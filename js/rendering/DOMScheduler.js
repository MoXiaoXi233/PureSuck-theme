/**
 * PureSuck DOMScheduler - DOM操作调度器
 * 统一的DOM操作调度器，基于优先级的任务队列，集成AnimationFrameManager优化性能
 * 
 * @module rendering/DOMScheduler
 */

import { eventBus } from '../core/EventBus.js';
import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';
import { animationFrameManager } from '../core/AnimationFrameManager.js';

/**
 * 任务优先级枚举
 * @readonly
 * @enum {string}
 */
export const TaskPriority = {
    /** 高优先级 */
    HIGH: 'high',
    /** 普通优先级 */
    NORMAL: 'normal',
    /** 低优先级 */
    LOW: 'low'
};

/**
 * 任务状态枚举
 * @readonly
 * @enum {string}
 */
export const TaskState = {
    /** 等待中 */
    PENDING: 'pending',
    /** 执行中 */
    EXECUTING: 'executing',
    /** 已完成 */
    COMPLETED: 'completed',
    /** 已取消 */
    CANCELLED: 'cancelled',
    /** 失败 */
    FAILED: 'failed'
};

/**
 * 调度选项
 * @typedef {Object} ScheduleOptions
 * @property {string} [priority='normal'] - 优先级: high, normal, low
 * @property {boolean} [batch=false] - 是否批量处理
 * @property {string} [id] - 任务ID
 * @property {Function} [onComplete] - 完成回调
 * @property {Function} [onError] - 错误回调
 * @property {boolean} [cancellable=true] - 是否可取消
 */

/**
 * DOM任务
 * @typedef {Object} DOMTask
 * @property {string} id - 任务ID
 * @property {Function} operation - DOM操作函数
 * @property {TaskPriority} priority - 优先级
 * @property {TaskState} state - 状态
 * @property {boolean} batch - 是否批量处理
 * @property {number} timestamp - 创建时间戳
 * @property {Function} [onComplete] - 完成回调
 * @property {Function} [onError] - 错误回调
 * @property {boolean} cancellable - 是否可取消
 */

/**
 * DOM操作调度器类
 */
export class DOMScheduler {
    constructor() {
        /** @type {DOMTask[]} - 任务队列 */
        this.queue = [];
        
        /** @type {boolean} - 是否正在处理 */
        this.isProcessing = false;
        
        /** @type {number} - RAF ID */
        this.rafId = null;
        
        /** @type {number} - Idle ID */
        this.idleId = null;
        
        /** @type {boolean} - 是否使用IdleCallback */
        this.useIdleCallback = typeof requestIdleCallback === 'function';
        
        /** @type {number} - Idle超时时间(ms) */
        this.idleTimeout = 800;
        
        /** @type {number} - 每帧最大处理时间(ms) */
        this.budgetMs = 12;
        
        /** @type {Map<string, DOMTask>} - 任务映射 */
        this.taskMap = new Map();
        
        /** @type {WeakMap<Element, Object>} - DOM缓存 */
        this.domCache = new WeakMap();
        
        /** @type {Map<string, Element[]>} - 选择器缓存 */
        this.selectorCache = new Map();
        
        /** @type {number} - 缓存过期时间(ms) */
        this.cacheExpiry = 5000;
        
        /** @type {boolean} - 是否启用缓存 */
        this.cacheEnabled = true;
        
        /** @type {boolean} - 是否启用 */
        this.enabled = true;
        
        /** @type {number} - 每帧最大任务数 */
        this.maxTasksPerFrame = 3;
        
        this.setupPerformanceListener();
    }

    /**
     * 设置性能监听器
     */
    setupPerformanceListener() {
        // 监听性能变化，自适应调整处理参数
        eventBus.on('performance:low', (data) => {
            const level = data.level;
            if (level === 'low') {
                this.maxTasksPerFrame = 2;
                this.budgetMs = 8;
            } else if (level === 'medium') {
                this.maxTasksPerFrame = 3;
                this.budgetMs = 12;
            } else {
                this.maxTasksPerFrame = 4;
                this.budgetMs = 16;
            }
            console.log(`[DOMScheduler] Adapted to ${level} performance`);
        });

        eventBus.on('performance:recover', (data) => {
            const level = data.level;
            if (level === 'high') {
                this.maxTasksPerFrame = 4;
                this.budgetMs = 16;
            }
            console.log(`[DOMScheduler] Performance recovered to ${level}`);
        });
    }

    /**
     * 调度DOM操作
     * @param {Function} operation - DOM操作函数
     * @param {ScheduleOptions} options - 配置选项
     * @returns {string|null} 任务ID
     */
    schedule(operation, options = {}) {
        if (!this.enabled) {
            console.warn('[DOMScheduler] Scheduler is disabled');
            return null;
        }

        if (typeof operation !== 'function') {
            console.warn('[DOMScheduler] Invalid operation');
            return null;
        }

        const {
            priority = TaskPriority.NORMAL,
            batch = false,
            id,
            onComplete,
            onError,
            cancellable = true
        } = options;

        // 生成任务ID
        const taskId = id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const task = {
            id: taskId,
            operation,
            priority,
            state: TaskState.PENDING,
            batch,
            timestamp: Date.now(),
            onComplete,
            onError,
            cancellable
        };

        // 存储任务
        this.taskMap.set(taskId, task);
        this.queue.push(task);

        // 按优先级排序
        this.sortQueue();

        // 开始处理队列
        this.processQueue();

        // 发布事件
        eventBus.emit('dom:scheduled', { taskId, priority, batch });

        return taskId;
    }

    /**
     * 调度高优先级任务
     * @param {Function} operation - DOM操作函数
     * @param {ScheduleOptions} options - 配置选项
     * @returns {string|null} 任务ID
     */
    scheduleHigh(operation, options = {}) {
        return this.schedule(operation, {
            ...options,
            priority: TaskPriority.HIGH
        });
    }

    /**
     * 调度低优先级任务
     * @param {Function} operation - DOM操作函数
     * @param {ScheduleOptions} options - 配置选项
     * @returns {string|null} 任务ID
     */
    scheduleLow(operation, options = {}) {
        return this.schedule(operation, {
            ...options,
            priority: TaskPriority.LOW
        });
    }

    /**
     * 排序队列（按优先级和时间戳）
     */
    sortQueue() {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        this.queue.sort((a, b) => {
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.timestamp - b.timestamp;
        });
    }

    /**
     * 处理队列
     */
    processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;

        // 检查是否可以使用AnimationFrameManager
        if (animationFrameManager.canRegister('high')) {
            // 使用RAF处理
            this.rafId = requestAnimationFrame(this.processRaf.bind(this));
        } else if (this.useIdleCallback) {
            // 使用IdleCallback处理
            this.idleId = requestIdleCallback(
                this.processIdle.bind(this),
                { timeout: this.idleTimeout }
            );
        } else {
            // 使用RAF处理
            this.rafId = requestAnimationFrame(this.processRaf.bind(this));
        }
    }

    /**
     * 使用requestIdleCallback处理
     * @param {IdleDeadline} deadline - Idle截止时间
     */
    processIdle(deadline) {
        const start = performance.now();
        let processedCount = 0;

        while (this.queue.length > 0) {
            // 检查是否有足够的时间
            if (deadline.timeRemaining() < 8) {
                break;
            }

            // 检查是否超时
            if (performance.now() - start > this.budgetMs) {
                break;
            }

            // 获取下一个任务
            const task = this.getNextTask();
            if (!task) break;

            // 执行任务
            this.executeTask(task);
            processedCount++;
        }

        this.isProcessing = false;

        // 发布处理事件
        eventBus.emit('dom:processed', {
            count: processedCount,
            remaining: this.queue.length
        });

        // 如果还有任务，继续调度
        if (this.queue.length > 0) {
            this.processQueue();
        }
    }

    /**
     * 使用requestAnimationFrame处理
     */
    processRaf() {
        let processedCount = 0;

        while (this.queue.length > 0 && processedCount < this.maxTasksPerFrame) {
            const task = this.getNextTask();
            if (!task) break;

            // 执行任务
            this.executeTask(task);
            processedCount++;
        }

        this.isProcessing = false;

        // 发布处理事件
        eventBus.emit('dom:processed', {
            count: processedCount,
            remaining: this.queue.length
        });

        // 如果还有任务，继续调度
        if (this.queue.length > 0) {
            this.processQueue();
        }
    }

    /**
     * 获取下一个任务
     * @returns {DOMTask|null} 任务
     */
    getNextTask() {
        // 从队列中移除第一个任务
        const task = this.queue.shift();
        if (!task) return null;

        // 检查任务是否已被取消
        if (task.state === TaskState.CANCELLED) {
            this.taskMap.delete(task.id);
            return this.getNextTask();
        }

        return task;
    }

    /**
     * 执行任务
     * @param {DOMTask} task - 任务
     */
    executeTask(task) {
        task.state = TaskState.EXECUTING;

        try {
            // 执行操作
            task.operation();

            // 标记为完成
            task.state = TaskState.COMPLETED;

            // 触发完成回调
            if (typeof task.onComplete === 'function') {
                try {
                    task.onComplete();
                } catch (error) {
                    console.error(`[DOMScheduler] Error in onComplete callback for ${task.id}:`, error);
                }
            }

            // 发布完成事件
            eventBus.emit('dom:task-complete', { taskId: task.id, priority: task.priority });

        } catch (error) {
            // 标记为失败
            task.state = TaskState.FAILED;

            // 错误处理
            ErrorBoundary.handle(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.LOW,
                message: 'DOM操作失败',
                metadata: { taskId: task.id, priority: task.priority }
            });

            // 触发错误回调
            if (typeof task.onError === 'function') {
                try {
                    task.onError(error);
                } catch (callbackError) {
                    console.error(`[DOMScheduler] Error in onError callback for ${task.id}:`, callbackError);
                }
            }

            // 发布失败事件
            eventBus.emit('dom:task-failed', { taskId: task.id, error });

        } finally {
            // 清理任务映射
            this.taskMap.delete(task.id);
        }
    }

    /**
     * 取消任务
     * @param {string} taskId - 任务ID
     * @returns {boolean} 是否成功取消
     */
    cancel(taskId) {
        const task = this.taskMap.get(taskId);
        if (!task) {
            console.warn(`[DOMScheduler] Task not found: ${taskId}`);
            return false;
        }

        if (!task.cancellable) {
            console.warn(`[DOMScheduler] Task is not cancellable: ${taskId}`);
            return false;
        }

        if (task.state !== TaskState.PENDING) {
            console.warn(`[DOMScheduler] Task is not pending: ${taskId}, state: ${task.state}`);
            return false;
        }

        // 标记为取消
        task.state = TaskState.CANCELLED;

        // 从队列中移除
        const index = this.queue.findIndex(t => t.id === taskId);
        if (index !== -1) {
            this.queue.splice(index, 1);
        }

        // 清理任务映射
        this.taskMap.delete(taskId);

        // 发布取消事件
        eventBus.emit('dom:task-cancelled', { taskId });

        console.log(`[DOMScheduler] Cancelled task: ${taskId}`);

        return true;
    }

    /**
     * 批量取消任务
     * @param {string[]} taskIds - 任务ID数组
     * @returns {number} 取消的任务数量
     */
    cancelMany(taskIds) {
        let count = 0;
        for (const taskId of taskIds) {
            if (this.cancel(taskId)) {
                count++;
            }
        }
        return count;
    }

    /**
     * 批量添加元素到DOM
     * @param {Element[]} elements - 元素数组
     * @param {Element} parent - 父元素
     * @param {ScheduleOptions} options - 配置选项
     * @returns {string|null} 任务ID
     */
    appendMany(elements, parent, options = {}) {
        if (!Array.isArray(elements) || !parent) {
            console.warn('[DOMScheduler] Invalid elements or parent');
            return null;
        }

        return this.schedule(() => {
            const fragment = document.createDocumentFragment();
            
            for (const el of elements) {
                if (el && el.nodeType === 1) {
                    fragment.appendChild(el);
                }
            }

            parent.appendChild(fragment);

            // 清除缓存
            this.invalidateCache(parent);

            // 发布事件
            eventBus.emit('dom:batch-appended', {
                count: elements.length,
                parent
            });
        }, { ...options, batch: true });
    }

    /**
     * 批量移除元素
     * @param {Element[]} elements - 元素数组
     * @param {ScheduleOptions} options - 配置选项
     * @returns {string|null} 任务ID
     */
    removeMany(elements, options = {}) {
        if (!Array.isArray(elements)) {
            console.warn('[DOMScheduler] Invalid elements');
            return null;
        }

        return this.schedule(() => {
            for (const el of elements) {
                if (el && el.parentNode) {
                    // 清除缓存
                    this.invalidateCache(el);
                    el.parentNode.removeChild(el);
                }
            }

            // 发布事件
            eventBus.emit('dom:batch-removed', {
                count: elements.length
            });
        }, { ...options, batch: true });
    }

    /**
     * 批量更新元素属性
     * @param {Array} updates - 更新数组: [{ element, props }]
     * @param {ScheduleOptions} options - 配置选项
     * @returns {string|null} 任务ID
     */
    updateMany(updates, options = {}) {
        if (!Array.isArray(updates)) {
            console.warn('[DOMScheduler] Invalid updates');
            return null;
        }

        return this.schedule(() => {
            for (const { element, props } of updates) {
                if (!element || !props) continue;

                for (const [key, value] of Object.entries(props)) {
                    element[key] = value;
                }

                // 清除缓存
                this.invalidateCache(element);
            }

            // 发布事件
            eventBus.emit('dom:batch-updated', {
                count: updates.length
            });
        }, { ...options, batch: true });
    }

    /**
     * 延迟执行操作
     * @param {Function} operation - 操作函数
     * @param {number} delay - 延迟时间(ms)
     * @returns {string|null} 任务ID
     */
    delay(operation, delay) {
        if (typeof operation !== 'function') return null;

        const timeoutId = setTimeout(() => {
            this.schedule(operation);
        }, delay);

        // 返回一个特殊的任务ID，可以用于取消
        return `delay-${timeoutId}`;
    }

    /**
     * 查询元素（使用缓存）
     * @param {string} selector - 选择器
     * @param {Element} [context=document] - 上下文元素
     * @returns {Element[]} 元素数组
     */
    queryElements(selector, context = document) {
        if (!this.cacheEnabled) {
            return Array.from(context.querySelectorAll(selector));
        }

        const cacheKey = `${selector}-${context === document ? 'doc' : 'ctx'}`;
        
        // 检查缓存
        const cached = this.selectorCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.elements;
        }

        // 查询元素
        const elements = Array.from(context.querySelectorAll(selector));

        // 更新缓存
        this.selectorCache.set(cacheKey, {
            elements,
            timestamp: Date.now()
        });

        return elements;
    }

    /**
     * 查询单个元素（使用缓存）
     * @param {string} selector - 选择器
     * @param {Element} [context=document] - 上下文元素
     * @returns {Element|null} 元素
     */
    queryElement(selector, context = document) {
        const elements = this.queryElements(selector, context);
        return elements.length > 0 ? elements[0] : null;
    }

    /**
     * 使缓存失效
     * @param {Element} [element] - 元素，如果不指定则清除所有缓存
     */
    invalidateCache(element) {
        if (element) {
            // 清除特定元素的缓存
            this.domCache.delete(element);
        } else {
            // 清除所有缓存
            this.domCache = new WeakMap();
            this.selectorCache.clear();
        }
    }

    /**
     * 清空队列
     */
    clear() {
        // 取消所有任务
        for (const task of this.queue) {
            task.state = TaskState.CANCELLED;
        }

        this.queue = [];
        this.taskMap.clear();
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

        // 发布事件
        eventBus.emit('dom:queue-cleared');
    }

    /**
     * 获取队列状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        const byPriority = {
            high: 0,
            normal: 0,
            low: 0
        };

        for (const task of this.queue) {
            byPriority[task.priority]++;
        }

        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            useIdleCallback: this.useIdleCallback,
            byPriority,
            enabled: this.enabled,
            cacheEnabled: this.cacheEnabled,
            maxTasksPerFrame: this.maxTasksPerFrame
        };
    }

    /**
     * 获取任务状态
     * @param {string} taskId - 任务ID
     * @returns {Object|null} 任务状态
     */
    getTaskStatus(taskId) {
        const task = this.taskMap.get(taskId);
        if (!task) return null;

        return {
            id: task.id,
            state: task.state,
            priority: task.priority,
            batch: task.batch,
            timestamp: task.timestamp
        };
    }

    /**
     * 启用调度器
     */
    enable() {
        this.enabled = true;
        console.log('[DOMScheduler] Enabled');
    }

    /**
     * 禁用调度器
     */
    disable() {
        this.enabled = false;
        this.clear();
        console.log('[DOMScheduler] Disabled');
    }

    /**
     * 启用缓存
     */
    enableCache() {
        this.cacheEnabled = true;
        console.log('[DOMScheduler] Cache enabled');
    }

    /**
     * 禁用缓存
     */
    disableCache() {
        this.cacheEnabled = false;
        this.invalidateCache();
        console.log('[DOMScheduler] Cache disabled');
    }
}

// 创建全局单例
export const domScheduler = new DOMScheduler();
