/**
 * PureSuck AnimationConfig - 动画配置
 * 集中管理所有动画配置,统一动画时长和easing
 */

import { staggerManager } from './StaggerManager.js';

/**
 * 动画配置
 */
export const ANIM_CONFIG = {
    // 列表页动画配置
    list: {
        enter: {
            duration: 400, // 从520ms降低
            stagger: 32,   // 从65ms降低
            y: 48,
            scale: 1,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            batchSize: 8,
            batchGap: 80,
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
            stagger: 30,
            y: 32,
            scale: 1,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            batchSize: 6,
            batchGap: 60,
            maxItems: 24
        },
        exit: {
            duration: 240,
            stagger: 25,
            y: -12,
            scale: 0.96,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }
    },
    // 独立页动画配置
    page: {
        enter: {
            duration: 400,
            stagger: 32,
            y: 48,
            scale: 1,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            batchSize: 8,
            batchGap: 80,
            maxItems: 16
        },
        exit: {
            duration: 240,
            stagger: 25,
            y: -12,
            scale: 0.96,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }
    }
};

/**
 * 根据设备性能自适应调整配置
 * @param {string} pageType - 页面类型: list, post, page
 * @returns {Object} 调整后的配置
 */
export function getAdaptiveConfig(pageType) {
    const baseConfig = ANIM_CONFIG[pageType];
    const adaptiveStagger = staggerManager.getAdaptiveStagger();

    return {
        enter: {
            ...baseConfig.enter,
            stagger: adaptiveStagger
        },
        exit: {
            ...baseConfig.exit
        }
    };
}

/**
 * 获取进入动画配置
 * @param {string} pageType - 页面类型: list, post, page
 * @returns {Object} 进入动画配置
 */
export function getEnterConfig(pageType) {
    return getAdaptiveConfig(pageType).enter;
}

/**
 * 获取退出动画配置
 * @param {string} pageType - 页面类型: list, post, page
 * @returns {Object} 退出动画配置
 */
export function getExitConfig(pageType) {
    return ANIM_CONFIG[pageType].exit;
}

/**
 * 获取所有配置
 * @returns {Object} 所有动画配置
 */
export function getAllConfigs() {
    return ANIM_CONFIG;
}
