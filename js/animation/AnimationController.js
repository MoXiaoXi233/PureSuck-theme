/**
 * PureSuck AnimationController - 动画控制器
 * 统一管理所有动画，支持性能自适应和并发控制
 * 
 * @module animation/AnimationController
 */

import { animationFrameManager } from '../core/AnimationFrameManager.js';
import { staggerManager } from './StaggerManager.js';
import { eventBus } from '../core/EventBus.js';
import { stateManager, NavigationState } from '../core/StateManager.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';
import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';
import { getAdaptiveConfig } from './AnimationConfig.js';

/**
 * 性能等级枚举
 * @readonly
 * @enum {string}
 */
export const PerformanceLevel = {
    /** 高性能 */
    HIGH: 'high',
    /** 中等性能 */
    MEDIUM: 'medium',
    /** 低性能 */
    LOW: 'low',
    /** 减少动画 */
    REDUCED: 'reduced'
};

/**
 * 动画状态枚举
 * @readonly
 * @enum {string}
 */
export const AnimationState = {
    /** 空闲 */
    IDLE: 'idle',
    /** 进入动画中 */
    ENTERING: 'entering',
    /** 退出动画中 */
    EXITING: 'exiting',
    /** 已暂停 */
    PAUSED: 'paused',
    /** 已打断 */
    CANCELLED: 'cancelled'
};

/**
 * 动画控制器类
 */
export class AnimationController {
    constructor() {
        this.activeAnimations = new Map(); // id -> animation
        this.animationCounter = 0;
        this.isInitialized = false;
        this.currentAnimationState = AnimationState.IDLE;
        this.performanceLevel = PerformanceLevel.HIGH;
        this.maxConcurrentAnimations = 6; // 最大并发动画数
        this.animationQueue = []; // 动画队列
        this.isProcessingQueue = false;
        this.prefersReducedMotion = false;

        // 订阅性能监控事件
        this._setupPerformanceMonitoring();
    }

    /**
     * 初始化
     * @param {AnimationFrameManager} frameManager - 动画帧管理器
     * @param {StaggerManager} staggerMgr - Stagger管理器
     */
    init(frameManager, staggerMgr) {
        if (this.isInitialized) {
            console.warn('[AnimationController] Already initialized');
            return;
        }

        this.frameManager = frameManager || animationFrameManager;
        this.staggerManager = staggerMgr || staggerManager;
        this.isInitialized = true;

        // 检测减少动画偏好
        this._detectReducedMotion();

        // 订阅状态管理器
        this._setupStateManagement();

        console.log('[AnimationController] Initialized');
    }

    /**
     * 检测减少动画偏好
     * @private
     */
    _detectReducedMotion() {
        this.prefersReducedMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (this.prefersReducedMotion) {
            this.performanceLevel = PerformanceLevel.REDUCED;
            console.log('[AnimationController] Reduced motion detected');
        }

        // 监听偏好变化
        if (typeof window.matchMedia === 'function') {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            mediaQuery.addEventListener('change', (e) => {
                this.prefersReducedMotion = e.matches;
                if (this.prefersReducedMotion) {
                    this.performanceLevel = PerformanceLevel.REDUCED;
                } else {
                    this._updatePerformanceLevel();
                }
                console.log(`[AnimationController] Reduced motion changed: ${this.prefersReducedMotion}`);
            });
        }
    }

    /**
     * 设置性能监控
     * @private
     */
    _setupPerformanceMonitoring() {
        // FPS监控已移除，性能等级现在基于设备能力检测
        // 不再需要监听性能更新事件
    }

    /**
     * 设置状态管理
     * @private
     */
    _setupStateManagement() {
        // 订阅状态变更
        stateManager.subscribe((transition) => {
            this._handleStateChange(transition);
        });
    }

    /**
     * 处理状态变更
     * @private
     * @param {Object} transition - 状态转换
     */
    _handleStateChange(transition) {
        const { from, to } = transition;

        // 如果进入错误状态，取消所有动画
        if (to === NavigationState.ERROR) {
            this.cancelAll('state error');
        }

        // 如果从导航状态切换到空闲，清理动画状态
        if (from === NavigationState.NAVIGATING && to === NavigationState.IDLE) {
            this.currentAnimationState = AnimationState.IDLE;
        }
    }

    /**
     * 更新性能等级
     * @private
     */
    _updatePerformanceLevel() {
        const previousLevel = this.performanceLevel;

        if (this.prefersReducedMotion) {
            this.performanceLevel = PerformanceLevel.REDUCED;
        } else {
            // 默认高性能，现代设备普遍为高刷
            this.performanceLevel = PerformanceLevel.HIGH;
        }

        // 性能等级变化时调整并发限制
        if (previousLevel !== this.performanceLevel) {
            this._adjustConcurrencyLimit();
            console.log(`[AnimationController] Performance level: ${previousLevel} -> ${this.performanceLevel}`);
        }
    }

    /**
     * 调整并发限制
     * @private
     */
    _adjustConcurrencyLimit() {
        const limits = {
            [PerformanceLevel.HIGH]: 8,
            [PerformanceLevel.MEDIUM]: 6,
            [PerformanceLevel.LOW]: 4,
            [PerformanceLevel.REDUCED]: 2
        };

        this.maxConcurrentAnimations = limits[this.performanceLevel] || 6;
        console.log(`[AnimationController] Max concurrent animations: ${this.maxConcurrentAnimations}`);
    }

    /**
     * 播放进入动画
     * @param {Element[]} elements - 目标元素数组
     * @param {Object} config - 动画配置
     * @param {string} [config.pageType='list'] - 页面类型
     * @returns {Promise} 动画完成Promise
     */
    async playEnter(elements, config = {}) {
        if (!this.isInitialized) {
            console.warn('[AnimationController] Not initialized');
            return Promise.resolve();
        }

        if (!elements || elements.length === 0) {
            return Promise.resolve();
        }

        // 检查是否应该跳过动画
        if (this._shouldSkipAnimation()) {
            this._showElementsImmediately(elements);
            return Promise.resolve();
        }

        // 更新动画状态
        this.currentAnimationState = AnimationState.ENTERING;

        // 更新状态管理器
        if (stateManager.getCurrentState() === NavigationState.NAVIGATING) {
            stateManager.setState(NavigationState.ANIMATING_ENTER, {
                animationType: 'enter',
                elementCount: elements.length
            });
        }

        // 获取自适应配置
        const pageType = config.pageType || 'list';
        const adaptiveConfig = getAdaptiveConfig(pageType);
        const mergedConfig = this._mergeConfig(adaptiveConfig.enter, config);

        console.log(
            `[AnimationController] Playing enter animation: ${elements.length} elements, ` +
            `performance: ${this.performanceLevel}, ` +
            `duration: ${mergedConfig.duration}ms, stagger: ${mergedConfig.stagger}ms`
        );

        // 发布开始事件
        eventBus.emit('animation:enter:start', {
            count: elements.length,
            config: mergedConfig,
            performanceLevel: this.performanceLevel
        });

        try {
            // 使用错误边界包装动画执行
            return await ErrorBoundary.withAsyncErrorHandling(
                () => this._executeEnterAnimation(elements, mergedConfig),
                {
                    type: ErrorType.ANIMATION,
                    severity: ErrorSeverity.MEDIUM,
                    message: '进入动画执行出错，已简化动画效果',
                    metadata: { elementCount: elements.length, config: mergedConfig }
                }
            );
        } finally {
            this.currentAnimationState = AnimationState.IDLE;
        }
    }

    /**
     * 执行进入动画
     * @private
     * @param {Element[]} elements - 目标元素
     * @param {Object} config - 配置
     * @returns {Promise}
     */
    async _executeEnterAnimation(elements, config) {
        const {
            duration = 380,
            stagger = 32,
            y = 16,
            scale = 1,
            easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            batchSize = 8,
            batchGap = 80
        } = config;

        // 预设初始状态
        elements.forEach(el => {
            el.style.opacity = '0';
            const initialTransform = scale !== 1
                ? `translate3d(0, ${y}px, 0) scale(${scale})`
                : `translate3d(0, ${y}px, 0)`;
            el.style.transform = initialTransform;
            el.style.willChange = 'opacity, transform';
        });

        // 强制重绘
        void document.documentElement.offsetHeight;

        // 分批执行动画（考虑并发限制）
        const batches = this._chunkArray(elements, batchSize);
        const promises = [];
        let batchDelay = 0;

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];

            // 等待并发限制
            await this._waitForConcurrencyLimit();

            for (let index = 0; index < batch.length; index++) {
                const el = batch[index];
                const absoluteIndex = batchIndex * batchSize + index;
                const delay = batchDelay + index * stagger;

                const anim = el.animate([
                    {
                        opacity: 0,
                        transform: scale !== 1
                            ? `translate3d(0, ${y}px, 0) scale(${scale})`
                            : `translate3d(0, ${y}px, 0)`
                    },
                    {
                        opacity: 1,
                        transform: 'translate3d(0, 0, 0) scale(1)'
                    }
                ], {
                    duration,
                    easing,
                    delay,
                    fill: 'both'
                });

                // 生成唯一ID
                const animId = `enter-${this.animationCounter++}-${absoluteIndex}`;

                // 注册到帧管理器
                this.frameManager.register(animId, anim, 'normal');
                this.activeAnimations.set(animId, anim);

                // 清理
                const cleanup = () => {
                    el.style.opacity = '';
                    el.style.transform = '';
                    el.style.willChange = '';
                    this.activeAnimations.delete(animId);
                };

                anim.onfinish = cleanup;
                anim.oncancel = cleanup;

                promises.push(anim.finished);
            }

            batchDelay += batchGap;

            // 如果不是最后一批，等待批次间隔
            if (batchIndex < batches.length - 1) {
                await this._delay(batchGap);
            }
        }

        await Promise.allSettled(promises);

        // 发布完成事件
        eventBus.emit('animation:enter:complete', {
            count: elements.length
        });
    }

    /**
     * 播放退出动画
     * @param {Element[]} elements - 目标元素数组
     * @param {Object} config - 动画配置
     * @param {string} [config.pageType='list'] - 页面类型
     * @returns {Promise} 动画完成Promise
     */
    async playExit(elements, config = {}) {
        if (!this.isInitialized) {
            console.warn('[AnimationController] Not initialized');
            return Promise.resolve();
        }

        if (!elements || elements.length === 0) {
            return Promise.resolve();
        }

        // 检查是否应该跳过动画
        if (this._shouldSkipAnimation()) {
            return Promise.resolve();
        }

        // 更新动画状态
        this.currentAnimationState = AnimationState.EXITING;

        // 更新状态管理器
        if (stateManager.getCurrentState() === NavigationState.NAVIGATING) {
            stateManager.setState(NavigationState.ANIMATING_EXIT, {
                animationType: 'exit',
                elementCount: elements.length
            });
        }

        // 获取自适应配置
        const pageType = config.pageType || 'list';
        const adaptiveConfig = getAdaptiveConfig(pageType);
        const mergedConfig = this._mergeConfig(adaptiveConfig.exit, config);

        console.log(
            `[AnimationController] Playing exit animation: ${elements.length} elements, ` +
            `performance: ${this.performanceLevel}, ` +
            `duration: ${mergedConfig.duration}ms, stagger: ${mergedConfig.stagger}ms`
        );

        // 发布开始事件
        eventBus.emit('animation:exit:start', {
            count: elements.length,
            config: mergedConfig,
            performanceLevel: this.performanceLevel
        });

        try {
            // 使用错误边界包装动画执行
            return await ErrorBoundary.withAsyncErrorHandling(
                () => this._executeExitAnimation(elements, mergedConfig),
                {
                    type: ErrorType.ANIMATION,
                    severity: ErrorSeverity.MEDIUM,
                    message: '退出动画执行出错，已简化动画效果',
                    metadata: { elementCount: elements.length, config: mergedConfig }
                }
            );
        } finally {
            this.currentAnimationState = AnimationState.IDLE;
        }
    }

    /**
     * 执行退出动画
     * @private
     * @param {Element[]} elements - 目标元素
     * @param {Object} config - 配置
     * @returns {Promise}
     */
    async _executeExitAnimation(elements, config) {
        const {
            duration = 240,
            stagger = 25,
            y = -12,
            scale = 0.96,
            easing = 'cubic-bezier(0.4, 0, 0.2, 1)'
        } = config;

        const promises = [];

        for (let index = 0; index < elements.length; index++) {
            const el = elements[index];
            const delay = index * stagger;

            const anim = el.animate([
                {
                    opacity: 1,
                    transform: 'translate3d(0, 0, 0) scale(1)'
                },
                {
                    opacity: 0,
                    transform: scale !== 1
                        ? `translate3d(0, ${y}px, 0) scale(${scale})`
                        : `translate3d(0, ${y}px, 0)`
                }
            ], {
                duration,
                easing,
                delay,
                fill: 'both'
            });

            // 生成唯一ID
            const animId = `exit-${this.animationCounter++}-${index}`;

            // 注册到帧管理器
            this.frameManager.register(animId, anim, 'high');
            this.activeAnimations.set(animId, anim);

            // 清理
            const cleanup = () => {
                el.style.opacity = '';
                el.style.transform = '';
                el.style.willChange = '';
                this.activeAnimations.delete(animId);
            };

            anim.onfinish = cleanup;
            anim.oncancel = cleanup;

            promises.push(anim.finished);
        }

        await Promise.allSettled(promises);

        // 发布完成事件
        eventBus.emit('animation:exit:complete', {
            count: elements.length
        });
    }

    /**
     * 取消所有动画
     * @param {string} [reason] - 取消原因
     */
    cancelAll(reason = 'manual') {
        console.log(`[AnimationController] Cancelling ${this.activeAnimations.size} animations: ${reason}`);

        this.currentAnimationState = AnimationState.CANCELLED;

        for (const [id, anim] of this.activeAnimations) {
            try {
                anim.cancel();
            } catch (error) {
                console.error(`[AnimationController] Error cancelling animation ${id}:`, error);
            }
        }

        this.activeAnimations.clear();

        // 发布取消事件
        eventBus.emit('animation:cancelled', {
            reason,
            count: this.activeAnimations.size
        });
    }

    /**
     * 取消特定类型的动画
     * @param {string} type - 动画类型: enter, exit
     */
    cancelByType(type) {
        const prefix = `${type}-`;
        let count = 0;

        for (const [id, anim] of this.activeAnimations) {
            if (id.startsWith(prefix)) {
                try {
                    anim.cancel();
                    count++;
                } catch (error) {
                    console.error(`[AnimationController] Error cancelling animation ${id}:`, error);
                }
                this.activeAnimations.delete(id);
            }
        }

        console.log(`[AnimationController] Cancelled ${count} ${type} animations`);
    }

    /**
     * 暂停所有动画
     */
    pauseAll() {
        console.log(`[AnimationController] Pausing ${this.activeAnimations.size} animations`);

        this.currentAnimationState = AnimationState.PAUSED;

        for (const [id, anim] of this.activeAnimations) {
            try {
                anim.pause();
            } catch (error) {
                console.error(`[AnimationController] Error pausing animation ${id}:`, error);
            }
        }

        // 发布暂停事件
        eventBus.emit('animation:paused', {
            count: this.activeAnimations.size
        });
    }

    /**
     * 恢复所有动画
     */
    resumeAll() {
        console.log(`[AnimationController] Resuming ${this.activeAnimations.size} animations`);

        this.currentAnimationState = AnimationState.IDLE;

        for (const [id, anim] of this.activeAnimations) {
            try {
                anim.play();
            } catch (error) {
                console.error(`[AnimationController] Error resuming animation ${id}:`, error);
            }
        }

        // 发布恢复事件
        eventBus.emit('animation:resumed', {
            count: this.activeAnimations.size
        });
    }

    /**
     * 获取活跃动画数量
     * @returns {number}
     */
    getActiveCount() {
        return this.activeAnimations.size;
    }

    /**
     * 是否有活跃动画
     * @returns {boolean}
     */
    hasActiveAnimations() {
        return this.activeAnimations.size > 0;
    }

    /**
     * 获取当前动画状态
     * @returns {string}
     */
    getAnimationState() {
        return this.currentAnimationState;
    }

    /**
     * 获取当前性能等级
     * @returns {string}
     */
    getPerformanceLevel() {
        return this.performanceLevel;
    }

    /**
     * 检查是否应该跳过动画
     * @private
     * @returns {boolean}
     */
    _shouldSkipAnimation() {
        return this.prefersReducedMotion || this.performanceLevel === PerformanceLevel.REDUCED;
    }

    /**
     * 立即显示元素（跳过动画）
     * @private
     * @param {Element[]} elements - 元素数组
     */
    _showElementsImmediately(elements) {
        elements.forEach(el => {
            el.style.opacity = '';
            el.style.transform = '';
            el.style.willChange = '';
        });
    }

    /**
     * 等待并发限制
     * @private
     * @returns {Promise}
     */
    async _waitForConcurrencyLimit() {
        while (this.activeAnimations.size >= this.maxConcurrentAnimations) {
            await this._delay(16); // 等待一帧
        }
    }

    /**
     * 延迟函数
     * @private
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise}
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 合并配置
     * @private
     * @param {Object} baseConfig - 基础配置
     * @param {Object} userConfig - 用户配置
     * @returns {Object} 合并后的配置
     */
    _mergeConfig(baseConfig, userConfig) {
        return {
            ...baseConfig,
            ...userConfig
        };
    }

    /**
     * 分块数组
     * @private
     * @param {Array} array - 数组
     * @param {number} size - 块大小
     * @returns {Array} 分块后的数组
     */
    _chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * 销毁动画控制器
     */
    destroy() {
        this.cancelAll('destroy');
        this.animationQueue = [];
        this.isInitialized = false;
        console.log('[AnimationController] Destroyed');
    }
}

// 创建全局单例
export const animationController = new AnimationController();
