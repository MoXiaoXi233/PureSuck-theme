/**
 * PureSuck StateManager - 状态管理器
 * 实现状态机模式管理导航状态
 * 
 * @module core/StateManager
 */

import { eventBus } from './EventBus.js';

/**
 * 导航状态枚举
 * @readonly
 * @enum {string}
 */
export const NavigationState = {
    /** 空闲状态，无导航进行中 */
    IDLE: 'idle',
    /** 导航中，正在加载新页面 */
    NAVIGATING: 'navigating',
    /** 退出动画中，正在执行页面退出动画 */
    ANIMATING_EXIT: 'animating_exit',
    /** 进入动画中，正在执行页面进入动画 */
    ANIMATING_ENTER: 'animating_enter',
    /** 错误状态，发生错误 */
    ERROR: 'error'
};

/**
 * 状态转换规则
 * 定义每个状态可以转换到的下一个状态
 * @private
 */
const STATE_TRANSITIONS = {
    [NavigationState.IDLE]: [NavigationState.NAVIGATING],
    [NavigationState.NAVIGATING]: [NavigationState.ANIMATING_EXIT, NavigationState.ERROR],
    [NavigationState.ANIMATING_EXIT]: [NavigationState.ANIMATING_ENTER, NavigationState.ERROR],
    [NavigationState.ANIMATING_ENTER]: [NavigationState.IDLE, NavigationState.ERROR],
    [NavigationState.ERROR]: [NavigationState.IDLE]
};

/**
 * 状态事件名称
 * @private
 */
const STATE_EVENTS = {
    STATE_CHANGE: 'state:change',
    STATE_ERROR: 'state:error',
    STATE_RESET: 'state:reset'
};

/**
 * 状态管理器类
 * 使用状态机模式管理导航状态
 */
export class StateManager {
    /**
     * 创建状态管理器实例
     * @param {Object} options - 配置选项
     * @param {boolean} [options.enablePersistence=true] - 是否启用状态持久化
     * @param {boolean} [options.enableLogging=false] - 是否启用日志记录
     */
    constructor(options = {}) {
        this._currentState = NavigationState.IDLE;
        this._previousState = null;
        this._stateHistory = [];
        this._maxHistoryLength = 50;
        this._enablePersistence = options.enablePersistence !== false;
        this._enableLogging = options.enableLogging || false;
        this._subscribers = new Map();
        this._isLocked = false;

        // 从history.state恢复状态
        if (this._enablePersistence) {
            this._restoreFromHistory();
        }

        this._log('StateManager initialized', { 
            state: this._currentState,
            persistence: this._enablePersistence 
        });
    }

    /**
     * 获取当前状态
     * @returns {string} 当前状态
     */
    getCurrentState() {
        return this._currentState;
    }

    /**
     * 获取上一个状态
     * @returns {string|null} 上一个状态，如果没有则返回null
     */
    getPreviousState() {
        return this._previousState;
    }

    /**
     * 获取状态历史记录
     * @returns {Array<{state: string, timestamp: number}>} 状态历史记录
     */
    getStateHistory() {
        return [...this._stateHistory];
    }

    /**
     * 设置新状态
     * @param {string} newState - 新状态
     * @param {Object} [metadata={}] - 附加元数据
     * @returns {boolean} 是否成功设置状态
     * @throws {Error} 如果状态转换无效
     */
    setState(newState, metadata = {}) {
        // 检查是否被锁定
        if (this._isLocked) {
            this._log('State is locked, cannot change state', { 
                current: this._currentState, 
                requested: newState 
            });
            return false;
        }

        // 验证状态
        if (!this._isValidState(newState)) {
            const error = new Error(`Invalid state: ${newState}`);
            this._handleError(error, 'setState');
            return false;
        }

        // 验证状态转换
        if (!this._canTransitionTo(newState)) {
            const error = new Error(
                `Invalid state transition from ${this._currentState} to ${newState}`
            );
            this._handleError(error, 'setState');
            return false;
        }

        // 记录状态转换
        const transition = {
            from: this._currentState,
            to: newState,
            timestamp: Date.now(),
            metadata
        };

        // 更新状态
        this._previousState = this._currentState;
        this._currentState = newState;

        // 添加到历史记录
        this._addToHistory(transition);

        // 持久化到history.state
        if (this._enablePersistence) {
            this._persistToHistory();
        }

        // 发布状态变更事件
        this._emitStateChange(transition);

        // 通知订阅者
        this._notifySubscribers(transition);

        this._log('State changed', transition);

        return true;
    }

    /**
     * 重置状态到初始状态
     * @param {Object} [options={}] - 重置选项
     * @param {boolean} [options.clearHistory=true] - 是否清除历史记录
     * @returns {boolean} 是否成功重置
     */
    reset(options = {}) {
        const { clearHistory = true } = options;

        const transition = {
            from: this._currentState,
            to: NavigationState.IDLE,
            timestamp: Date.now(),
            metadata: { reason: 'reset' }
        };

        this._previousState = this._currentState;
        this._currentState = NavigationState.IDLE;

        if (clearHistory) {
            this._stateHistory = [];
        }

        // 持久化到history.state
        if (this._enablePersistence) {
            this._persistToHistory();
        }

        // 发布状态重置事件
        eventBus.emit(STATE_EVENTS.STATE_RESET, transition);

        // 通知订阅者
        this._notifySubscribers(transition);

        this._log('State reset', { clearHistory });

        return true;
    }

    /**
     * 检查是否可以转换到指定状态
     * @param {string} targetState - 目标状态
     * @returns {boolean} 是否可以转换
     */
    canTransitionTo(targetState) {
        return this._canTransitionTo(targetState);
    }

    /**
     * 订阅状态变更
     * @param {Function} callback - 回调函数，接收transition对象
     * @returns {Function} 取消订阅函数
     */
    subscribe(callback) {
        if (typeof callback !== 'function') {
            console.warn('[StateManager] Invalid callback for subscription');
            return () => {};
        }

        const id = Symbol('subscriber');
        this._subscribers.set(id, callback);

        return () => {
            this._subscribers.delete(id);
        };
    }

    /**
     * 锁定状态，防止状态变更
     * @param {string} [reason] - 锁定原因
     */
    lock(reason) {
        this._isLocked = true;
        this._log('State locked', { reason });
    }

    /**
     * 解锁状态
     * @param {string} [reason] - 解锁原因
     */
    unlock(reason) {
        this._isLocked = false;
        this._log('State unlocked', { reason });
    }

    /**
     * 检查状态是否被锁定
     * @returns {boolean} 是否被锁定
     */
    isLocked() {
        return this._isLocked;
    }

    /**
     * 获取状态转换路径
     * @param {string} fromState - 起始状态
     * @param {string} toState - 目标状态
     * @returns {Array<string>|null} 转换路径，如果无法转换则返回null
     */
    getTransitionPath(fromState, toState) {
        if (fromState === toState) {
            return [];
        }

        // 使用BFS查找最短路径
        const queue = [[fromState]];
        const visited = new Set([fromState]);

        while (queue.length > 0) {
            const path = queue.shift();
            const currentState = path[path.length - 1];

            const nextStates = STATE_TRANSITIONS[currentState] || [];
            for (const nextState of nextStates) {
                if (nextState === toState) {
                    return [...path, nextState];
                }

                if (!visited.has(nextState)) {
                    visited.add(nextState);
                    queue.push([...path, nextState]);
                }
            }
        }

        return null;
    }

    /**
     * 验证状态是否有效
     * @private
     * @param {string} state - 状态
     * @returns {boolean} 是否有效
     */
    _isValidState(state) {
        return Object.values(NavigationState).includes(state);
    }

    /**
     * 检查是否可以转换到目标状态
     * @private
     * @param {string} targetState - 目标状态
     * @returns {boolean} 是否可以转换
     */
    _canTransitionTo(targetState) {
        const allowedStates = STATE_TRANSITIONS[this._currentState] || [];
        return allowedStates.includes(targetState);
    }

    /**
     * 添加到历史记录
     * @private
     * @param {Object} transition - 状态转换
     */
    _addToHistory(transition) {
        this._stateHistory.push(transition);

        // 限制历史记录长度
        if (this._stateHistory.length > this._maxHistoryLength) {
            this._stateHistory.shift();
        }
    }

    /**
     * 持久化状态到history.state
     * @private
     */
    _persistToHistory() {
        try {
            const currentState = history.state || {};
            history.replaceState({
                ...currentState,
                pureSuckState: {
                    currentState: this._currentState,
                    previousState: this._previousState,
                    timestamp: Date.now()
                }
            }, document.title);
        } catch (error) {
            console.warn('[StateManager] Failed to persist state to history:', error);
        }
    }

    /**
     * 从history.state恢复状态
     * @private
     */
    _restoreFromHistory() {
        try {
            const currentState = history.state || {};
            const pureSuckState = currentState.pureSuckState;

            if (pureSuckState && this._isValidState(pureSuckState.currentState)) {
                this._currentState = pureSuckState.currentState;
                this._previousState = pureSuckState.previousState;
                this._log('State restored from history', pureSuckState);
            }
        } catch (error) {
            console.warn('[StateManager] Failed to restore state from history:', error);
        }
    }

    /**
     * 发布状态变更事件
     * @private
     * @param {Object} transition - 状态转换
     */
    _emitStateChange(transition) {
        eventBus.emit(STATE_EVENTS.STATE_CHANGE, transition);
    }

    /**
     * 通知订阅者
     * @private
     * @param {Object} transition - 状态转换
     */
    _notifySubscribers(transition) {
        for (const [id, callback] of this._subscribers) {
            try {
                callback(transition);
            } catch (error) {
                console.error(`[StateManager] Error in subscriber callback:`, error);
            }
        }
    }

    /**
     * 处理错误
     * @private
     * @param {Error} error - 错误对象
     * @param {string} context - 错误上下文
     */
    _handleError(error, context) {
        console.error(`[StateManager] Error in ${context}:`, error);
        eventBus.emit(STATE_EVENTS.STATE_ERROR, { error, context });
    }

    /**
     * 记录日志
     * @private
     * @param {string} message - 日志消息
     * @param {Object} [data] - 附加数据
     */
    _log(message, data) {
        if (this._enableLogging) {
            console.log(`[StateManager] ${message}`, data || '');
        }
    }

    /**
     * 销毁状态管理器
     */
    destroy() {
        this._subscribers.clear();
        this._stateHistory = [];
        this._currentState = NavigationState.IDLE;
        this._previousState = null;
        this._log('StateManager destroyed');
    }
}

/**
 * 状态事件名称常量
 * @readonly
 * @enum {string}
 */
export const StateEvents = {
    /** 状态变更事件 */
    STATE_CHANGE: STATE_EVENTS.STATE_CHANGE,
    /** 状态错误事件 */
    STATE_ERROR: STATE_EVENTS.STATE_ERROR,
    /** 状态重置事件 */
    STATE_RESET: STATE_EVENTS.STATE_RESET
};

// 创建全局单例
export const stateManager = new StateManager();
