/**
 * PureSuck PageStabilityMonitor - 页面稳定监控器
 * 检测页面是否处于静止状态，监控布局重排、重绘、长任务等性能事件
 * 提供稳定性评分和静默窗口机制，确保页面真正稳定
 * 
 * @module preload/PageStabilityMonitor
 */

import { eventBus } from '../core/EventBus.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';
import { animationFrameManager } from '../core/AnimationFrameManager.js';

/**
 * 监控状态枚举
 * @readonly
 * @enum {string}
 */
export const MonitorState = {
    /** 空闲状态 */
    IDLE: 'idle',
    /** 监控中 */
    MONITORING: 'monitoring',
    /** 等待稳定 */
    WAITING_FOR_STABILITY: 'waiting_for_stability',
    /** 已稳定 */
    STABLE: 'stable'
};

/**
 * 性能事件类型
 * @typedef {Object} PerformanceEvent
 * @property {string} type - 事件类型
 * @property {number} timestamp - 时间戳
 * @property {number} value - 事件值（如持续时间、偏移量等）
 * @property {Object} [details] - 额外详情
 */

/**
 * 稳定性指标
 * @typedef {Object} StabilityMetrics
 * @property {number} layoutShifts - 布局偏移次数
 * @property {number} layoutShiftScore - 布局偏移扣分
 * @property {number} repaints - 重绘次数
 * @property {number} repaintScore - 重绘扣分
 * @property {number} longTasks - 长任务次数
 * @property {number} longTaskScore - 长任务扣分
 * @property {number} lowFrameCount - 低帧率次数
 * @property {number} lowFrameScore - 低帧率扣分
 * @property {number} totalScore - 总稳定性评分
 * @property {number} currentFrameRate - 当前帧率
 * @property {number} silentWindowCount - 连续静默窗口数
 */

/**
 * PageStabilityMonitor - 页面稳定监控器类
 */
export class PageStabilityMonitor {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {number} [options.silentWindowDuration=200] - 静默窗口持续时间(ms)
     * @param {number} [options.requiredSilentWindows=3] - 需要的连续静默窗口数
     * @param {number} [options.timeout=5000] - 等待稳定的超时时间(ms)
     * @param {number} [options.longTaskThreshold=50] - 长任务阈值(ms)
     * @param {number} [options.lowFrameRateThreshold=30] - 低帧率阈值(fps)
     * @param {number} [options.sampleInterval=100] - 采样间隔(ms)
     * @param {number} [options.scoreHistorySize=100] - 评分历史记录大小
     * @param {boolean} [options.debug=false] - 是否启用调试模式
     */
    constructor(options = {}) {
        /**
         * 当前监控状态
         * @type {MonitorState}
         * @private
         */
        this._state = MonitorState.IDLE;

        /**
         * PerformanceObserver实例
         * @type {PerformanceObserver|null}
         * @private
         */
        this._layoutShiftObserver = null;
        this._repaintObserver = null;
        this._longTaskObserver = null;

        /**
         * 帧率监控相关
         * @type {Object}
         * @private
         */
        this._frameRateMonitor = {
            lastFrameTime: 0,
            frameCount: 0,
            currentFPS: 0,
            rafId: null
        };

        /**
         * 静默窗口相关
         * @type {Object}
         * @private
         */
        this._silentWindow = {
            startTime: 0,
            count: 0,
            lastEventTime: 0
        };

        /**
         * 稳定性指标
         * @type {StabilityMetrics}
         * @private
         */
        this._metrics = {
            layoutShifts: 0,
            layoutShiftScore: 0,
            repaints: 0,
            repaintScore: 0,
            longTasks: 0,
            longTaskScore: 0,
            lowFrameCount: 0,
            lowFrameScore: 0,
            totalScore: 100,
            currentFrameRate: 60,
            silentWindowCount: 0
        };

        /**
         * 性能事件历史
         * @type {Array<PerformanceEvent>}
         * @private
         */
        this._eventHistory = [];

        /**
         * 评分历史
         * @type {Array<number>}
         * @private
         */
        this._scoreHistory = [];

        /**
         * 稳定性Promise resolve函数
         * @type {Function|null}
         * @private
         */
        this._stabilityResolve = null;

        /**
         * 超时定时器
         * @type {number|null}
         * @private
         */
        this._timeoutId = null;

        /**
         * 采样定时器
         * @type {number|null}
         * @private
         */
        this._sampleIntervalId = null;

        /**
         * 降级模式（PerformanceObserver不支持时）
         * @type {boolean}
         * @private
         */
        this._fallbackMode = false;

        // 配置选项
        this._silentWindowDuration = options.silentWindowDuration || 200;
        this._requiredSilentWindows = options.requiredSilentWindows || 3;
        this._timeout = options.timeout || 5000;
        this._longTaskThreshold = options.longTaskThreshold || 50;
        this._lowFrameRateThreshold = options.lowFrameRateThreshold || 30;
        this._sampleInterval = options.sampleInterval || 100;
        this._scoreHistorySize = options.scoreHistorySize || 100;
        this._debug = options.debug || false;

        this._log('PageStabilityMonitor initialized with options:', options);
    }

    /**
     * 启动监控
     * @public
     */
    start() {
        if (this._state === MonitorState.MONITORING || this._state === MonitorState.WAITING_FOR_STABILITY) {
            this._log('Already monitoring');
            return;
        }

        this._state = MonitorState.MONITORING;
        this._resetMetrics();
        this._silentWindow.startTime = performance.now();
        this._silentWindow.lastEventTime = performance.now();

        // 启动各种监控
        this._monitorLayoutShifts();
        this._monitorRepaints();
        this._monitorLongTasks();
        this._monitorFrameRate();

        // 启动采样定时器
        this._startSampling();

        // 发布监控开始事件
        eventBus.emit('stability:monitor:start', {
            timestamp: performance.now()
        });

        this._log('Monitoring started');
    }

    /**
     * 停止监控
     * @public
     */
    stop() {
        if (this._state === MonitorState.IDLE) {
            return;
        }

        this._state = MonitorState.IDLE;

        // 断开所有观察者
        if (this._layoutShiftObserver) {
            this._layoutShiftObserver.disconnect();
            this._layoutShiftObserver = null;
        }

        if (this._repaintObserver) {
            this._repaintObserver.disconnect();
            this._repaintObserver = null;
        }

        if (this._longTaskObserver) {
            this._longTaskObserver.disconnect();
            this._longTaskObserver = null;
        }

        // 停止帧率监控
        if (this._frameRateMonitor.rafId) {
            cancelAnimationFrame(this._frameRateMonitor.rafId);
            this._frameRateMonitor.rafId = null;
        }

        // 清除定时器
        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._sampleIntervalId) {
            clearInterval(this._sampleIntervalId);
            this._sampleIntervalId = null;
        }

        // 清除稳定性Promise
        if (this._stabilityResolve) {
            this._stabilityResolve = null;
        }

        // 发布监控停止事件
        eventBus.emit('stability:monitor:stop', {
            timestamp: performance.now(),
            metrics: this._metrics
        });

        this._log('Monitoring stopped');
    }

    /**
     * 等待页面稳定
     * @public
     * @param {Object} [options] - 选项
     * @param {number} [options.timeout] - 超时时间(ms)，覆盖构造函数的设置
     * @returns {Promise<StabilityMetrics>} 稳定性指标
     */
    async waitForStability(options = {}) {
        if (this._state === MonitorState.WAITING_FOR_STABILITY) {
            this._log('Already waiting for stability');
            return this._metrics;
        }

        // 如果未监控，先启动监控
        if (this._state === MonitorState.IDLE) {
            this.start();
        }

        this._state = MonitorState.WAITING_FOR_STABILITY;
        this._resetMetrics();
        this._silentWindow.startTime = performance.now();
        this._silentWindow.lastEventTime = performance.now();
        this._silentWindow.count = 0;

        const timeout = options.timeout || this._timeout;

        return new Promise((resolve) => {
            this._stabilityResolve = resolve;

            // 设置超时
            this._timeoutId = setTimeout(() => {
                this._log(`Stability timeout after ${timeout}ms`);
                this._handleStabilityAchieved(true);
            }, timeout);

            this._log(`Waiting for stability (timeout: ${timeout}ms)`);
        });
    }

    /**
     * 获取当前稳定性评分
     * @public
     * @returns {number} 稳定性评分 (0-100)
     */
    getStabilityScore() {
        return this._metrics.totalScore;
    }

    /**
     * 获取当前指标
     * @public
     * @returns {StabilityMetrics} 稳定性指标
     */
    getMetrics() {
        return { ...this._metrics };
    }

    /**
     * 获取评分历史
     * @public
     * @returns {Array<number>} 评分历史
     */
    getScoreHistory() {
        return [...this._scoreHistory];
    }

    /**
     * 获取事件历史
     * @public
     * @returns {Array<PerformanceEvent>} 事件历史
     */
    getEventHistory() {
        return [...this._eventHistory];
    }

    /**
     * 获取当前状态
     * @public
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            state: this._state,
            metrics: { ...this._metrics },
            silentWindow: {
                duration: performance.now() - this._silentWindow.startTime,
                count: this._silentWindow.count,
                lastEventTime: this._silentWindow.lastEventTime
            },
            fallbackMode: this._fallbackMode
        };
    }

    /**
     * 销毁监控器
     * @public
     */
    destroy() {
        this.stop();
        this._eventHistory = [];
        this._scoreHistory = [];
        this._log('PageStabilityMonitor destroyed');
    }

    // ==================== 私有方法 ====================

    /**
     * 监控布局偏移
     * @private
     */
    _monitorLayoutShifts() {
        if (typeof PerformanceObserver === 'undefined') {
            this._log('PerformanceObserver not supported, layout shift monitoring disabled', 'warn');
            this._fallbackMode = true;
            return;
        }

        try {
            this._layoutShiftObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();

                for (const entry of entries) {
                    if (entry.hadRecentInput) continue;

                    const value = entry.value || 0;
                    this._metrics.layoutShifts++;

                    // 根据偏移大小扣分：5-10分
                    const penalty = Math.min(10, Math.max(5, value * 100));
                    this._metrics.layoutShiftScore += penalty;

                    this._recordEvent({
                        type: 'layout-shift',
                        timestamp: entry.startTime,
                        value: value,
                        details: {
                            hadRecentInput: entry.hadRecentInput,
                            sources: entry.sources
                        }
                    });

                    this._updateSilentWindow();
                    this._calculateStabilityScore();

                    if (this._debug) {
                        this._log(`Layout shift detected: ${value.toFixed(4)} (penalty: ${penalty.toFixed(2)})`);
                    }
                }
            });

            this._layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
            this._log('Layout shift monitoring started');
        } catch (error) {
            this._log('Layout shift monitoring not supported', 'warn');
            this._fallbackMode = true;
        }
    }

    /**
     * 监控重绘
     * @private
     */
    _monitorRepaints() {
        if (typeof PerformanceObserver === 'undefined') {
            return;
        }

        try {
            this._repaintObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();

                for (const entry of entries) {
                    this._metrics.repaints++;

                    // 每次重绘扣1-2分
                    const penalty = 1 + Math.random();
                    this._metrics.repaintScore += penalty;

                    this._recordEvent({
                        type: 'paint',
                        timestamp: entry.startTime,
                        value: entry.duration || 0,
                        details: {
                            name: entry.name
                        }
                    });

                    this._updateSilentWindow();
                    this._calculateStabilityScore();
                }
            });

            this._repaintObserver.observe({ entryTypes: ['paint'] });
            this._log('Repaint monitoring started');
        } catch (error) {
            this._log('Repaint monitoring not supported', 'warn');
        }
    }

    /**
     * 监控长任务
     * @private
     */
    _monitorLongTasks() {
        if (typeof PerformanceObserver === 'undefined') {
            return;
        }

        try {
            this._longTaskObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();

                for (const entry of entries) {
                    if (entry.duration < this._longTaskThreshold) continue;

                    this._metrics.longTasks++;

                    // 根据任务时长扣分：10-20分
                    const penalty = Math.min(20, Math.max(10, entry.duration / 10));
                    this._metrics.longTaskScore += penalty;

                    this._recordEvent({
                        type: 'longtask',
                        timestamp: entry.startTime,
                        value: entry.duration,
                        details: {
                            name: entry.name,
                            attribution: entry.attribution
                        }
                    });

                    this._updateSilentWindow();
                    this._calculateStabilityScore();

                    if (this._debug) {
                        this._log(`Long task detected: ${entry.duration.toFixed(2)}ms (penalty: ${penalty.toFixed(2)})`);
                    }
                }
            });

            this._longTaskObserver.observe({ entryTypes: ['longtask'] });
            this._log('Long task monitoring started');
        } catch (error) {
            this._log('Long task monitoring not supported', 'warn');
        }
    }

    /**
     * 监控帧率
     * @private
     */
    _monitorFrameRate() {
        const measureFrameRate = (timestamp) => {
            if (this._frameRateMonitor.lastFrameTime === 0) {
                this._frameRateMonitor.lastFrameTime = timestamp;
                this._frameRateMonitor.rafId = requestAnimationFrame(measureFrameRate);
                return;
            }

            const delta = timestamp - this._frameRateMonitor.lastFrameTime;
            this._frameRateMonitor.lastFrameTime = timestamp;

            // 计算FPS
            this._frameRateMonitor.currentFPS = 1000 / delta;
            this._metrics.currentFrameRate = Math.round(this._frameRateMonitor.currentFPS);

            // 检查低帧率
            if (this._metrics.currentFrameRate < this._lowFrameRateThreshold) {
                this._metrics.lowFrameCount++;
                this._metrics.lowFrameScore += 5;

                this._updateSilentWindow();
                this._calculateStabilityScore();

                if (this._debug) {
                    this._log(`Low frame rate: ${this._metrics.currentFrameRate}fps`);
                }
            }

            // 继续监控
            if (this._state !== MonitorState.IDLE) {
                this._frameRateMonitor.rafId = requestAnimationFrame(measureFrameRate);
            }
        };

        this._frameRateMonitor.rafId = requestAnimationFrame(measureFrameRate);
        this._log('Frame rate monitoring started');
    }

    /**
     * 启动采样
     * @private
     */
    _startSampling() {
        this._sampleIntervalId = setInterval(() => {
            if (this._state === MonitorState.IDLE) {
                return;
            }

            // 检查静默窗口
            this._checkSilentWindow();

            // 记录评分历史
            this._recordScoreHistory();

        }, this._sampleInterval);
    }

    /**
     * 检查静默窗口
     * @private
     */
    _checkSilentWindow() {
        const now = performance.now();
        const timeSinceLastEvent = now - this._silentWindow.lastEventTime;

        if (timeSinceLastEvent >= this._silentWindowDuration) {
            // 静默窗口满足
            this._silentWindow.count++;
            this._metrics.silentWindowCount = this._silentWindow.count;

            this._log(`Silent window ${this._silentWindow.count}/${this._requiredSilentWindows} (${timeSinceLastEvent.toFixed(0)}ms)`);

            // 检查是否达到稳定条件
            if (this._silentWindow.count >= this._requiredSilentWindows) {
                this._handleStabilityAchieved();
            }
        } else {
            // 重置静默窗口计数
            if (this._silentWindow.count > 0) {
                this._log(`Silent window reset (event after ${timeSinceLastEvent.toFixed(0)}ms)`);
            }
            this._silentWindow.count = 0;
            this._metrics.silentWindowCount = 0;
        }
    }

    /**
     * 更新静默窗口
     * @private
     */
    _updateSilentWindow() {
        this._silentWindow.lastEventTime = performance.now();
    }

    /**
     * 计算稳定性评分
     * @private
     */
    _calculateStabilityScore() {
        // 基础分100
        let score = 100;

        // 扣除各项扣分
        score -= this._metrics.layoutShiftScore;
        score -= this._metrics.repaintScore;
        score -= this._metrics.longTaskScore;
        score -= this._metrics.lowFrameScore;

        // 确保评分在0-100之间
        score = Math.max(0, Math.min(100, score));

        this._metrics.totalScore = Math.round(score);

        // 发布评分更新事件
        eventBus.emit('stability:score:updated', {
            score: this._metrics.totalScore,
            metrics: { ...this._metrics }
        });

        if (this._debug) {
            this._log(`Stability score: ${this._metrics.totalScore}`);
        }
    }

    /**
     * 处理稳定达成
     * @private
     * @param {boolean} [timeout=false] - 是否因超时而达成
     */
    _handleStabilityAchieved(timeout = false) {
        if (this._state !== MonitorState.WAITING_FOR_STABILITY) {
            return;
        }

        this._state = MonitorState.STABLE;

        // 清除超时定时器
        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }

        // 发布稳定达成事件
        eventBus.emit('stability:achieved', {
            timestamp: performance.now(),
            metrics: { ...this._metrics },
            timeout: timeout
        });

        this._log(`Stability achieved${timeout ? ' (timeout)' : ''}, score: ${this._metrics.totalScore}`);

        // 解析Promise
        if (this._stabilityResolve) {
            const resolve = this._stabilityResolve;
            this._stabilityResolve = null;
            resolve({ ...this._metrics });
        }
    }

    /**
     * 重置指标
     * @private
     */
    _resetMetrics() {
        this._metrics = {
            layoutShifts: 0,
            layoutShiftScore: 0,
            repaints: 0,
            repaintScore: 0,
            longTasks: 0,
            longTaskScore: 0,
            lowFrameCount: 0,
            lowFrameScore: 0,
            totalScore: 100,
            currentFrameRate: 60,
            silentWindowCount: 0
        };

        this._silentWindow = {
            startTime: performance.now(),
            count: 0,
            lastEventTime: performance.now()
        };

        this._log('Metrics reset');
    }

    /**
     * 记录事件
     * @private
     * @param {PerformanceEvent} event - 性能事件
     */
    _recordEvent(event) {
        this._eventHistory.push(event);

        // 限制历史记录大小
        if (this._eventHistory.length > 1000) {
            this._eventHistory.shift();
        }
    }

    /**
     * 记录评分历史
     * @private
     */
    _recordScoreHistory() {
        this._scoreHistory.push(this._metrics.totalScore);

        // 限制历史记录大小
        if (this._scoreHistory.length > this._scoreHistorySize) {
            this._scoreHistory.shift();
        }
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

        const prefix = '[PageStabilityMonitor]';
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
export const pageStabilityMonitor = new PageStabilityMonitor({
    silentWindowDuration: 200,
    requiredSilentWindows: 3,
    timeout: 5000,
    longTaskThreshold: 50,
    lowFrameRateThreshold: 30,
    sampleInterval: 100,
    scoreHistorySize: 100,
    debug: false
});
