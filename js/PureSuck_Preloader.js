/**
 * PureSuck 智能预加载器
 * 功能: 智能预测用户行为，预加载文章数据，实现零延迟动画
 * 策略: Intersection Observer + Hover 触发 + 优先级管理
 * 作者: Kilo Code
 * 版本: 1.0.0
 */

class IntelligentPreloader {
    constructor() {
        // 缓存管理
        this.cache = new Map(); // URL -> {data, timestamp}
        this.priority = new Map(); // URL -> priority score
        this.maxCacheSize = 20; // 最多缓存20篇文章
        this.cacheTimeout = 5 * 60 * 1000; // 缓存5分钟过期

        // 预加载配置
        this.prefetchThreshold = 0.3; // 卡片可见30%时预加载
        this.rootMargin = '100px'; // 提前100px预加载

        // 性能监控
        this.stats = {
            total: 0,
            hits: 0,
            misses: 0,
            errors: 0
        };

        // Observer 实例
        this.observer = null;

        // 禁用标志
        this.disabled = false;
    }

    /**
     * 初始化预加载器
     */
    init() {
        if (this.disabled) {
            return;
        }

        // 检测设备性能，低端设备禁用预加载
        if (this.isLowEndDevice()) {
            this.disabled = true;
            return;
        }

        // 初始化 Intersection Observer
        this.initIntersectionObserver();

        // 绑定 hover 事件
        this.bindHoverEvents();

        // 定期清理过期缓存
        this.startCacheCleanup();
    }

    /**
     * 检测是否为低端设备
     */
    isLowEndDevice() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        // 检测 CPU 核心数
        const cores = navigator.hardwareConcurrency || 4;
        
        // 检测内存
        const memory = navigator.deviceMemory || 4;
        
        // 检测网络类型
        const slowNetwork = connection && (
            connection.effectiveType === '2g' || 
            connection.effectiveType === 'slow-2g'
        );

        return cores <= 2 || memory <= 2 || slowNetwork;
    }

    /**
     * 初始化 Intersection Observer
     */
    initIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            return;
        }

        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            { 
                threshold: this.prefetchThreshold,
                rootMargin: this.rootMargin
            }
        );

        // 监听所有文章卡片
        this.observeCards();

        // Pjax 完成后重新监听
        document.addEventListener('pjax:success', () => {
            setTimeout(() => this.observeCards(), 100);
        });
    }

    /**
     * 监听所有文章卡片
     */
    observeCards() {
        if (!this.observer) return;

        const cards = document.querySelectorAll('.post');
        cards.forEach(card => {
            this.observer.observe(card);
        });
    }

    /**
     * 处理 Intersection 事件
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                
                // 检查是否为加密文章
                if (this.isProtectedPost(card)) {
                    return; // 加密文章不预加载
                }
                
                const link = card.querySelector('.post-title a');
                if (link) {
                    const url = link.href;
                    this.prefetch(url, 'viewport');
                }
            }
        });
    }

    /**
     * 绑定 hover 事件
     */
    bindHoverEvents() {
        document.addEventListener('mouseover', (e) => {
            if (this.disabled) return;

            const card = e.target.closest('.post');
            if (!card) return;

            // 检查是否为加密文章
            if (this.isProtectedPost(card)) {
                return; // 加密文章不预加载
            }

            const link = card.querySelector('.post-title a');
            if (link) {
                // hover 时提升优先级预加载
                this.prefetch(link.href, 'hover');
            }
        }, { passive: true });
    }

    /**
     * 检查是否为加密文章
     * @param {Element} card - 文章卡片元素
     * @returns {boolean} 是否为加密文章
     */
    isProtectedPost(card) {
        // 检查多种加密文章标识
        return card.classList.contains('protected') ||
               card.classList.contains('post-password-required') ||
               card.classList.contains('post-protected') ||
               card.dataset.protected === 'true' ||
               card.querySelector('.post-password-form') !== null;
    }

    /**
     * 预加载文章数据
     * @param {string} url - 文章URL
     * @param {string} trigger - 触发来源: 'viewport' | 'hover' | 'manual'
     */
    async prefetch(url, trigger = 'manual') {
        if (this.disabled) return;

        // 已缓存则只更新优先级
        if (this.cache.has(url)) {
            this.updatePriority(url, trigger);
            return;
        }

        // 检查是否为当前页面
        if (url === window.location.href) {
            return;
        }

        this.stats.total++;

        try {
            // 发起轻量级预加载请求
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Prefetch': 'true',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                priority: trigger === 'hover' ? 'high' : 'low'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // 提取关键数据（轻量级）
            const data = this.extractCriticalData(doc, html);

            // 缓存数据
            this.cache.set(url, {
                ...data,
                timestamp: Date.now()
            });

            // 更新优先级
            this.updatePriority(url, trigger);

            // 清理旧缓存
            this.pruneCache();

        } catch (error) {
            this.stats.errors++;
        }
    }

    /**
     * 提取关键数据
     * @param {Document} doc - 解析后的文档
     * @param {string} html - 完整HTML
     * @returns {Object} 关键数据
     */
    extractCriticalData(doc, html) {
        return {
            // Layer 2 关键内容
            title: doc.querySelector('.post-title')?.textContent?.trim() || '',
            cover: doc.querySelector('.post-media img')?.src || '',
            author: doc.querySelector('.post-author .avatar-item:last-child')?.textContent?.trim() || '',
            meta: doc.querySelector('.meta.post-meta')?.innerHTML || '',
            
            // Layer 3 正文内容
            content: doc.querySelector('.post-content')?.innerHTML || '',
            
            // 完整HTML（用于完整渲染）
            fullHTML: html,
            
            // 元数据
            pageTitle: doc.querySelector('title')?.textContent || '',
            
            // 统计信息
            size: html.length
        };
    }

    /**
     * 更新URL优先级
     * @param {string} url - URL
     * @param {string} trigger - 触发来源
     */
    updatePriority(url, trigger) {
        const scores = { 
            hover: 10,      // 最高优先级
            viewport: 5,    // 中等优先级
            manual: 1       // 低优先级
        };
        
        const current = this.priority.get(url) || 0;
        const newScore = current + (scores[trigger] || 1);
        
        this.priority.set(url, newScore);
    }

    /**
     * 清理过期和低优先级缓存
     */
    pruneCache() {
        const now = Date.now();

        // 清理过期缓存
        for (const [url, data] of this.cache.entries()) {
            if (now - data.timestamp > this.cacheTimeout) {
                this.cache.delete(url);
                this.priority.delete(url);
            }
        }

        // 清理超出数量限制的缓存
        if (this.cache.size <= this.maxCacheSize) return;

        // 按优先级排序，删除低优先级缓存
        const sorted = Array.from(this.priority.entries())
            .sort((a, b) => a[1] - b[1]);

        const toDelete = sorted.slice(0, this.cache.size - this.maxCacheSize);
        
        toDelete.forEach(([url]) => {
            this.cache.delete(url);
            this.priority.delete(url);
        });
    }

    /**
     * 定期清理缓存
     */
    startCacheCleanup() {
        setInterval(() => {
            this.pruneCache();
        }, 60 * 1000); // 每分钟清理一次
    }

    /**
     * 获取缓存数据
     * @param {string} url - URL
     * @returns {Object|null} 缓存数据
     */
    getCache(url) {
        const data = this.cache.get(url);
        
        if (data) {
            this.stats.hits++;
        } else {
            this.stats.misses++;
        }
        
        return data;
    }

    /**
     * 计算缓存命中率
     * @returns {number} 命中率百分比
     */
    getHitRate() {
        const total = this.stats.hits + this.stats.misses;
        if (total === 0) return 0;
        return Math.round((this.stats.hits / total) * 100);
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的大小
     */
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * 获取性能统计
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            ...this.stats,
            hitRate: this.getHitRate(),
            cacheSize: this.cache.size,
            cacheUrls: Array.from(this.cache.keys())
        };
    }

    /**
     * 清空所有缓存
     */
    clearCache() {
        this.cache.clear();
        this.priority.clear();
    }

    /**
     * 销毁预加载器
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        this.clearCache();
    }
}

// 创建全局实例
if (typeof window !== 'undefined') {
    window.preloader = new IntelligentPreloader();
    
    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.preloader.init();
        });
    } else {
        window.preloader.init();
    }
}