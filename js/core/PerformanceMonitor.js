/**
 * PureSuck PerformanceMonitor - 性能监控器
 * 监控长任务和内存使用情况
 * 注意：已移除FPS监控，现代设备普遍为高刷，FPS监控意义不大且浪费资源
 */

import { eventBus } from './EventBus.js';

export class PerformanceMonitor {
    constructor() {
        this.isMonitoring = false;
        
        this.longTaskThreshold = 50; // 长任务阈值(ms)
        this.longTaskObserver = null;
        
        this.memory = null;
        this.memoryUpdateInterval = 2000; // 每2秒更新一次内存
        this.lastMemoryUpdate = 0;
        
        this.memoryCheckInterval = null;
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
        this.lastMemoryUpdate = performance.now();

        // 开始长任务监控
        this.startLongTaskMonitoring();

        // 开始内存监控
        this.startMemoryMonitoring();

        console.log('[PerformanceMonitor] Started');
    }

    /**
     * 停止性能监控
     */
    stop() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;

        if (this.longTaskObserver) {
            this.longTaskObserver.disconnect();
            this.longTaskObserver = null;
        }

        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = null;
        }

        console.log('[PerformanceMonitor] Stopped');
    }

    /**
     * 内存监控
     */
    startMemoryMonitoring() {
        const checkMemory = () => {
            if (!this.isMonitoring) return;

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

            this.lastMemoryUpdate = performance.now();
        };

        // 立即执行一次
        checkMemory();

        // 定时检查
        this.memoryCheckInterval = setInterval(checkMemory, this.memoryUpdateInterval);
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
     * 获取当前性能状态
     */
    getStatus() {
        return {
            memory: this.memory,
            isMonitoring: this.isMonitoring
        };
    }
}

// 创建全局单例
export const performanceMonitor = new PerformanceMonitor();
