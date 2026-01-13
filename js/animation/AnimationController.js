/**
 * PureSuck AnimationController - 动画控制器
 * 统一管理所有动画,使用Web Animations API,集成到AnimationFrameManager
 */

import { animationFrameManager } from '../core/AnimationFrameManager.js';
import { staggerManager } from './StaggerManager.js';
import { eventBus } from '../core/EventBus.js';

export class AnimationController {
    constructor() {
        this.activeAnimations = new Map(); // id -> animation
        this.animationCounter = 0;
        this.isInitialized = false;
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

        console.log('[AnimationController] Initialized');
    }

    /**
     * 播放进入动画
     * @param {Element[]} elements - 目标元素数组
     * @param {Object} config - 动画配置
     * @returns {Promise} 动画完成Promise
     */
    playEnter(elements, config) {
        if (!this.isInitialized) {
            console.warn('[AnimationController] Not initialized');
            return Promise.resolve();
        }

        if (!elements || elements.length === 0) {
            return Promise.resolve();
        }

        const {
            duration = 380,
            stagger = 32,
            y = 32,
            scale = 1,
            easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            batchSize = 8,
            batchGap = 80
        } = config;

        console.log(
            `[AnimationController] Playing enter animation: ${elements.length} elements, ` +
            `duration: ${duration}ms, stagger: ${stagger}ms`
        );

        // 发布开始事件
        eventBus.emit('animation:enter:start', {
            count: elements.length,
            config
        });

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

        // 分批执行动画
        const batches = this._chunkArray(elements, batchSize);
        const promises = [];
        let batchDelay = 0;

        batches.forEach((batch, batchIndex) => {
            batch.forEach((el, index) => {
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
                anim.onfinish = () => {
                    el.style.opacity = '';
                    el.style.transform = '';
                    el.style.willChange = '';
                    this.activeAnimations.delete(animId);
                };

                anim.oncancel = () => {
                    el.style.opacity = '';
                    el.style.transform = '';
                    el.style.willChange = '';
                    this.activeAnimations.delete(animId);
                };

                promises.push(anim.finished);
            });

            batchDelay += batchGap;
        });

        return Promise.allSettled(promises).then(() => {
            eventBus.emit('animation:enter:complete', {
                count: elements.length
            });
        });
    }

    /**
     * 播放退出动画
     * @param {Element[]} elements - 目标元素数组
     * @param {Object} config - 动画配置
     * @returns {Promise} 动画完成Promise
     */
    playExit(elements, config) {
        if (!this.isInitialized) {
            console.warn('[AnimationController] Not initialized');
            return Promise.resolve();
        }

        if (!elements || elements.length === 0) {
            return Promise.resolve();
        }

        const {
            duration = 240,
            stagger = 25,
            y = -12,
            scale = 0.96,
            easing = 'cubic-bezier(0.4, 0, 0.2, 1)'
        } = config;

        console.log(
            `[AnimationController] Playing exit animation: ${elements.length} elements, ` +
            `duration: ${duration}ms, stagger: ${stagger}ms`
        );

        // 发布开始事件
        eventBus.emit('animation:exit:start', {
            count: elements.length,
            config
        });

        const promises = [];

        elements.forEach((el, index) => {
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
            anim.onfinish = () => {
                el.style.opacity = '';
                el.style.transform = '';
                el.style.willChange = '';
                this.activeAnimations.delete(animId);
            };

            anim.oncancel = () => {
                el.style.opacity = '';
                el.style.transform = '';
                el.style.willChange = '';
                this.activeAnimations.delete(animId);
            };

            promises.push(anim.finished);
        });

        return Promise.allSettled(promises).then(() => {
            eventBus.emit('animation:exit:complete', {
                count: elements.length
            });
        });
    }

    /**
     * 取消所有动画
     */
    cancelAll() {
        console.log(`[AnimationController] Cancelling ${this.activeAnimations.size} animations`);

        for (const [id, anim] of this.activeAnimations) {
            try {
                anim.cancel();
            } catch (error) {
                console.error(`[AnimationController] Error cancelling animation ${id}:`, error);
            }
        }

        this.activeAnimations.clear();
    }

    /**
     * 取消特定类型的动画
     * @param {string} type - 动画类型: enter, exit
     */
    cancelByType(type) {
        const prefix = `${type}-`;

        for (const [id, anim] of this.activeAnimations) {
            if (id.startsWith(prefix)) {
                try {
                    anim.cancel();
                } catch (error) {
                    console.error(`[AnimationController] Error cancelling animation ${id}:`, error);
                }
                this.activeAnimations.delete(id);
            }
        }
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
     * 分块数组
     * @private
     */
    _chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * 暂停所有动画
     */
    pauseAll() {
        console.log(`[AnimationController] Pausing ${this.activeAnimations.size} animations`);

        for (const [id, anim] of this.activeAnimations) {
            try {
                anim.pause();
            } catch (error) {
                console.error(`[AnimationController] Error pausing animation ${id}:`, error);
            }
        }
    }

    /**
     * 恢复所有动画
     */
    resumeAll() {
        console.log(`[AnimationController] Resuming ${this.activeAnimations.size} animations`);

        for (const [id, anim] of this.activeAnimations) {
            try {
                anim.play();
            } catch (error) {
                console.error(`[AnimationController] Error resuming animation ${id}:`, error);
            }
        }
    }
}

// 创建全局单例
export const animationController = new AnimationController();
