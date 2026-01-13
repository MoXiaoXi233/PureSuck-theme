/**
 * PureSuck StaggerManager - Stagger延迟管理器
 * 实现非线性stagger计算,前快后慢,提升响应性
 */

import { deviceCapability } from '../core/DeviceCapability.js';

export class StaggerManager {
    constructor() {
        this.baseStagger = 32; // 基础stagger延迟(ms)
        this.minStagger = 30; // 最小stagger延迟(ms)
        this.maxStagger = 60; // 最大stagger延迟(ms)
    }

    /**
     * 计算stagger延迟(非线性,前快后慢)
     * @param {number} index - 元素索引
     * @param {number} total - 总元素数
     * @returns {number} 延迟时间(ms)
     */
    calculateDelay(index, total) {
        // 前3个元素: 最小延迟
        if (index < 3) {
            return this.minStagger;
        }

        // 第4-6个元素: 中等延迟
        if (index < 6) {
            return 40;
        }

        // 后面元素逐渐增加,最大60ms
        const progress = (index - 6) / (total - 6);
        return Math.min(40 + progress * 20, this.maxStagger);
    }

    /**
     * 计算批量stagger延迟
     * @param {number} batchIndex - 批次索引
     * @param {number} totalBatches - 总批次数
     * @returns {number} 延迟时间(ms)
     */
    calculateBatchDelay(batchIndex, totalBatches) {
        // 前2批: 最小延迟
        if (batchIndex < 2) {
            return 60;
        }

        // 后面批次逐渐增加
        const progress = batchIndex / totalBatches;
        return Math.min(60 + progress * 40, 100);
    }

    /**
     * 根据设备性能调整stagger
     * @returns {number} 调整后的stagger
     */
    getAdaptiveStagger() {
        const deviceLevel = deviceCapability.getPerformanceLevel();

        switch (deviceLevel) {
            case 'high':
                return 30;
            case 'medium':
                return 40;
            case 'low':
                return 50;
            default:
                return 40;
        }
    }

    /**
     * 获取推荐的stagger配置
     * @param {string} pageType - 页面类型: list, post, page
     * @returns {Object} stagger配置
     */
    getRecommendedConfig(pageType) {
        const adaptiveStagger = this.getAdaptiveStagger();

        switch (pageType) {
            case 'list':
                return {
                    stagger: Math.min(adaptiveStagger + 2, 32),
                    batchSize: 8,
                    batchGap: 80
                };
            case 'post':
                return {
                    stagger: adaptiveStagger,
                    batchSize: 6,
                    batchGap: 60
                };
            case 'page':
                return {
                    stagger: Math.min(adaptiveStagger + 2, 32),
                    batchSize: 8,
                    batchGap: 80
                };
            default:
                return {
                    stagger: 32,
                    batchSize: 8,
                    batchGap: 80
                };
        }
    }

    /**
     * 计算所有元素的延迟
     * @param {number} total - 总元素数
     * @returns {number[]} 延迟数组
     */
    calculateAllDelays(total) {
        const delays = [];
        for (let i = 0; i < total; i++) {
            delays.push(this.calculateDelay(i, total));
        }
        return delays;
    }

    /**
     * 设置基础stagger
     * @param {number} stagger - 基础stagger延迟(ms)
     */
    setBaseStagger(stagger) {
        this.baseStagger = Math.max(this.minStagger, Math.min(stagger, this.maxStagger));
    }

    /**
     * 获取基础stagger
     * @returns {number}
     */
    getBaseStagger() {
        return this.baseStagger;
    }
}

// 创建全局单例
export const staggerManager = new StaggerManager();
