/**
 * PureSuck DOMScheduler - DOM操作调度器
 * 管理DOM操作队列,批量处理,RAF调度
 */

import { eventBus } from '../core/EventBus.js';

export class DOMScheduler {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.rafId = null;
        this.idleId = null;
        this.useIdleCallback = typeof requestIdleCallback === 'function';
        this.idleTimeout = 800;
        this.budgetMs = 12;
    }

    /**
     * 调度DOM操作
     * @param {Function} operation - DOM操作函数
     * @param {Object} options - 配置选项
     * @param {string} options.priority - 优先级: high, normal, low
     * @param {boolean} options.batch - 是否批量处理
     */
    schedule(operation, options = {}) {
        if (typeof operation !== 'function') {
            console.warn('[DOMScheduler] Invalid operation');
            return;
        }

        const { priority = 'normal', batch = false } = options;

        this.queue.push({
            operation,
            priority,
            batch,
            timestamp: Date.now()
        });

        // 按优先级排序
        this.queue.sort((a, b) => {
            const priorityOrder = { high: 0, normal: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        this.processQueue();
    }

    /**
     * 处理队列
     */
    processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;

        if (this.useIdleCallback) {
            this.idleId = requestIdleCallback(
                this.processIdle.bind(this),
                { timeout: this.idleTimeout }
            );
        } else {
            this.rafId = requestAnimationFrame(this.processRaf.bind(this));
        }
    }

    /**
     * 使用requestIdleCallback处理
     */
    processIdle(deadline) {
        const start = performance.now();

        while (this.queue.length > 0) {
            // 检查是否有足够的时间
            if (deadline.timeRemaining() < 8) {
                break;
            }

            // 检查是否超时
            if (performance.now() - start > this.budgetMs) {
                break;
            }

            const item = this.queue.shift();
            this.executeOperation(item);
        }

        this.isProcessing = false;

        // 如果还有任务,继续调度
        if (this.queue.length > 0) {
            this.processQueue();
        }
    }

    /**
     * 使用requestAnimationFrame处理
     */
    processRaf() {
        // RAF模式下,每帧处理最多3个操作
        const maxPerFrame = 3;
        let count = 0;

        while (this.queue.length > 0 && count < maxPerFrame) {
            const item = this.queue.shift();
            this.executeOperation(item);
            count++;
        }

        this.isProcessing = false;

        // 如果还有任务,继续调度
        if (this.queue.length > 0) {
            this.processQueue();
        }
    }

    /**
     * 执行操作
     */
    executeOperation(item) {
        try {
            item.operation();
        } catch (error) {
            console.error('[DOMScheduler] Error executing operation:', error);
        }
    }

    /**
     * 批量添加元素到DOM
     * @param {Element[]} elements - 元素数组
     * @param {Element} parent - 父元素
     * @param {Object} options - 配置选项
     */
    appendMany(elements, parent, options = {}) {
        if (!Array.isArray(elements) || !parent) {
            console.warn('[DOMScheduler] Invalid elements or parent');
            return;
        }

        this.schedule(() => {
            const fragment = document.createDocumentFragment();
            
            for (const el of elements) {
                if (el && el.nodeType === 1) {
                    fragment.appendChild(el);
                }
            }

            parent.appendChild(fragment);

            eventBus.emit('dom:batch-appended', {
                count: elements.length,
                parent
            });
        }, { ...options, batch: true });
    }

    /**
     * 批量移除元素
     * @param {Element[]} elements - 元素数组
     * @param {Object} options - 配置选项
     */
    removeMany(elements, options = {}) {
        if (!Array.isArray(elements)) {
            console.warn('[DOMScheduler] Invalid elements');
            return;
        }

        this.schedule(() => {
            for (const el of elements) {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            }

            eventBus.emit('dom:batch-removed', {
                count: elements.length
            });
        }, { ...options, batch: true });
    }

    /**
     * 批量更新元素属性
     * @param {Array} updates - 更新数组: [{ element, props }]
     * @param {Object} options - 配置选项
     */
    updateMany(updates, options = {}) {
        if (!Array.isArray(updates)) {
            console.warn('[DOMScheduler] Invalid updates');
            return;
        }

        this.schedule(() => {
            for (const { element, props } of updates) {
                if (!element || !props) continue;

                for (const [key, value] of Object.entries(props)) {
                    element[key] = value;
                }
            }

            eventBus.emit('dom:batch-updated', {
                count: updates.length
            });
        }, { ...options, batch: true });
    }

    /**
     * 延迟执行操作
     * @param {Function} operation - 操作函数
     * @param {number} delay - 延迟时间(ms)
     */
    delay(operation, delay) {
        if (typeof operation !== 'function') return;

        setTimeout(() => {
            this.schedule(operation);
        }, delay);
    }

    /**
     * 清空队列
     */
    clear() {
        this.queue = [];
        this.isProcessing = false;

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (this.idleId) {
            cancelIdleCallback(this.idleId);
            this.idleId = null;
        }

        console.log('[DOMScheduler] Queue cleared');
    }

    /**
     * 获取队列状态
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            useIdleCallback: this.useIdleCallback
        };
    }
}

// 创建全局单例
export const domScheduler = new DOMScheduler();
