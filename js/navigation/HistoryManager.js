/**
 * PureSuck HistoryManager - 历史记录管理器
 * 管理滚动位置恢复和hash锚点导航
 * 
 * @module navigation/HistoryManager
 */

import { eventBus } from '../core/EventBus.js';
import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';

/**
 * 滚动配置
 * @private
 */
const SCROLL_CONFIG = {
    duration: 550,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    threshold: 100,
    cacheSize: 50
};

/**
 * 历史事件名称
 * @private
 */
const HISTORY_EVENTS = {
    SCROLL_SAVED: 'history:scrollSaved',
    SCROLL_RESTORED: 'history:scrollRestored',
    HASH_CHANGED: 'history:hashChanged',
    CACHE_CLEARED: 'history:cacheCleared'
};

/**
 * 历史记录管理器类
 * 管理滚动位置恢复和hash锚点导航
 */
export class HistoryManager {
    /**
     * 创建历史记录管理器实例
     * @param {Object} options - 配置选项
     * @param {number} [options.scrollDuration=550] - 滚动动画持续时间
     * @param {string} [options.scrollEasing='cubic-bezier(0.2, 0.8, 0.2, 1)'] - 滚动缓动函数
     * @param {boolean} [options.enableCache=true] - 是否启用滚动位置缓存
     * @param {number} [options.cacheSize=50] - 缓存大小
     */
    constructor(options = {}) {
        this._swup = null;
        this._isInitialized = false;
        this._isDestroyed = false;
        this._scrollDuration = options.scrollDuration ?? SCROLL_CONFIG.duration;
        this._scrollEasing = options.scrollEasing ?? SCROLL_CONFIG.easing;
        this._enableCache = options.enableCache !== false;
        this._cacheSize = options.cacheSize ?? SCROLL_CONFIG.cacheSize;
        this._scrollCache = new Map();
        this._currentScrollPosition = null;
        this._activeScrollAnimation = null;

        this._setupEventListeners();
    }

    /**
     * 初始化历史管理器
     * @param {Object} swup - Swup实例
     */
    init(swup) {
        if (this._isInitialized || this._isDestroyed) {
            console.warn('[HistoryManager] Already initialized or destroyed');
            return;
        }

        this._swup = swup;
        this._isInitialized = true;

        // 监听Swup事件
        this._registerSwupHooks();

        // 监听滚动事件
        this._registerScrollListeners();

        // 监听hash变化
        this._registerHashListeners();

        this._log('HistoryManager initialized', {
            scrollDuration: this._scrollDuration,
            enableCache: this._enableCache,
            cacheSize: this._cacheSize
        });
    }

    /**
     * 注册Swup hooks
     * @private
     */
    _registerSwupHooks() {
        if (!this._swup) return;

        // 在导航开始前保存滚动位置
        this._swup.hooks.before('visit:start', () => {
            this.saveScrollPosition();
        });

        // 在内容替换后恢复滚动位置
        this._swup.hooks.on('content:replace', () => {
            this._handleContentReplace();
        });
    }

    /**
     * 注册滚动事件监听器
     * @private
     */
    _registerScrollListeners() {
        // 使用节流监听滚动
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (scrollTimeout) return;
            scrollTimeout = setTimeout(() => {
                this._currentScrollPosition = {
                    x: window.scrollX,
                    y: window.scrollY,
                    timestamp: Date.now()
                };
                scrollTimeout = null;
            }, 100);
        }, { passive: true });
    }

    /**
     * 注册hash事件监听器
     * @private
     */
    _registerHashListeners() {
        // 监听hash变化
        window.addEventListener('hashchange', () => {
            this._handleHashChange();
        });

        // 监听点击事件处理hash链接
        document.addEventListener('click', (event) => {
            const link = event.target?.closest('a[href^="#"]');
            if (!link) return;

            const hash = link.getAttribute('href');
            if (hash === '#') return;

            // 阻止默认行为，使用平滑滚动
            event.preventDefault();
            this.scrollToHash(hash);
        });
    }

    /**
     * 保存当前滚动位置
     * @param {string} [url] - URL，默认为当前URL
     */
    saveScrollPosition(url) {
        const targetUrl = url || window.location.href;

        const scrollPosition = {
            x: window.scrollX,
            y: window.scrollY,
            timestamp: Date.now()
        };

        // 保存到缓存
        if (this._enableCache) {
            this._addToScrollCache(targetUrl, scrollPosition);
        }

        // 保存到history.state
        try {
            const currentState = history.state || {};
            history.replaceState({
                ...currentState,
                scrollPosition
            }, document.title);
        } catch (error) {
            console.warn('[HistoryManager] Failed to save scroll position to history:', error);
        }

        // 发布事件
        eventBus.emit(HISTORY_EVENTS.SCROLL_SAVED, {
            url: targetUrl,
            scrollPosition
        });

        this._log('Scroll position saved', { url: targetUrl, scrollPosition });
    }

    /**
     * 恢复滚动位置
     * @param {string} [url] - URL，默认为当前URL
     * @param {boolean} [smooth=false] - 是否使用平滑滚动
     * @returns {boolean} 是否成功恢复
     */
    restoreScrollPosition(url, smooth = false) {
        const targetUrl = url || window.location.href;

        // 优先从history.state获取
        let scrollPosition = null;
        try {
            const currentState = history.state;
            if (currentState && currentState.scrollPosition) {
                scrollPosition = currentState.scrollPosition;
            }
        } catch (error) {
            console.warn('[HistoryManager] Failed to get scroll position from history:', error);
        }

        // 如果history.state中没有，从缓存获取
        if (!scrollPosition && this._enableCache) {
            scrollPosition = this._getFromScrollCache(targetUrl);
        }

        if (!scrollPosition) {
            this._log('No scroll position to restore', { url: targetUrl });
            return false;
        }

        // 恢复滚动位置
        if (smooth) {
            this.smoothScrollTo(scrollPosition.x, scrollPosition.y);
        } else {
            window.scrollTo(scrollPosition.x, scrollPosition.y);
        }

        // 发布事件
        eventBus.emit(HISTORY_EVENTS.SCROLL_RESTORED, {
            url: targetUrl,
            scrollPosition,
            smooth
        });

        this._log('Scroll position restored', { url: targetUrl, scrollPosition });

        return true;
    }

    /**
     * 平滑滚动到指定位置
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} [duration] - 持续时间，默认使用配置值
     */
    smoothScrollTo(x, y, duration) {
        // 取消之前的滚动动画
        if (this._activeScrollAnimation) {
            this._activeScrollAnimation.cancel();
        }

        const startX = window.scrollX;
        const startY = window.scrollY;
        const targetDuration = duration ?? this._scrollDuration;
        const startTime = performance.now();

        // 如果距离很小，直接滚动
        const distance = Math.abs(y - startY);
        if (distance < SCROLL_CONFIG.threshold) {
            window.scrollTo(x, y);
            return;
        }

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / targetDuration, 1);

            // 使用ease-out缓动
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentX = startX + (x - startX) * eased;
            const currentY = startY + (y - startY) * eased;

            window.scrollTo(currentX, currentY);

            if (progress < 1) {
                this._activeScrollAnimation = requestAnimationFrame(animateScroll);
            } else {
                this._activeScrollAnimation = null;
            }
        };

        this._activeScrollAnimation = requestAnimationFrame(animateScroll);
    }

    /**
     * 平滑滚动到顶部
     * @param {boolean} [force=false] - 是否强制滚动
     */
    smoothScrollToTop(force = false) {
        if (!force && window.scrollY < SCROLL_CONFIG.threshold) {
            return;
        }

        this.smoothScrollTo(0, 0);
    }

    /**
     * 滚动到hash锚点
     * @param {string} hash - hash字符串（包含#）
     * @param {boolean} [smooth=true] - 是否使用平滑滚动
     */
    scrollToHash(hash, smooth = true) {
        if (!hash || hash === '#') {
            this.smoothScrollToTop(true);
            return;
        }

        // 移除#号
        const hashId = hash.substring(1);
        const element = document.getElementById(hashId);

        if (!element) {
            console.warn('[HistoryManager] Element not found for hash:', hash);
            return;
        }

        // 计算目标位置
        const targetY = element.getBoundingClientRect().top + window.scrollY - 20; // 20px偏移

        if (smooth) {
            this.smoothScrollTo(0, targetY);
        } else {
            window.scrollTo(0, targetY);
        }

        // 更新URL但不触发hashchange
        history.replaceState(null, null, hash);

        // 发布事件
        eventBus.emit(HISTORY_EVENTS.HASH_CHANGED, {
            hash,
            element,
            smooth
        });

        this._log('Scrolled to hash', { hash, element });
    }

    /**
     * 获取缓存的滚动位置
     * @param {string} url - URL
     * @returns {Object|null} 滚动位置对象
     */
    getCachedScrollPositions(url) {
        if (!this._enableCache) {
            return null;
        }

        const scrollPosition = this._scrollCache.get(url);
        if (!scrollPosition) {
            return null;
        }

        return {
            window: {
                top: scrollPosition.y,
                left: scrollPosition.x
            },
            timestamp: scrollPosition.timestamp
        };
    }

    /**
     * 清除滚动位置缓存
     * @param {string} [url] - 可选，清除指定URL的缓存
     */
    clearScrollCache(url) {
        if (url) {
            this._scrollCache.delete(url);
        } else {
            this._scrollCache.clear();
        }

        eventBus.emit(HISTORY_EVENTS.CACHE_CLEARED, { url });

        this._log('Scroll cache cleared', { url });
    }

    /**
     * 获取缓存大小
     * @returns {number} 缓存大小
     */
    getCacheSize() {
        return this._scrollCache.size;
    }

    /**
     * 处理内容替换
     * @private
     */
    _handleContentReplace() {
        // 检查是否有hash
        if (window.location.hash) {
            // 延迟执行，确保DOM已更新
            setTimeout(() => {
                this.scrollToHash(window.location.hash, true);
            }, 100);
            return;
        }

        // 否则恢复滚动位置
        this.restoreScrollPosition(window.location.href, false);
    }

    /**
     * 处理hash变化
     * @private
     */
    _handleHashChange() {
        const hash = window.location.hash;
        if (hash) {
            this.scrollToHash(hash, true);
        } else {
            this.smoothScrollToTop(true);
        }
    }

    /**
     * 添加到滚动缓存
     * @private
     * @param {string} url - URL
     * @param {Object} scrollPosition - 滚动位置
     */
    _addToScrollCache(url, scrollPosition) {
        // 限制缓存大小
        if (this._scrollCache.size >= this._cacheSize) {
            // 删除最旧的条目
            const firstKey = this._scrollCache.keys().next().value;
            this._scrollCache.delete(firstKey);
        }

        this._scrollCache.set(url, scrollPosition);
    }

    /**
     * 从滚动缓存获取
     * @private
     * @param {string} url - URL
     * @returns {Object|null} 滚动位置
     */
    _getFromScrollCache(url) {
        return this._scrollCache.get(url) || null;
    }

    /**
     * 设置事件监听器
     * @private
     */
    _setupEventListeners() {
        this._eventListeners = [];
    }

    /**
     * 清理事件监听器
     * @private
     */
    _cleanupEventListeners() {
        // 事件监听器通过destroy方法清理
    }

    /**
     * 销毁历史记录管理器
     */
    destroy() {
        if (this._isDestroyed) return;

        this._isDestroyed = true;
        this._isInitialized = false;

        // 取消滚动动画
        if (this._activeScrollAnimation) {
            cancelAnimationFrame(this._activeScrollAnimation);
            this._activeScrollAnimation = null;
        }

        // 清理缓存
        this._scrollCache.clear();
        this._currentScrollPosition = null;
        this._swup = null;

        this._cleanupEventListeners();

        this._log('HistoryManager destroyed');
    }

    /**
     * 记录日志
     * @private
     * @param {string} message - 日志消息
     * @param {Object} [data] - 附加数据
     */
    _log(message, data) {
        console.log(`[HistoryManager] ${message}`, data || '');
    }
}

/**
 * 历史事件名称常量
 * @readonly
 * @enum {string}
 */
export const HistoryEvents = {
    /** 滚动位置保存事件 */
    SCROLL_SAVED: HISTORY_EVENTS.SCROLL_SAVED,
    /** 滚动位置恢复事件 */
    SCROLL_RESTORED: HISTORY_EVENTS.SCROLL_RESTORED,
    /** hash变化事件 */
    HASH_CHANGED: HISTORY_EVENTS.HASH_CHANGED,
    /** 缓存清除事件 */
    CACHE_CLEARED: HISTORY_EVENTS.CACHE_CLEARED
};

// 创建全局单例
export const historyManager = new HistoryManager();
