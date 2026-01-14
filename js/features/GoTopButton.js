/**
 * PureSuck GoTopButton - 回到顶部按钮模块
 * 滚动监听和显示控制，平滑滚动到顶部
 * 
 * @module features/GoTopButton
 */

import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';

/**
 * 回到顶部按钮类
 * 管理回到顶部按钮的所有功能
 */
class GoTopButton {
    constructor() {
        this.bound = false;
        this.button = null;
        this.anchor = null;
        this.ticking = false;
        this.initialized = false;
    }

    /**
     * 同步按钮元素
     * @param {Element} root - 根元素
     */
    sync(root) {
        try {
            const scope = root && root.querySelector ? root : document;
            this.button = scope.querySelector('#go-top') || document.querySelector('#go-top');
            this.anchor = this.button ? this.button.querySelector('.go') : null;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.LOW,
                message: '同步回到顶部按钮失败',
                metadata: { module: 'GoTopButton' }
            });
        }
    }

    /**
     * 更新按钮可见性
     */
    updateVisibility() {
        if (!this.button) return;

        try {
            if (window.scrollY > 100) {
                this.button.classList.add('visible');
            } else {
                this.button.classList.remove('visible');
            }
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.LOW,
                message: '更新按钮可见性失败',
                metadata: { module: 'GoTopButton' }
            });
        }
    }

    /**
     * 滚动事件处理（使用 RAF 节流）
     */
    onScroll() {
        if (this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
            this.ticking = false;
            this.updateVisibility();
        });
    }

    /**
     * 点击事件处理
     * @param {Event} event - 点击事件
     */
    onClick(event) {
        try {
            const target = event.target instanceof Element
                ? event.target.closest('#go-top .go')
                : null;
            if (!target) return;

            event.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

            setTimeout(() => {
                const current = document.querySelector('#go-top');
                if (current) current.classList.remove('visible');
            }, 400);
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.UNKNOWN,
                severity: ErrorSeverity.LOW,
                message: '回到顶部失败',
                metadata: { module: 'GoTopButton' }
            });
        }
    }

    /**
     * 初始化模块
     * @param {Element} root - 根元素
     * @public
     */
    init(root) {
        try {
            this.sync(root);
            if (!this.button || !this.anchor) return;

            if (!this.bound) {
                this.bound = true;
                window.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
                document.addEventListener('click', this.onClick.bind(this), true);
            }

            this.updateVisibility();
            this.initialized = true;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.MEDIUM,
                message: '初始化回到顶部按钮失败',
                metadata: { module: 'GoTopButton' }
            });
        }
    }

    /**
     * 更新可见性
     * @public
     */
    update() {
        this.updateVisibility();
    }

    /**
     * 销毁模块
     */
    destroy() {
        if (this.bound) {
            window.removeEventListener('scroll', this.onScroll);
            document.removeEventListener('click', this.onClick);
            this.bound = false;
        }
        this.button = null;
        this.anchor = null;
        this.ticking = false;
        this.initialized = false;
    }
}

// 创建单例实例
const goTopButton = new GoTopButton();

/**
 * 初始化回到顶部按钮
 * @param {Element} root - 根元素
 * @public
 */
export function initGoTopButton(root) {
    goTopButton.init(root);
}

/**
 * 更新回到顶部按钮可见性
 * @public
 */
export function updateGoTopButton() {
    goTopButton.update();
}

/**
 * 获取回到顶部按钮实例
 * @returns {GoTopButton} 回到顶部按钮实例
 * @public
 */
export function getGoTopButton() {
    return goTopButton;
}

// 导出旧的函数名以保持向后兼容
export function handleGoTopButton(root) {
    initGoTopButton(root);
}

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initGoTopButton());
} else {
    initGoTopButton();
}

export default GoTopButton;
