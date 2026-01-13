/**
 * PureSuck VisibilityManager - 可见性管理器
 * 封装IntersectionObserver,提供元素可见性检测和回调
 */

import { eventBus } from '../core/EventBus.js';

export class VisibilityManager {
    constructor() {
        this.observer = null;
        this.observedElements = new WeakMap(); // element -> { callbacks, once }
        this.rafThrottled = false;
        this.pendingCallbacks = [];
    }

    /**
     * 初始化
     */
    init() {
        if (this.observer) {
            console.warn('[VisibilityManager] Already initialized');
            return;
        }

        if (typeof IntersectionObserver !== 'function') {
            console.warn('[VisibilityManager] IntersectionObserver not supported');
            return;
        }

        this.observer = new IntersectionObserver(
            this.handleIntersections.bind(this),
            {
                rootMargin: '200px 0px',
                threshold: 0.01
            }
        );

        console.log('[VisibilityManager] Initialized');
    }

    /**
     * 处理交叉观察回调
     */
    handleIntersections(entries) {
        // RAF节流,避免高频回调
        if (this.rafThrottled) {
            this.pendingCallbacks.push(...entries);
            return;
        }

        this.rafThrottled = true;
        this.processEntries(entries);

        requestAnimationFrame(() => {
            this.rafThrottled = false;
            if (this.pendingCallbacks.length > 0) {
                const entries = this.pendingCallbacks;
                this.pendingCallbacks = [];
                this.processEntries(entries);
            }
        });
    }

    /**
     * 处理观察条目
     */
    processEntries(entries) {
        for (const entry of entries) {
            const el = entry.target;
            const data = this.observedElements.get(el);

            if (!data) continue;

            const { onVisible, onHidden, once } = data;

            if (entry.isIntersecting) {
                // 元素可见
                if (onVisible) {
                    try {
                        onVisible(el, entry);
                    } catch (error) {
                        console.error('[VisibilityManager] Error in onVisible callback:', error);
                    }
                }

                // 如果是一次性观察,可见后取消观察
                if (once) {
                    this.unobserve(el);
                }
            } else {
                // 元素隐藏
                if (onHidden) {
                    try {
                        onHidden(el, entry);
                    } catch (error) {
                        console.error('[VisibilityManager] Error in onHidden callback:', error);
                    }
                }
            }
        }
    }

    /**
     * 观察元素
     * @param {Element} element - 要观察的元素
     * @param {Object} options - 配置选项
     * @param {Function} options.onVisible - 可见回调
     * @param {Function} options.onHidden - 隐藏回调
     * @param {boolean} options.once - 是否一次性观察
     */
    observe(element, options = {}) {
        if (!this.observer) {
            console.warn('[VisibilityManager] Not initialized');
            return;
        }

        if (!element || typeof element.nodeType !== 'number') {
            console.warn('[VisibilityManager] Invalid element');
            return;
        }

        const { onVisible, onHidden, once = false } = options;

        // 存储回调
        this.observedElements.set(element, {
            onVisible: typeof onVisible === 'function' ? onVisible : null,
            onHidden: typeof onHidden === 'function' ? onHidden : null,
            once
        });

        // 开始观察
        this.observer.observe(element);

        // 发布事件
        eventBus.emit('visibility:observe', { element, options });
    }

    /**
     * 取消观察元素
     * @param {Element} element - 要取消观察的元素
     */
    unobserve(element) {
        if (!this.observer) return;

        if (this.observedElements.has(element)) {
            this.observedElements.delete(element);
            this.observer.unobserve(element);

            eventBus.emit('visibility:unobserve', { element });
        }
    }

    /**
     * 检查元素是否可见
     * @param {Element} element - 要检查的元素
     * @returns {boolean|null} 可见状态,如果未观察则返回null
     */
    isVisible(element) {
        if (!this.observer || !element) return null;

        // 如果元素正在被观察,检查其位置
        const rect = element.getBoundingClientRect();
        return (
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
        );
    }

    /**
     * 一次性观察元素(可见后自动取消)
     * @param {Element} element - 要观察的元素
     * @param {Function} onVisible - 可见回调
     */
    observeOnce(element, onVisible) {
        this.observe(element, {
            onVisible,
            once: true
        });
    }

    /**
     * 批量观察元素
     * @param {Element[]} elements - 要观察的元素数组
     * @param {Object} options - 配置选项
     */
    observeMany(elements, options = {}) {
        if (!Array.isArray(elements)) {
            console.warn('[VisibilityManager] Elements must be an array');
            return;
        }

        for (const element of elements) {
            this.observe(element, options);
        }
    }

    /**
     * 取消所有观察
     */
    disconnect() {
        if (!this.observer) return;

        this.observer.disconnect();
        this.observedElements = new WeakMap();
        this.pendingCallbacks = [];

        console.log('[VisibilityManager] Disconnected');
    }

    /**
     * 重置(重新初始化)
     */
    reset() {
        this.disconnect();
        this.init();
    }

    /**
     * 获取观察的元素数量
     * @returns {number}
     */
    getObservedCount() {
        // WeakMap无法直接获取大小,返回0
        return 0;
    }
}

// 创建全局单例
export const visibilityManager = new VisibilityManager();
