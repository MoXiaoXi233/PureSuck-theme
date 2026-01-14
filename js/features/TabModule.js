/**
 * PureSuck TabModule - 标签页模块
 * 标签切换动画，指示器动画
 * 
 * @module features/TabModule
 */

import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';

/**
 * 标签页模块类
 * 管理标签页的所有功能
 */
class TabModule {
    constructor() {
        this.initialized = false;
    }

    /**
     * 初始化单个标签容器
     * @param {HTMLElement} container - 标签容器
     */
    initTabContainer(container) {
        try {
            if (container.dataset.binded === "1") return;
            container.dataset.binded = "1";

            const tabHeader = container.querySelector('.tab-header');
            if (!tabHeader) return;

            const tabLinks = Array.from(tabHeader.querySelectorAll('.tab-link'));
            const tabPanes = Array.from(container.querySelectorAll('.tab-pane'));
            const indicator = tabHeader.querySelector('.tab-indicator');

            if (!tabLinks.length || !indicator) return;

            let cachedWidths = [];
            let cachedOffsets = [];

            const updateCache = () => {
                cachedWidths = tabLinks.map(l => l.offsetWidth);
                cachedOffsets = tabLinks.map(l => l.offsetLeft);
            };

            const updateIndicator = index => {
                requestAnimationFrame(() => {
                    indicator.style.width = `${cachedWidths[index] * 0.75}px`;
                    indicator.style.left = `${cachedOffsets[index] + cachedWidths[index] * 0.125}px`;
                });
            };

            const updateLayout = () => {
                updateCache();
                const activeIndex = tabLinks.findIndex(l => l.classList.contains('active'));
                updateIndicator(activeIndex >= 0 ? activeIndex : 0);
            };

            if (window.ResizeObserver) {
                new ResizeObserver(updateLayout).observe(tabHeader);
            }

            tabHeader.addEventListener('click', e => {
                const target = e.target.closest('.tab-link');
                if (!target) return;

                const newIndex = tabLinks.indexOf(target);
                const oldIndex = tabLinks.findIndex(l => l.classList.contains('active'));
                if (newIndex === oldIndex) return;

                tabHeader.classList.remove('dir-left', 'dir-right');
                tabHeader.classList.add(newIndex > oldIndex ? 'dir-right' : 'dir-left');

                tabLinks.forEach(l => {
                    l.classList.remove('active');
                    l.setAttribute('tabindex', '-1');
                });

                tabPanes.forEach(p => p.classList.remove('active'));

                target.classList.add('active');
                target.setAttribute('tabindex', '0');
                target.focus();

                if (tabPanes[newIndex]) {
                    tabPanes[newIndex].classList.add('active');
                }
                updateIndicator(newIndex);
            });

            updateLayout();
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.LOW,
                message: '初始化标签容器失败',
                metadata: { module: 'TabModule' }
            });
        }
    }

    /**
     * 初始化所有标签容器
     * @param {Element} root - 根元素
     */
    init(root) {
        try {
            const scope = root && root.querySelector ? root : document;
            const tabContainers = scope.querySelectorAll('.tab-container');

            tabContainers.forEach(container => {
                this.initTabContainer(container);
            });

            this.initialized = true;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.MEDIUM,
                message: '初始化标签页模块失败',
                metadata: { module: 'TabModule' }
            });
        }
    }

    /**
     * 销毁模块
     */
    destroy() {
        this.initialized = false;
    }
}

// 创建单例实例
const tabModule = new TabModule();

/**
 * 初始化标签页模块
 * @param {Element} root - 根元素
 * @public
 */
export function initTabModule(root) {
    tabModule.init(root);
}

/**
 * 获取标签页模块实例
 * @returns {TabModule} 标签页模块实例
 * @public
 */
export function getTabModule() {
    return tabModule;
}

// 导出旧的函数名以保持向后兼容
export function bindTabs(root) {
    initTabModule(root);
}

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initTabModule());
} else {
    initTabModule();
}

export default TabModule;
