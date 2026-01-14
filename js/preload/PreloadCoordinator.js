/**
 * PureSuck PreloadCoordinator - 预加载协调器
 * 统一管理所有预加载相关模块，协调模块间的交互
 * 提供统一的API接口，管理整个预加载流程
 * 
 * @module preload/PreloadCoordinator
 */

import { eventBus } from '../core/EventBus.js';
import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';
import { PagePreloader, pagePreloader } from './PagePreloader.js';
import { SequentialTaskQueue, PredefinedTasks, sequentialTaskQueue } from './SequentialTaskQueue.js';
import { PageStabilityMonitor, pageStabilityMonitor } from './PageStabilityMonitor.js';
import { AnimationGatekeeper, animationGatekeeper } from './AnimationGatekeeper.js';

/**
 * 协调器状态枚举
 * @readonly
 * @enum {string}
 */
export const CoordinatorState = {
    /** 未初始化 */
    UNINITIALIZED: 'uninitialized',
    /** 已初始化 */
    INITIALIZED: 'initialized',
    /** 已启用 */
    ENABLED: 'enabled',
    /** 已禁用 */
    DISABLED: 'disabled',
    /** 已销毁 */
    DESTROYED: 'destroyed'
};

/**
 * 预加载阶段枚举
 * @readonly
 * @enum {string}
 */
export const PreloadPhase = {
    /** 空闲 */
    IDLE: 'idle',
    /** 准备导航 */
    PREPARING: 'preparing',
    /** 执行任务 */
    EXECUTING_TASKS: 'executing_tasks',
    /** 等待稳定 */
    WAITING_STABILITY: 'waiting_stability',
    /** 执行动画 */
    ANIMATING: 'animating'
};

/**
 * 操作历史记录
 * @typedef {Object} OperationHistory
 * @property {string} id - 操作ID
 * @property {string} phase - 预加载阶段
 * @property {string} action - 操作名称
 * @property {number} timestamp - 时间戳
 * @property {Object} data - 操作数据
 * @property {Object} result - 操作结果
 * @property {Error|null} error - 错误信息
 */

/**
 * PreloadCoordinator - 预加载协调器类
 */
export class PreloadCoordinator {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {boolean} [options.enabled=true] - 是否启用协调器
     * @param {boolean} [options.debug=false] - 调试模式
     * @param {Object} [options.preload] - 预加载配置
     * @param {boolean} [options.preload.enabled=true] - 是否启用预加载
     * @param {number} [options.preload.cacheSize=5] - 缓存大小
     * @param {number} [options.preload.timeout=5000] - 超时时间(ms)
     * @param {Object} [options.taskQueue] - 任务队列配置
     * @param {boolean} [options.taskQueue.enabled=true] - 是否启用任务队列
     * @param {number} [options.taskQueue.timeout=15000] - 超时时间(ms)
     * @param {Object} [options.stability] - 稳定性监控配置
     * @param {boolean} [options.stability.enabled=true] - 是否启用稳定性监控
     * @param {number} [options.stability.minScore=80] - 最小稳定性评分
     * @param {number} [options.stability.timeout=5000] - 超时时间(ms)
     * @param {Object} [options.animation] - 动画配置
     * @param {boolean} [options.animation.enabled=true] - 是否启用动画
     * @param {number} [options.animation.timeout=10000] - 超时时间(ms)
     */
    constructor(options = {}) {
        /**
         * 协调器状态
         * @type {CoordinatorState}
         * @private
         */
        this._state = CoordinatorState.UNINITIALIZED;

        /**
         * 当前预加载阶段
         * @type {PreloadPhase}
         * @private
         */
        this._currentPhase = PreloadPhase.IDLE;

        /**
         * 子模块实例
         * @type {Object}
         * @private
         */
        this._modules = {
            pagePreloader: null,
            sequentialTaskQueue: null,
            pageStabilityMonitor: null,
            animationGatekeeper: null
        };

        /**
         * 操作历史记录
         * @type {Array<OperationHistory>}
         * @private
         */
        this._operationHistory = [];

        /**
         * 最大历史记录数
         * @type {number}
         * @private
         */
        this._maxHistorySize = 100;

        /**
         * 操作计数器
         * @type {number}
         * @private
         */
        this._operationCounter = 0;

        /**
         * 性能统计
         * @type {Object}
         * @private
         */
        this._performanceStats = {
            totalOperations: 0,
            successfulOperations: 0,
            failedOperations: 0,
            averagePreloadTime: 0,
            averageTaskTime: 0,
            averageStabilityTime: 0,
            averageAnimationTime: 0
        };

        /**
         * 当前操作ID
         * @type {string|null}
         * @private
         */
        this._currentOperationId = null;

        /**
         * 事件订阅清理函数
         * @type {Array<Function>}
         * @private
         */
        this._eventUnsubscribers = [];

        // 配置选项
        this._enabled = options.enabled !== false;
        this._debug = options.debug || false;
        this._config = {
            preload: {
                enabled: options.preload?.enabled !== false,
                cacheSize: options.preload?.cacheSize || 5,
                timeout: options.preload?.timeout || 5000
            },
            taskQueue: {
                enabled: options.taskQueue?.enabled !== false,
                timeout: options.taskQueue?.timeout || 15000
            },
            stability: {
                enabled: options.stability?.enabled !== false,
                minScore: options.stability?.minScore || 80,
                timeout: options.stability?.timeout || 5000
            },
            animation: {
                enabled: options.animation?.enabled !== false,
                timeout: options.animation?.timeout || 10000
            }
        };

        this._log('PreloadCoordinator initialized with options:', options);
    }

    /**
     * 初始化协调器
     * @public
     * @returns {Promise<boolean>} 是否成功初始化
     */
    async init() {
        if (this._state !== CoordinatorState.UNINITIALIZED) {
            this._log('Already initialized', 'warn');
            return true;
        }

        this._log('Initializing PreloadCoordinator...');

        try {
            // 初始化子模块
            await this._initializeModules();

            // 设置模块间的依赖关系
            this._setupModuleDependencies();

            // 注册事件监听器
            this._setupEventListeners();

            // 更新状态
            this._state = this._enabled ? CoordinatorState.ENABLED : CoordinatorState.INITIALIZED;

            // 发布初始化事件
            eventBus.emit('coordinator:init', {
                timestamp: Date.now(),
                config: this._config
            });

            this._log('PreloadCoordinator initialized successfully');
            return true;

        } catch (error) {
            this._handleError(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.HIGH,
                message: '协调器初始化失败'
            });

            this._state = CoordinatorState.DESTROYED;
            return false;
        }
    }

    /**
     * 准备页面导航
     * @public
     * @param {string} url - 目标URL
     * @returns {Promise<Object|null>} 预加载结果
     */
    async preparePageNavigation(url) {
        if (!this._enabled) {
            this._log('Coordinator is disabled, skipping navigation preparation', 'warn');
            return null;
        }

        if (this._currentPhase !== PreloadPhase.IDLE) {
            this._log('Another operation is in progress', 'warn');
            return null;
        }

        const operationId = this._createOperationId();
        this._currentOperationId = operationId;
        this._currentPhase = PreloadPhase.PREPARING;
        const startTime = performance.now();

        this._log(`Preparing page navigation: ${url} (${operationId})`);

        // 发布开始事件
        eventBus.emit('coordinator:prepare:start', {
            operationId,
            url,
            timestamp: Date.now()
        });

        try {
            // 检查预加载是否启用
            if (!this._config.preload.enabled) {
                this._log('Preload is disabled, skipping', 'warn');
                this._recordOperation(operationId, 'prepare', { url }, { skipped: true });
                this._resetPhase();
                return null;
            }

            // 使用PagePreloader预加载页面
            const result = await this._modules.pagePreloader.preload(url);

            if (!result) {
                throw new Error('Page preloader returned null');
            }

            // 更新性能统计
            const duration = performance.now() - startTime;
            this._updatePerformanceStats('preload', duration);

            // 发布完成事件
            eventBus.emit('coordinator:prepare:complete', {
                operationId,
                url,
                result,
                duration,
                timestamp: Date.now()
            });

            // 记录操作历史
            this._recordOperation(operationId, 'prepare', { url }, { success: true, duration, result });

            this._log(`Page navigation prepared successfully in ${duration.toFixed(2)}ms`);
            this._resetPhase();
            return result;

        } catch (error) {
            this._handleError(error, {
                type: ErrorType.NETWORK,
                severity: ErrorSeverity.MEDIUM,
                message: `页面导航准备失败: ${url}`,
                metadata: { url, operationId }
            });

            // 记录失败操作
            this._recordOperation(operationId, 'prepare', { url }, { success: false, error });

            this._resetPhase();
            return null;
        }
    }

    /**
     * 执行导航后任务
     * @public
     * @returns {Promise<Object|null>} 执行结果
     */
    async executePostNavigationTasks() {
        if (!this._enabled) {
            this._log('Coordinator is disabled, skipping task execution', 'warn');
            return null;
        }

        if (this._currentPhase !== PreloadPhase.IDLE) {
            this._log('Another operation is in progress', 'warn');
            return null;
        }

        const operationId = this._createOperationId();
        this._currentOperationId = operationId;
        this._currentPhase = PreloadPhase.EXECUTING_TASKS;
        const startTime = performance.now();

        this._log(`Executing post-navigation tasks (${operationId})`);

        // 发布开始事件
        eventBus.emit('coordinator:tasks:start', {
            operationId,
            timestamp: Date.now()
        });

        try {
            // 检查任务队列是否启用
            if (!this._config.taskQueue.enabled) {
                this._log('Task queue is disabled, skipping', 'warn');
                this._recordOperation(operationId, 'executeTasks', {}, { skipped: true });
                this._resetPhase();
                return null;
            }

            // 使用SequentialTaskQueue执行任务
            const result = await this._modules.sequentialTaskQueue.execute();

            // 更新性能统计
            const duration = performance.now() - startTime;
            this._updatePerformanceStats('tasks', duration);

            // 发布完成事件
            eventBus.emit('coordinator:tasks:complete', {
                operationId,
                result,
                duration,
                timestamp: Date.now()
            });

            // 记录操作历史
            this._recordOperation(operationId, 'executeTasks', {}, { success: true, duration, result });

            this._log(`Post-navigation tasks executed in ${duration.toFixed(2)}ms`);
            this._resetPhase();
            return result;

        } catch (error) {
            this._handleError(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.MEDIUM,
                message: '导航后任务执行失败',
                metadata: { operationId }
            });

            // 记录失败操作
            this._recordOperation(operationId, 'executeTasks', {}, { success: false, error });

            this._resetPhase();
            return null;
        }
    }

    /**
     * 等待页面稳定
     * @public
     * @param {Object} [options] - 选项
     * @param {number} [options.timeout] - 超时时间(ms)
     * @returns {Promise<Object|null>} 稳定性指标
     */
    async waitForPageStability(options = {}) {
        if (!this._enabled) {
            this._log('Coordinator is disabled, skipping stability check', 'warn');
            return null;
        }

        if (this._currentPhase !== PreloadPhase.IDLE) {
            this._log('Another operation is in progress', 'warn');
            return null;
        }

        const operationId = this._createOperationId();
        this._currentOperationId = operationId;
        this._currentPhase = PreloadPhase.WAITING_STABILITY;
        const startTime = performance.now();

        this._log(`Waiting for page stability (${operationId})`);

        // 发布开始事件
        eventBus.emit('coordinator:stability:start', {
            operationId,
            timestamp: Date.now()
        });

        try {
            // 检查稳定性监控是否启用
            if (!this._config.stability.enabled) {
                this._log('Stability monitoring is disabled, skipping', 'warn');
                this._recordOperation(operationId, 'waitForStability', {}, { skipped: true });
                this._resetPhase();
                return null;
            }

            // 使用PageStabilityMonitor等待稳定
            const metrics = await this._modules.pageStabilityMonitor.waitForStability(options);

            // 检查稳定性评分
            if (metrics.totalScore < this._config.stability.minScore) {
                this._log(`Stability score ${metrics.totalScore} below threshold ${this._config.stability.minScore}`, 'warn');
            }

            // 更新性能统计
            const duration = performance.now() - startTime;
            this._updatePerformanceStats('stability', duration);

            // 发布完成事件
            eventBus.emit('coordinator:stability:complete', {
                operationId,
                metrics,
                duration,
                timestamp: Date.now()
            });

            // 记录操作历史
            this._recordOperation(operationId, 'waitForStability', {}, { success: true, duration, metrics });

            this._log(`Page stability achieved in ${duration.toFixed(2)}ms, score: ${metrics.totalScore}`);
            this._resetPhase();
            return metrics;

        } catch (error) {
            this._handleError(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.MEDIUM,
                message: '等待页面稳定失败',
                metadata: { operationId }
            });

            // 记录失败操作
            this._recordOperation(operationId, 'waitForStability', {}, { success: false, error });

            this._resetPhase();
            return null;
        }
    }

    /**
     * 请求进入动画
     * @public
     * @param {Object} animationConfig - 动画配置
     * @param {string} animationConfig.type - 动画类型
     * @param {Element[]} animationConfig.elements - 目标元素
     * @param {Object} [animationConfig.options] - 动画选项
     * @returns {Promise<boolean>} 是否成功执行动画
     */
    async requestEnterAnimation(animationConfig) {
        if (!this._enabled) {
            this._log('Coordinator is disabled, skipping animation', 'warn');
            return false;
        }

        if (this._currentPhase !== PreloadPhase.IDLE) {
            this._log('Another operation is in progress', 'warn');
            return false;
        }

        const operationId = this._createOperationId();
        this._currentOperationId = operationId;
        this._currentPhase = PreloadPhase.ANIMATING;
        const startTime = performance.now();

        this._log(`Requesting enter animation (${operationId})`);

        // 发布开始事件
        eventBus.emit('coordinator:animation:start', {
            operationId,
            config: animationConfig,
            timestamp: Date.now()
        });

        try {
            // 检查动画是否启用
            if (!this._config.animation.enabled) {
                this._log('Animation is disabled, skipping', 'warn');
                this._recordOperation(operationId, 'requestAnimation', animationConfig, { skipped: true });
                this._resetPhase();
                return false;
            }

            // 使用AnimationGatekeeper请求动画
            const result = await this._modules.animationGatekeeper.requestAnimation({
                type: 'enter',
                elements: animationConfig.elements || [],
                options: animationConfig.options || {},
                skipOnFail: true
            });

            // 更新性能统计
            const duration = performance.now() - startTime;
            this._updatePerformanceStats('animation', duration);

            // 发布完成事件
            eventBus.emit('coordinator:animation:complete', {
                operationId,
                result,
                duration,
                timestamp: Date.now()
            });

            // 记录操作历史
            this._recordOperation(operationId, 'requestAnimation', animationConfig, { success: result, duration });

            this._log(`Enter animation ${result ? 'completed' : 'failed'} in ${duration.toFixed(2)}ms`);
            this._resetPhase();
            return result;

        } catch (error) {
            this._handleError(error, {
                type: ErrorType.RENDERING,
                severity: ErrorSeverity.MEDIUM,
                message: '进入动画请求失败',
                metadata: { operationId }
            });

            // 记录失败操作
            this._recordOperation(operationId, 'requestAnimation', animationConfig, { success: false, error });

            this._resetPhase();
            return false;
        }
    }

    /**
     * 获取协调器状态
     * @public
     * @returns {Object} 状态信息
     */
    getCoordinatorStatus() {
        return {
            state: this._state,
            currentPhase: this._currentPhase,
            enabled: this._enabled,
            currentOperationId: this._currentOperationId,
            config: this._config,
            performanceStats: { ...this._performanceStats },
            modules: {
                pagePreloader: this._modules.pagePreloader ? this._modules.pagePreloader.getStatus() : null,
                sequentialTaskQueue: this._modules.sequentialTaskQueue ? this._modules.sequentialTaskQueue.getQueueStatus() : null,
                pageStabilityMonitor: this._modules.pageStabilityMonitor ? this._modules.pageStabilityMonitor.getStatus() : null,
                animationGatekeeper: this._modules.animationGatekeeper ? this._modules.animationGatekeeper.getStatus() : null
            }
        };
    }

    /**
     * 获取详细状态
     * @public
     * @returns {Object} 详细状态信息
     */
    getDetailedStatus() {
        const status = this.getCoordinatorStatus();

        return {
            ...status,
            operationHistory: this._operationHistory,
            operationCount: this._operationCounter,
            eventListeners: {
                coordinator: eventBus.listenerCount('coordinator:init'),
                prepare: eventBus.listenerCount('coordinator:prepare:start'),
                tasks: eventBus.listenerCount('coordinator:tasks:start'),
                stability: eventBus.listenerCount('coordinator:stability:start'),
                animation: eventBus.listenerCount('coordinator:animation:start')
            }
        };
    }

    /**
     * 启用协调器
     * @public
     */
    enable() {
        if (this._state === CoordinatorState.DESTROYED) {
            this._log('Cannot enable destroyed coordinator', 'warn');
            return;
        }

        if (this._enabled) {
            this._log('Coordinator is already enabled', 'warn');
            return;
        }

        this._enabled = true;
        this._state = CoordinatorState.ENABLED;

        eventBus.emit('coordinator:enabled', {
            timestamp: Date.now()
        });

        this._log('Coordinator enabled');
    }

    /**
     * 禁用协调器
     * @public
     */
    disable() {
        if (this._state === CoordinatorState.DESTROYED) {
            this._log('Cannot disable destroyed coordinator', 'warn');
            return;
        }

        if (!this._enabled) {
            this._log('Coordinator is already disabled', 'warn');
            return;
        }

        this._enabled = false;
        this._state = CoordinatorState.DISABLED;

        eventBus.emit('coordinator:disabled', {
            timestamp: Date.now()
        });

        this._log('Coordinator disabled');
    }

    /**
     * 销毁协调器
     * @public
     */
    destroy() {
        if (this._state === CoordinatorState.DESTROYED) {
            return;
        }

        this._log('Destroying PreloadCoordinator...');

        // 销毁子模块
        if (this._modules.pagePreloader) {
            this._modules.pagePreloader.destroy();
        }
        if (this._modules.sequentialTaskQueue) {
            this._modules.sequentialTaskQueue.destroy();
        }
        if (this._modules.pageStabilityMonitor) {
            this._modules.pageStabilityMonitor.destroy();
        }
        if (this._modules.animationGatekeeper) {
            this._modules.animationGatekeeper.destroy();
        }

        // 清理事件监听器
        for (const unsubscribe of this._eventUnsubscribers) {
            unsubscribe();
        }
        this._eventUnsubscribers = [];

        // 清空历史记录
        this._operationHistory = [];

        // 更新状态
        this._state = CoordinatorState.DESTROYED;
        this._currentPhase = PreloadPhase.IDLE;

        // 发布销毁事件
        eventBus.emit('coordinator:destroyed', {
            timestamp: Date.now()
        });

        this._log('PreloadCoordinator destroyed');
    }

    // ==================== 私有方法 ====================

    /**
     * 初始化子模块
     * @private
     * @returns {Promise<void>}
     */
    async _initializeModules() {
        this._log('Initializing sub-modules...');

        // 使用全局单例或创建新实例
        this._modules.pagePreloader = pagePreloader || new PagePreloader({
            enableCache: true,
            maxCacheSize: this._config.preload.cacheSize,
            maxPreloadTime: this._config.preload.timeout,
            debug: this._debug
        });

        this._modules.sequentialTaskQueue = sequentialTaskQueue || new SequentialTaskQueue({
            totalTimeout: this._config.taskQueue.timeout,
            debug: this._debug
        });

        this._modules.pageStabilityMonitor = pageStabilityMonitor || new PageStabilityMonitor({
            timeout: this._config.stability.timeout,
            debug: this._debug
        });

        this._modules.animationGatekeeper = animationGatekeeper || new AnimationGatekeeper({
            unlockTimeout: this._config.animation.timeout,
            minStabilityScore: this._config.stability.minScore,
            debug: this._debug
        });

        this._log('Sub-modules initialized');
    }

    /**
     * 设置模块间的依赖关系
     * @private
     */
    _setupModuleDependencies() {
        this._log('Setting up module dependencies...');

        // AnimationGatekeeper已经通过事件与PageStabilityMonitor和SequentialTaskQueue集成
        // 这里主要是确保模块间的引用正确

        this._log('Module dependencies set up');
    }

    /**
     * 设置事件监听器
     * @private
     */
    _setupEventListeners() {
        this._log('Setting up event listeners...');

        // 监听页面预加载事件
        const unsubscribePreloadStart = eventBus.on('page:preload:start', (data) => {
            if (this._debug) {
                this._log(`Page preload started: ${data.url}`);
            }
        });
        this._eventUnsubscribers.push(unsubscribePreloadStart);

        const unsubscribePreloadComplete = eventBus.on('page:preload:complete', (data) => {
            if (this._debug) {
                this._log(`Page preload completed: ${data.url} in ${data.result.totalTime.toFixed(2)}ms`);
            }
        });
        this._eventUnsubscribers.push(unsubscribePreloadComplete);

        // 监听任务队列事件
        const unsubscribeTaskStart = eventBus.on('task:start', (data) => {
            if (this._debug) {
                this._log(`Task started: ${data.taskName}`);
            }
        });
        this._eventUnsubscribers.push(unsubscribeTaskStart);

        const unsubscribeTaskComplete = eventBus.on('task:complete', (data) => {
            if (this._debug) {
                this._log(`Task completed: ${data.taskName} in ${data.duration.toFixed(2)}ms`);
            }
        });
        this._eventUnsubscribers.push(unsubscribeTaskComplete);

        // 监听稳定性事件
        const unsubscribeStabilityAchieved = eventBus.on('stability:achieved', (data) => {
            if (this._debug) {
                this._log(`Stability achieved: score ${data.metrics.totalScore}`);
            }
        });
        this._eventUnsubscribers.push(unsubscribeStabilityAchieved);

        // 监听动画事件
        const unsubscribeAnimationStart = eventBus.on('animation:gatekeeper:start', (data) => {
            if (this._debug) {
                this._log(`Animation started: ${data.type}`);
            }
        });
        this._eventUnsubscribers.push(unsubscribeAnimationStart);

        const unsubscribeAnimationComplete = eventBus.on('animation:gatekeeper:complete', (data) => {
            if (this._debug) {
                this._log(`Animation completed: ${data.type} in ${data.duration}ms`);
            }
        });
        this._eventUnsubscribers.push(unsubscribeAnimationComplete);

        this._log('Event listeners set up');
    }

    /**
     * 创建操作ID
     * @private
     * @returns {string} 操作ID
     */
    _createOperationId() {
        return `op-${++this._operationCounter}`;
    }

    /**
     * 记录操作历史
     * @private
     * @param {string} operationId - 操作ID
     * @param {string} action - 操作名称
     * @param {Object} data - 操作数据
     * @param {Object} result - 操作结果
     */
    _recordOperation(operationId, action, data, result) {
        const operation = {
            id: operationId,
            phase: this._currentPhase,
            action,
            timestamp: Date.now(),
            data,
            result
        };

        this._operationHistory.push(operation);

        // 限制历史记录数量
        if (this._operationHistory.length > this._maxHistorySize) {
            this._operationHistory.shift();
        }

        // 更新统计
        this._performanceStats.totalOperations++;
        if (result.success !== false) {
            this._performanceStats.successfulOperations++;
        } else {
            this._performanceStats.failedOperations++;
        }
    }

    /**
     * 更新性能统计
     * @private
     * @param {string} type - 统计类型
     * @param {number} duration - 耗时(ms)
     */
    _updatePerformanceStats(type, duration) {
        const stats = this._performanceStats;
        const count = stats.successfulOperations;

        switch (type) {
            case 'preload':
                if (count === 1) {
                    stats.averagePreloadTime = duration;
                } else {
                    stats.averagePreloadTime = (stats.averagePreloadTime * (count - 1) + duration) / count;
                }
                break;
            case 'tasks':
                if (count === 1) {
                    stats.averageTaskTime = duration;
                } else {
                    stats.averageTaskTime = (stats.averageTaskTime * (count - 1) + duration) / count;
                }
                break;
            case 'stability':
                if (count === 1) {
                    stats.averageStabilityTime = duration;
                } else {
                    stats.averageStabilityTime = (stats.averageStabilityTime * (count - 1) + duration) / count;
                }
                break;
            case 'animation':
                if (count === 1) {
                    stats.averageAnimationTime = duration;
                } else {
                    stats.averageAnimationTime = (stats.averageAnimationTime * (count - 1) + duration) / count;
                }
                break;
        }
    }

    /**
     * 重置阶段
     * @private
     */
    _resetPhase() {
        this._currentPhase = PreloadPhase.IDLE;
        this._currentOperationId = null;
    }

    /**
     * 处理错误
     * @private
     * @param {Error} error - 错误对象
     * @param {Object} context - 错误上下文
     */
    _handleError(error, context) {
        ErrorBoundary.handle(error, context);

        // 发布错误事件
        eventBus.emit('coordinator:error', {
            error: error.message,
            stack: error.stack,
            context,
            timestamp: Date.now()
        });
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

        const prefix = '[PreloadCoordinator]';
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
export const preloadCoordinator = new PreloadCoordinator({
    enabled: true,
    debug: false,
    preload: {
        enabled: true,
        cacheSize: 5,
        timeout: 5000
    },
    taskQueue: {
        enabled: true,
        timeout: 15000
    },
    stability: {
        enabled: true,
        minScore: 80,
        timeout: 5000
    },
    animation: {
        enabled: true,
        timeout: 10000
    }
});
