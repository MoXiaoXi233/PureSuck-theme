/**
 * PureSuck 分层渲染器
 * 功能: 渐进式渲染页面内容，优化感知性能
 * 策略: Layer 1 动画 -> Layer 2 关键内容 -> Layer 3 正文 -> Layer 4 懒加载
 * 作者: Kilo Code
 * 版本: 1.0.0
 */

class LayeredRenderer {
    constructor() {
        // 渲染层级时间配置 (ms)
        this.layers = {
            L1_ANIMATION: 0,      // 卡片壳动画（由 VT Controller 处理）
            L2_CRITICAL: 450,     // 关键内容（标题+封面+元数据）
            L3_CONTENT: 600,      // 正文内容
            L4_RESOURCES: 1000    // 懒加载资源（图片+代码高亮+评论）
        };

        // 渲染配置
        this.config = {
            fadeInDuration: 280,        // 渐显动画时长
            fadeTiming: 'ease',         // 渐显缓动
            skeletonTimeout: 1000,      // 骨架屏超时
            idleTimeout: 2000           // requestIdleCallback 超时
        };

        // 性能监控
        this.stats = {
            total: 0,
            cacheHits: 0,
            cacheMisses: 0,
            avgL2Time: 0,
            avgL3Time: 0
        };

        // 当前渲染状态
        this.isRendering = false;
    }

    /**
     * 渲染页面内容（主入口）
     * ⚠️ 新架构: Pjax已经替换DOM，这里只负责延迟加载非关键资源
     * @param {string} url - 目标 URL
     * @param {HTMLElement} targetContainer - 目标容器
     * @returns {Promise} 渲染完成的 Promise
     */
    async render(url, targetContainer) {
        if (this.isRendering) {
            console.warn('[Renderer] 渲染进行中，忽略新请求');
            return;
        }

        this.isRendering = true;
        this.stats.total++;

        try {
            // 检查是否有缓存(仅用于统计)
            const cached = window.preloader?.getCache(url);
            if (cached) {
                this.stats.cacheHits++;
            } else {
                this.stats.cacheMisses++;
            }

            // ⚠️ 重要: Pjax 已经完成 DOM 替换
            // 我们只需要在适当时机执行懒加载任务

            // Layer 4: 延迟执行懒加载任务
            this.scheduleLazyLoad(targetContainer);

        } catch (error) {
            console.error('[Renderer] 调度失败:', error);
        } finally {
            this.isRendering = false;
        }
    }

    /**
     * 调度懒加载（Layer 4）
     * @param {HTMLElement} container - 容器元素
     */
    scheduleLazyLoad(container) {
        const callback = () => this.renderLayer4(container);

        if ('requestIdleCallback' in window) {
            requestIdleCallback(callback, { 
                timeout: this.config.idleTimeout 
            });
        } else {
            setTimeout(callback, this.layers.L4_RESOURCES);
        }
    }

    /**
     * 渲染 Layer 4：懒加载资源
     * @param {HTMLElement} container - 容器元素
     */
    renderLayer4(container) {
        // 懒加载图片
        this.lazyLoadImages(container);

        // 代码高亮
        this.highlightCode(container);

        // 初始化评论系统
        this.initializeComments(container);

        // 初始化其他交互组件
        this.initializeInteractions(container);
    }

    /**
     * 懒加载图片
     * @param {HTMLElement} container - 容器元素
     */
    lazyLoadImages(container) {
        const images = container.querySelectorAll('img[data-src], img[loading="lazy"]');

        if (images.length === 0) return;

        if ('IntersectionObserver' in window) {
            const imgObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        
                        // 加载图片
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        
                        imgObserver.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px'
            });

            images.forEach(img => imgObserver.observe(img));
        } else {
            // 降级：直接加载所有图片
            images.forEach(img => {
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
            });
        }
    }

    /**
     * 代码高亮
     * @param {HTMLElement} container - 容器元素
     */
    highlightCode(container) {
        if (typeof hljs === 'undefined') return;

        const codeBlocks = container.querySelectorAll('pre code:not(.hljs):not([data-highlighted])');

        if (codeBlocks.length === 0) return;

        codeBlocks.forEach(block => {
            try {
                hljs.highlightElement(block);
                block.dataset.highlighted = 'true';
            } catch (error) {
                console.warn('[Renderer] 代码高亮失败:', error);
            }
        });
    }

    /**
     * 初始化评论系统
     * @param {HTMLElement} container - 容器元素
     */
    initializeComments(container) {
        const commentTextarea = container.querySelector('.OwO-textarea');

        if (commentTextarea && typeof initializeCommentsOwO === 'function') {
            initializeCommentsOwO();
        }
    }

    /**
     * 初始化交互组件
     * @param {HTMLElement} container - 容器元素
     */
    initializeInteractions(container) {
        // 图片缩放（已在 PureSuck_Module.js 中统一处理，这里不再重复初始化）
        // 避免 PJAX 后重复初始化导致配置丢失

        // TOC 目录
        if (typeof initializeStickyTOC === 'function') {
            initializeStickyTOC();
        }

        // Shortcodes
        if (typeof runShortcodes === 'function') {
            runShortcodes();
        }
    }

    /**
     * 渲染骨架屏
     * @param {HTMLElement} container - 容器元素
     */
    renderSkeleton(container) {
        const contentElement = container.querySelector('.post-content');
        if (contentElement) {
            // 使用现有卡片内容作为占位符，添加加载提示
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-loading';
            skeleton.innerHTML = '<span>正在加载...</span>';
            
            contentElement.innerHTML = '';
            contentElement.appendChild(skeleton);

            // 超时后显示错误
            setTimeout(() => {
                if (skeleton.parentElement === contentElement) {
                    skeleton.innerHTML = '<span>加载超时，请刷新页面</span>';
                }
            }, this.config.skeletonTimeout);
        }
    }

    /**
     * 渲染错误信息
     * @param {HTMLElement} container - 容器元素
     * @param {Error} error - 错误对象
     */
    renderError(container, error) {
        console.error('[Renderer] 渲染错误:', error);

        const contentElement = container.querySelector('.post-content');
        if (contentElement) {
            contentElement.innerHTML = `
                <div class="render-error" style="padding: 2rem; text-align: center; color: var(--text2-color);">
                    <p>⚠️ 加载失败</p>
                    <p style="font-size: 0.9rem; opacity: 0.7;">${error.message}</p>
                    <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; border: 1px solid; border-radius: 4px; cursor: pointer;">
                        刷新页面
                    </button>
                </div>
            `;
        }
    }

    /**
     * 渐显更新元素内容
     * @param {HTMLElement} element - 目标元素
     * @param {Function} updateFn - 更新函数
     * @returns {Promise} 动画完成的 Promise
     */
    fadeUpdate(element, updateFn) {
        return new Promise((resolve) => {
            // 淡出
            element.style.opacity = '0';
            element.style.transition = `opacity ${this.config.fadeInDuration}ms ${this.config.fadeTiming}`;

            setTimeout(() => {
                // 更新内容
                updateFn();

                // 淡入
                requestAnimationFrame(() => {
                    element.style.opacity = '1';
                    
                    setTimeout(() => {
                        element.style.transition = '';
                        resolve();
                    }, this.config.fadeInDuration);
                });
            }, 50);
        });
    }

    /**
     * 预加载图片
     * @param {string} src - 图片 URL
     * @returns {Promise<HTMLImageElement>} 加载完成的图片
     */
    preloadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
            
            img.src = src;
        });
    }

    /**
     * 获取完整页面 HTML
     * @param {string} url - URL
     * @returns {Promise<string>} HTML 字符串
     */
    async fetchFullPage(url) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
    }

    /**
     * 从 HTML 提取数据
     * @param {string} html - HTML 字符串
     * @returns {Object} 提取的数据
     */
    extractData(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        return {
            title: doc.querySelector('.post-title')?.textContent?.trim() || '',
            cover: doc.querySelector('.post-media img')?.src || '',
            author: doc.querySelector('.post-author .avatar-item:last-child')?.textContent?.trim() || '',
            meta: doc.querySelector('.meta.post-meta')?.innerHTML || '',
            content: doc.querySelector('.post-content')?.innerHTML || '',
            pageTitle: doc.querySelector('title')?.textContent || '',
            fullHTML: html
        };
    }

    /**
     * 更新平均时间统计
     * @param {string} key - 统计键名
     * @param {number} time - 新时间
     */
    updateAvgTime(key, time) {
        const count = this.stats.total;
        const oldAvg = this.stats[key];
        this.stats[key] = (oldAvg * (count - 1) + time) / count;
    }

    /**
     * 获取性能统计
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            ...this.stats,
            cacheHitRate: this.stats.total > 0
                ? Math.round((this.stats.cacheHits / this.stats.total) * 100)
                : 0
        };
    }

    /**
     * 销毁渲染器
     */
    destroy() {
        this.isRendering = false;
    }
}

// 创建全局实例
if (typeof window !== 'undefined') {
    window.layeredRenderer = new LayeredRenderer();
}