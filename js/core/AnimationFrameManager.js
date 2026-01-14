/**
 * PureSuck AnimationFrameManager - 动画帧管理器
 * 管理动画帧率控制、动画队列和并发控制
 */

import { eventBus } from './EventBus.js';
import { performanceMonitor } from './PerformanceMonitor.js';

export class AnimationFrameManager {
    constructor() {
        this.animations = new Map(); // 存储所有动画: id -> { animation, priority, timestamp }
        this.activeCount = 0; // 当前活跃动画数量
        this.maxConcurrent = 8; // 最大并发动画数(根据性能自适应)
        this.isPaused = false;
        
        // 性能自适应配置
        this.performanceConfig = {
            high: { maxConcurrent: 8, priorityThreshold: 'normal' },
            medium: { maxConcurrent: 6, priorityThreshold: 'high' },
            low: { maxConcurrent: 4, priorityThreshold: 'critical' }
        };
        
        // 优先级定义
        this.priorityLevels = {
            critical: 3,
            high: 2,
            normal: 1,
            low: 0
        };
        
        this.setupPerformanceListener();
    }

    /**
     * 注册动画
     * @param {string} id - 动画ID
     * @param {Animation} animation - Web Animations API动画对象
     * @param {string} priority - 优先级: critical, high, normal, low
     * @returns {boolean} 是否注册成功
     */
    register(id, animation, priority = 'normal') {
        if (!animation || typeof animation.cancel !== 'function') {
            console.warn(`[AnimationFrameManager] Invalid animation for id: ${id}`);
            return false;
        }

        // 检查并发限制
        if (this.activeCount >= this.maxConcurrent) {
            // 使用高性能配置
            const config = this.performanceConfig.high;
            const currentPriority = this.priorityLevels[priority] || 0;
            const thresholdPriority = this.priorityLevels[config.priorityThreshold] || 0;
            
            // 如果优先级不够,拒绝注册
            if (currentPriority < thresholdPriority) {
                console.warn(
                    `[AnimationFrameManager] Animation rejected (concurrent limit): ${id}, ` +
                    `active: ${this.activeCount}/${this.maxConcurrent}, priority: ${priority}`
                );
                return false;
            }
        }

        // 存储动画
        this.animations.set(id, {
            animation,
            priority: this.priorityLevels[priority] || 0,
            timestamp: Date.now()
        });

        this.activeCount++;

        // 监听动画结束
        const cleanup = () => {
            this.unregister(id);
        };

        animation.onfinish = cleanup;
        animation.oncancel = cleanup;

        return true;
    }

    /**
     * 取消注册动画
     * @param {string} id - 动画ID
     */
    unregister(id) {
        const animData = this.animations.get(id);
        if (!animData) return;

        this.animations.delete(id);
        this.activeCount--;
    }

    /**
     * 取消动画
     * @param {string} id - 动画ID
     */
    cancel(id) {
        const animData = this.animations.get(id);
        if (!animData) return;

        try {
            animData.animation.cancel();
        } catch (error) {
            console.error(`[AnimationFrameManager] Error canceling animation ${id}:`, error);
        }

        this.unregister(id);
    }

    /**
     * 取消所有动画
     */
    cancelAll() {
        for (const [id, animData] of this.animations) {
            try {
                animData.animation.cancel();
            } catch (error) {
                console.error(`[AnimationFrameManager] Error canceling animation ${id}:`, error);
            }
        }

        this.animations.clear();
        this.activeCount = 0;
    }

    /**
     * 取消低优先级动画
     */
    cancelLowPriority() {
        // 使用高性能配置
        const config = this.performanceConfig.high;
        const thresholdPriority = this.priorityLevels[config.priorityThreshold] || 0;

        for (const [id, animData] of this.animations) {
            if (animData.priority < thresholdPriority) {
                try {
                    animData.animation.cancel();
                } catch (error) {
                    console.error(`[AnimationFrameManager] Error canceling low priority animation ${id}:`, error);
                }
                this.unregister(id);
            }
        }
    }

    /**
     * 暂停所有动画
     */
    pause() {
        if (this.isPaused) return;

        this.isPaused = true;

        for (const [id, animData] of this.animations) {
            try {
                animData.animation.pause();
            } catch (error) {
                console.error(`[AnimationFrameManager] Error pausing animation ${id}:`, error);
            }
        }

        console.log('[AnimationFrameManager] Paused all animations');
    }

    /**
     * 恢复所有动画
     */
    resume() {
        if (!this.isPaused) return;

        this.isPaused = false;

        for (const [id, animData] of this.animations) {
            try {
                animData.animation.play();
            } catch (error) {
                console.error(`[AnimationFrameManager] Error resuming animation ${id}:`, error);
            }
        }

        console.log('[AnimationFrameManager] Resumed all animations');
    }

    /**
     * 获取动画数量
     * @returns {Object} 动画统计
     */
    getCount() {
        const byPriority = {
            critical: 0,
            high: 0,
            normal: 0,
            low: 0
        };

        for (const animData of this.animations.values()) {
            if (animData.priority >= 3) byPriority.critical++;
            else if (animData.priority >= 2) byPriority.high++;
            else if (animData.priority >= 1) byPriority.normal++;
            else byPriority.low++;
        }

        return {
            total: this.animations.size,
            active: this.activeCount,
            maxConcurrent: this.maxConcurrent,
            byPriority,
            isPaused: this.isPaused
        };
    }

    /**
     * 是否可以注册新动画
     * @param {string} priority - 优先级
     * @returns {boolean}
     */
    canRegister(priority = 'normal') {
        if (this.isPaused) return false;

        if (this.activeCount < this.maxConcurrent) return true;

        // 使用高性能配置
        const config = this.performanceConfig.high;
        const currentPriority = this.priorityLevels[priority] || 0;
        const thresholdPriority = this.priorityLevels[config.priorityThreshold] || 0;

        return currentPriority >= thresholdPriority;
    }

    /**
     * 获取性能配置
     * @returns {Object}
     */
    getConfig() {
        return {
            maxConcurrent: this.maxConcurrent,
            performanceLevel: 'high',
            isPaused: this.isPaused
        };
    }
}

// 创建全局单例
export const animationFrameManager = new AnimationFrameManager();
