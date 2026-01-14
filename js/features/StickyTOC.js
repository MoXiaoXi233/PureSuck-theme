/**
 * PureSuck StickyTOC - 粘性目录模块
 * IntersectionObserver 实现，哨兵元素方案
 * 
 * @module features/StickyTOC
 */

import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';

/**
 * 粘性目录模块类
 * 管理粘性目录的所有功能
 */
class StickyTOC {
    constructor() {
        this.state = {
            section: null,
            sidebar: null,
            threshold: 0,
            observer: null,
            bound: false
        };
        this.initialized = false;
    }

    /**
     * 更新阈值
     * 计算 TOC 上方所有元素的高度和
     */
    updateThreshold() {
        if (!this.state.section || !this.state.sidebar) return;

        try {
            // 计算 TOC 上方所有元素的高度和
            const tocAboveElements = Array.from(this.state.sidebar.children)
                .filter(element => element !== this.state.section);
            this.state.threshold = tocAboveElements.reduce(
                (total, element) => total + element.offsetHeight, 
                0
            ) + 50;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.LOW,
                message: '更新粘性目录阈值失败',
                metadata: { module: 'StickyTOC' }
            });
        }
    }

    /**
     * 处理 IntersectionObserver 回调
     * @param {IntersectionObserverEntry[]} entries - 观察到的元素列表
     */
    handleIntersection(entries) {
        if (!this.state.section || entries.length === 0) return;

        try {
            const [entry] = entries;
            // 当哨兵元素（位于阈值位置）离开视口顶部时，TOC 应该变为 sticky
            const shouldStick = !entry.isIntersecting;
            this.state.section.classList.toggle("sticky", shouldStick);
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.LOW,
                message: '处理粘性目录交叉观察失败',
                metadata: { module: 'StickyTOC' }
            });
        }
    }

    /**
     * 创建或更新哨兵元素
     */
    createOrUpdateSentinel() {
        if (!this.state.section || !this.state.sidebar) return;

        try {
            // 先断开旧观察
            if (this.state.observer) {
                this.state.observer.disconnect();
            }

            // 更新阈值
            this.updateThreshold();

            // 创建或更新哨兵元素
            let sentinel = document.getElementById('toc-sticky-sentinel');
            if (!sentinel) {
                sentinel = document.createElement('div');
                sentinel.id = 'toc-sticky-sentinel';
                // 固定在阈值位置（从页面顶部算起）
                sentinel.style.position = 'absolute';
                sentinel.style.top = this.state.threshold + 'px';
                sentinel.style.left = '0';
                sentinel.style.width = '1px';
                sentinel.style.height = '1px';
                sentinel.style.pointerEvents = 'none';
                sentinel.style.visibility = 'hidden';
                document.body.appendChild(sentinel);
            } else {
                sentinel.style.top = this.state.threshold + 'px';
            }

            // 重新观察哨兵
            if (typeof IntersectionObserver !== 'undefined') {
                this.state.observer = new IntersectionObserver(
                    this.handleIntersection.bind(this), 
                    {
                        root: null,
                        threshold: 0,
                        rootMargin: '0px 0px 0px 0px'
                    }
                );
                this.state.observer.observe(sentinel);
            }
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.MEDIUM,
                message: '创建或更新哨兵元素失败',
                metadata: { module: 'StickyTOC' }
            });
        }
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        // Resize 时更新哨兵位置
        this.createOrUpdateSentinel();
    }

    /**
     * 初始化模块
     */
    init() {
        try {
            const tocSection = document.getElementById("toc-section");
            const rightSidebar = document.querySelector(".right-sidebar");
            if (!tocSection || !rightSidebar) return;

            this.state.section = tocSection;
            this.state.sidebar = rightSidebar;

            if (this.state.bound) return;
            this.state.bound = true;

            if (typeof IntersectionObserver !== 'undefined') {
                // 使用 IntersectionObserver + 哨兵元素
                this.createOrUpdateSentinel();
            } else {
                // 降级：使用 scroll 事件
                let raf = 0;
                this.updateThreshold();
                const requestUpdate = () => {
                    if (raf) return;
                    raf = window.requestAnimationFrame(() => {
                        raf = 0;
                        const shouldStick = window.scrollY >= this.state.threshold;
                        tocSection.classList.toggle("sticky", shouldStick);
                    });
                };
                requestUpdate();
                window.addEventListener("scroll", requestUpdate, { passive: true });
            }

            window.addEventListener("resize", this.handleResize.bind(this));
            window.addEventListener("orientationchange", this.handleResize.bind(this));
            window.addEventListener("load", this.handleResize.bind(this), { once: true });

            this.initialized = true;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.HIGH,
                message: '初始化粘性目录失败',
                metadata: { module: 'StickyTOC' }
            });
        }
    }

    /**
     * 销毁模块
     */
    destroy() {
        if (this.state.observer) {
            this.state.observer.disconnect();
            this.state.observer = null;
        }

        const sentinel = document.getElementById('toc-sticky-sentinel');
        if (sentinel && sentinel.parentNode) {
            sentinel.parentNode.removeChild(sentinel);
        }

        this.state = {
            section: null,
            sidebar: null,
            threshold: 0,
            observer: null,
            bound: false
        };
        this.initialized = false;
    }
}

// 创建单例实例
const stickyTOC = new StickyTOC();

/**
 * 初始化粘性目录
 * @public
 */
export function initStickyTOC() {
    stickyTOC.init();
}

/**
 * 获取粘性目录实例
 * @returns {StickyTOC} 粘性目录实例
 * @public
 */
export function getStickyTOC() {
    return stickyTOC;
}

// 导出旧的函数名以保持向后兼容
export const initializeStickyTOC = initStickyTOC;

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStickyTOC);
} else {
    initStickyTOC();
}

export default StickyTOC;
