/**
 * PureSuck ResourceManager - 资源管理器
 * 实现资源预加载和管理
 */

import { eventBus } from './EventBus.js';

export class ResourceManager {
    constructor() {
        this.preloadedLinks = new Set();
        this.hoverTimers = new Map();
        this.hoverDelay = 100; // hover延迟(ms)
    }

    /**
     * 预加载链接资源
     * @param {string} url - 资源URL
     * @param {string} type - 资源类型: style, script, font, image
     */
    preload(url, type = 'image') {
        if (!url || this.preloadedLinks.has(url)) return;

        const link = document.createElement('link');
        link.rel = 'preload';
        
        switch (type) {
            case 'style':
                link.as = 'style';
                link.href = url;
                break;
            case 'script':
                link.as = 'script';
                link.href = url;
                break;
            case 'font':
                link.as = 'font';
                link.type = 'font/woff2';
                link.href = url;
                link.crossOrigin = 'anonymous';
                break;
            case 'image':
            default:
                link.as = 'image';
                link.href = url;
                break;
        }

        document.head.appendChild(link);
        this.preloadedLinks.add(url);

        eventBus.emit('resource:preloaded', { url, type });
    }

    /**
     * 预连接域名
     * @param {string} origin - 域名
     */
    preconnect(origin) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        document.head.appendChild(link);
    }

    /**
     * DNS预解析
     * @param {string} hostname - 主机名
     */
    dnsPrefetch(hostname) {
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = hostname;
        document.head.appendChild(link);
    }

    /**
     * Hover预加载
     * @param {Element} link - 链接元素
     * @param {Function} callback - 回调函数
     */
    setupHoverPreload(link, callback) {
        if (!link || !link.href) return;

        const handleMouseEnter = () => {
            // 清除之前的定时器
            if (this.hoverTimers.has(link)) {
                clearTimeout(this.hoverTimers.get(link));
            }

            // 设置新的定时器
            const timer = setTimeout(() => {
                if (typeof callback === 'function') {
                    callback(link.href);
                }
            }, this.hoverDelay);

            this.hoverTimers.set(link, timer);
        };

        const handleMouseLeave = () => {
            // 清除定时器
            if (this.hoverTimers.has(link)) {
                clearTimeout(this.hoverTimers.get(link));
                this.hoverTimers.delete(link);
            }
        };

        link.addEventListener('mouseenter', handleMouseEnter);
        link.addEventListener('mouseleave', handleMouseLeave);
    }

    /**
     * 批量设置hover预加载
     * @param {NodeList|Element[]} links - 链接元素集合
     * @param {Function} callback - 回调函数
     */
    setupHoverPreloadMany(links, callback) {
        const linkArray = Array.from(links || []);
        
        for (const link of linkArray) {
            this.setupHoverPreload(link, callback);
        }
    }

    /**
     * 预加载下一页
     * @param {string} nextUrl - 下一页URL
     */
    preloadNextPage(nextUrl) {
        if (!nextUrl) return;

        try {
            const url = new URL(nextUrl, window.location.origin);
            
            // 预连接域名
            this.preconnect(url.origin);
            
            // 预加载页面
            fetch(url, {
                method: 'HEAD',
                credentials: 'same-origin'
            }).catch(() => {
                // 忽略错误
            });

            eventBus.emit('resource:next-page-preloaded', { url: nextUrl });
        } catch (error) {
            console.warn('[ResourceManager] Failed to preload next page:', error);
        }
    }

    /**
     * 预加载关键资源
     */
    preloadCriticalResources() {
        // 预连接CDN
        this.preconnect('https://cdn.jsdelivr.net');
        
        // DNS预解析常用域名
        this.dnsPrefetch('//cdn.jsdelivr.net');
    }

    /**
     * 清除hover预加载
     * @param {Element} link - 链接元素
     */
    clearHoverPreload(link) {
        if (this.hoverTimers.has(link)) {
            clearTimeout(this.hoverTimers.get(link));
            this.hoverTimers.delete(link);
        }
    }

    /**
     * 清除所有hover预加载
     */
    clearAllHoverPreloads() {
        for (const timer of this.hoverTimers.values()) {
            clearTimeout(timer);
        }
        this.hoverTimers.clear();
    }

    /**
     * 获取已预加载的资源数量
     * @returns {number}
     */
    getPreloadedCount() {
        return this.preloadedLinks.size;
    }

    /**
     * 清除预加载记录
     */
    clearPreloadedLinks() {
        this.preloadedLinks.clear();
    }
}

// 创建全局单例
export const resourceManager = new ResourceManager();
