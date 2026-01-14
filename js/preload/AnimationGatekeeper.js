/**
 * PureSuck AnimationGatekeeper - 动画守门员
 * 控制动画触发时机，确保动画在最佳条件下执行
 * 提供动画锁机制，与SwupManager和AnimationController集成
 * 
 * @module preload/AnimationGatekeeper
 */

import { eventBus } from '../core/EventBus.js';
import { animationController } from '../animation/AnimationController.js';
import { pageStabilityMonitor } from './PageStabilityMonitor.js';
import { sequentialTaskQueue } from './SequentialTaskQueue.js';

/**
 * 锁状态枚举
 * @readonly
 * @enum {string}
 */
export const LockState = {
    /** 未锁定 */
    UNLOCKED: 'unlocked',
    /** 已锁定 */
    LOCKED: 'locked',
    /** 等待解锁中 */
    WAITING: 'waiting'
};

/**
 * 动画请求状态
 * @typedef {Object} AnimationRequest
 * @property {string} id - 请求ID
 * @property {string} type - 动画类型
 * @property {Element[]} elements - 目标元素
 * @property {Object} options - 动画选项
 * @property {number} timestamp - 请求时间戳
 * @property {string} status - 请求状态
 * @property {number} executeTime - 执行时间戳
 * @property {number} completeTime - 完成时间戳
 * @property {Error|null} error - 错误信息
 */

/**
 * AnimationGatekeeper - 动画守门员类
 */
export class AnimationGatekeeper {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {number} [options.unlockTimeout=10000] - 等待解锁的超时时间(ms)
     * @param {number} [options.minStabilityScore=80] - 最小稳定性评分
     * @param {number} [options.minFrameRate=30] - 最小帧率(fps)
     * @param {boolean} [options.enableAutoUnlock=true] - 是否启用自动解锁
     * @param {boolean} [options.debug=false] - 是否启用调试模式
     */
    constructor(options = {}) {
        /**
         * 锁定原因集合
         * @type {Set<string>}
         * @private
         */
        this._lockReasons = new Set();

        /**
         * 当前锁状态
         * @type {LockState}
         * @private
         */
        this._lockState = LockState.UNLOCKED;

        /**
         * 等待解锁的Promise resolve函数数组
         * @type {Array<Function>}
         * @private
         */
        this._unlockResolvers = [];

        /**
         * 等待解锁的超时定时器
         * @type {Map<number, Function>}
         * @private
         */
        this._timeoutResolvers = new Map();

        /**
         * 动画请求历史
         * @type {Array<AnimationRequest>}
         * @private
         */
        this._requestHistory = [];

        /**
         * 锁定/解锁历史
         * @type {Array<Object>}
         * @private
         */
        this._lockHistory = [];

        /**
         * 最大历史记录数
         * @type {number}
         * @private
         */
        this._maxHistorySize = 100;

        /**
         * 是否正在执行动画
         * @type {boolean}
         * @private
         */
        this._isAnimating = false;

        /**
         * 当前动画请求
         * @type {AnimationRequest|null}
         * @private
         */
        this._currentRequest = null;

        /**
         * 请求计数器
         * @type {number}
         * @private
         */
        this._requestCounter = 0;

        // 配置选项
        this._unlockTimeout = options.unlockTimeout || 10000;
        this._minStabilityScore = options.minStabilityScore !== undefined ? options.minStabilityScore : 80;
        this._minFrameRate = options.minFrameRate || 30;
        this._enableAutoUnlock = options.enableAutoUnlock !== false;
        this._debug = options.debug || false;

        // 事件订阅清理函数
        this._eventUnsubscribers = [];

        this._log('AnimationGatekeeper initialized with options:', options);
        this._setupEventListeners();
    }

    /**
     * 锁定动画
     * @public
     * @param {string} reason - 锁定原因
     * @returns {AnimationGatekeeper} 返回this以支持链式调用
     */
    lock(reason) {
        if (!reason || typeof reason !== 'string') {
            this._log('Invalid lock reason', 'warn');
            return this;
        }

        // 如果已经锁定，只添加原因
        if (this._lockState === LockState.LOCKED) {
            if (this._lockReasons.has(reason)) {
                this._log(`Already locked with reason: ${reason}`, 'warn');
                return this;
            }

            this._lockReasons.add(reason);
            this._recordLockHistory('lock', reason);
            this._log(`Added lock reason: ${reason}`);
            return this;
        }

        // 设置锁定状态
        this._lockState = LockState.LOCKED;
        this._lockReasons.add(reason);
        this._recordLockHistory('lock', reason);

        // 发布锁定事件
        eventBus.emit('animation:gatekeeper:locked', {
            reason,
            reasons: Array.from(this._lockReasons)
        });

        this._log(`Locked: ${reason}`);
        return this;
    }

    /**
     * 解锁动画
     * @public
     * @param {string} [reason] - 解锁原因（可选）
     * @returns {AnimationGatekeeper} 返回this以支持链式调用
     */
    unlock(reason) {
        if (this._lockState === LockState.UNLOCKED) {
            this._log('Already unlocked', 'warn');
            return this;
        }

        // 如果指定了原因，移除该原因
        if (reason && typeof reason === 'string') {
            if (!this._lockReasons.has(reason)) {
                this._log(`Lock reason not found: ${reason}`, 'warn');
                return this;
            }

            this._lockReasons.delete(reason);
            this._recordLockHistory('unlock', reason);
            this._log(`Removed lock reason: ${reason}`);

            // 如果还有其他锁定原因，保持锁定状态
            if (this._lockReasons.size > 0) {
                this._log(`Still locked with reasons: ${Array.from(this._lockReasons).join(', ')}`);
                return this;
            }
        } else {
            // 清除所有锁定原因
            this._lockReasons.clear();
            this._recordLockHistory('unlock', 'all');
            this._log('Cleared all lock reasons');
        }

        // 解锁
        this._lockState = LockState.UNLOCKED;

        // 解析所有等待的Promise
        this._resolveUnlockPromises();

        // 发布解锁事件
        eventBus.emit('animation:gatekeeper:unlocked', {
            reason: reason || 'all'
        });

        this._log('Unlocked');
        return this;
    }

    /**
     * 检查是否锁定
     * @public
     * @returns {boolean} 是否锁定
     */
    isLocked() {
        return this._lockState === LockState.LOCKED;
    }

    /**
     * 等待解锁
     * @public
     * @param {number} [timeout] - 超时时间(ms)，覆盖构造函数的设置
     * @returns {Promise<boolean>} 是否成功解锁（超时返回false）
     */
    async waitForUnlock(timeout) {
        // 如果未锁定，立即返回
        if (!this.isLocked()) {
            return true;
        }

        this._lockState = LockState.WAITING;
        const timeoutMs = timeout || this._unlockTimeout;

        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                this._log(`Wait for unlock timeout after ${timeoutMs}ms`, 'warn');
                this._timeoutResolvers.delete(timeoutId);
                resolve(false);
            }, timeoutMs);

            this._timeoutResolvers.set(timeoutId, resolve);
            this._unlockResolvers.push(() => {
                clearTimeout(timeoutId);
                this._timeoutResolvers.delete(timeoutId);
                resolve(true);
            });

            this._log(`Waiting for unlock (timeout: ${timeoutMs}ms)`);
        });
    }

    /**
     * 请求执行动画
     * @public
     * @param {Object} animationConfig - 动画配置
     * @param {string} animationConfig.type - 动画类型: 'enter', 'exit', 'custom'
     * @param {Element[]} animationConfig.elements - 目标元素数组
     * @param {Object} [animationConfig.options] - 动画选项
     * @param {number} [animationConfig.options.duration] - 动画持续时间(ms)
     * @param {string} [animationConfig.options.easing] - 缓动函数
     * @param {number} [animationConfig.options.delay] - 延迟时间(ms)
     * @param {boolean} [animationConfig.force=false] - 是否强制执行（跳过条件检查）
     * @param {boolean} [animationConfig.skipOnFail=false] - 条件不满足时是否跳过
     * @returns {Promise<boolean>} 是否成功执行动画
     */
    async requestAnimation(animationConfig) {
        const {
            type,
            elements,
            options = {},
            force = false,
            skipOnFail = false
        } = animationConfig;

        // 参数验证
        if (!type || typeof type !== 'string') {
            this._log('Invalid animation type', 'error');
            return false;
        }

        if (!elements || !Array.isArray(elements) || elements.length === 0) {
            this._log('Invalid or empty elements array', 'warn');
            return false;
        }

        // 生成请求ID
        const requestId = `anim-${this._requestCounter++}`;
        const timestamp = Date.now();

        // 创建请求记录
        const request = {
            id: requestId,
            type,
            elements,
            options,
            timestamp,
            status: 'pending',
            executeTime: 0,
            completeTime: 0,
            error: null
        };

        // 发布请求事件
        eventBus.emit('animation:gatekeeper:request', {
            requestId,
            type,
            elementCount: elements.length,
            options
        });

        this._log(`Animation requested: ${type} (${requestId})`);

        // 检查是否正在执行动画
        if (this._isAnimating) {
            this._log('Animation already in progress, request queued', 'warn');
            request.status = 'queued';
            this._addToRequestHistory(request);
            return false;
        }

        // 检查锁状态
        if (this.isLocked()) {
            this._log('Gatekeeper locked, waiting for unlock');
            const unlocked = await this.waitForUnlock();

            if (!unlocked) {
                this._log('Wait for unlock timeout, skipping animation', 'warn');
                request.status = 'timeout';
                request.error = new Error('Wait for unlock timeout');
                this._addToRequestHistory(request);
                return false;
            }
        }

        // 检查前置条件（除非强制执行）
        if (!force) {
            const conditionsMet = this._checkConditions();

            if (!conditionsMet) {
                this._log('Animation conditions not met', 'warn');

                if (skipOnFail) {
                    request.status = 'skipped';
                    request.error = new Error('Conditions not met');
                    this._addToRequestHistory(request);
                    return false;
                }

                // 等待条件满足
                this._log('Waiting for conditions to be met');
                const waited = await this._waitForConditions();

                if (!waited) {
                    this._log('Wait for conditions timeout, skipping animation', 'warn');
                    request.status = 'timeout';
                    request.error = new Error('Wait for conditions timeout');
                    this._addToRequestHistory(request);
                    return false;
                }
            }
        }

        // 执行动画
        return await this._executeAnimation(request);
    }

    /**
     * 强制解锁
     * @public
     */
    forceUnlock() {
        this._log('Force unlock');
        this._lockReasons.clear();
        this._lockState = LockState.UNLOCKED;
        this._resolveUnlockPromises();

        // 发布强制解锁事件
        eventBus.emit('animation:gatekeeper:force-unlock', {
            timestamp: Date.now()
        });
    }

    /**
     * 获取状态
     * @public
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            lockState: this._lockState,
            lockReasons: Array.from(this._lockReasons),
            isAnimating: this._isAnimating,
            currentRequest: this._currentRequest ? {
                id: this._currentRequest.id,
                type: this._currentRequest.type,
                status: this._currentRequest.status
            } : null,
            requestCount: this._requestHistory.length,
            config: {
                unlockTimeout: this._unlockTimeout,
                minStabilityScore: this._minStabilityScore,
                minFrameRate: this._minFrameRate,
                enableAutoUnlock: this._enableAutoUnlock
            }
        };
    }

    /**
     * 获取请求历史
     * @public
     * @param {number} [limit] - 限制返回的记录数
     * @returns {Array<AnimationRequest>} 请求历史
     */
    getRequestHistory(limit) {
        if (limit && limit > 0) {
            return this._requestHistory.slice(-limit);
        }
        return [...this._requestHistory];
    }

    /**
     * 获取锁定历史
     * @public
     * @param {number} [limit] - 限制返回的记录数
     * @returns {Array<Object>} 锁定历史
     */
    getLockHistory(limit) {
        if (limit && limit > 0) {
            return this._lockHistory.slice(-limit);
        }
        return [...this._lockHistory];
    }

    /**
     * 销毁守门员
     * @public
     */
    destroy() {
        // 清除所有超时定时器
        for (const [timeoutId, resolver] of this._timeoutResolvers) {
            clearTimeout(timeoutId);
        }
        this._timeoutResolvers.clear();

        // 清理事件监听器
        for (const unsubscribe of this._eventUnsubscribers) {
            unsubscribe();
        }
        this._eventUnsubscribers = [];

        // 清空历史记录
        this._requestHistory = [];
        this._lockHistory = [];

        this._log('AnimationGatekeeper destroyed');
    }

    // ==================== 私有方法 ====================

    /**
     * 解析所有解锁Promise
     * @private
     */
    _resolveUnlockPromises() {
        const resolvers = [...this._unlockResolvers];
        this._unlockResolvers = [];

        for (const resolve of resolvers) {
            try {
                resolve();
            } catch (error) {
                this._log('Error resolving unlock promise', 'error', error);
            }
        }

        this._log(`Resolved ${resolvers.length} unlock promises`);
    }

    /**
     * 检查前置条件
     * @private
     * @returns {boolean} 条件是否满足
     */
    _checkConditions() {
        const conditions = {
            stability: false,
            tasks: false,
            frameRate: false
        };

        // 检查页面稳定性
        const stabilityScore = pageStabilityMonitor.getStabilityScore();
        conditions.stability = stabilityScore >= this._minStabilityScore;

        // 检查任务完成状态
        const queueStatus = sequentialTaskQueue.getQueueStatus();
        conditions.tasks = queueStatus.state === 'idle' || queueStatus.state === 'completed';

        // 检查帧率
        const metrics = pageStabilityMonitor.getMetrics();
        conditions.frameRate = metrics.currentFrameRate >= this._minFrameRate;

        const allMet = conditions.stability && conditions.tasks && conditions.frameRate;

        this._log('Conditions check:', {
            stability: { score: stabilityScore, met: conditions.stability, threshold: this._minStabilityScore },
            tasks: { state: queueStatus.state, met: conditions.tasks },
            frameRate: { fps: metrics.currentFrameRate, met: conditions.frameRate, threshold: this._minFrameRate },
            allMet
        });

        return allMet;
    }

    /**
     * 等待条件满足
     * @private
     * @param {number} [timeout=5000] - 超时时间(ms)
     * @returns {Promise<boolean>} 是否成功
     */
    async _waitForConditions(timeout = 5000) {
        const startTime = Date.now();

        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this._checkConditions()) {
                    clearInterval(checkInterval);
                    resolve(true);
                }

                // 检查超时
                if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    resolve(false);
                }
            }, 100);
        });
    }

    /**
     * 执行动画
     * @private
     * @param {AnimationRequest} request - 动画请求
     * @returns {Promise<boolean>} 是否成功
     */
    async _executeAnimation(request) {
        this._isAnimating = true;
        this._currentRequest = request;
        request.status = 'executing';
        request.executeTime = Date.now();

        // 发布开始事件
        eventBus.emit('animation:gatekeeper:start', {
            requestId: request.id,
            type: request.type,
            elementCount: request.elements.length
        });

        this._log(`Executing animation: ${request.type} (${request.id})`);

        try {
            // 根据类型执行动画
            let result;
            switch (request.type) {
                case 'enter':
                    result = await animationController.playEnter(request.elements, request.options);
                    break;
                case 'exit':
                    result = await animationController.playExit(request.elements, request.options);
                    break;
                case 'custom':
                    // 自定义动画需要特殊处理
                    result = await this._executeCustomAnimation(request);
                    break;
                default:
                    throw new Error(`Unknown animation type: ${request.type}`);
            }

            // 动画完成
            request.status = 'completed';
            request.completeTime = Date.now();

            // 发布完成事件
            eventBus.emit('animation:gatekeeper:complete', {
                requestId: request.id,
                type: request.type,
                duration: request.completeTime - request.executeTime
            });

            this._log(`Animation completed: ${request.type} (${request.id}) in ${request.completeTime - request.executeTime}ms`);

            this._onAnimationComplete(request);
            return true;

        } catch (error) {
            // 动画失败
            request.status = 'failed';
            request.error = error;
            request.completeTime = Date.now();

            // 发布错误事件
            eventBus.emit('animation:gatekeeper:error', {
                requestId: request.id,
                type: request.type,
                error: error.message,
                stack: error.stack
            });

            this._log(`Animation failed: ${request.type} (${request.id}) - ${error.message}`, 'error');

            this._onAnimationError(error, request);
            return false;

        } finally {
            this._isAnimating = false;
            this._currentRequest = null;
            this._addToRequestHistory(request);
        }
    }

    /**
     * 执行自定义动画
     * @private
     * @param {AnimationRequest} request - 动画请求
     * @returns {Promise<boolean>}
     */
    async _executeCustomAnimation(request) {
        const { elements, options } = request;

        if (!options || !options.animate) {
            throw new Error('Custom animation requires an animate function');
        }

        // 执行自定义动画函数
        const animateFn = options.animate;
        if (typeof animateFn !== 'function') {
            throw new Error('animate option must be a function');
        }

        return await animateFn(elements, options);
    }

    /**
     * 动画完成处理
     * @private
     * @param {AnimationRequest} request - 动画请求
     */
    _onAnimationComplete(request) {
        // 自动解锁（如果启用）
        if (this._enableAutoUnlock && this.isLocked()) {
            this.unlock('animation-complete');
        }

        // 清理动画状态
        this._cleanupAnimation(request);
    }

    /**
     * 动画错误处理
     * @private
     * @param {Error} error - 错误对象
     * @param {AnimationRequest} request - 动画请求
     */
    _onAnimationError(error, request) {
        // 清理动画状态
        this._cleanupAnimation(request);

        // 如果启用自动解锁，即使失败也解锁
        if (this._enableAutoUnlock && this.isLocked()) {
            this.unlock('animation-failed');
        }
    }

    /**
     * 清理动画状态
     * @private
     * @param {AnimationRequest} request - 动画请求
     */
    _cleanupAnimation(request) {
        // 清理元素的动画样式
        if (request.elements) {
            for (const el of request.elements) {
                if (el && el.style) {
                    // 移除will-change属性
                    el.style.willChange = '';
                }
            }
        }
    }

    /**
     * 添加到请求历史
     * @private
     * @param {AnimationRequest} request - 动画请求
     */
    _addToRequestHistory(request) {
        // 深拷贝请求对象
        const requestCopy = {
            id: request.id,
            type: request.type,
            elementCount: request.elements.length,
            status: request.status,
            timestamp: request.timestamp,
            executeTime: request.executeTime,
            completeTime: request.completeTime,
            duration: request.completeTime - request.executeTime,
            error: request.error ? { message: request.error.message } : null
        };

        this._requestHistory.push(requestCopy);

        // 限制历史记录数量
        if (this._requestHistory.length > this._maxHistorySize) {
            this._requestHistory.shift();
        }
    }

    /**
     * 记录锁定历史
     * @private
     * @param {string} action - 动作: 'lock' 或 'unlock'
     * @param {string} reason - 原因
     */
    _recordLockHistory(action, reason) {
        this._lockHistory.push({
            action,
            reason,
            timestamp: Date.now(),
            lockReasons: Array.from(this._lockReasons)
        });

        // 限制历史记录数量
        if (this._lockHistory.length > this._maxHistorySize) {
            this._lockHistory.shift();
        }
    }

    /**
     * 设置事件监听器
     * @private
     */
    _setupEventListeners() {
        // 监听页面稳定事件
        const unsubscribeStability = eventBus.on('stability:achieved', (data) => {
            if (this._debug) {
                this._log(`Stability achieved: ${data.metrics.totalScore}`);
            }

            // 如果启用自动解锁且页面稳定，尝试解锁
            if (this._enableAutoUnlock && this.isLocked()) {
                this.unlock('stability-achieved');
            }
        });
        this._eventUnsubscribers.push(unsubscribeStability);

        // 监听任务队列完成事件
        const unsubscribeTasks = eventBus.on('task:queue:complete', (data) => {
            if (this._debug) {
                this._log(`Task queue completed: ${data.result.completedTasks}/${data.result.totalTasks}`);
            }

            // 如果启用自动解锁且任务完成，尝试解锁
            if (this._enableAutoUnlock && this.isLocked()) {
                this.unlock('tasks-completed');
            }
        });
        this._eventUnsubscribers.push(unsubscribeTasks);

        // 监听Swup导航开始事件
        const unsubscribeSwupStart = eventBus.on('swup:navigation:start', () => {
            this.lock('swup-navigating');
        });
        this._eventUnsubscribers.push(unsubscribeSwupStart);

        // 监听Swup导航完成事件
        const unsubscribeSwupComplete = eventBus.on('swup:navigation:complete', () => {
            this.unlock('swup-navigation-complete');
        });
        this._eventUnsubscribers.push(unsubscribeSwupComplete);
    }

    /**
     * 日志输出
     * @private
     * @param {string} message - 日志消息
     * @param {string} [level='log'] - 日志级别
     * @param {...any} args - 额外参数
     */
    _log(message, level = 'log', ...args) {
        if (!this._debug) return;

        const prefix = '[AnimationGatekeeper]';
        const timestamp = new Date().toISOString();

        switch (level) {
            case 'warn':
                console.warn(`${prefix} [${timestamp}] ${message}`, ...args);
                break;
            case 'error':
                console.error(`${prefix} [${timestamp}] ${message}`, ...args);
                break;
            default:
                console.log(`${prefix} [${timestamp}] ${message}`, ...args);
        }
    }
}

// 创建全局单例
export const animationGatekeeper = new AnimationGatekeeper({
    unlockTimeout: 10000,
    minStabilityScore: 80,
    minFrameRate: 30,
    enableAutoUnlock: true,
    debug: false
});
