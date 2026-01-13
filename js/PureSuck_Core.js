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

    // 3. 启动性能监控
    performanceMonitor.start();
    console.log('[PureSuck Core] Performance monitoring started');

    // 4. 监听性能事件
    eventBus.on('performance:update', (data) => {
        // 可选: 在控制台显示性能信息
        if (window.PureSuck.DEBUG) {
            console.log(`[PureSuck Core] Performance update: FPS=${data.fps}, Level=${data.level}`);
        }
    });

    eventBus.on('performance:low', (data) => {
        console.warn(
            `[PureSuck Core] Performance degraded: ${data.reason}, ` +
            `FPS=${performanceMonitor.fps}, Level=${data.level}`
        );
    });

    eventBus.on('performance:recover', (data) => {
        console.log(
            `[PureSuck Core] Performance recovered: FPS=${data.fps}, Level=${data.level}`
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
