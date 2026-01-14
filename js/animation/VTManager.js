/**
 * PureSuck VTManager - View Transitions API 管理器
 * 统一管理 View Transitions API，支持共享元素动画
 * 
 * @module animation/VTManager
 */

import { eventBus } from '../core/EventBus.js';
import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';

/**
 * View Transitions 配置
 * @private
 */
const VT_CONFIG = {
    styleId: 'ps-vt-shared-element-style',
    markerAttr: 'data-ps-vt-name',
    duration: 500,
    easing: 'cubic-bezier(.2,.8,.2,1)',
    leadMs: 100, // VT完成后提前多久开始进入动画
    borderRadius: '0.85rem'
};

/**
 * View Transitions 管理器类
 */
export class VTManager {
    constructor() {
        this._isSupported = false;
        this._isEnabled = true;
        this._currentTransition = null;
        this._sharedElementName = null;
        this._styleElement = null;
        this._transitionCount = 0;
        this._errorCount = 0;
        this._maxErrors = 3; // 最大错误次数，超过则禁用VT

        // 检测支持
        this._detectSupport();
    }

    /**
     * 检测 View Transitions API 支持
     * @private
     */
    _detectSupport() {
        this._isSupported = typeof document.startViewTransition === 'function'
            && typeof CSS !== 'undefined'
            && typeof CSS.supports === 'function'
            && CSS.supports('view-transition-name: ps-test');

        if (this._isSupported) {
            console.log('[VTManager] View Transitions API supported');
        } else {
            console.warn('[VTManager] View Transitions API not supported');
        }
    }

    /**
     * 检查是否支持 View Transitions
     * @returns {boolean}
     */
    isSupported() {
        return this._isSupported;
    }

    /**
     * 检查是否启用 View Transitions
     * @returns {boolean}
     */
    isEnabled() {
        return this._isSupported && this._isEnabled;
    }

    /**
     * 启用 View Transitions
     */
    enable() {
        this._isEnabled = true;
        this._errorCount = 0;
        console.log('[VTManager] View Transitions enabled');
    }

    /**
     * 禁用 View Transitions
     * @param {string} [reason] - 禁用原因
     */
    disable(reason = 'manual') {
        this._isEnabled = false;
        console.warn(`[VTManager] View Transitions disabled: ${reason}`);

        // 清除所有标记
        this.clearSharedElements();
    }

    /**
     * 启动 View Transition
     * @param {Function} callback - 在过渡期间执行的回调
     * @param {Object} [options] - 配置选项
     * @param {boolean} [options.updateDOM=true] - 是否更新DOM
     * @returns {Promise<void>}
     */
    async startVT(callback, options = {}) {
        if (!this.isEnabled()) {
            console.log('[VTManager] VT disabled, executing callback directly');
            await callback();
            return;
        }

        const { updateDOM = true } = options;

        try {
            console.log('[VTManager] Starting View Transition');

            // 发布开始事件
            eventBus.emit('vt:start', {
                count: ++this._transitionCount
            });

            // 执行 View Transition
            this._currentTransition = document.startViewTransition(async () => {
                try {
                    await callback();
                } catch (error) {
                    console.error('[VTManager] Error in VT callback:', error);
                    throw error;
                }
            });

            // 等待过渡完成
            await this._currentTransition.finished;

            console.log('[VTManager] View Transition completed');

            // 发布完成事件
            eventBus.emit('vt:complete', {
                count: this._transitionCount
            });

            // 重置错误计数
            this._errorCount = 0;

        } catch (error) {
            this._handleError(error, 'startVT');
        } finally {
            this._currentTransition = null;
        }
    }

    /**
     * 等待 View Transition 完成
     * @param {number} [timeout=2000] - 超时时间（毫秒）
     * @returns {Promise<void>}
     */
    async waitForVT(timeout = 2000) {
        if (!this.isEnabled()) {
            return Promise.resolve();
        }

        if (!this._currentTransition) {
            return Promise.resolve();
        }

        try {
            // 等待当前过渡完成
            await Promise.race([
                this._currentTransition.finished,
                this._waitForAnimations(timeout)
            ]);

            console.log('[VTManager] View Transition finished');
        } catch (error) {
            console.warn('[VTManager] VT wait timeout or error:', error);
        }
    }

    /**
     * 等待所有 view-transition 动画完成
     * @private
     * @param {number} timeout - 超时时间
     * @returns {Promise<void>}
     */
    async _waitForAnimations(timeout) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            const checkAnimations = () => {
                if (Date.now() - startTime > timeout) {
                    console.warn('[VTManager] VT animation timeout');
                    resolve();
                    return;
                }

                if (typeof document.getAnimations !== 'function') {
                    resolve();
                    return;
                }

                const animations = document.getAnimations({ subtree: true });
                const vtAnimations = animations.filter((anim) => {
                    const target = anim?.effect?.target;
                    const text = target?.toString ? target.toString() : '';
                    return text.includes('view-transition');
                });

                if (vtAnimations.length === 0) {
                    resolve();
                } else {
                    requestAnimationFrame(checkAnimations);
                }
            };

            requestAnimationFrame(checkAnimations);
        });
    }

    /**
     * 应用共享元素到指定元素
     * @param {Element} element - 目标元素
     * @param {string} name - 共享元素名称
     * @returns {boolean} 是否成功应用
     */
    applySharedElement(element, name) {
        if (!this.isEnabled()) {
            return false;
        }

        if (!element || !name) {
            console.warn('[VTManager] Invalid element or name for shared element');
            return false;
        }

        try {
            // 清除之前的标记
            this.clearSharedElements();

            // 确保CSS存在
            this._ensureSharedElementCSS(name);

            // 应用 view-transition-name
            element.style.viewTransitionName = name;
            element.setAttribute(VT_CONFIG.markerAttr, name);

            this._sharedElementName = name;

            console.log(`[VTManager] Applied shared element: ${name}`);

            // 发布事件
            eventBus.emit('vt:shared-element', {
                element,
                name
            });

            return true;
        } catch (error) {
            this._handleError(error, 'applySharedElement');
            return false;
        }
    }

    /**
     * 应用文章卡片共享元素
     * @param {Element} postCard - 文章卡片元素
     * @param {string} postKey - 文章key
     * @returns {boolean} 是否成功应用
     */
    applyPostSharedElement(postCard, postKey) {
        if (!postKey) {
            return false;
        }

        const name = this._getPostTransitionName(postKey);
        return this.applySharedElement(postCard, name);
    }

    /**
     * 清除所有共享元素标记
     */
    clearSharedElements() {
        const elements = document.querySelectorAll(`[${VT_CONFIG.markerAttr}]`);
        
        elements.forEach((el) => {
            el.style.viewTransitionName = '';
            el.removeAttribute(VT_CONFIG.markerAttr);
        });

        this._sharedElementName = null;

        console.log(`[VTManager] Cleared ${elements.length} shared elements`);
    }

    /**
     * 获取文章过渡名称
     * @private
     * @param {string} postKey - 文章key
     * @returns {string} 过渡名称
     */
    _getPostTransitionName(postKey) {
        const safeKey = encodeURIComponent(String(postKey || '')).replace(/%/g, '_');
        return `ps-post-${safeKey}`;
    }

    /**
     * 确保共享元素CSS存在
     * @private
     * @param {string} name - 共享元素名称
     */
    _ensureSharedElementCSS(name) {
        if (!this._styleElement) {
            this._styleElement = document.getElementById(VT_CONFIG.styleId);
        }

        if (!this._styleElement) {
            this._styleElement = document.createElement('style');
            this._styleElement.id = VT_CONFIG.styleId;
            document.head.appendChild(this._styleElement);
        }

        // 检查是否已存在该名称的CSS
        if (this._styleElement.textContent.includes(`::view-transition-group(${name})`)) {
            return;
        }

        // 添加新的CSS规则
        const css = `
/* PureSuck View Transitions: shared element morph - ${name} */
::view-transition-group(${name}) {
  animation-duration: ${VT_CONFIG.duration}ms;
  animation-timing-function: ${VT_CONFIG.easing};
  animation-fill-mode: both;
  border-radius: ${VT_CONFIG.borderRadius};
  overflow: hidden;
}
::view-transition-old(${name}),
::view-transition-new(${name}) {
  animation-duration: ${VT_CONFIG.duration}ms;
  animation-timing-function: ${VT_CONFIG.easing};
  animation-fill-mode: both;
}
`;

        this._styleElement.textContent += css;
    }

    /**
     * 从元素获取文章key
     * @param {Element} element - 元素
     * @returns {string|null} 文章key
     */
    getPostKeyFromElement(element) {
        if (!element) return null;
        return element.dataset?.psPostKey 
            || element.getAttribute('data-ps-post-key') 
            || null;
    }

    /**
     * 查找索引文章卡片
     * @param {string} postKey - 文章key
     * @param {Element} [root=document] - 搜索根元素
     * @returns {Element|null} 文章卡片元素
     */
    findIndexPostCard(postKey, root = document) {
        if (!postKey) return null;

        const cards = root.querySelectorAll('.post.post--index');
        for (const card of cards) {
            const cardKey = this.getPostKeyFromElement(card);
            if (cardKey === postKey) return card;
        }

        return null;
    }

    /**
     * 记住最后文章key到history.state
     * @param {string} postKey - 文章key
     */
    rememberLastPostKey(postKey) {
        if (!postKey) return;

        try {
            const state = (history.state && typeof history.state === 'object') 
                ? history.state 
                : {};
            
            if (state.lastPostKey === postKey) return;

            history.replaceState(
                { ...state, lastPostKey: postKey },
                document.title
            );

            console.log(`[VTManager] Remembered post key: ${postKey}`);
        } catch (error) {
            console.warn('[VTManager] Failed to remember post key:', error);
        }
    }

    /**
     * 获取最后文章key
     * @returns {string|null} 最后文章key
     */
    getLastPostKey() {
        try {
            const state = history.state;
            return state?.lastPostKey || null;
        } catch {
            return null;
        }
    }

    /**
     * 获取当前共享元素名称
     * @returns {string|null}
     */
    getCurrentSharedElementName() {
        return this._sharedElementName;
    }

    /**
     * 获取当前过渡配置
     * @returns {Object} 配置对象
     */
    getConfig() {
        return {
            duration: VT_CONFIG.duration,
            easing: VT_CONFIG.easing,
            leadMs: VT_CONFIG.leadMs
        };
    }

    /**
     * 处理错误
     * @private
     * @param {Error} error - 错误对象
     * @param {string} context - 错误上下文
     */
    _handleError(error, context) {
        console.error(`[VTManager] Error in ${context}:`, error);

        // 增加错误计数
        this._errorCount++;

        // 超过最大错误次数，禁用VT
        if (this._errorCount >= this._maxErrors) {
            this.disable('too many errors');
        }

        // 使用ErrorBoundary处理错误
        ErrorBoundary.handle(error, {
            type: ErrorType.VT,
            severity: ErrorSeverity.MEDIUM,
            message: '页面过渡出错，已切换到普通模式',
            metadata: {
                context,
                errorCount: this._errorCount,
                maxErrors: this._maxErrors
            }
        });
    }

    /**
     * 销毁管理器
     */
    destroy() {
        this.clearSharedElements();

        if (this._styleElement) {
            this._styleElement.remove();
            this._styleElement = null;
        }

        this._isEnabled = false;
        this._currentTransition = null;
        this._sharedElementName = null;

        console.log('[VTManager] Destroyed');
    }
}

// 创建全局单例
export const vtManager = new VTManager();
