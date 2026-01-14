/**
 * PureSuck SequentialTaskQueue - 顺序任务队列管理器
 * 管理所有初始化任务的执行顺序，确保任务按顺序执行，不并行
 * 支持任务优先级和依赖关系，与DOMScheduler集成使用requestIdleCallback
 * 
 * @module preload/SequentialTaskQueue
 */

import { eventBus } from '../core/EventBus.js';
import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';
import { domScheduler } from '../rendering/DOMScheduler.js';

/**
 * 任务优先级枚举
 * @readonly
 * @enum {number}
 */
export const TaskPriority = {
    /** 关键任务（必须立即执行） */
    CRITICAL: 10,
    /** 高优先级 */
    HIGH: 8,
    /** 普通优先级 */
    NORMAL: 5,
    /** 低优先级 */
    LOW: 3
};

/**
 * 任务执行状态枚举
 * @readonly
 * @enum {string}
 */
export const TaskExecutionState = {
    /** 等待执行 */
    PENDING: 'pending',
    /** 正在执行 */
    EXECUTING: 'executing',
    /** 执行完成 */
    COMPLETED: 'completed',
    /** 执行失败 */
    FAILED: 'failed',
    /** 已取消 */
    CANCELLED: 'cancelled',
    /** 已跳过 */
    SKIPPED: 'skipped'
};

/**
 * 队列状态枚举
 * @readonly
 * @enum {string}
 */
export const QueueState = {
    /** 空闲 */
    IDLE: 'idle',
    /** 正在执行 */
    EXECUTING: 'executing',
    /** 已暂停 */
    PAUSED: 'paused',
    /** 已完成 */
    COMPLETED: 'completed',
    /** 已取消 */
    CANCELLED: 'cancelled',
    /** 执行失败 */
    FAILED: 'failed'
};

/**
 * 任务定义
 * @typedef {Object} QueuedTask
 * @property {string} id - 任务ID
 * @property {string} name - 任务名称
 * @property {Function} execute - 执行函数，返回Promise
 * @property {number} priority - 优先级（1-10，10最高）
 * @property {string[]} dependencies - 依赖的任务ID列表
 * @property {TaskExecutionState} state - 执行状态
 * @property {number} timeout - 超时时间（ms）
 * @property {boolean} skipOnError - 出错时是否跳过
 * @property {number} startTime - 开始时间
 * @property {number} endTime - 结束时间
 * @property {number} duration - 执行耗时（ms）
 * @property {Error|null} error - 错误信息
 * @property {Object} metadata - 元数据
 * @property {number} retryCount - 重试次数
 * @property {number} maxRetries - 最大重试次数
 */

/**
 * 队列执行结果
 * @typedef {Object} QueueResult
 * @property {boolean} success - 是否成功
 * @property {number} totalTasks - 总任务数
 * @property {number} completedTasks - 完成的任务数
 * @property {number} failedTasks - 失败的任务数
 * @property {number} skippedTasks - 跳过的任务数
 * @property {number} totalTime - 总耗时（ms）
 * @property {Array<QueuedTask>} tasks - 所有任务
 */

/**
 * SequentialTaskQueue - 顺序任务队列类
 */
export class SequentialTaskQueue {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {boolean} [options.enableProgressiveExecution=true] - 是否启用渐进式执行
     * @param {number} [options.taskTimeout=5000] - 单个任务超时时间（ms）
     * @param {number} [options.totalTimeout=15000] - 总超时时间（ms）
     * @param {number} [options.idleTimeout=100] - requestIdleCallback超时时间（ms）
     * @param {boolean} [options.debug=false] - 是否启用调试模式
     * @param {boolean} [options.enableRetries=true] - 是否启用任务重试
     * @param {number} [options.maxRetries=2] - 最大重试次数
     */
    constructor(options = {}) {
        /**
         * 任务Map（ID -> 任务）
         * @type {Map<string, QueuedTask>}
         * @private
         */
        this._tasks = new Map();

        /**
         * 任务执行顺序（按依赖关系排序）
         * @type {Array<string>}
         * @private
         */
        this._executionOrder = [];

        /**
         * 当前执行索引
         * @type {number}
         * @private
         */
        this._currentIndex = 0;

        /**
         * 队列状态
         * @type {QueueState}
         * @private
         */
        this._state = QueueState.IDLE;

        /**
         * 是否已暂停
         * @type {boolean}
         * @private
         */
        this._isPaused = false;

        /**
         * 任务历史记录
         * @type {Array<QueuedTask>}
         * @private
         */
        this._taskHistory = [];

        /**
         * 最大历史记录数
         * @type {number}
         * @private
         */
        this._maxHistorySize = 50;

        /**
         * AbortController用于取消执行
         * @type {AbortController|null}
         * @private
         */
        this._abortController = null;

        /**
         * 总超时定时器
         * @type {number|null}
         * @private
         */
        this._totalTimeoutId = null;

        // 配置选项
        this._enableProgressiveExecution = options.enableProgressiveExecution !== false;
        this._taskTimeout = options.taskTimeout || 5000;
        this._totalTimeout = options.totalTimeout || 15000;
        this._idleTimeout = options.idleTimeout || 100;
        this._debug = options.debug || false;
        this._enableRetries = options.enableRetries !== false;
        this._maxRetries = options.maxRetries || 2;

        // 性能指标
        this._metrics = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            skippedTasks: 0,
            totalTime: 0,
            averageTaskTime: 0
        };

        // 执行开始时间
        this._executionStartTime = 0;

        // 事件订阅清理函数
        this._eventUnsubscribers = [];

        this._log('SequentialTaskQueue initialized with options:', options);
        this._setupEventListeners();
    }

    /**
     * 添加任务
     * @public
     * @param {Object} task - 任务定义
     * @param {string} task.id - 任务ID
     * @param {string} task.name - 任务名称
     * @param {Function} task.execute - 执行函数
     * @param {number} [task.priority=5] - 优先级（1-10）
     * @param {string[]} [task.dependencies=[]] - 依赖的任务ID列表
     * @param {number} [task.timeout=5000] - 超时时间（ms）
     * @param {boolean} [task.skipOnError=true] - 出错时是否跳过
     * @param {number} [task.maxRetries=2] - 最大重试次数
     * @param {Object} [task.metadata={}] - 元数据
     * @returns {SequentialTaskQueue} 返回this以支持链式调用
     */
    addTask(task) {
        // 参数验证
        if (!task.id || typeof task.id !== 'string') {
            throw new Error('Task must have a valid id');
        }
        if (!task.name || typeof task.name !== 'string') {
            throw new Error('Task must have a valid name');
        }
        if (typeof task.execute !== 'function') {
            throw new Error('Task must have an execute function');
        }

        // 检查任务ID是否已存在
        if (this._tasks.has(task.id)) {
            this._log(`Task with id "${task.id}" already exists, updating`, 'warn');
        }

        // 创建任务对象
        const queuedTask = {
            id: task.id,
            name: task.name,
            execute: task.execute,
            priority: task.priority || TaskPriority.NORMAL,
            dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
            state: TaskExecutionState.PENDING,
            timeout: task.timeout || this._taskTimeout,
            skipOnError: task.skipOnError !== false,
            startTime: 0,
            endTime: 0,
            duration: 0,
            error: null,
            metadata: task.metadata || {},
            retryCount: 0,
            maxRetries: task.maxRetries !== undefined ? task.maxRetries : this._maxRetries
        };

        // 存储任务
        this._tasks.set(task.id, queuedTask);
        this._metrics.totalTasks = this._tasks.size;

        // 发布任务添加事件
        eventBus.emit('task:queue:taskAdded', {
            taskId: task.id,
            taskName: task.name,
            priority: queuedTask.priority,
            dependencies: queuedTask.dependencies
        });

        this._log(`Task added: ${task.id} (${task.name})`);
        return this;
    }

    /**
     * 批量添加任务
     * @public
     * @param {Array<Object>} tasks - 任务数组
     * @returns {SequentialTaskQueue} 返回this以支持链式调用
     */
    addTasks(tasks) {
        if (!Array.isArray(tasks)) {
            throw new Error('tasks must be an array');
        }

        for (const task of tasks) {
            this.addTask(task);
        }

        return this;
    }

    /**
     * 移除任务
     * @public
     * @param {string} taskId - 任务ID
     * @returns {boolean} 是否成功移除
     */
    removeTask(taskId) {
        if (!this._tasks.has(taskId)) {
            this._log(`Task not found: ${taskId}`, 'warn');
            return false;
        }

        // 检查任务是否正在执行
        const task = this._tasks.get(taskId);
        if (task.state === TaskExecutionState.EXECUTING) {
            this._log(`Cannot remove executing task: ${taskId}`, 'warn');
            return false;
        }

        this._tasks.delete(taskId);
        this._metrics.totalTasks = this._tasks.size;

        // 发布任务移除事件
        eventBus.emit('task:queue:taskRemoved', { taskId });

        this._log(`Task removed: ${taskId}`);
        return true;
    }

    /**
     * 清空队列
     * @public
     */
    clear() {
        // 取消当前执行
        if (this._state === QueueState.EXECUTING) {
            this.cancel();
        }

        // 清空任务
        this._tasks.clear();
        this._executionOrder = [];
        this._currentIndex = 0;
        this._state = QueueState.IDLE;

        // 重置指标
        this._metrics = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            skippedTasks: 0,
            totalTime: 0,
            averageTaskTime: 0
        };

        // 发布队列清空事件
        eventBus.emit('task:queue:cleared');

        this._log('Queue cleared');
    }

    /**
     * 执行所有任务
     * @public
     * @returns {Promise<QueueResult>} 执行结果
     */
    async execute() {
        // 检查状态
        if (this._state === QueueState.EXECUTING) {
            this._log('Queue is already executing', 'warn');
            return this._createResult(false, 'Queue is already executing');
        }

        if (this._tasks.size === 0) {
            this._log('No tasks to execute', 'warn');
            return this._createResult(true, 'No tasks to execute');
        }

        // 重置状态
        this._state = QueueState.EXECUTING;
        this._isPaused = false;
        this._currentIndex = 0;
        this._executionStartTime = performance.now();
        this._abortController = new AbortController();

        // 重置任务状态
        for (const task of this._tasks.values()) {
            task.state = TaskExecutionState.PENDING;
            task.error = null;
            task.retryCount = 0;
        }

        // 重置指标
        this._metrics = {
            totalTasks: this._tasks.size,
            completedTasks: 0,
            failedTasks: 0,
            skippedTasks: 0,
            totalTime: 0,
            averageTaskTime: 0
        };

        // 解析执行顺序（拓扑排序）
        try {
            this._resolveExecutionOrder();
        } catch (error) {
            this._state = QueueState.FAILED;
            this._handleError(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.HIGH,
                message: '任务依赖解析失败'
            });
            return this._createResult(false, 'Failed to resolve task dependencies', error);
        }

        // 设置总超时
        this._setupTotalTimeout();

        // 发布队列开始事件
        eventBus.emit('task:queue:start', {
            taskCount: this._tasks.size,
            executionOrder: this._executionOrder
        });

        this._log(`Starting execution of ${this._tasks.size} tasks`);

        try {
            // 执行任务
            await this._executeAllTasks();

            // 计算总耗时
            const totalTime = performance.now() - this._executionStartTime;
            this._metrics.totalTime = totalTime;

            // 更新状态
            this._state = QueueState.COMPLETED;

            // 清理总超时定时器
            this._clearTotalTimeout();

            // 发布队列完成事件
            eventBus.emit('task:queue:complete', {
                result: this._createResult(true, 'All tasks completed'),
                metrics: this._metrics
            });

            this._log(`Queue completed in ${totalTime.toFixed(2)}ms`);
            return this._createResult(true, 'All tasks completed');

        } catch (error) {
            // 更新状态
            this._state = QueueState.FAILED;

            // 清理总超时定时器
            this._clearTotalTimeout();

            // 错误处理
            this._handleError(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.MEDIUM,
                message: '任务队列执行失败',
                metadata: { failedTasks: this._metrics.failedTasks }
            });

            // 发布队列失败事件
            eventBus.emit('task:queue:failed', {
                error: error.message,
                metrics: this._metrics
            });

            this._log(`Queue failed: ${error.message}`, 'error');
            return this._createResult(false, 'Queue execution failed', error);
        } finally {
            this._abortController = null;
        }
    }

    /**
     * 暂停执行
     * @public
     */
    pause() {
        if (this._state !== QueueState.EXECUTING) {
            this._log('Cannot pause: queue is not executing', 'warn');
            return;
        }

        this._isPaused = true;
        this._state = QueueState.PAUSED;

        // 发布暂停事件
        eventBus.emit('task:queue:paused');

        this._log('Queue paused');
    }

    /**
     * 恢复执行
     * @public
     */
    resume() {
        if (this._state !== QueueState.PAUSED) {
            this._log('Cannot resume: queue is not paused', 'warn');
            return;
        }

        this._isPaused = false;
        this._state = QueueState.EXECUTING;

        // 继续执行
        this._executeNextTask();

        // 发布恢复事件
        eventBus.emit('task:queue:resumed');

        this._log('Queue resumed');
    }

    /**
     * 取消执行
     * @public
     */
    cancel() {
        if (this._state === QueueState.IDLE || this._state === QueueState.COMPLETED) {
            return;
        }

        // 取消AbortController
        if (this._abortController) {
            this._abortController.abort();
        }

        // 清理总超时定时器
        this._clearTotalTimeout();

        // 更新状态
        this._state = QueueState.CANCELLED;
        this._isPaused = false;

        // 标记所有未完成的任务为已取消
        for (const task of this._tasks.values()) {
            if (task.state === TaskExecutionState.PENDING || 
                task.state === TaskExecutionState.EXECUTING) {
                task.state = TaskExecutionState.CANCELLED;
            }
        }

        // 发布取消事件
        eventBus.emit('task:queue:cancelled', {
            currentIndex: this._currentIndex,
            remainingTasks: this._executionOrder.length - this._currentIndex
        });

        this._log('Queue cancelled');
    }

    /**
     * 获取队列状态
     * @public
     * @returns {Object} 状态信息
     */
    getQueueStatus() {
        return {
            state: this._state,
            isPaused: this._isPaused,
            currentIndex: this._currentIndex,
            totalTasks: this._tasks.size,
            executionOrder: [...this._executionOrder],
            metrics: { ...this._metrics },
            enableProgressiveExecution: this._enableProgressiveExecution,
            taskTimeout: this._taskTimeout,
            totalTimeout: this._totalTimeout
        };
    }

    /**
     * 获取任务历史记录
     * @public
     * @param {number} [limit] - 限制返回的记录数
     * @returns {Array<QueuedTask>} 任务历史记录
     */
    getTaskHistory(limit) {
        if (limit && limit > 0) {
            return this._taskHistory.slice(-limit);
        }
        return [...this._taskHistory];
    }

    /**
     * 获取任务状态
     * @public
     * @param {string} taskId - 任务ID
     * @returns {QueuedTask|null} 任务对象
     */
    getTaskStatus(taskId) {
        const task = this._tasks.get(taskId);
        if (!task) {
            return null;
        }
        return {
            id: task.id,
            name: task.name,
            state: task.state,
            priority: task.priority,
            dependencies: task.dependencies,
            duration: task.duration,
            error: task.error ? task.error.message : null,
            retryCount: task.retryCount
        };
    }

    /**
     * 获取所有任务状态
     * @public
     * @returns {Array<Object>} 所有任务状态
     */
    getAllTaskStatus() {
        const statuses = [];
        for (const task of this._tasks.values()) {
            statuses.push({
                id: task.id,
                name: task.name,
                state: task.state,
                priority: task.priority,
                dependencies: task.dependencies,
                duration: task.duration,
                error: task.error ? task.error.message : null,
                retryCount: task.retryCount
            });
        }
        return statuses;
    }

    /**
     * 销毁队列
     * @public
     */
    destroy() {
        // 取消执行
        this.cancel();

        // 清空任务
        this._tasks.clear();
        this._executionOrder = [];
        this._taskHistory = [];

        // 清理事件监听器
        for (const unsubscribe of this._eventUnsubscribers) {
            unsubscribe();
        }
        this._eventUnsubscribers = [];

        this._log('SequentialTaskQueue destroyed');
    }

    // ==================== 私有方法 ====================

    /**
     * 解析执行顺序（拓扑排序）
     * @private
     */
    _resolveExecutionOrder() {
        const visited = new Set();
        const visiting = new Set();
        const order = [];

        const visit = (taskId) => {
            if (visited.has(taskId)) return;
            if (visiting.has(taskId)) {
                throw new Error(`Circular dependency detected: ${taskId}`);
            }

            // 检查任务是否存在
            if (!this._tasks.has(taskId)) {
                this._log(`Dependency task not found: ${taskId}`, 'warn');
                return;
            }

            visiting.add(taskId);

            const task = this._tasks.get(taskId);

            // 先执行依赖的任务
            for (const depId of task.dependencies) {
                visit(depId);
            }

            visiting.delete(taskId);
            visited.add(taskId);
            order.push(taskId);
        };

        // 遍历所有任务
        for (const taskId of this._tasks.keys()) {
            visit(taskId);
        }

        this._executionOrder = order;
        this._log(`Execution order resolved: ${order.join(' -> ')}`);
    }

    /**
     * 执行所有任务
     * @private
     * @returns {Promise<void>}
     */
    async _executeAllTasks() {
        while (this._currentIndex < this._executionOrder.length) {
            // 检查是否已取消
            if (this._abortController && this._abortController.signal.aborted) {
                throw new Error('Queue execution cancelled');
            }

            // 检查是否已暂停
            if (this._isPaused) {
                // 等待恢复
                await new Promise(resolve => {
                    const checkResume = () => {
                        if (!this._isPaused || this._state === QueueState.CANCELLED) {
                            resolve();
                        } else {
                            requestAnimationFrame(checkResume);
                        }
                    };
                    checkResume();
                });

                // 如果已取消，抛出错误
                if (this._state === QueueState.CANCELLED) {
                    throw new Error('Queue execution cancelled');
                }
            }

            // 执行下一个任务
            await this._executeNextTask();
        }
    }

    /**
     * 执行下一个任务
     * @private
     * @returns {Promise<void>}
     */
    async _executeNextTask() {
        if (this._currentIndex >= this._executionOrder.length) {
            return;
        }

        const taskId = this._executionOrder[this._currentIndex];
        const task = this._tasks.get(taskId);

        if (!task) {
            this._log(`Task not found: ${taskId}`, 'warn');
            this._currentIndex++;
            return;
        }

        // 检查任务状态
        if (task.state === TaskExecutionState.COMPLETED || 
            task.state === TaskExecutionState.SKIPPED) {
            this._currentIndex++;
            return;
        }

        // 使用渐进式执行
        if (this._enableProgressiveExecution) {
            await this._waitForIdle();
        }

        // 执行任务
        await this._executeTask(task);

        // 移动到下一个任务
        this._currentIndex++;
    }

    /**
     * 执行任务
     * @private
     * @param {QueuedTask} task - 任务对象
     * @returns {Promise<void>}
     */
    async _executeTask(task) {
        task.state = TaskExecutionState.EXECUTING;
        task.startTime = performance.now();

        // 发布任务开始事件
        eventBus.emit('task:start', {
            taskId: task.id,
            taskName: task.name,
            priority: task.priority
        });

        this._log(`Executing task: ${task.id} (${task.name})`);

        try {
            // 设置任务超时
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Task timeout after ${task.timeout}ms`));
                }, task.timeout);
            });

            // 执行任务
            const executePromise = task.execute();

            // 等待任务完成或超时
            await Promise.race([executePromise, timeoutPromise]);

            // 任务完成
            task.endTime = performance.now();
            task.duration = task.endTime - task.startTime;
            task.state = TaskExecutionState.COMPLETED;
            this._metrics.completedTasks++;

            // 更新平均任务时间
            this._updateAverageTaskTime(task.duration);

            // 发布任务完成事件
            eventBus.emit('task:complete', {
                taskId: task.id,
                taskName: task.name,
                duration: task.duration
            });

            this._log(`Task completed: ${task.id} in ${task.duration.toFixed(2)}ms`);

            // 添加到历史记录
            this._addToHistory(task);

        } catch (error) {
            // 任务失败
            task.error = error;
            task.endTime = performance.now();
            task.duration = task.endTime - task.startTime;

            // 检查是否可以重试
            if (this._enableRetries && task.retryCount < task.maxRetries) {
                task.retryCount++;
                this._log(`Task failed, retrying (${task.retryCount}/${task.maxRetries}): ${task.id}`, 'warn');

                // 重新执行任务
                await this._executeTask(task);
                return;
            }

            // 检查是否跳过
            if (task.skipOnError) {
                task.state = TaskExecutionState.SKIPPED;
                this._metrics.skippedTasks++;

                this._log(`Task skipped due to error: ${task.id}`, 'warn');

                // 发布任务跳过事件
                eventBus.emit('task:skipped', {
                    taskId: task.id,
                    taskName: task.name,
                    error: error.message
                });

                // 添加到历史记录
                this._addToHistory(task);
                return;
            }

            // 任务失败
            task.state = TaskExecutionState.FAILED;
            this._metrics.failedTasks++;

            // 错误处理
            this._handleError(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.MEDIUM,
                message: `任务执行失败: ${task.name}`,
                metadata: { taskId: task.id, taskName: task.name }
            });

            // 发布任务错误事件
            eventBus.emit('task:error', {
                taskId: task.id,
                taskName: task.name,
                error: error.message
            });

            this._log(`Task failed: ${task.id} - ${error.message}`, 'error');

            // 添加到历史记录
            this._addToHistory(task);

            // 抛出错误以停止队列执行
            throw error;
        }
    }

    /**
     * 等待浏览器空闲
     * @private
     * @returns {Promise<void>}
     */
    async _waitForIdle() {
        return new Promise((resolve) => {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(
                    () => resolve(),
                    { timeout: this._idleTimeout }
                );
            } else {
                // 降级方案：使用requestAnimationFrame
                requestAnimationFrame(() => resolve());
            }
        });
    }

    /**
     * 设置总超时
     * @private
     */
    _setupTotalTimeout() {
        if (this._totalTimeout > 0) {
            this._totalTimeoutId = setTimeout(() => {
                if (this._state === QueueState.EXECUTING) {
                    this._log(`Total timeout reached: ${this._totalTimeout}ms`, 'warn');
                    this.cancel();
                }
            }, this._totalTimeout);
        }
    }

    /**
     * 清理总超时定时器
     * @private
     */
    _clearTotalTimeout() {
        if (this._totalTimeoutId) {
            clearTimeout(this._totalTimeoutId);
            this._totalTimeoutId = null;
        }
    }

    /**
     * 更新平均任务时间
     * @private
     * @param {number} duration - 任务耗时
     */
    _updateAverageTaskTime(duration) {
        const completedCount = this._metrics.completedTasks;
        if (completedCount === 1) {
            this._metrics.averageTaskTime = duration;
        } else {
            this._metrics.averageTaskTime = 
                (this._metrics.averageTaskTime * (completedCount - 1) + duration) / completedCount;
        }
    }

    /**
     * 添加到历史记录
     * @private
     * @param {QueuedTask} task - 任务对象
     */
    _addToHistory(task) {
        // 深拷贝任务对象
        const taskCopy = {
            id: task.id,
            name: task.name,
            state: task.state,
            priority: task.priority,
            dependencies: [...task.dependencies],
            duration: task.duration,
            error: task.error ? { message: task.error.message, stack: task.error.stack } : null,
            retryCount: task.retryCount,
            timestamp: Date.now()
        };

        this._taskHistory.push(taskCopy);

        // 限制历史记录数量
        if (this._taskHistory.length > this._maxHistorySize) {
            this._taskHistory.shift();
        }
    }

    /**
     * 创建执行结果
     * @private
     * @param {boolean} success - 是否成功
     * @param {string} message - 结果消息
     * @param {Error} [error] - 错误对象
     * @returns {QueueResult} 执行结果
     */
    _createResult(success, message, error) {
        return {
            success,
            message,
            error: error ? error.message : null,
            totalTasks: this._metrics.totalTasks,
            completedTasks: this._metrics.completedTasks,
            failedTasks: this._metrics.failedTasks,
            skippedTasks: this._metrics.skippedTasks,
            totalTime: this._metrics.totalTime,
            averageTaskTime: this._metrics.averageTaskTime,
            tasks: this.getAllTaskStatus()
        };
    }

    /**
     * 处理错误
     * @private
     * @param {Error} error - 错误对象
     * @param {Object} context - 错误上下文
     */
    _handleError(error, context) {
        ErrorBoundary.handle(error, context);
    }

    /**
     * 设置事件监听器
     * @private
     */
    _setupEventListeners() {
        // 监听性能事件
        const unsubscribeLongTask = eventBus.on('performance:longtask', (data) => {
            if (this._debug) {
                this._log(`Long task detected during queue execution: ${data.duration.toFixed(2)}ms`, 'warn');
            }
        });
        this._eventUnsubscribers.push(unsubscribeLongTask);
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

        const prefix = '[SequentialTaskQueue]';
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

// ==================== 预定义任务工厂 ====================

/**
 * 预定义任务工厂
 */
export class PredefinedTasks {
    /**
     * 创建代码高亮任务
     * @static
     * @returns {Object} 任务定义
     */
    static createHighlightCodeTask() {
        return {
            id: 'highlight-code',
            name: '代码高亮',
            priority: TaskPriority.HIGH,
            dependencies: [],
            execute: async () => {
                if (typeof hljs !== 'undefined') {
                    const blocks = document.querySelectorAll('pre code:not([data-highlighted])');
                    for (const block of blocks) {
                        hljs.highlightElement(block);
                        block.dataset.highlighted = 'true';
                    }
                }
            },
            timeout: 3000,
            skipOnError: true
        };
    }

    /**
     * 创建图片懒加载任务
     * @static
     * @returns {Object} 任务定义
     */
    static createLazyLoadImagesTask() {
        return {
            id: 'lazy-load-images',
            name: '图片懒加载',
            priority: TaskPriority.NORMAL,
            dependencies: [],
            execute: async () => {
                if (typeof imageLazyLoader !== 'undefined') {
                    imageLazyLoader.autoInit({ eagerCount: 3 });
                }
            },
            timeout: 2000,
            skipOnError: true
        };
    }

    /**
     * 创建TOC初始化任务
     * @static
     * @returns {Object} 任务定义
     */
    static createInitializeTOCTask() {
        return {
            id: 'initialize-toc',
            name: 'TOC初始化',
            priority: TaskPriority.NORMAL,
            dependencies: [],
            execute: async () => {
                if (typeof initializeStickyTOC === 'function') {
                    if (document.querySelector('#toc-section') || document.querySelector('.toc')) {
                        initializeStickyTOC();
                    }
                }
            },
            timeout: 2000,
            skipOnError: true
        };
    }

    /**
     * 创建评论初始化任务
     * @static
     * @returns {Object} 任务定义
     */
    static createInitializeCommentsTask() {
        return {
            id: 'initialize-comments',
            name: '评论初始化',
            priority: TaskPriority.NORMAL,
            dependencies: [],
            execute: async () => {
                if (typeof initializeCommentsOwO === 'function') {
                    initializeCommentsOwO();
                }
            },
            timeout: 2000,
            skipOnError: true
        };
    }

    /**
     * 创建Shortcodes初始化任务
     * @static
     * @returns {Object} 任务定义
     */
    static createInitializeShortcodesTask() {
        return {
            id: 'initialize-shortcodes',
            name: 'Shortcodes初始化',
            priority: TaskPriority.NORMAL,
            dependencies: [],
            execute: async () => {
                // 初始化各种短代码组件
                const shortcodes = document.querySelectorAll('[data-shortcode]');
                for (const element of shortcodes) {
                    const type = element.dataset.shortcode;
                    // 根据类型初始化不同的短代码
                    if (typeof window[`init${type}`] === 'function') {
                        window[`init${type}`](element);
                    }
                }
            },
            timeout: 2000,
            skipOnError: true
        };
    }

    /**
     * 创建标签页初始化任务
     * @static
     * @returns {Object} 任务定义
     */
    static createInitializeTabsTask() {
        return {
            id: 'initialize-tabs',
            name: '标签页初始化',
            priority: TaskPriority.NORMAL,
            dependencies: [],
            execute: async () => {
                if (typeof TabModule !== 'undefined') {
                    const tabs = document.querySelectorAll('.tab-container');
                    for (const tab of tabs) {
                        new TabModule(tab);
                    }
                }
            },
            timeout: 2000,
            skipOnError: true
        };
    }

    /**
     * 创建折叠面板初始化任务
     * @static
     * @returns {Object} 任务定义
     */
    static createInitializeCollapsibleTask() {
        return {
            id: 'initialize-collapsible',
            name: '折叠面板初始化',
            priority: TaskPriority.NORMAL,
            dependencies: [],
            execute: async () => {
                if (typeof CollapsiblePanel !== 'undefined') {
                    const panels = document.querySelectorAll('.collapsible-panel');
                    for (const panel of panels) {
                        new CollapsiblePanel(panel);
                    }
                }
            },
            timeout: 2000,
            skipOnError: true
        };
    }

    /**
     * 获取所有预定义任务
     * @static
     * @returns {Array<Object>} 任务数组
     */
    static getAllTasks() {
        return [
            this.createHighlightCodeTask(),
            this.createLazyLoadImagesTask(),
            this.createInitializeTOCTask(),
            this.createInitializeCommentsTask(),
            this.createInitializeShortcodesTask(),
            this.createInitializeTabsTask(),
            this.createInitializeCollapsibleTask()
        ];
    }
}

// 创建全局单例
export const sequentialTaskQueue = new SequentialTaskQueue({
    enableProgressiveExecution: true,
    taskTimeout: 5000,
    totalTimeout: 15000,
    idleTimeout: 100,
    debug: false,
    enableRetries: true,
    maxRetries: 2
});
