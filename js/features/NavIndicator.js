/**
 * PureSuck NavIndicator - 导航指示器模块
 * 动态控制导航高亮，支持窗口大小变化
 * 
 * @module features/NavIndicator
 */

import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';

/**
 * 导航指示器类
 * 管理导航指示器的所有功能
 */
class NavIndicator {
    constructor() {
        this.indicator = null;
        this.navContainer = null;
        this.navItems = [];
        this.initialized = false;
    }

    /**
     * 创建指示器元素
     * @returns {HTMLElement} 指示器元素
     */
    createIndicator() {
        const el = document.createElement('div');
        el.className = 'nav-indicator';
        return el;
    }

    /**
     * 更新指示器位置和大小
     * @param {HTMLElement} targetItem - 目标导航项
     */
    updateIndicator(targetItem) {
        if (!this.indicator || !targetItem) return;

        try {
            const itemRect = targetItem.getBoundingClientRect();
            const containerRect = this.navContainer.getBoundingClientRect();

            // 计算相对于容器的位置
            const left = itemRect.left - containerRect.left;
            const top = itemRect.top - containerRect.top;

            // 使用 transform 代替 left/top，性能更好（GPU加速）
            this.indicator.style.width = `${itemRect.width}px`;
            this.indicator.style.height = `${itemRect.height}px`;
            this.indicator.style.transform = `translate(${left}px, ${top}px) scale(1)`;

            // 添加激活状态
            requestAnimationFrame(() => {
                this.indicator.classList.add('active');
            });
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.LOW,
                message: '更新导航指示器失败',
                metadata: { module: 'NavIndicator' }
            });
        }
    }

    /**
     * 隐藏指示器
     */
    hideIndicator() {
        if (!this.indicator) return;
        this.indicator.classList.remove('active');
    }

    /**
     * 获取当前激活的导航项
     * @returns {HTMLElement|null} 激活的导航项
     */
    getActiveNavItem() {
        const currentPath = window.location.pathname;

        for (const item of this.navItems) {
            const link = item.querySelector('a');
            if (link) {
                const linkPath = new URL(link.href).pathname;
                if (linkPath === currentPath) {
                    return item;
                }
            }
        }
        return null;
    }

    /**
     * 初始化导航指示器
     */
    init() {
        try {
            this.navContainer = document.querySelector('.header-nav');
            if (!this.navContainer) return;

            // 检查是否已存在指示器
            if (this.navContainer.querySelector('.nav-indicator')) {
                return;
            }

            // 创建并添加指示器
            this.indicator = this.createIndicator();
            this.navContainer.appendChild(this.indicator);

            // 获取所有导航项
            this.navItems = Array.from(this.navContainer.querySelectorAll('.nav-item'));

            // 初始定位
            const activeItem = this.getActiveNavItem();
            if (activeItem) {
                // 使用 requestAnimationFrame 确保元素已渲染
                requestAnimationFrame(() => {
                    this.updateIndicator(activeItem);
                });
            }

            // 监听窗口大小变化 - 使用 200ms 防抖
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    const activeItem = this.getActiveNavItem();
                    if (activeItem) {
                        this.updateIndicator(activeItem);
                    }
                }, 200);
            });

            this.initialized = true;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.MEDIUM,
                message: '初始化导航指示器失败',
                metadata: { module: 'NavIndicator' }
            });
        }
    }

    /**
     * 更新指示器（供 Swup 调用）
     */
    update() {
        if (!this.navContainer) {
            this.init();
            return;
        }

        try {
            // 重新获取导航项（Swup 可能会替换内容）
            this.navItems = Array.from(this.navContainer.querySelectorAll('.nav-item'));

            const activeItem = this.getActiveNavItem();
            if (activeItem) {
                requestAnimationFrame(() => {
                    this.updateIndicator(activeItem);
                });
            } else {
                this.hideIndicator();
            }
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.LOW,
                message: '更新导航指示器失败',
                metadata: { module: 'NavIndicator' }
            });
        }
    }

    /**
     * 销毁模块
     */
    destroy() {
        if (this.indicator && this.indicator.parentNode) {
            this.indicator.parentNode.removeChild(this.indicator);
        }
        this.indicator = null;
        this.navContainer = null;
        this.navItems = [];
        this.initialized = false;
    }
}

// 创建单例实例
const navIndicator = new NavIndicator();

// 导出到全局（保持向后兼容）
window.NavIndicator = {
    init: () => navIndicator.init(),
    update: () => navIndicator.update()
};

/**
 * 初始化导航指示器
 * @public
 */
export function initNavIndicator() {
    navIndicator.init();
}

/**
 * 更新导航指示器
 * @public
 */
export function updateNavIndicator() {
    navIndicator.update();
}

/**
 * 获取导航指示器实例
 * @returns {NavIndicator} 导航指示器实例
 * @public
 */
export function getNavIndicator() {
    return navIndicator;
}

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavIndicator);
} else {
    initNavIndicator();
}

export default NavIndicator;
