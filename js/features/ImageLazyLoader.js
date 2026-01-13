/**
 * PureSuck ImageLazyLoader - 图片懒加载器
 * 使用IntersectionObserver和loading="lazy"属性实现图片懒加载
 */

import { eventBus } from '../core/EventBus.js';

export class ImageLazyLoader {
    constructor() {
        this.observer = null;
        this.observedImages = new WeakSet();
        this.loadedImages = new WeakSet();
        this.isInitialized = false;
    }

    /**
     * 初始化
     */
    init() {
        if (this.isInitialized) {
            console.warn('[ImageLazyLoader] Already initialized');
            return;
        }

        if (typeof IntersectionObserver !== 'function') {
            console.warn('[ImageLazyLoader] IntersectionObserver not supported');
            this.fallbackInit();
            return;
        }

        this.observer = new IntersectionObserver(
            this.handleIntersections.bind(this),
            {
                rootMargin: '200px 0px',
                threshold: 0.01
            }
        );

        this.isInitialized = true;
        console.log('[ImageLazyLoader] Initialized');
    }

    /**
     * 降级初始化(不支持IntersectionObserver)
     */
    fallbackInit() {
        // 直接加载所有图片
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => {
            this.loadImage(img);
        });
    }

    /**
     * 处理交叉观察
     */
    handleIntersections(entries) {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                const img = entry.target;
                this.loadImage(img);
                this.observer.unobserve(img);
            }
        }
    }

    /**
     * 加载图片
     * @param {HTMLImageElement} img - 图片元素
     */
    loadImage(img) {
        if (this.loadedImages.has(img)) return;

        // 检查是否有data-src
        const src = img.dataset.src;
        if (src) {
            img.src = src;
            delete img.dataset.src;
        }

        // 检查是否有data-srcset
        const srcset = img.dataset.srcset;
        if (srcset) {
            img.srcset = srcset;
            delete img.dataset.srcset;
        }

        // 监听加载完成
        img.onload = () => {
            img.classList.add('loaded');
            this.loadedImages.add(img);
            eventBus.emit('image:loaded', { img, src: img.src });
        };

        img.onerror = () => {
            img.classList.add('error');
            eventBus.emit('image:error', { img, src: img.src });
        };
    }

    /**
     * 观察图片
     * @param {HTMLImageElement} img - 图片元素
     */
    observe(img) {
        if (!this.isInitialized || !img) return;

        if (this.observedImages.has(img)) return;

        // 检查是否已经有loading属性
        if (img.hasAttribute('loading')) {
            return;
        }

        // 添加loading="lazy"属性
        img.setAttribute('loading', 'lazy');

        // 如果有data-src,使用IntersectionObserver
        if (img.dataset.src || img.dataset.srcset) {
            this.observedImages.add(img);
            this.observer.observe(img);
        }
    }

    /**
     * 批量观察图片
     * @param {NodeList|Element[]} images - 图片元素集合
     */
    observeMany(images) {
        if (!Array.isArray(images)) {
            images = Array.from(images || []);
        }

        for (const img of images) {
            this.observe(img);
        }
    }

    /**
     * 设置首屏图片为eager加载
     * @param {number} count - 首屏图片数量
     */
    setAboveFoldImagesEager(count = 3) {
        const images = document.querySelectorAll('img');
        const eagerImages = Array.from(images).slice(0, count);

        for (const img of eagerImages) {
            img.setAttribute('loading', 'eager');
        }

        console.log(`[ImageLazyLoader] Set ${eagerImages.length} images as eager`);
    }

    /**
     * 自动初始化页面中的图片
     * @param {Object} options - 配置选项
     */
    autoInit(options = {}) {
        const {
            eagerCount = 3,
            selector = 'img'
        } = options;

        // 设置首屏图片为eager
        this.setAboveFoldImagesEager(eagerCount);

        // 观察其他图片
        const images = document.querySelectorAll(selector);
        this.observeMany(images);

        console.log(`[ImageLazyLoader] Auto initialized ${images.length} images`);
    }

    /**
     * 取消观察
     * @param {HTMLImageElement} img - 图片元素
     */
    unobserve(img) {
        if (!this.observer || !img) return;

        this.observer.unobserve(img);
        this.observedImages.delete(img);
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (!this.observer) return;

        this.observer.disconnect();
        this.observedImages = new WeakSet();

        console.log('[ImageLazyLoader] Disconnected');
    }

    /**
     * 重置
     */
    reset() {
        this.disconnect();
        this.init();
    }

    /**
     * 获取已加载图片数量
     * @returns {number}
     */
    getLoadedCount() {
        // WeakMap无法直接获取大小
        return document.querySelectorAll('img.loaded').length;
    }
}

// 创建全局单例
export const imageLazyLoader = new ImageLazyLoader();
