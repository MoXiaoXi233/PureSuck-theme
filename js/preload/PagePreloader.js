/**
 * PureSuck PagePreloader - 页面预加载器
 * 在后台预加载页面，确保布局计算完成，提升页面切换性能
 * 
 * @module preload/PagePreloader
 */

import { eventBus } from '../core/EventBus.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';
import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';

/**
 * 预加载状态枚举
 * @readonly
 * @enum {string}
 */
export const PreloadState = {
    /** 空闲状态 */
    IDLE: 'idle',
    /** 正在获取HTML */
    FETCHING: 'fetching',
    /** 正在解析HTML */
    PARSING: 'parsing',
    /** 正在计算布局 */
    COMPUTING_LAYOUT: 'computing_layout',
    /** 预加载完成 */
    COMPLETED: 'completed',
    /** 预加载失败 */
    FAILED: 'failed'
};

/**
 * 预加载结果
 * @typedef {Object} PreloadResult
 * @property {string} html - HTML内容
 * @property {DocumentFragment} fragment - DOM片段
 * @property {Array<string>} scripts - 脚本URL列表
 * @property {Array<string>} stylesheets - 样式表URL列表
 * @property {Array<string>} images - 图片URL列表
 * @property {number} loadTime - 加载耗时(ms)
 * @property {number} parseTime - 解析耗时(ms)
 * @property {number} layoutTime - 布局计算耗时(ms)
 * @property {number} totalTime - 总耗时(ms)
 */

/**
 * 缓存条目
 * @typedef {Object} CacheEntry
 * @property {PreloadResult} result - 预加载结果
 * @property {number} timestamp - 缓存时间戳
 * @property {number} accessCount - 访问次数
 */

/**
 * PagePreloader - 页面预加载器类
 */
export class PagePreloader {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {boolean} [options.enableCache=true] - 是否启用缓存
     * @param {boolean} [options.preloadImages=true] - 是否预加载图片
     * @param {boolean} [options.preloadScripts=false] - 是否预加载脚本
     * @param {boolean} [options.preloadStylesheets=true] - 是否预加载样式表
     * @param {number} [options.maxCacheSize=5] - 最大缓存页面数（LRU）
     * @param {number} [options.maxPreloadTime=5000] - 最大预加载时间(ms)
     * @param {number} [options.layoutWaitFrames=2] - 等待布局计算的帧数
     * @param {boolean} [options.debug=false] - 是否启用调试模式
     */
    constructor(options = {}) {
        /**
         * 当前预加载状态
         * @type {PreloadState}
         * @private
         */
        this._state = PreloadState.IDLE;

        /**
         * 缓存Map（LRU策略）
         * @type {Map<string, CacheEntry>}
         * @private
         */
        this._cache = new Map();

        /**
         * 缓存访问顺序（用于LRU）
         * @type {Array<string>}
         * @private
         */
        this._cacheOrder = [];

        /**
         * 当前正在预加载的URL
         * @type {string|null}
         * @private
         */
        this._currentPreload = null;

        /**
         * 离屏DOM容器
         * @type {HTMLDivElement|null}
         * @private
         */
        this._offscreenContainer = null;

        /**
         * AbortController用于取消请求
         * @type {AbortController|null}
         * @private
         */
        this._abortController = null;

        // 配置选项
        this._enableCache = options.enableCache !== false;
        this._preloadImages = options.preloadImages !== false;
        this._preloadScripts = options.preloadScripts || false;
        this._preloadStylesheets = options.preloadStylesheets !== false;
        this._maxCacheSize = options.maxCacheSize || 5;
        this._maxPreloadTime = options.maxPreloadTime || 5000;
        this._layoutWaitFrames = options.layoutWaitFrames || 2;
        this._debug = options.debug || false;

        // 性能指标
        this._performanceMetrics = {
            fetchTime: 0,
            parseTime: 0,
            layoutTime: 0,
            resourcePreloadTime: 0,
            totalTime: 0
        };

        // 统计信息
        this._stats = {
            totalPreloads: 0,
            successfulPreloads: 0,
            failedPreloads: 0,
            cacheHits: 0,
            cacheMisses: 0
        };

        this._log('PagePreloader initialized with options:', options);
    }

    /**
     * 预加载页面
     * @public
     * @param {string} url - 目标URL
     * @returns {Promise<PreloadResult|null>} 预加载结果，失败时返回null
     */
    async preload(url) {
        // 参数验证
        if (!url || typeof url !== 'string') {
            const error = new Error('Invalid URL provided');
            this._handleError(error, {
                type: ErrorType.NETWORK,
                severity: ErrorSeverity.MEDIUM,
                message: '预加载URL无效'
            });
            return null;
        }

        // 检查缓存
        if (this._enableCache) {
            const cached = this.getCachedPage(url);
            if (cached) {
                this._stats.cacheHits++;
                this._log(`Cache hit for: ${url}`);
                eventBus.emit('page:preload:cached', { url, result: cached });
                return cached;
            }
            this._stats.cacheMisses++;
        }

        // 检查是否已在预加载中
        if (this._currentPreload === url && this._state !== PreloadState.IDLE) {
            this._log(`Already preloading: ${url}`);
            return null;
        }

        const startTime = performance.now();
        this._currentPreload = url;
        this._stats.totalPreloads++;

        try {
            // 发布预加载开始事件
            eventBus.emit('page:preload:start', { url });
            this._log(`Starting preload for: ${url}`);

            // 1. 获取HTML
            this._state = PreloadState.FETCHING;
            const html = await this._fetchHTML(url);
            if (!html) {
                throw new Error('Failed to fetch HTML');
            }

            // 2. 创建离屏容器并解析
            this._state = PreloadState.PARSING;
            const container = this._createOffscreenContainer();
            const fragment = this._parseHTML(html, container);

            // 3. 等待布局计算
            this._state = PreloadState.COMPUTING_LAYOUT;
            await this._waitForLayoutCalculation(container);

            // 4. 提取资源
            const resources = this._extractResources(fragment);

            // 5. 预加载资源
            if (this._preloadImages || this._preloadScripts || this._preloadStylesheets) {
                await this._preloadResources(resources);
            }

            // 6. 构建结果
            const result = {
                html,
                fragment,
                scripts: resources.scripts,
                stylesheets: resources.stylesheets,
                images: resources.images,
                loadTime: this._performanceMetrics.fetchTime,
                parseTime: this._performanceMetrics.parseTime,
                layoutTime: this._performanceMetrics.layoutTime,
                totalTime: performance.now() - startTime
            };

            // 7. 缓存结果
            if (this._enableCache) {
                this._cachePage(url, result);
            }

            // 8. 清理
            this._cleanupOffscreenContainer();

            // 9. 更新状态
            this._state = PreloadState.COMPLETED;
            this._stats.successfulPreloads++;

            // 10. 发布完成事件
            eventBus.emit('page:preload:complete', {
                url,
                result,
                metrics: this._performanceMetrics
            });

            this._log(`Preload completed for: ${url} in ${result.totalTime.toFixed(2)}ms`);
            return result;

        } catch (error) {
            // 错误处理
            this._state = PreloadState.FAILED;
            this._stats.failedPreloads++;
            this._cleanupOffscreenContainer();

            this._handleError(error, {
                type: ErrorType.NETWORK,
                severity: ErrorSeverity.MEDIUM,
                message: `预加载失败: ${url}`,
                metadata: { url }
            });

            eventBus.emit('page:preload:error', {
                url,
                error: error.message
            });

            this._log(`Preload failed for: ${url}`, error);
            return null;

        } finally {
            this._currentPreload = null;
            this._abortController = null;
        }
    }

    /**
     * 获取缓存的页面
     * @public
     * @param {string} url - 目标URL
     * @returns {PreloadResult|null} 缓存的预加载结果
     */
    getCachedPage(url) {
        if (!this._enableCache) return null;

        const entry = this._cache.get(url);
        if (!entry) return null;

        // 更新访问时间（LRU）
        entry.accessCount++;
        entry.timestamp = Date.now();
        
        // 更新访问顺序
        const index = this._cacheOrder.indexOf(url);
        if (index > -1) {
            this._cacheOrder.splice(index, 1);
        }
        this._cacheOrder.push(url);

        this._log(`Cache retrieved for: ${url} (access count: ${entry.accessCount})`);
        return entry.result;
    }

    /**
     * 清除缓存
     * @public
     * @param {string} [url] - 可选，指定URL只清除该页面的缓存
     */
    clearCache(url) {
        if (url) {
            this._cache.delete(url);
            const index = this._cacheOrder.indexOf(url);
            if (index > -1) {
                this._cacheOrder.splice(index, 1);
            }
            this._log(`Cache cleared for: ${url}`);
        } else {
            this._cache.clear();
            this._cacheOrder = [];
            this._log('All cache cleared');
        }
    }

    /**
     * 取消当前预加载
     * @public
     */
    cancel() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
            this._log('Preload cancelled');
        }
        this._currentPreload = null;
        this._state = PreloadState.IDLE;
    }

    /**
     * 获取当前状态
     * @public
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            state: this._state,
            currentPreload: this._currentPreload,
            cacheSize: this._cache.size,
            maxCacheSize: this._maxCacheSize,
            performanceMetrics: { ...this._performanceMetrics },
            stats: { ...this._stats }
        };
    }

    /**
     * 获取性能指标
     * @public
     * @returns {Object} 性能指标
     */
    getPerformanceMetrics() {
        return {
            ...this._performanceMetrics,
            cacheHitRate: this._stats.totalPreloads > 0
                ? (this._stats.cacheHits / this._stats.totalPreloads * 100).toFixed(2) + '%'
                : '0%',
            successRate: this._stats.totalPreloads > 0
                ? (this._stats.successfulPreloads / this._stats.totalPreloads * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * 销毁预加载器
     * @public
     */
    destroy() {
        this.cancel();
        this._cleanupOffscreenContainer();
        this.clearCache();
        this._state = PreloadState.IDLE;
        this._log('PagePreloader destroyed');
    }

    // ==================== 私有方法 ====================

    /**
     * 获取页面HTML
     * @private
     * @param {string} url - 目标URL
     * @returns {Promise<string>} HTML内容
     */
    async _fetchHTML(url) {
        const startTime = performance.now();
        this._abortController = new AbortController();
        const signal = this._abortController.signal;

        try {
            // 设置超时
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Fetch timeout after ${this._maxPreloadTime}ms`));
                }, this._maxPreloadTime);
            });

            // 执行fetch
            const fetchPromise = fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                signal
            });

            const response = await Promise.race([fetchPromise, timeoutPromise]);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            this._performanceMetrics.fetchTime = performance.now() - startTime;
            this._log(`Fetched HTML in ${this._performanceMetrics.fetchTime.toFixed(2)}ms`);

            return html;

        } catch (error) {
            if (error.name === 'AbortError') {
                this._log('Fetch aborted');
                throw new Error('Preload cancelled');
            }
            throw error;
        }
    }

    /**
     * 创建离屏容器
     * @private
     * @returns {HTMLDivElement} 离屏容器
     */
    _createOffscreenContainer() {
        if (this._offscreenContainer) {
            return this._offscreenContainer;
        }

        const container = document.createElement('div');
        container.className = 'puresuck-preloader-offscreen';
        container.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            visibility: hidden;
            pointer-events: none;
            z-index: -1;
            display: none;
        `;
        document.body.appendChild(container);
        this._offscreenContainer = container;

        this._log('Offscreen container created');
        return container;
    }

    /**
     * 解析HTML并插入到容器
     * @private
     * @param {string} html - HTML内容
     * @param {HTMLDivElement} container - 离屏容器
     * @returns {DocumentFragment} DOM片段
     */
    _parseHTML(html, container) {
        const startTime = performance.now();

        // 创建模板元素进行解析
        const template = document.createElement('template');
        template.innerHTML = html;

        // 获取内容片段
        const fragment = template.content;

        // 插入到离屏容器
        container.appendChild(fragment);
        container.style.display = 'block';

        this._performanceMetrics.parseTime = performance.now() - startTime;
        this._log(`HTML parsed in ${this._performanceMetrics.parseTime.toFixed(2)}ms`);

        return fragment;
    }

    /**
     * 等待布局计算完成
     * @private
     * @param {HTMLDivElement} container - 离屏容器
     * @returns {Promise<void>}
     */
    async _waitForLayoutCalculation(container) {
        const startTime = performance.now();

        // 强制触发重排
        void container.offsetHeight;

        // 等待多帧以确保布局完全计算
        for (let i = 0; i < this._layoutWaitFrames; i++) {
            await new Promise(resolve => requestAnimationFrame(resolve));
            // 每帧都强制触发重排
            void container.offsetHeight;
        }

        this._performanceMetrics.layoutTime = performance.now() - startTime;
        this._log(`Layout computed in ${this._performanceMetrics.layoutTime.toFixed(2)}ms`);
    }

    /**
     * 提取资源URL
     * @private
     * @param {DocumentFragment} fragment - DOM片段
     * @returns {Object} 资源对象
     */
    _extractResources(fragment) {
        const scripts = [];
        const stylesheets = [];
        const images = [];

        // 提取脚本
        const scriptElements = fragment.querySelectorAll('script[src]');
        scriptElements.forEach(script => {
            const src = script.getAttribute('src');
            if (src && !scripts.includes(src)) {
                scripts.push(src);
            }
        });

        // 提取样式表
        const linkElements = fragment.querySelectorAll('link[rel="stylesheet"]');
        linkElements.forEach(link => {
            const href = link.getAttribute('href');
            if (href && !stylesheets.includes(href)) {
                stylesheets.push(href);
            }
        });

        // 提取图片
        const imgElements = fragment.querySelectorAll('img[src]');
        imgElements.forEach(img => {
            const src = img.getAttribute('src');
            if (src && !images.includes(src)) {
                images.push(src);
            }
        });

        // 提取背景图片
        const elementsWithBg = fragment.querySelectorAll('[style*="background-image"]');
        elementsWithBg.forEach(el => {
            const style = el.style.backgroundImage;
            const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (match && match[1] && !images.includes(match[1])) {
                images.push(match[1]);
            }
        });

        this._log(`Extracted resources: ${scripts.length} scripts, ${stylesheets.length} stylesheets, ${images.length} images`);

        return { scripts, stylesheets, images };
    }

    /**
     * 预加载资源
     * @private
     * @param {Object} resources - 资源对象
     * @returns {Promise<void>}
     */
    async _preloadResources(resources) {
        const startTime = performance.now();
        const promises = [];

        // 预加载图片
        if (this._preloadImages && resources.images.length > 0) {
            promises.push(this._preloadImages(resources.images));
        }

        // 预加载脚本
        if (this._preloadScripts && resources.scripts.length > 0) {
            promises.push(this._preloadScriptsList(resources.scripts));
        }

        // 预加载样式表
        if (this._preloadStylesheets && resources.stylesheets.length > 0) {
            promises.push(this._preloadStylesheetsList(resources.stylesheets));
        }

        await Promise.allSettled(promises);

        this._performanceMetrics.resourcePreloadTime = performance.now() - startTime;
        this._log(`Resources preloaded in ${this._performanceMetrics.resourcePreloadTime.toFixed(2)}ms`);
    }

    /**
     * 预加载图片列表
     * @private
     * @param {Array<string>} urls - 图片URL列表
     * @returns {Promise<void>}
     */
    async _preloadImages(urls) {
        const promises = urls.map(url => {
            return new Promise((resolve) => {
                const img = new Image();
                img.loading = 'eager';
                
                img.onload = () => {
                    this._log(`Image preloaded: ${url}`);
                    resolve();
                };
                
                img.onerror = () => {
                    this._log(`Image preload failed: ${url}`, 'warn');
                    resolve(); // 不阻塞其他资源
                };
                
                img.src = url;
            });
        });

        await Promise.allSettled(promises);
    }

    /**
     * 预加载脚本列表
     * @private
     * @param {Array<string>} urls - 脚本URL列表
     * @returns {Promise<void>}
     */
    async _preloadScriptsList(urls) {
        const promises = urls.map(async (url) => {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    this._log(`Script preloaded: ${url}`);
                    // 释放对象URL
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                }
            } catch (error) {
                this._log(`Script preload failed: ${url}`, 'warn');
            }
        });

        await Promise.allSettled(promises);
    }

    /**
     * 预加载样式表列表
     * @private
     * @param {Array<string>} urls - 样式表URL列表
     * @returns {Promise<void>}
     */
    async _preloadStylesheetsList(urls) {
        const promises = urls.map(url => {
            return new Promise((resolve) => {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'style';
                link.href = url;
                
                link.onload = () => {
                    this._log(`Stylesheet preloaded: ${url}`);
                    resolve();
                };
                
                link.onerror = () => {
                    this._log(`Stylesheet preload failed: ${url}`, 'warn');
                    resolve();
                };
                
                document.head.appendChild(link);
            });
        });

        await Promise.allSettled(promises);
    }

    /**
     * 缓存页面
     * @private
     * @param {string} url - URL
     * @param {PreloadResult} result - 预加载结果
     */
    _cachePage(url, result) {
        // 如果缓存已满，移除最旧的条目
        if (this._cache.size >= this._maxCacheSize) {
            const oldestUrl = this._cacheOrder.shift();
            if (oldestUrl) {
                this._cache.delete(oldestUrl);
                this._log(`Cache evicted: ${oldestUrl}`);
            }
        }

        // 添加新条目
        this._cache.set(url, {
            result,
            timestamp: Date.now(),
            accessCount: 1
        });
        this._cacheOrder.push(url);

        this._log(`Page cached: ${url} (cache size: ${this._cache.size}/${this._maxCacheSize})`);
    }

    /**
     * 清理离屏容器
     * @private
     */
    _cleanupOffscreenContainer() {
        if (this._offscreenContainer) {
            this._offscreenContainer.remove();
            this._offscreenContainer = null;
            this._log('Offscreen container cleaned up');
        }
    }

    /**
     * 处理错误
     * @private
     * @param {Error} error - 错误对象
     * @param {Object} context - 错误上下文
     */
    _handleError(error, context) {
        ErrorBoundary.handle(error, context);
    }

    /**
     * 日志输出
     * @private
     * @param {string} message - 日志消息
     * @param {string} [level='log'] - 日志级别
     * @param {...any} args - 额外参数
     */
    _log(message, level = 'log', ...args) {
        if (!this._debug) return;

        const prefix = '[PagePreloader]';
        const timestamp = new Date().toISOString();

        switch (level) {
            case 'warn':
                console.warn(`${prefix} [${timestamp}] ${message}`, ...args);
                break;
            case 'error':
                console.error(`${prefix} [${timestamp}] ${message}`, ...args);
                break;
            default:
                console.log(`${prefix} [${timestamp}] ${message}`, ...args);
        }
    }
}

// 创建全局单例
export const pagePreloader = new PagePreloader({
    enableCache: true,
    preloadImages: true,
    preloadScripts: false,
    preloadStylesheets: true,
    maxCacheSize: 5,
    maxPreloadTime: 5000,
    debug: false
});
