/**
 * PureSuck PerformanceMonitor - 性能监控器
 * 实时监控FPS、长任务和内存使用情况
 */

import { eventBus } from './EventBus.js';

export class PerformanceMonitor {
    constructor() {
        this.isMonitoring = false;
        this.fps = 60;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fpsUpdateInterval = 1000; // 每秒更新一次FPS
        this.lastFpsUpdate = 0;
        
        this.performanceLevel = 'high'; // high, medium, low
        this.lowFpsThreshold = 45; // 低于此FPS视为低性能
        this.recoverFpsThreshold = 55; // 高于此FPS视为性能恢复
        
        this.longTaskThreshold = 50; // 长任务阈值(ms)
        this.longTaskObserver = null;
        
        this.memory = null;
        this.memoryUpdateInterval = 2000; // 每2秒更新一次内存
        this.lastMemoryUpdate = 0;
        
        this.rafId = null;
    }

    /**
     * 启动性能监控
     */
    start() {
        if (this.isMonitoring) {
            console.warn('[PerformanceMonitor] Already monitoring');
            return;
        }

        this.isMonitoring = true;
        this.lastTime = performance.now();
        this.lastFpsUpdate = performance.now();
        this.lastMemoryUpdate = performance.now();
        this.frameCount = 0;

        // 开始FPS监控
        this.startFpsMonitoring();

        // 开始长任务监控
        this.startLongTaskMonitoring();

        console.log('[PerformanceMonitor] Started');
    }

    /**
     * 停止性能监控
     */
    stop() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (this.longTaskObserver) {
            this.longTaskObserver.disconnect();
            this.longTaskObserver = null;
        }

        console.log('[PerformanceMonitor] Stopped');
    }

    /**
     * FPS监控
     */
    startFpsMonitoring() {
        const measureFps = (timestamp) => {
            if (!this.isMonitoring) return;

            this.frameCount++;
            const elapsed = timestamp - this.lastFpsUpdate;

            // 每秒更新一次FPS
            if (elapsed >= this.fpsUpdateInterval) {
                this.fps = Math.round((this.frameCount * 1000) / elapsed);
                this.frameCount = 0;
                this.lastFpsUpdate = timestamp;

                // 检测性能等级变化
                this.checkPerformanceLevel();

                // 发布FPS更新事件
                eventBus.emit('performance:update', {
                    fps: this.fps,
                    level: this.performanceLevel,
                    timestamp
                });
            }

            // 更新内存信息
            this.updateMemory(timestamp);

            this.rafId = requestAnimationFrame(measureFps);
        };

        this.rafId = requestAnimationFrame(measureFps);
    }

    /**
     * 长任务监控
     */
    startLongTaskMonitoring() {
        if (typeof PerformanceObserver === 'undefined') {
            console.warn('[PerformanceMonitor] PerformanceObserver not supported');
            return;
        }

        try {
            this.longTaskObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                
                for (const entry of entries) {
                    if (entry.duration > this.longTaskThreshold) {
                        console.warn(
                            `[PerformanceMonitor] Long task detected: ${entry.duration.toFixed(2)}ms`
                        );

                        // 发布长任务事件
                        eventBus.emit('performance:longtask', {
                            duration: entry.duration,
                            startTime: entry.startTime,
                            name: entry.name
                        });

                        // 长任务可能导致性能下降
                        if (this.performanceLevel === 'high') {
                            this.performanceLevel = 'medium';
                            eventBus.emit('performance:low', {
                                reason: 'longtask',
                                duration: entry.duration,
                                level: this.performanceLevel
                            });
                        }
                    }
                }
            });

            this.longTaskObserver.observe({ entryTypes: ['longtask'] });
        } catch (error) {
            console.warn('[PerformanceMonitor] Long task monitoring not supported:', error);
        }
    }

    /**
     * 更新内存信息
     */
    updateMemory(timestamp) {
        if (timestamp - this.lastMemoryUpdate < this.memoryUpdateInterval) return;

        this.lastMemoryUpdate = timestamp;

        // Chrome/Edge支持performance.memory
        if (performance.memory) {
            this.memory = {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                usedPercent: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100).toFixed(2)
            };

            // 内存使用率过高
            if (parseFloat(this.memory.usedPercent) > 80) {
                eventBus.emit('performance:memory-high', this.memory);
            }
        }
    }

    /**
     * 检查性能等级
     */
    checkPerformanceLevel() {
        const previousLevel = this.performanceLevel;

        if (this.fps < this.lowFpsThreshold) {
            this.performanceLevel = 'low';
        } else if (this.fps >= this.recoverFpsThreshold) {
            this.performanceLevel = 'high';
        } else {
            this.performanceLevel = 'medium';
        }

        // 性能等级变化时发布事件
        if (previousLevel !== this.performanceLevel) {
            if (this.performanceLevel === 'low') {
                eventBus.emit('performance:low', {
                    reason: 'fps',
                    fps: this.fps,
                    level: this.performanceLevel
                });
            } else if (previousLevel === 'low' && this.performanceLevel !== 'low') {
                eventBus.emit('performance:recover', {
                    fps: this.fps,
                    level: this.performanceLevel
                });
            }
        }
    }

    /**
     * 获取当前性能状态
     */
    getStatus() {
        return {
            fps: this.fps,
            level: this.performanceLevel,
            memory: this.memory,
            isMonitoring: this.isMonitoring
        };
    }

    /**
     * 获取性能等级
     */
    getPerformanceLevel() {
        return this.performanceLevel;
    }

    /**
     * 是否是低性能设备
     */
    isLowPerformance() {
        return this.performanceLevel === 'low';
    }

    /**
     * 是否是高性能设备
     */
    isHighPerformance() {
        return this.performanceLevel === 'high';
    }
}

// 创建全局单例
export const performanceMonitor = new PerformanceMonitor();
