/**
 * PureSuck CollapsiblePanel - 折叠面板模块
 * 展开/收起动画
 * 
 * @module features/CollapsiblePanel
 */

import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';

/**
 * 折叠面板模块类
 * 管理折叠面板的所有功能
 */
class CollapsiblePanel {
    constructor() {
        this.initialized = false;
    }

    /**
     * 初始化单个折叠面板
     * @param {HTMLElement} panel - 折叠面板元素
     */
    initPanel(panel) {
        try {
            if (panel.dataset.binded === "1") return;
            panel.dataset.binded = "1";

            const button = panel.querySelector('.collapsible-header');
            const contentDiv = panel.querySelector('.collapsible-content');
            const icon = button ? button.querySelector('.icon') : null;

            if (!button || !contentDiv) return;

            button.addEventListener('click', function () {
                this.classList.toggle('active');

                if (contentDiv.style.maxHeight && contentDiv.style.maxHeight !== '0px') {
                    contentDiv.style.maxHeight = '0px';
                    if (icon) {
                        icon.classList.remove('icon-up-open');
                        icon.classList.add('icon-down-open');
                    }
                } else {
                    contentDiv.style.maxHeight = contentDiv.scrollHeight + "px";
                    if (icon) {
                        icon.classList.remove('icon-down-open');
                        icon.classList.add('icon-up-open');
                    }
                }
            });
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.LOW,
                message: '初始化折叠面板失败',
                metadata: { module: 'CollapsiblePanel' }
            });
        }
    }

    /**
     * 初始化所有折叠面板
     * @param {Element} root - 根元素
     */
    init(root) {
        try {
            const scope = root && root.querySelector ? root : document;
            const panels = scope.querySelectorAll('.collapsible-panel');

            panels.forEach(panel => {
                this.initPanel(panel);
            });

            this.initialized = true;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.MEDIUM,
                message: '初始化折叠面板模块失败',
                metadata: { module: 'CollapsiblePanel' }
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
const collapsiblePanel = new CollapsiblePanel();

/**
 * 初始化折叠面板模块
 * @param {Element} root - 根元素
 * @public
 */
export function initCollapsiblePanel(root) {
    collapsiblePanel.init(root);
}

/**
 * 获取折叠面板模块实例
 * @returns {CollapsiblePanel} 折叠面板模块实例
 * @public
 */
export function getCollapsiblePanel() {
    return collapsiblePanel;
}

// 导出旧的函数名以保持向后兼容
export function bindCollapsiblePanels(root) {
    initCollapsiblePanel(root);
}

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initCollapsiblePanel());
} else {
    initCollapsiblePanel();
}

export default CollapsiblePanel;
