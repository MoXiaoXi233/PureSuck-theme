/**
 * PureSuck Core - 核心入口文件
 * 初始化所有核心模块: EventBus, PerformanceMonitor, AnimationFrameManager, DeviceCapability
 */

import { EventBus, eventBus } from './core/EventBus.js';
import { PerformanceMonitor, performanceMonitor } from './core/PerformanceMonitor.js';
import { AnimationFrameManager, animationFrameManager } from './core/AnimationFrameManager.js';
import { DeviceCapability, deviceCapability } from './core/DeviceCapability.js';

// 导出全局实例
window.PureSuck = {
    EventBus,
    eventBus,
    PerformanceMonitor,
    performanceMonitor,
    AnimationFrameManager,
    animationFrameManager,
    DeviceCapability,
    deviceCapability
};

// 初始化函数
function initPureSuckCore() {
    console.log('[PureSuck Core] Initializing...');

    // 1. 获取设备性能等级
    const deviceLevel = deviceCapability.getPerformanceLevel();
    console.log(`[PureSuck Core] Device performance level: ${deviceLevel}`);

    // 2. 根据设备性能调整动画帧管理器
    animationFrameManager.adaptToPerformance(deviceLevel);

    // 3. 启动性能监控（仅监控长任务和内存）
    performanceMonitor.start();
    console.log('[PureSuck Core] Performance monitoring started (long tasks & memory)');

    // 4. 监听长任务事件
    eventBus.on('performance:longtask', (data) => {
        console.warn(
            `[PureSuck Core] Long task detected: ${data.duration.toFixed(2)}ms`
        );
    });

    // 5. 监听内存高使用事件
    eventBus.on('performance:memory-high', (data) => {
        console.warn(
            `[PureSuck Core] Memory usage high: ${data.usedPercent}%`
        );
    });

    eventBus.on('animation:adapted', (data) => {
        console.log(
            `[PureSuck Core] Animation adapted: Level=${data.level}, ` +
            `Max concurrent=${data.maxConcurrent}`
        );
    });

    console.log('[PureSuck Core] Initialized successfully');
    console.log('[PureSuck Core] Available modules:', Object.keys(window.PureSuck));
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPureSuckCore);
} else {
    initPureSuckCore();
}

// 导出供其他模块使用
export {
    EventBus,
    eventBus,
    PerformanceMonitor,
    performanceMonitor,
    AnimationFrameManager,
    animationFrameManager,
    DeviceCapability,
    deviceCapability
};
