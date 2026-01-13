/**
 * PureSuck DeviceCapability - 设备能力检测
 * 检测CPU、内存、网络等设备能力,返回性能等级
 */

export class DeviceCapability {
    constructor() {
        this.cached = null;
        this.performanceLevel = 'high';
    }

    /**
     * 获取设备性能等级
     * @returns {string} 'high' | 'medium' | 'low'
     */
    getPerformanceLevel() {
        if (this.cached) {
            return this.cached;
        }

        const score = this.calculateScore();
        this.performanceLevel = this.scoreToLevel(score);
        this.cached = this.performanceLevel;

        console.log(
            `[DeviceCapability] Performance level: ${this.performanceLevel} ` +
            `(score: ${score.toFixed(2)})`
        );

        return this.performanceLevel;
    }

    /**
     * 计算设备性能分数 (0-100)
     */
    calculateScore() {
        let score = 0;
        let factors = 0;

        // CPU核心数 (0-30分)
        const cpuScore = this.getCpuScore();
        score += cpuScore;
        factors++;

        // 内存 (0-30分)
        const memoryScore = this.getMemoryScore();
        score += memoryScore;
        factors++;

        // 网络类型 (0-20分)
        const networkScore = this.getNetworkScore();
        score += networkScore;
        factors++;

        // 硬件并发 (0-20分)
        const concurrencyScore = this.getConcurrencyScore();
        score += concurrencyScore;
        factors++;

        // 归一化到0-100
        const maxScore = 100;
        const normalizedScore = Math.min(score / maxScore * 100, 100);

        return normalizedScore;
    }

    /**
     * 获取CPU分数 (0-30)
     */
    getCpuScore() {
        const cores = navigator.hardwareConcurrency || 4;
        
        if (cores >= 8) return 30;
        if (cores >= 6) return 25;
        if (cores >= 4) return 20;
        if (cores >= 2) return 15;
        return 10;
    }

    /**
     * 获取内存分数 (0-30)
     */
    getMemoryScore() {
        // Chrome/Edge支持navigator.deviceMemory
        if (navigator.deviceMemory) {
            const memory = navigator.deviceMemory; // GB
            
            if (memory >= 8) return 30;
            if (memory >= 6) return 25;
            if (memory >= 4) return 20;
            if (memory >= 2) return 15;
            return 10;
        }

        // 使用performance.memory作为备选
        if (performance.memory) {
            const limit = performance.memory.jsHeapSizeLimit / (1024 * 1024 * 1024); // GB
            
            if (limit >= 2) return 25;
            if (limit >= 1) return 20;
            return 15;
        }

        // 默认中等
        return 20;
    }

    /**
     * 获取网络分数 (0-20)
     */
    getNetworkScore() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (!connection) {
            return 15; // 默认中等
        }

        const effectiveType = connection.effectiveType;
        
        if (effectiveType === '4g') return 20;
        if (effectiveType === '3g') return 15;
        if (effectiveType === '2g') return 10;
        if (effectiveType === 'slow-2g') return 5;

        return 15;
    }

    /**
     * 获取并发分数 (0-20)
     */
    getConcurrencyScore() {
        // 使用CPU核心数作为并发指标
        const cores = navigator.hardwareConcurrency || 4;
        
        if (cores >= 8) return 20;
        if (cores >= 6) return 16;
        if (cores >= 4) return 12;
        if (cores >= 2) return 8;
        return 4;
    }

    /**
     * 分数转性能等级
     */
    scoreToLevel(score) {
        if (score >= 70) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    /**
     * 获取CPU核心数
     */
    getCpuCores() {
        return navigator.hardwareConcurrency || 4;
    }

    /**
     * 获取内存信息 (GB)
     */
    getMemoryInfo() {
        // Chrome/Edge
        if (navigator.deviceMemory) {
            return {
                deviceMemory: navigator.deviceMemory,
                source: 'navigator.deviceMemory'
            };
        }

        // performance.memory
        if (performance.memory) {
            return {
                jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / (1024 * 1024 * 1024)).toFixed(2),
                totalJSHeapSize: (performance.memory.totalJSHeapSize / (1024 * 1024 * 1024)).toFixed(2),
                usedJSHeapSize: (performance.memory.usedJSHeapSize / (1024 * 1024 * 1024)).toFixed(2),
                source: 'performance.memory'
            };
        }

        return null;
    }

    /**
     * 获取网络信息
     */
    getNetworkInfo() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (!connection) {
            return null;
        }

        return {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink, // Mbps
            rtt: connection.rtt, // ms
            saveData: connection.saveData
        };
    }

    /**
     * 是否是低性能设备
     */
    isLowPerformance() {
        return this.getPerformanceLevel() === 'low';
    }

    /**
     * 是否是高性能设备
     */
    isHighPerformance() {
        return this.getPerformanceLevel() === 'high';
    }

    /**
     * 是否应该使用简化动画
     */
    shouldSimplifyAnimation() {
        return this.isLowPerformance();
    }

    /**
     * 获取推荐的动画并发数
     */
    getRecommendedConcurrency() {
        const level = this.getPerformanceLevel();
        
        switch (level) {
            case 'high': return 8;
            case 'medium': return 6;
            case 'low': return 4;
            default: return 6;
        }
    }

    /**
     * 获取推荐的stagger延迟 (ms)
     */
    getRecommendedStagger() {
        const level = this.getPerformanceLevel();
        
        switch (level) {
            case 'high': return 30;
            case 'medium': return 40;
            case 'low': return 50;
            default: return 40;
        }
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cached = null;
    }

    /**
     * 获取完整信息
     */
    getInfo() {
        return {
            performanceLevel: this.getPerformanceLevel(),
            cpuCores: this.getCpuCores(),
            memory: this.getMemoryInfo(),
            network: this.getNetworkInfo(),
            recommendedConcurrency: this.getRecommendedConcurrency(),
            recommendedStagger: this.getRecommendedStagger()
        };
    }
}

// 创建全局单例
export const deviceCapability = new DeviceCapability();
