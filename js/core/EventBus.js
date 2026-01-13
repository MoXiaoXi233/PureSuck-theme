/**
 * PureSuck EventBus - 事件总线
 * 提供事件发布订阅机制,用于模块间通信
 */

export class EventBus {
    constructor() {
        this.events = new Map();
    }

    /**
     * 订阅事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    on(event, callback) {
        if (typeof callback !== 'function') {
            console.warn(`[EventBus] Invalid callback for event: ${event}`);
            return () => {};
        }

        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const callbacks = this.events.get(event);
        callbacks.push(callback);

        // 返回取消订阅函数
        return () => this.off(event, callback);
    }

    /**
     * 取消订阅事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        if (!this.events.has(event)) return;

        const callbacks = this.events.get(event);
        const index = callbacks.indexOf(callback);

        if (index > -1) {
            callbacks.splice(index, 1);
        }

        // 如果没有回调了,删除事件
        if (callbacks.length === 0) {
            this.events.delete(event);
        }
    }

    /**
     * 发布事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        if (!this.events.has(event)) return;

        const callbacks = this.events.get(event);
        
        // 创建副本,避免在回调中修改数组
        const callbacksCopy = [...callbacks];

        for (const callback of callbacksCopy) {
            try {
                callback(data);
            } catch (error) {
                console.error(`[EventBus] Error in callback for event "${event}":`, error);
            }
        }
    }

    /**
     * 一次性订阅
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    once(event, callback) {
        if (typeof callback !== 'function') {
            console.warn(`[EventBus] Invalid callback for once event: ${event}`);
            return () => {};
        }

        const onceCallback = (data) => {
            callback(data);
            this.off(event, onceCallback);
        };

        return this.on(event, onceCallback);
    }

    /**
     * 清除所有事件或特定事件的所有回调
     * @param {string} event - 可选,事件名称
     */
    clear(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * 获取事件的订阅者数量
     * @param {string} event - 事件名称
     * @returns {number} 订阅者数量
     */
    listenerCount(event) {
        if (!this.events.has(event)) return 0;
        return this.events.get(event).length;
    }
}

// 创建全局单例
export const eventBus = new EventBus();
