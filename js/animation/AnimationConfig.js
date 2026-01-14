/**
 * PureSuck AnimationConfig - 动画配置
 * 集中管理所有动画配置，支持性能自适应和动态调整
 * 
 * @module animation/AnimationConfig
 */

import { staggerManager } from './StaggerManager.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';
import { eventBus } from '../core/EventBus.js';

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
 * 基础动画配置常量
 * @private
 */
const BASE_CONFIG = {
    // 列表页动画配置
    list: {
        enter: {
            duration: 520,
            stagger: 65,
            y: 48,
            scale: 1,
            easing: 'cubic-bezier(0.16, 0.55, 0.35, 1)',
            batchSize: 6,
            batchGap: 100,
            maxItems: 14
        },
        exit: {
            duration: 240,
            stagger: 25,
            y: -12,
            scale: 0.96,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }
    },
    // 文章页动画配置
    post: {
        enter: {
            duration: 380,
            stagger: 32,
            y: 16,
            scale: 1,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            batchSize: 8,
            batchGap: 80,
            maxItems: 24
        },
        exit: {
            duration: 320,
            contentStagger: 30,
            y: -12,
            scale: 0.96,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }
    },
    // 独立页动画配置
    page: {
        enter: {
            card: {
                duration: 520,
                y: 40,
                scale: 0.98,
                easing: 'cubic-bezier(0.16, 0.55, 0.35, 1)'
            },
            inner: {
                duration: 360,
                stagger: 28,
                y: 12,
                easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
                batchSize: 6,
                batchGap: 70,
                maxItems: 16
            }
        },
        exit: {
            duration: 320,
            innerStagger: 20,
            y: -12,
            scale: 0.96,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }
    },
    // View Transitions 配置
    vt: {
        duration: 500,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        leadMs: 100
    },
    // 滚动动画配置
    scroll: {
        duration: 550,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
    }
};

/**
 * 性能等级对应的配置调整因子
 * @private
 */
const PERFORMANCE_MULTIPLIERS = {
    [PerformanceLevel.HIGH]: {
        duration: 1.0,      // 100% 时长
        stagger: 1.0,       // 100% 交错
        batchSize: 1.0,     // 100% 批次大小
        maxItems: 1.0,     // 100% 最大元素数
        y: 1.0,            // 100% Y轴位移
        scale: 1.0         // 100% 缩放
    },
    [PerformanceLevel.MEDIUM]: {
        duration: 0.8,     // 80% 时长
        stagger: 0.8,      // 80% 交错
        batchSize: 1.2,     // 120% 批次大小（一次处理更多）
        maxItems: 0.8,      // 80% 最大元素数
        y: 0.8,            // 80% Y轴位移
        scale: 1.0         // 100% 缩放
    },
    [PerformanceLevel.LOW]: {
        duration: 0.6,     // 60% 时长
        stagger: 0.6,      // 60% 交错
        batchSize: 1.5,    // 150% 批次大小
        maxItems: 0.6,      // 60% 最大元素数
        y: 0.5,            // 50% Y轴位移
        scale: 1.0         // 100% 缩放
    },
    [PerformanceLevel.REDUCED]: {
        duration: 0.1,     // 10% 时长（几乎无动画）
        stagger: 0.1,      // 10% 交错
        batchSize: 2.0,    // 200% 批次大小（一次性处理）
        maxItems: 0.3,      // 30% 最大元素数
        y: 0.1,            // 10% Y轴位移
        scale: 1.0         // 100% 缩放
    }
};

/**
 * 动画配置管理器类
 */
export class AnimationConfigManager {
    constructor() {
        this.currentLevel = PerformanceLevel.HIGH;
        this.currentFPS = 60;
        this.isMonitoring = false;
        this.adaptiveConfigs = new Map(); // 缓存自适应配置
        this.lastUpdateTime = 0;
        this.updateInterval = 500; // 配置更新间隔（毫秒）

        // 初始化
        this._init();
    }

    /**
     * 初始化
     * @private
     */
    _init() {
        // FPS监控已移除，性能等级现在基于设备能力检测
        // 默认使用高性能配置
        this.currentLevel = PerformanceLevel.HIGH;
        
        console.log('[AnimationConfig] Initialized');
    }

    /**
     * 获取基础配置
     * @param {string} pageType - 页面类型: list, post, page
     * @returns {Object} 基础配置
     */
    getBaseConfig(pageType) {
        return BASE_CONFIG[pageType] || BASE_CONFIG.list;
    }

    /**
     * 获取指定性能等级的配置
     * @param {string} pageType - 页面类型: list, post, page
     * @param {string} level - 性能等级
     * @returns {Object} 配置对象
     */
    getConfig(pageType, level = this.currentLevel) {
        const cacheKey = `${pageType}-${level}`;

        // 检查缓存
        if (this.adaptiveConfigs.has(cacheKey)) {
            return this.adaptiveConfigs.get(cacheKey);
        }

        // 获取基础配置
        const baseConfig = this.getBaseConfig(pageType);

        // 获取性能因子
        const multipliers = PERFORMANCE_MULTIPLIERS[level] || PERFORMANCE_MULTIPLIERS[PerformanceLevel.HIGH];

        // 应用性能因子
        const adaptiveConfig = this._applyMultipliers(baseConfig, multipliers);

        // 缓存配置
        this.adaptiveConfigs.set(cacheKey, adaptiveConfig);

        return adaptiveConfig;
    }

    /**
     * 应用性能因子到配置
     * @private
     * @param {Object} config - 基础配置
     * @param {Object} multipliers - 性能因子
     * @returns {Object} 调整后的配置
     */
    _applyMultipliers(config, multipliers) {
        const result = {};

        for (const key in config) {
            const value = config[key];

            if (typeof value === 'number') {
                // 数字类型：应用因子
                result[key] = Math.round(value * (multipliers[key] || 1.0));
            } else if (typeof value === 'object' && value !== null) {
                // 对象类型：递归应用
                result[key] = this._applyMultipliers(value, multipliers);
            } else {
                // 其他类型：直接复制
                result[key] = value;
            }
        }

        return result;
    }

    /**
     * 获取自适应配置（带stagger管理器集成）
     * @param {string} pageType - 页面类型: list, post, page
     * @returns {Object} 自适应配置
     */
    getAdaptiveConfig(pageType) {
        const config = this.getConfig(pageType, this.currentLevel);

        // 集成stagger管理器
        const adaptiveStagger = staggerManager.getAdaptiveStagger();

        // 对于有stagger属性的配置，使用自适应stagger
        if (config.enter && typeof config.enter.stagger === 'number') {
            config.enter.stagger = adaptiveStagger;
        }
        if (config.exit && typeof config.exit.stagger === 'number') {
            config.exit.stagger = adaptiveStagger;
        }

        return config;
    }

    /**
     * 获取进入动画配置
     * @param {string} pageType - 页面类型: list, post, page
     * @returns {Object} 进入动画配置
     */
    getEnterConfig(pageType) {
        return this.getAdaptiveConfig(pageType).enter;
    }

    /**
     * 获取退出动画配置
     * @param {string} pageType - 页面类型: list, post, page
     * @returns {Object} 退出动画配置
     */
    getExitConfig(pageType) {
        return this.getAdaptiveConfig(pageType).exit;
    }

    /**
     * 获取VT配置
     * @returns {Object} VT配置
     */
    getVTConfig() {
        return { ...BASE_CONFIG.vt };
    }

    /**
     * 获取滚动配置
     * @returns {Object} 滚动配置
     */
    getScrollConfig() {
        return { ...BASE_CONFIG.scroll };
    }

    /**
     * 适配到指定性能等级
     * @param {string} level - 性能等级
     */
    adaptToLevel(level) {
        if (!Object.values(PerformanceLevel).includes(level)) {
            console.warn(`[AnimationConfig] Invalid performance level: ${level}`);
            return;
        }

        const previousLevel = this.currentLevel;
        this.currentLevel = level;

        // 清除配置缓存
        this.adaptiveConfigs.clear();

        console.log(`[AnimationConfig] Adapted to ${previousLevel} -> ${level}`);

        // 发布配置更新事件
        eventBus.emit('animation:config:updated', {
            level,
            previousLevel
        });
    }

    /**
     * 获取当前性能等级
     * @returns {string}
     */
    getCurrentLevel() {
        return this.currentLevel;
    }

    /**
     * 获取当前FPS
     * @returns {number}
     */
    getCurrentFPS() {
        return this.currentFPS;
    }

    /**
     * 获取所有基础配置
     * @returns {Object} 所有基础配置
     */
    getAllBaseConfigs() {
        return BASE_CONFIG;
    }

    /**
     * 获取性能因子
     * @param {string} level - 性能等级
     * @returns {Object} 性能因子
     */
    getMultipliers(level = this.currentLevel) {
        return { ...PERFORMANCE_MULTIPLIERS[level] };
    }

    /**
     * 重置到默认配置
     */
    reset() {
        this.currentLevel = PerformanceLevel.HIGH;
        this.currentFPS = 60;
        this.adaptiveConfigs.clear();
        this.lastUpdateTime = 0;

        console.log('[AnimationConfig] Reset to default');

        // 发布重置事件
        eventBus.emit('animation:config:reset');
    }

    /**
     * 销毁配置管理器
     */
    destroy() {
        this.adaptiveConfigs.clear();
        console.log('[AnimationConfig] Destroyed');
    }
}

// 创建全局单例
export const animationConfigManager = new AnimationConfigManager();

/**
 * 获取自适应配置（便捷函数）
 * @param {string} pageType - 页面类型
 * @returns {Object} 自适应配置
 */
export function getAdaptiveConfig(pageType) {
    return animationConfigManager.getAdaptiveConfig(pageType);
}

/**
 * 获取进入动画配置（便捷函数）
 * @param {string} pageType - 页面类型
 * @returns {Object} 进入动画配置
 */
export function getEnterConfig(pageType) {
    return animationConfigManager.getEnterConfig(pageType);
}

/**
 * 获取退出动画配置（便捷函数）
 * @param {string} pageType - 页面类型
 * @returns {Object} 退出动画配置
 */
export function getExitConfig(pageType) {
    return animationConfigManager.getExitConfig(pageType);
}

/**
 * 获取配置（便捷函数）
 * @param {string} pageType - 页面类型
 * @param {string} level - 性能等级
 * @returns {Object} 配置对象
 */
export function getConfig(pageType, level) {
    return animationConfigManager.getConfig(pageType, level);
}

/**
 * 适配到指定性能等级（便捷函数）
 * @param {string} level - 性能等级
 */
export function adaptToLevel(level) {
    animationConfigManager.adaptToLevel(level);
}

/**
 * 获取所有配置（便捷函数）
 * @returns {Object} 所有基础配置
 */
export function getAllConfigs() {
    return animationConfigManager.getAllBaseConfigs();
}
