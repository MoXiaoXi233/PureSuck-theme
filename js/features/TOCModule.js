/**
 * PureSuck TOCModule - 目录导航模块
 * 提供目录导航功能，使用 IntersectionObserver 追踪滚动位置
 * 支持滚动监听和 hash 导航
 * 
 * @module features/TOCModule
 */

import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';

/**
 * TOC 模块类
 * 管理目录导航的所有功能
 */
class TOCModule {
    constructor() {
        this.state = null;
        this.listenersBound = false;
        this.hashTimer = 0;
        this.scrollEndTimer = 0;
        this.scrollEndHandler = null;
        this.rafId = null;
        this.refreshRaf = 0;
    }

    /**
     * 重置模块状态
     * 清理所有事件监听器和观察器
     */
    reset() {
        if (!this.state) return;

        try {
            if (this.hashTimer) {
                clearTimeout(this.hashTimer);
                this.hashTimer = 0;
            }

            if (this.scrollEndHandler) {
                window.removeEventListener("scroll", this.scrollEndHandler);
                this.scrollEndHandler = null;
            }

            if (this.scrollEndTimer) {
                clearTimeout(this.scrollEndTimer);
                this.scrollEndTimer = 0;
            }

            if (this.refreshRaf) {
                cancelAnimationFrame(this.refreshRaf);
                this.refreshRaf = 0;
            }

            if (this.state.observer) {
                this.state.observer.disconnect();
                this.state.observer = null;
            }

            const previousElement = this.state.elements[this.state.activeIndex];
            if (previousElement && previousElement.id) {
                const previousLink = this.state.linkById.get(previousElement.id);
                if (previousLink) {
                    previousLink.classList.remove("li-active");
                }
            }

            this.state = null;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.LOW,
                message: 'TOC 重置失败',
                metadata: { module: 'TOCModule' }
            });
        }
    }

    /**
     * 刷新布局
     * 重新绑定观察器并设置初始激活项
     */
    refreshLayout() {
        if (!this.state) return;
        this.bindObserver();
        this.setActive(this.getInitialActiveIndex());
    }

    /**
     * 调度布局刷新（使用 RAF 优化）
     */
    scheduleRefreshLayout() {
        if (this.refreshRaf) cancelAnimationFrame(this.refreshRaf);
        this.refreshRaf = requestAnimationFrame(() => {
            this.refreshRaf = 0;
            this.refreshLayout();
        });
    }

    /**
     * 获取初始激活的索引
     * @returns {number} 激活项的索引
     */
    getInitialActiveIndex() {
        if (!this.state) return 0;
        const activationOffset = this.state.activationOffset;
        let activeIndex = 0;

        // 一次性获取所有 boundingClientRect，避免循环中多次触发 reflow
        const rects = this.state.elements.map(el => el.getBoundingClientRect().top);

        for (let index = 0; index < rects.length; index++) {
            if (rects[index] <= activationOffset) {
                activeIndex = index;
            } else {
                break;
            }
        }

        return activeIndex;
    }

    /**
     * 绑定 IntersectionObserver
     * 监听标题元素的可见性变化
     */
    bindObserver() {
        if (!this.state) return;
        if (this.state.observer) {
            this.state.observer.disconnect();
        }

        this.state.intersecting.clear();

        const activationRatio = 0.15;
        const bottomRatio = 1;
        this.state.activationOffset = Math.round(window.innerHeight * activationRatio);
        this.state.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
            rootMargin: `-${activationRatio * 100}% 0px -${bottomRatio * 100}% 0px`,
            threshold: 0
        });

        this.state.elements.forEach(element => {
            if (element.id) {
                this.state.observer.observe(element);
            }
        });
    }

    /**
     * 处理 IntersectionObserver 回调
     * @param {IntersectionObserverEntry[]} entries - 观察到的元素列表
     */
    handleIntersect(entries) {
        if (!this.state || !this.state.indexByElement) return;

        // 取消之前的 RAF，避免重复处理
        if (this.rafId) cancelAnimationFrame(this.rafId);

        // IntersectionObserver 已经是异步批量回调，直接用 RAF 优化即可
        this.rafId = requestAnimationFrame(() => {
            if (!this.state || !this.state.indexByElement) {
                this.rafId = null;
                return;
            }

            let bestIndex = -1;
            let bestDistance = Infinity;

            entries.forEach(entry => {
                if (!entry || !entry.target) return;
                const index = this.state.indexByElement.get(entry.target);
                if (index == null) return;
                if (entry.isIntersecting) {
                    this.state.intersecting.add(index);
                    this.state.topByIndex.set(index, entry.boundingClientRect.top);
                } else {
                    this.state.intersecting.delete(index);
                }
            });

            this.state.intersecting.forEach(index => {
                const top = this.state.topByIndex.get(index);
                if (top == null) return;
                const distance = Math.abs(top - this.state.activationOffset);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = index;
                }
            });

            if (bestIndex >= 0) {
                this.setActive(bestIndex);
            }

            this.rafId = null;
        });
    }

    /**
     * 设置激活的目录项
     * @param {number} index - 要激活的索引
     */
    setActive(index) {
        if (!this.state) return;
        if (index < 0 || index >= this.state.elements.length) return;
        if (this.state.activeIndex === index) return;

        const element = this.state.elements[index];
        if (!element || !element.id) return;
        const link = this.state.linkById.get(element.id);
        if (!link) return;

        const previousElement = this.state.elements[this.state.activeIndex];
        if (previousElement && previousElement.id) {
            const previousLink = this.state.linkById.get(previousElement.id);
            if (previousLink) {
                previousLink.classList.remove("li-active");
            }
        }

        link.classList.add("li-active");
        this.state.activeIndex = index;

        const item = this.state.itemById.get(element.id);
        if (this.state.siderbar && item) {
            this.state.siderbar.style.transform = `translate3d(0, ${item.offsetTop + 4}px, 0)`;
        }
    }

    /**
     * 等待滚动结束
     * @param {Function} done - 完成回调
     * @param {number} timeout - 超时时间（毫秒）
     */
    waitForScrollEnd(done, timeout = 160) {
        if (this.scrollEndHandler) {
            window.removeEventListener("scroll", this.scrollEndHandler);
            this.scrollEndHandler = null;
        }

        if (this.scrollEndTimer) {
            clearTimeout(this.scrollEndTimer);
            this.scrollEndTimer = 0;
        }

        this.scrollEndHandler = () => {
            if (this.scrollEndTimer) {
                clearTimeout(this.scrollEndTimer);
            }
            this.scrollEndTimer = window.setTimeout(() => {
                window.removeEventListener("scroll", this.scrollEndHandler);
                this.scrollEndHandler = null;
                this.scrollEndTimer = 0;
                done();
            }, timeout);
        };

        window.addEventListener("scroll", this.scrollEndHandler, { passive: true });
        this.scrollEndHandler();
    }

    /**
     * 处理目录链接点击事件
     * @param {Event} event - 点击事件
     */
    handleClick(event) {
        if (!this.state) return;
        const link = event.target instanceof Element ? event.target.closest(".toc-a") : null;
        if (!link) return;

        const href = link.getAttribute("href");
        if (!href || href.charAt(0) !== "#") return;

        event.preventDefault();
        event.stopPropagation();

        const targetId = href.slice(1);
        const targetElement = document.getElementById(targetId);
        if (!targetElement) return;

        const targetTop = targetElement.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
            top: targetTop,
            behavior: "smooth"
        });

        if (this.state.observer) {
            this.state.observer.disconnect();
            this.state.observer = null;
        }

        if (this.hashTimer) {
            clearTimeout(this.hashTimer);
        }
        this.hashTimer = window.setTimeout(() => {
            window.location.hash = targetId;
            this.hashTimer = 0;
        }, 300);

        const index = this.state.indexById.get(targetId);
        if (index != null) {
            this.setActive(index);
        }

        this.waitForScrollEnd(() => {
            this.bindObserver();
            this.setActive(this.getInitialActiveIndex());
        });
    }

    /**
     * 初始化 TOC 模块
     */
    init() {
        try {
            const tocSection = document.getElementById("toc-section");
            const toc = document.querySelector(".toc");
            const postWrapper = document.querySelector(".inner-post-wrapper");

            if (!toc || !postWrapper) {
                this.reset();
                return;
            }

            const elements = Array.from(postWrapper.querySelectorAll("h1, h2, h3, h4, h5, h6"));
            const links = Array.from(toc.querySelectorAll(".toc-a"));
            const siderbar = document.querySelector(".siderbar");

            if (!elements.length || !links.length || !siderbar) {
                this.reset();
                return;
            }

            siderbar.style.transition = "transform 0.5s ease";

            if (tocSection) {
                tocSection.style.display = "block";
                const rightSidebar = document.querySelector(".right-sidebar");
                if (rightSidebar) {
                    rightSidebar.style.position = "absolute";
                    rightSidebar.style.top = "0";
                }
            }

            links.forEach(link => {
                link.setAttribute("no-pjax", "");
                link.classList.remove("li-active");
            });

            this.state = {
                elements,
                links,
                siderbar,
                activeIndex: -1,
                indexByElement: new Map(),
                indexById: new Map(),
                linkById: new Map(),
                itemById: new Map(),
                topByIndex: new Map(),
                activationOffset: 0,
                observer: null,
                intersecting: new Set()
            };

            this.state.elements.forEach((element, index) => {
                this.state.indexByElement.set(element, index);
                if (element.id) {
                    this.state.indexById.set(element.id, index);
                }
            });

            this.state.links.forEach(link => {
                const href = link.getAttribute("href");
                if (!href || href.charAt(0) !== "#") return;
                const id = href.slice(1);
                this.state.linkById.set(id, link);
                const item = link.closest("li");
                if (item) {
                    this.state.itemById.set(id, item);
                }
            });

            if (toc.dataset.binded !== "1") {
                toc.addEventListener("click", this.handleClick.bind(this), true);
                toc.dataset.binded = "1";
            }

            if (!this.listenersBound) {
                this.listenersBound = true;
                window.addEventListener("resize", this.scheduleRefreshLayout.bind(this), { passive: true });
                window.addEventListener("orientationchange", this.scheduleRefreshLayout.bind(this));
                window.addEventListener("load", this.scheduleRefreshLayout.bind(this), { once: true });
            }

            this.refreshLayout();
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.MEDIUM,
                message: 'TOC 初始化失败',
                metadata: { module: 'TOCModule' }
            });
        }
    }

    /**
     * 销毁模块
     */
    destroy() {
        this.reset();
        this.listenersBound = false;
    }
}

// 创建单例实例
const tocModule = new TOCModule();

/**
 * 初始化 TOC 模块
 * @public
 */
export function initializeTOC() {
    tocModule.init();
}

/**
 * 重置 TOC 模块
 * @public
 */
export function resetTOC() {
    tocModule.reset();
}

/**
 * 刷新 TOC 布局
 * @public
 */
export function refreshTOCLayout() {
    tocModule.refreshLayout();
}

/**
 * 获取 TOC 模块实例
 * @returns {TOCModule} TOC 模块实例
 * @public
 */
export function getTOCModule() {
    return tocModule;
}

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTOC);
} else {
    initializeTOC();
}

export default TOCModule;
