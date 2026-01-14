/**
 * PureSuck LazyLoader - 统一的懒加载管理器
 * 支持图片懒加载、内容懒加载和预加载策略
 * 
 * @module rendering/LazyLoader
 */

import { eventBus } from '../core/EventBus.js';
import { visibilityManager } from './VisibilityManager.js';
import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

/**
 * 懒加载类型枚举
 * @readonly
 * @enum {string}
 */
export const LazyLoadType = {
    /** 图片懒加载 */
    IMAGE: 'image',
    /** 内容懒加载 */
    CONTENT: 'content',
    /** 预加载 */
    PRELOAD: 'preload'
};

/**
 * 加载状态枚举
 * @readonly
 * @enum {string}
 */
export const LoadState = {
    /** 等待加载 */
    PENDING: 'pending',
    /** 加载中 */
    LOADING: 'loading',
    /** 加载完成 */
    LOADED: 'loaded',
    /** 加载失败 */
    FAILED: 'failed'
};

/**
 * 懒加载配置
 * @typedef {Object} LazyLoadOptions
 * @property {string} [type='image'] - 懒加载类型
 * @property {string} [src] - 图片源地址
 * @property {string} [srcset] - 图片源集
 * @property {string} [sizes] - 图片尺寸
 * @property {Function} [onLoad] - 加载成功回调
 * @property {Function} [onError] - 加载失败回调
 * @property {Function} [onProgress] - 加载进度回调
 * @property {boolean} [preload=false] - 是否预加载
 * @property {number} [threshold=0.01] - 可见性阈值
 * @property {string} [rootMargin='200px 0px'] - 根边距
 * @property {boolean} [once=true] - 是否只加载一次
 */

/**
 * 懒加载项
 * @typedef {Object} LazyLoadItem
 * @property {Element} element - 目标元素
 * @property {LazyLoadOptions} options - 加载选项
 * @property {LoadState} state - 加载状态
 * @property {number} timestamp - 创建时间戳
 * @property {IntersectionObserver} observer - 观察器实例
 */

/**
 * 懒加载管理器类
 */
export class LazyLoader {
    constructor() {
        /** @type {Map<string, LazyLoadItem>} - 懒加载项映射 */
        this.items = new Map();
        
        /** @type {Set<string>} - 预加载队列 */
        this.preloadQueue = new Set();
        
        /** @type {boolean} - 是否启用 */
        this.enabled = true;
        
        /** @type {number} - 预加载距离(px) */
        this.preloadDistance = 1000;
        
        /** @type {boolean} - 是否启用预加载 */
        this.preloadEnabled = true;
        
        /** @type {WeakMap<Element, string>} - 元素到ID的映射 */
        this.elementToId = new WeakMap();
        
        /** @type {Map<string, Function>} - 取消回调映射 */
        this.cancelCallbacks = new Map();
        
        /** @type {IntersectionObserver|null} - 默认观察器 */
        this.defaultObserver = null;
        
        /** @type {IntersectionObserver|null} - 预加载观察器 */
        this.preloadObserver = null;
        
        this.init();
    }

    /**
     * 初始化
     */
    init() {
        if (typeof IntersectionObserver !== 'function') {
            console.warn('[LazyLoader] IntersectionObserver not supported');
            this.enabled = false;
            return;
        }

        // 创建默认观察器
        this.defaultObserver = new IntersectionObserver(
            this.handleIntersection.bind(this),
            {
                rootMargin: '200px 0px',
                threshold: 0.01
            }
        );

        // 创建预加载观察器
        this.preloadObserver = new IntersectionObserver(
            this.handlePreload.bind(this),
            {
                rootMargin: '1200px 0px',
                threshold: 0
            }
        );

        console.log('[LazyLoader] Initialized');
    }

    /**
     * 处理交叉观察回调
     * @param {IntersectionObserverEntry[]} entries - 观察条目
     */
    handleIntersection(entries) {
        for (const entry of entries) {
            const id = this.elementToId.get(entry.target);
            if (!id) continue;

            const item = this.items.get(id);
            if (!item) continue;

            if (entry.isIntersecting) {
                // 元素可见，开始加载
                this.loadItem(id);
            }
        }
    }

    /**
     * 处理预加载回调
     * @param {IntersectionObserverEntry[]} entries - 观察条目
     */
    handlePreload(entries) {
        if (!this.preloadEnabled) return;

        for (const entry of entries) {
            const id = this.elementToId.get(entry.target);
            if (!id) continue;

            const item = this.items.get(id);
            if (!item || item.state !== LoadState.PENDING) continue;

            // 添加到预加载队列
            this.preloadQueue.add(id);
        }

        // 批量处理预加载
        this.processPreloadQueue();
    }

    /**
     * 处理预加载队列
     */
    processPreloadQueue() {
        if (this.preloadQueue.size === 0) return;

        // 使用高性能配置，现代设备普遍为高刷
        const maxPreloadPerFrame = 3;

        let count = 0;
        for (const id of this.preloadQueue) {
            if (count >= maxPreloadPerFrame) break;

            const item = this.items.get(id);
            if (item && item.state === LoadState.PENDING) {
                this.preloadItem(id);
                count++;
            }

            this.preloadQueue.delete(id);
        }

        // 如果还有预加载任务，继续调度
        if (this.preloadQueue.size > 0) {
            requestAnimationFrame(() => this.processPreloadQueue());
        }
    }

    /**
     * 观察元素
     * @param {Element} element - 要观察的元素
     * @param {LazyLoadOptions} options - 加载选项
     * @returns {string|null} 懒加载项ID
     */
    observe(element, options = {}) {
        if (!this.enabled) {
            console.warn('[LazyLoader] Lazy loading is disabled');
            return null;
        }

        if (!element || typeof element.nodeType !== 'number') {
            console.warn('[LazyLoader] Invalid element');
            return null;
        }

        const id = `lazy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const item = {
            element,
            options: {
                type: LazyLoadType.IMAGE,
                threshold: 0.01,
                rootMargin: '200px 0px',
                once: true,
                preload: false,
                ...options
            },
            state: LoadState.PENDING,
            timestamp: Date.now(),
            observer: null
        };

        // 存储懒加载项
        this.items.set(id, item);
        this.elementToId.set(element, id);

        // 根据类型选择观察器
        const observer = options.preload ? this.preloadObserver : this.defaultObserver;
        if (observer) {
            observer.observe(element);
            item.observer = observer;
        }

        // 发布事件
        eventBus.emit('lazy:observe', { id, element, options });

        console.log(`[LazyLoader] Observed element: ${id}, type: ${item.options.type}`);

        return id;
    }

    /**
     * 取消观察元素
     * @param {string} id - 懒加载项ID
     */
    unobserve(id) {
        const item = this.items.get(id);
        if (!item) return;

        // 取消观察
        if (item.observer) {
            item.observer.unobserve(item.element);
        }

        // 取消加载
        const cancelCallback = this.cancelCallbacks.get(id);
        if (cancelCallback) {
            try {
                cancelCallback();
            } catch (error) {
                console.error(`[LazyLoader] Error canceling load ${id}:`, error);
            }
            this.cancelCallbacks.delete(id);
        }

        // 从预加载队列移除
        this.preloadQueue.delete(id);

        // 清理映射
        this.elementToId.delete(item.element);
        this.items.delete(id);

        // 发布事件
        eventBus.emit('lazy:unobserve', { id });

        console.log(`[LazyLoader] Unobserved element: ${id}`);
    }

    /**
     * 立即加载元素
     * @param {string} id - 懒加载项ID
     * @returns {Promise<void>} 加载Promise
     */
    async loadNow(id) {
        const item = this.items.get(id);
        if (!item) {
            console.warn(`[LazyLoader] Item not found: ${id}`);
            return;
        }

        // 取消观察
        if (item.observer) {
            item.observer.unobserve(item.element);
        }

        // 从预加载队列移除
        this.preloadQueue.delete(id);

        // 加载项
        return this.loadItem(id);
    }

    /**
     * 加载懒加载项
     * @param {string} id - 懒加载项ID
     * @returns {Promise<void>} 加载Promise
     */
    async loadItem(id) {
        const item = this.items.get(id);
        if (!item || item.state !== LoadState.PENDING) return;

        item.state = LoadState.LOADING;

        try {
            // 根据类型加载
            if (item.options.type === LazyLoadType.IMAGE) {
                await this.loadImage(item);
            } else if (item.options.type === LazyLoadType.CONTENT) {
                await this.loadContent(item);
            }

            item.state = LoadState.LOADED;

            // 触发成功回调
            if (typeof item.options.onLoad === 'function') {
                try {
                    item.options.onLoad(item.element, item.options);
                } catch (error) {
                    console.error(`[LazyLoader] Error in onLoad callback for ${id}:`, error);
                }
            }

            // 发布事件
            eventBus.emit('lazy:loaded', { id, element: item.element, options: item.options });

            console.log(`[LazyLoader] Loaded: ${id}`);

        } catch (error) {
            item.state = LoadState.FAILED;

            // 错误处理
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.LOW,
                message: '懒加载失败',
                metadata: { id, type: item.options.type }
            });

            // 触发失败回调
            if (typeof item.options.onError === 'function') {
                try {
                    item.options.onError(item.element, error, item.options);
                } catch (callbackError) {
                    console.error(`[LazyLoader] Error in onError callback for ${id}:`, callbackError);
                }
            }

            // 发布事件
            eventBus.emit('lazy:failed', { id, element: item.element, error });

            console.error(`[LazyLoader] Failed to load: ${id}`, error);
        }

        // 如果是一次性加载，取消观察
        if (item.options.once && item.observer) {
            item.observer.unobserve(item.element);
            item.observer = null;
        }
    }

    /**
     * 预加载懒加载项
     * @param {string} id - 懒加载项ID
     */
    async preloadItem(id) {
        const item = this.items.get(id);
        if (!item || item.state !== LoadState.PENDING) return;

        try {
            // 根据类型预加载
            if (item.options.type === LazyLoadType.IMAGE) {
                await this.preloadImage(item);
            } else if (item.options.type === LazyLoadType.CONTENT) {
                await this.preloadContent(item);
            }

            // 发布事件
            eventBus.emit('lazy:preloaded', { id, element: item.element });

            console.log(`[LazyLoader] Preloaded: ${id}`);

        } catch (error) {
            // 预加载失败不影响主加载
            console.warn(`[LazyLoader] Preload failed for ${id}:`, error);
        }
    }

    /**
     * 加载图片
     * @param {LazyLoadItem} item - 懒加载项
     * @returns {Promise<void>}
     */
    loadImage(item) {
        return new Promise((resolve, reject) => {
            const { element, options } = item;
            const { src, srcset, sizes } = options;

            if (!src) {
                reject(new Error('No src specified'));
                return;
            }

            // 创建图片对象
            const img = new Image();

            // 设置取消回调
            const cancelCallback = () => {
                img.src = '';
                reject(new Error('Load cancelled'));
            };
            this.cancelCallbacks.set(
                this.elementToId.get(element),
                cancelCallback
            );

            // 加载成功
            img.onload = () => {
                this.cancelCallbacks.delete(this.elementToId.get(element));
                
                // 更新元素属性
                if (element.tagName === 'IMG') {
                    element.src = src;
                    if (srcset) element.srcset = srcset;
                    if (sizes) element.sizes = sizes;
                } else {
                    element.style.backgroundImage = `url(${src})`;
                }

                // 添加加载完成类
                element.classList.add('lazy-loaded');
                element.classList.remove('lazy-loading');

                resolve();
            };

            // 加载失败
            img.onerror = () => {
                this.cancelCallbacks.delete(this.elementToId.get(element));
                
                element.classList.add('lazy-error');
                element.classList.remove('lazy-loading');

                reject(new Error(`Failed to load image: ${src}`));
            };

            // 开始加载
            element.classList.add('lazy-loading');
            img.src = src;
            if (srcset) img.srcset = srcset;
        });
    }

    /**
     * 预加载图片
     * @param {LazyLoadItem} item - 懒加载项
     * @returns {Promise<void>}
     */
    preloadImage(item) {
        return new Promise((resolve, reject) => {
            const { options } = item;
            const { src, srcset } = options;

            if (!src) {
                reject(new Error('No src specified'));
                return;
            }

            const img = new Image();

            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Failed to preload image: ${src}`));

            img.src = src;
            if (srcset) img.srcset = srcset;
        });
    }

    /**
     * 加载内容
     * @param {LazyLoadItem} item - 懒加载项
     * @returns {Promise<void>}
     */
    async loadContent(item) {
        const { element, options } = item;

        // 显示元素
        element.style.opacity = '1';
        element.style.visibility = 'visible';
        element.classList.add('lazy-loaded');
        element.classList.remove('lazy-loading');

        // 如果有自定义加载函数
        if (typeof options.load === 'function') {
            await options.load(element);
        }
    }

    /**
     * 预加载内容
     * @param {LazyLoadItem} item - 懒加载项
     * @returns {Promise<void>}
     */
    async preloadContent(item) {
        const { options } = item;

        // 如果有自定义预加载函数
        if (typeof options.preloadFn === 'function') {
            await options.preloadFn(item.element);
        }
    }

    /**
     * 批量观察元素
     * @param {Element[]} elements - 元素数组
     * @param {LazyLoadOptions} options - 加载选项
     * @returns {string[]} 懒加载项ID数组
     */
    observeMany(elements, options = {}) {
        if (!Array.isArray(elements)) {
            console.warn('[LazyLoader] Elements must be an array');
            return [];
        }

        const ids = [];
        for (const element of elements) {
            const id = this.observe(element, options);
            if (id) ids.push(id);
        }

        return ids;
    }

    /**
     * 批量取消观察
     * @param {string[]} ids - 懒加载项ID数组
     */
    unobserveMany(ids) {
        for (const id of ids) {
            this.unobserve(id);
        }
    }

    /**
     * 立即加载所有元素
     * @returns {Promise<void>}
     */
    async loadAll() {
        const ids = Array.from(this.items.keys());
        const promises = ids.map(id => this.loadNow(id));
        await Promise.all(promises);
    }

    /**
     * 清空所有懒加载项
     */
    clear() {
        // 取消所有观察
        for (const [id, item] of this.items) {
            if (item.observer) {
                item.observer.unobserve(item.element);
            }

            const cancelCallback = this.cancelCallbacks.get(id);
            if (cancelCallback) {
                try {
                    cancelCallback();
                } catch (error) {
                    console.error(`[LazyLoader] Error canceling load ${id}:`, error);
                }
            }
        }

        // 清空映射
        this.items.clear();
        this.elementToId = new WeakMap();
        this.cancelCallbacks.clear();
        this.preloadQueue.clear();

        console.log('[LazyLoader] Cleared all items');
    }

    /**
     * 获取懒加载项状态
     * @param {string} id - 懒加载项ID
     * @returns {Object|null} 状态信息
     */
    getItemStatus(id) {
        const item = this.items.get(id);
        if (!item) return null;

        return {
            id,
            state: item.state,
            type: item.options.type,
            timestamp: item.timestamp,
            element: item.element
        };
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        const stats = {
            total: this.items.size,
            byState: {
                pending: 0,
                loading: 0,
                loaded: 0,
                failed: 0
            },
            byType: {
                image: 0,
                content: 0,
                preload: 0
            },
            preloadQueue: this.preloadQueue.size,
            enabled: this.enabled
        };

        for (const item of this.items.values()) {
            stats.byState[item.state]++;
            stats.byType[item.options.type]++;
        }

        return stats;
    }

    /**
     * 启用预加载
     */
    enablePreload() {
        this.preloadEnabled = true;
        console.log('[LazyLoader] Preload enabled');
    }

    /**
     * 禁用预加载
     */
    disablePreload() {
        this.preloadEnabled = false;
        this.preloadQueue.clear();
        console.log('[LazyLoader] Preload disabled');
    }

    /**
     * 启用懒加载
     */
    enable() {
        this.enabled = true;
        console.log('[LazyLoader] Enabled');
    }

    /**
     * 禁用懒加载
     */
    disable() {
        this.enabled = false;
        console.log('[LazyLoader] Disabled');
    }

    /**
     * 销毁
     */
    destroy() {
        this.clear();

        if (this.defaultObserver) {
            this.defaultObserver.disconnect();
            this.defaultObserver = null;
        }

        if (this.preloadObserver) {
            this.preloadObserver.disconnect();
            this.preloadObserver = null;
        }

        console.log('[LazyLoader] Destroyed');
    }
}

// 创建全局单例
export const lazyLoader = new LazyLoader();
