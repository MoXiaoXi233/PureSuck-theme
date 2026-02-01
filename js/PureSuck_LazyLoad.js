/**
 * PureSuck LazyLoad Manager
 *
 * 简洁的懒加载系统，与 Swup/VT 动画协调
 * 依赖浏览器原生缓存机制，不重复造轮子
 */

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        rootMargin: '200px 0px',
        threshold: 0.01,
        selector: 'img[data-lazy-src]'
    };

    // ==================== 状态 ====================
    let observer = null;
    let isInitialized = false;

    // ==================== 核心函数 ====================

    /**
     * 加载单张图片
     */
    function loadImage(img) {
        const src = img.dataset.lazySrc;
        if (!src) return Promise.resolve(img);

        return new Promise((resolve) => {
            // 移除懒加载标记
            img.removeAttribute('data-lazy-src');
            img.classList.add('lazy-loaded');

            // 设置真实 src
            img.src = src;

            // 处理 srcset
            const srcset = img.dataset.lazySrcset;
            if (srcset) {
                img.srcset = srcset;
                img.removeAttribute('data-lazy-srcset');
            }

            // 绑定 medium-zoom
            if (img.hasAttribute('data-zoomable') && window.mediumZoomInstance) {
                window.mediumZoomInstance.attach(img);
            }

            resolve(img);
        });
    }

    /**
     * 创建 Intersection Observer
     */
    function createObserver() {
        if (observer) return observer;

        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    observer.unobserve(img);
                    loadImage(img);
                }
            });
        }, {
            rootMargin: CONFIG.rootMargin,
            threshold: CONFIG.threshold
        });

        return observer;
    }

    // ==================== 公共 API ====================

    const LazyLoadManager = {
        init() {
            if (isInitialized) return;
            isInitialized = true;

            createObserver();
            this.observe(document);
        },

        observe(root = document) {
            const obs = createObserver();
            const images = root.querySelectorAll(CONFIG.selector);

            images.forEach(img => {
                if (!img.dataset.lazySrc) return;
                if (img.classList.contains('lazy-loaded')) return;
                obs.observe(img);
            });
        },

        /**
         * 立即加载指定范围内的所有懒加载图片
         */
        async loadAll(root = document) {
            const images = root.querySelectorAll(CONFIG.selector);
            if (!images.length) return [];

            images.forEach(img => observer?.unobserve(img));

            const promises = Array.from(images).map(img => loadImage(img));
            return Promise.all(promises);
        },

        /**
         * VT 动画前加载卡片内的图片
         */
        async loadForVT(postCard) {
            if (!postCard) return;
            await this.loadAll(postCard);
        }
    };

    // ==================== 导出 & 初始化 ====================
    window.LazyLoadManager = LazyLoadManager;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => LazyLoadManager.init());
    } else {
        LazyLoadManager.init();
    }

})();
