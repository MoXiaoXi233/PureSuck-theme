/**
 * PureSuck RouteManager - 路由管理器
 * 统一的页面类型检测，支持URL和DOM双重检测
 * 
 * @module navigation/RouteManager
 */

import { eventBus } from '../core/EventBus.js';

/**
 * 页面类型枚举
 * @readonly
 * @enum {string}
 */
export const PageType = {
    /** 列表页（首页、分类页、标签页、搜索页） */
    LIST: 'list',
    /** 文章详情页 */
    POST: 'post',
    /** 独立页面（关于、友链、归档等） */
    PAGE: 'page'
};

/**
 * 路由事件名称
 * @private
 */
const ROUTE_EVENTS = {
    PAGE_TYPE_DETECTED: 'route:pageTypeDetected',
    ROUTE_CHANGED: 'route:changed'
};

/**
 * 路由模式配置
 * @private
 */
const ROUTE_PATTERNS = {
    /** 文章页URL模式 */
    POST: [
        /\/archives\/\d+\.html/,
        /\/post\/\d+/,
        /\/p\/\d+/
    ],
    /** 独立页面URL模式 */
    PAGE: [
        /\/about\/?$/,
        /\/links\/?$/,
        /\/archives\/?$/,
        /\/tags\/?$/,
        /\/guestbook\/?$/,
        /\/contact\/?$/
    ],
    /** 列表页URL模式 */
    LIST: [
        /^\/$/,
        /\/page\/\d+/,
        /\/category\/.+/,
        /\/tag\/.+/,
        /\/search\/.+/,
        /\/archives\/\d{4}\/\d{2}/
    ]
};

/**
 * DOM选择器配置
 * @private
 */
const DOM_SELECTORS = {
    /** 文章页选择器 */
    POST: '.post.post--single',
    /** 独立页面选择器 */
    PAGE: '.post.post--index.main-item:not(.post--single)',
    /** 列表页选择器 */
    LIST: '.wrapper'
};

/**
 * 路由管理器类
 * 提供统一的页面类型检测和路由管理
 */
export class RouteManager {
    /**
     * 创建路由管理器实例
     * @param {Object} options - 配置选项
     * @param {boolean} [options.enableCaching=true] - 是否启用缓存
     * @param {boolean} [options.enableDOMDetection=true] - 是否启用DOM检测
     * @param {boolean} [options.enableURLDetection=true] - 是否启用URL检测
     */
    constructor(options = {}) {
        this._enableCaching = options.enableCaching !== false;
        this._enableDOMDetection = options.enableDOMDetection !== false;
        this._enableURLDetection = options.enableURLDetection !== false;
        this._cache = new Map();
        this._maxCacheSize = 100;
        this._currentUrl = null;
        this._currentPageType = null;

        this._setupEventListeners();
    }

    /**
     * 获取页面类型（从URL）
     * @param {string} url - URL字符串
     * @returns {string} 页面类型
     */
    getPageType(url) {
        if (!url) {
            return this.getCurrentPageType();
        }

        // 检查缓存
        if (this._enableCaching && this._cache.has(url)) {
            return this._cache.get(url);
        }

        // 标准化URL
        let normalizedUrl;
        try {
            normalizedUrl = new URL(url, window.location.origin).href;
        } catch (error) {
            console.warn('[RouteManager] Invalid URL:', url);
            return PageType.LIST;
        }

        // URL检测
        let detectedType = PageType.LIST;
        if (this._enableURLDetection) {
            detectedType = this._detectFromURL(normalizedUrl);
        }

        // 缓存结果
        if (this._enableCaching) {
            this._addToCache(normalizedUrl, detectedType);
        }

        // 发布事件
        eventBus.emit(ROUTE_EVENTS.PAGE_TYPE_DETECTED, {
            url: normalizedUrl,
            pageType: detectedType,
            method: 'url'
        });

        return detectedType;
    }

    /**
     * 获取当前页面类型（从DOM）
     * @returns {string} 页面类型
     */
    getCurrentPageType() {
        // 检查缓存
        const currentUrl = window.location.href;
        if (this._currentUrl === currentUrl && this._currentPageType) {
            return this._currentPageType;
        }

        // DOM检测
        let detectedType = PageType.LIST;
        if (this._enableDOMDetection) {
            detectedType = this._detectFromDOM();
        }

        // 更新缓存
        this._currentUrl = currentUrl;
        this._currentPageType = detectedType;

        // 缓存结果
        if (this._enableCaching) {
            this._addToCache(currentUrl, detectedType);
        }

        // 发布事件
        eventBus.emit(ROUTE_EVENTS.PAGE_TYPE_DETECTED, {
            url: currentUrl,
            pageType: detectedType,
            method: 'dom'
        });

        return detectedType;
    }

    /**
     * 双重检测页面类型（URL + DOM）
     * @param {string} [url] - 可选的URL
     * @returns {Object} 检测结果
     */
    detectPageType(url) {
        const urlType = this.getPageType(url);
        const domType = this.getCurrentPageType();

        // 如果提供了URL，优先使用URL检测结果
        const finalType = url ? urlType : domType;

        return {
            urlType,
            domType,
            finalType,
            matched: urlType === domType,
            method: url ? 'url' : 'dom'
        };
    }

    /**
     * 判断是否是文章页
     * @param {string} [url] - 可选的URL
     * @returns {boolean} 是否是文章页
     */
    isPostPage(url) {
        return this.getPageType(url) === PageType.POST;
    }

    /**
     * 判断是否是独立页面
     * @param {string} [url] - 可选的URL
     * @returns {boolean} 是否是独立页面
     */
    isPagePage(url) {
        return this.getPageType(url) === PageType.PAGE;
    }

    /**
     * 判断是否是列表页
     * @param {string} [url] - 可选的URL
     * @returns {boolean} 是否是列表页
     */
    isListPage(url) {
        return this.getPageType(url) === PageType.LIST;
    }

    /**
     * 判断是否是独立页面（通过DOM判断）
     * @returns {boolean} 是否是独立页面
     */
    isStandalonePage() {
        return Boolean(document.querySelector(DOM_SELECTORS.PAGE));
    }

    /**
     * 判断是否是文章页（通过DOM判断）
     * @returns {boolean} 是否是文章页
     */
    isArticlePage() {
        return Boolean(document.querySelector(DOM_SELECTORS.POST));
    }

    /**
     * 判断是否是列表页（通过DOM判断）
     * @returns {boolean} 是否是列表页
     */
    isListPageByDOM() {
        return Boolean(document.querySelector(DOM_SELECTORS.LIST));
    }

    /**
     * 从URL检测页面类型
     * @private
     * @param {string} url - URL字符串
     * @returns {string} 页面类型
     */
    _detectFromURL(url) {
        const urlObj = new URL(url, window.location.origin);
        const pathname = urlObj.pathname;
        const search = urlObj.search;

        // 检查文章页模式
        for (const pattern of ROUTE_PATTERNS.POST) {
            if (pattern.test(pathname)) {
                return PageType.POST;
            }
        }

        // 检查独立页面模式
        for (const pattern of ROUTE_PATTERNS.PAGE) {
            if (pattern.test(pathname)) {
                return PageType.PAGE;
            }
        }

        // 检查列表页模式
        for (const pattern of ROUTE_PATTERNS.LIST) {
            if (pattern.test(pathname)) {
                return PageType.LIST;
            }
        }

        // 默认返回列表页
        return PageType.LIST;
    }

    /**
     * 从DOM检测页面类型
     * @private
     * @returns {string} 页面类型
     */
    _detectFromDOM() {
        // 优先检查data属性
        const swupRoot = document.getElementById('swup');
        const dataType = swupRoot?.dataset?.psPageType || '';

        if (dataType === 'post') return PageType.POST;
        if (dataType === 'page') return PageType.PAGE;
        if (dataType === 'list') return PageType.LIST;

        // 通过DOM选择器检测
        if (this._isArticlePageByDOM()) {
            return PageType.POST;
        }

        if (this._isStandalonePageByDOM()) {
            return PageType.PAGE;
        }

        // 默认返回列表页
        return PageType.LIST;
    }

    /**
     * 判断是否是文章页（通过DOM选择器）
     * @private
     * @returns {boolean} 是否是文章页
     */
    _isArticlePageByDOM() {
        return Boolean(document.querySelector(DOM_SELECTORS.POST));
    }

    /**
     * 判断是否是独立页面（通过DOM选择器）
     * @private
     * @returns {boolean} 是否是独立页面
     */
    _isStandalonePageByDOM() {
        return Boolean(document.querySelector(DOM_SELECTORS.PAGE));
    }

    /**
     * 添加到缓存
     * @private
     * @param {string} url - URL
     * @param {string} pageType - 页面类型
     */
    _addToCache(url, pageType) {
        // 限制缓存大小
        if (this._cache.size >= this._maxCacheSize) {
            // 删除最旧的条目（使用Map的迭代顺序）
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }

        this._cache.set(url, pageType);
    }

    /**
     * 清除缓存
     * @param {string} [url] - 可选，清除指定URL的缓存
     */
    clearCache(url) {
        if (url) {
            this._cache.delete(url);
        } else {
            this._cache.clear();
        }
    }

    /**
     * 获取缓存大小
     * @returns {number} 缓存大小
     */
    getCacheSize() {
        return this._cache.size;
    }

    /**
     * 获取缓存统计信息
     * @returns {Object} 缓存统计
     */
    getCacheStats() {
        const stats = {
            total: this._cache.size,
            byType: {
                [PageType.LIST]: 0,
                [PageType.POST]: 0,
                [PageType.PAGE]: 0
            }
        };

        for (const type of this._cache.values()) {
            if (stats.byType[type] !== undefined) {
                stats.byType[type]++;
            }
        }

        return stats;
    }

    /**
     * 设置事件监听器
     * @private
     */
    _setupEventListeners() {
        // 监听路由变化
        window.addEventListener('popstate', () => {
            this._handleRouteChange();
        });

        // 监听pushState和replaceState
        this._wrapHistoryMethods();
    }

    /**
     * 处理路由变化
     * @private
     */
    _handleRouteChange() {
        const newUrl = window.location.href;
        const newPageType = this.getCurrentPageType();

        // 发布路由变化事件
        eventBus.emit(ROUTE_EVENTS.ROUTE_CHANGED, {
            url: newUrl,
            pageType: newPageType,
            previousUrl: this._currentUrl,
            previousPageType: this._currentPageType
        });
    }

    /**
     * 包装history方法以监听路由变化
     * @private
     */
    _wrapHistoryMethods() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = (...args) => {
            originalPushState.apply(history, args);
            this._handleRouteChange();
        };

        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args);
            this._handleRouteChange();
        };
    }

    /**
     * 销毁路由管理器
     */
    destroy() {
        this._cache.clear();
        this._currentUrl = null;
        this._currentPageType = null;

        // 恢复原始history方法
        if (history.pushState !== this._originalPushState) {
            history.pushState = this._originalPushState;
        }
        if (history.replaceState !== this._originalReplaceState) {
            history.replaceState = this._originalReplaceState;
        }
    }
}

/**
 * 路由事件名称常量
 * @readonly
 * @enum {string}
 */
export const RouteEvents = {
    /** 页面类型检测事件 */
    PAGE_TYPE_DETECTED: ROUTE_EVENTS.PAGE_TYPE_DETECTED,
    /** 路由变化事件 */
    ROUTE_CHANGED: ROUTE_EVENTS.ROUTE_CHANGED
};

// 创建全局单例
export const routeManager = new RouteManager();
