/**
 * PureSuck SwupManager - Swup实例管理器
 * 管理Swup实例的完整生命周期，集成状态管理和错误处理
 * 
 * @module navigation/SwupManager
 */

import { stateManager, NavigationState } from '../core/StateManager.js';
import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';
import { eventBus } from '../core/EventBus.js';
import { routeManager } from './RouteManager.js';
import { historyManager } from './HistoryManager.js';

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
 * View Transitions 配置
 * @private
 */
const VT_CONFIG = {
    styleId: 'ps-vt-shared-element-style',
    markerAttr: 'data-ps-vt-name',
    duration: 500,
    easing: 'cubic-bezier(.2,.8,.2,1)'
};

/**
 * 导航事件名称
 * @private
 */
const NAVIGATION_EVENTS = {
    VISIT_START: 'swup:visit:start',
    CONTENT_REPLACE: 'swup:content:replace',
    VISIT_END: 'swup:visit:end',
    PAGE_VIEW: 'swup:page:view',
    NAVIGATION_ERROR: 'swup:navigation:error'
};

/**
 * Swup管理器类
 * 管理Swup实例的生命周期和导航流程
 */
export class SwupManager {
    /**
     * 创建Swup管理器实例
     * @param {Object} options - 配置选项
     * @param {boolean} [options.enableVT=true] - 是否启用View Transitions
     * @param {boolean} [options.enableAnimation=true] - 是否启用动画
     * @param {Object} [options.swupOptions] - Swup配置选项
     */
    constructor(options = {}) {
        this._swup = null;
        this._scrollPlugin = null;
        this._isInitialized = false;
        this._isDestroyed = false;
        this._enableVT = options.enableVT !== false && this._supportsViewTransitions();
        this._enableAnimation = options.enableAnimation !== false;
        this._swupOptions = options.swupOptions || {};
        this._currentPageToken = 0;
        this._lastNavigation = {
            fromType: null,
            toType: null,
            toUrl: '',
            isSwup: false,
            fromTypeDetail: null,
            predictedToType: null,
            useVT: false
        };
        this._lastPost = {
            key: null,
            fromSingle: false
        };

        this._setupEventListeners();
    }

    /**
     * 检查是否支持View Transitions API
     * @private
     * @returns {boolean} 是否支持
     */
    _supportsViewTransitions() {
        return typeof document.startViewTransition === 'function'
            && typeof CSS !== 'undefined'
            && typeof CSS.supports === 'function'
            && CSS.supports('view-transition-name: ps-test');
    }

    /**
     * 初始化Swup
     * @returns {Promise<boolean>} 是否成功初始化
     */
    async init() {
        if (this._isInitialized || this._isDestroyed) {
            console.warn('[SwupManager] Already initialized or destroyed');
            return false;
        }

        try {
            // 检查Swup是否可用
            if (typeof Swup === 'undefined') {
                throw new Error('Swup library is not loaded');
            }

            // 初始化插件
            const plugins = await this._initPlugins();

            // 创建Swup实例
            this._swup = new Swup({
                containers: ['#swup'],
                plugins,
                resolveUrl: (url) => {
                    const resolved = new URL(url, window.location.origin);
                    return resolved.pathname + resolved.search + resolved.hash;
                },
                animateHistoryBrowsing: this._enableVT,
                native: this._enableVT,
                animationSelector: false,
                ...this._swupOptions
            });

            // 注册Swup hooks
            this._registerHooks();

            // 注册表单处理
            this._registerFormHandlers();

            // 注册点击事件处理
            this._registerClickHandlers();

            // 初始化历史管理器
            historyManager.init(this._swup);

            // 更新状态
            stateManager.setState(NavigationState.IDLE, { reason: 'swup_initialized' });

            this._isInitialized = true;
            this._log('Swup initialized successfully', { 
                enableVT: this._enableVT,
                enableAnimation: this._enableAnimation 
            });

            // 执行初始页面加载
            this._handleInitialLoad();

            return true;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.SWUP,
                severity: ErrorSeverity.CRITICAL,
                message: 'Swup初始化失败',
                metadata: { options }
            });
            return false;
        }
    }

    /**
     * 初始化插件
     * @private
     * @returns {Promise<Array>} 插件数组
     */
    async _initPlugins() {
        const plugins = [];

        // 滚动插件
        if (typeof SwupScrollPlugin === 'function') {
            this._scrollPlugin = new SwupScrollPlugin({
                doScrollingRightAway: true,
                animateScroll: {
                    betweenPages: false,
                    samePageWithHash: true,
                    samePage: true
                }
            });
            plugins.push(this._scrollPlugin);
        }

        return plugins;
    }

    /**
     * 注册Swup hooks
     * @private
     */
    _registerHooks() {
        // visit:start hook
        this._swup.hooks.on('visit:start', (visit) => this._onVisitStart(visit));

        // content:replace hook
        this._swup.hooks.on('content:replace', () => this._onContentReplace());

        // visit:end hook
        this._swup.hooks.on('visit:end', () => this._onVisitEnd());

        // page:view hook
        this._swup.hooks.on('page:view', () => this._onPageView());
    }

    /**
     * 处理visit:start事件
     * @private
     * @param {Object} visit - 访问对象
     */
    _onVisitStart(visit) {
        stateManager.setState(NavigationState.NAVIGATING, { url: visit.to?.url });

        // 检测源页面类型
        const fromType = routeManager.getCurrentPageType();
        this._lastNavigation.fromType = fromType;
        this._lastNavigation.fromTypeDetail = fromType;
        this._lastNavigation.toUrl = visit.to?.url || '';
        this._lastNavigation.isSwup = true;

        // 预测目标页面类型
        const toUrl = visit.to?.url || '';
        const predictedToType = routeManager.getPageType(toUrl);
        this._lastNavigation.predictedToType = predictedToType;

        // 检测是否使用VT
        const useVT = this._shouldUseVT(fromType, toUrl);
        this._lastNavigation.useVT = useVT;

        // 更新状态
        stateManager.setState(NavigationState.ANIMATING_EXIT, {
            fromType,
            toType: predictedToType,
            useVT
        });

        // 应用动画类
        this._applyExitClasses(fromType, useVT);

        // 记录文章信息
        this._lastPost.fromSingle = fromType === PageType.POST;

        // 发布事件
        eventBus.emit(NAVIGATION_EVENTS.VISIT_START, {
            fromType,
            toType: predictedToType,
            toUrl,
            useVT
        });
    }

    /**
     * 处理content:replace事件
     * @private
     */
    _onContentReplace() {
        const toType = routeManager.getCurrentPageType();
        this._lastNavigation.toType = toType;

        // 更新状态
        stateManager.setState(NavigationState.ANIMATING_ENTER, {
            toType,
            fromType: this._lastNavigation.fromType
        });

        // 清理动画类
        this._cleanupAnimationClasses();

        // 应用进入动画类
        const hasSharedElement = this._hasSharedElement();
        this._applyEnterClasses(toType, hasSharedElement);

        // 滚动处理
        this._handleScrollAfterReplace(toType);

        // 同步VT共享元素
        if (this._enableVT) {
            this._syncSharedElements();
        }

        // 发布事件
        eventBus.emit(NAVIGATION_EVENTS.CONTENT_REPLACE, {
            toType,
            hasSharedElement
        });
    }

    /**
     * 处理visit:end事件
     * @private
     */
    _onVisitEnd() {
        stateManager.setState(NavigationState.IDLE, { reason: 'navigation_complete' });

        // 延迟清理动画类
        setTimeout(() => {
            this._cleanupAnimationClasses();
        }, 1000);

        // 发布事件
        eventBus.emit(NAVIGATION_EVENTS.VISIT_END, {
            fromType: this._lastNavigation.fromType,
            toType: this._lastNavigation.toType
        });
    }

    /**
     * 处理page:view事件
     * @private
     */
    _onPageView() {
        const pageType = routeManager.getCurrentPageType();
        const token = ++this._currentPageToken;
        const isCurrent = () => token === this._currentPageToken;

        // 更新导航栏
        this._updateNavigation();

        // 初始化页面内容
        this._initializePageContent(pageType, isCurrent);

        // 发布事件
        eventBus.emit(NAVIGATION_EVENTS.PAGE_VIEW, {
            pageType,
            url: window.location.href
        });

        // 用户自定义回调
        if (typeof window.pjaxCustomCallback === 'function') {
            window.pjaxCustomCallback();
        }
    }

    /**
     * 处理初始加载
     * @private
     */
    _handleInitialLoad() {
        this._lastNavigation.isSwup = false;
        const initialPageType = routeManager.getCurrentPageType();

        // 移除预加载类
        this._removePreloadClasses();

        // 执行初始进入动画
        if (this._enableAnimation) {
            this._runEnterAnimation(initialPageType, false);
        }

        // 同步VT共享元素
        if (this._enableVT) {
            this._syncSharedElements();
        }
    }

    /**
     * 注册表单处理
     * @private
     */
    _registerFormHandlers() {
        document.addEventListener('submit', async (event) => {
            const form = event.target?.closest('form');
            if (!form) return;

            // 搜索表单
            if (this._isSearchForm(form)) {
                await this._handleSearchForm(form, event);
                return;
            }

            // 评论表单
            if (this._isCommentForm(form)) {
                await this._handleCommentForm(form, event);
                return;
            }

            // 加密文章表单
            if (this._isProtectedForm(form)) {
                await this._handleProtectedForm(form, event);
                return;
            }
        }, true);
    }

    /**
     * 注册点击事件处理
     * @private
     */
    _registerClickHandlers() {
        document.addEventListener('click', (event) => {
            if (!this._enableVT) return;
            if (event.defaultPrevented) return;
            if (event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const link = event.target?.closest('a[href]');
            if (!link) return;
            if (link.target && link.target !== '_self') return;
            if (link.hasAttribute('download')) return;

            let toUrl;
            try {
                toUrl = new URL(link.href, window.location.origin);
            } catch {
                return;
            }
            if (toUrl.origin !== window.location.origin) return;

            const postCard = link.closest('.post.post--index');
            if (!postCard) return;

            const postKey = this._getPostKey(postCard);
            if (!postKey) return;

            // 记录文章key并应用VT名称
            this._rememberLastPostKey(postKey);
            this._applyPostSharedElementName(postCard, postKey);
        }, true);
    }

    /**
     * 处理搜索表单
     * @private
     * @param {HTMLFormElement} form - 表单元素
     * @param {Event} event - 事件对象
     */
    async _handleSearchForm(form, event) {
        const method = (form.getAttribute('method') || 'get').toLowerCase();
        if (method !== 'get') return;

        const url = this._buildGetUrlFromForm(form);
        if (!this._isSameOriginUrl(url.href)) return;

        event.preventDefault();
        this.navigate(url.href);
    }

    /**
     * 处理评论表单
     * @private
     * @param {HTMLFormElement} form - 表单元素
     * @param {Event} event - 事件对象
     */
    async _handleCommentForm(form, event) {
        const action = form.getAttribute('action') || '';
        if (!this._isSameOriginUrl(action)) return;

        event.preventDefault();

        const restore = this._setFormBusyState(form, true, '提交中...');
        try {
            const response = await fetch(action, {
                method: 'POST',
                body: new FormData(form),
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/html;q=0.9,*/*;q=0.8'
                }
            });

            if (!response.ok) {
                this._showToast('评论提交失败，请稍后重试', 'error');
                return;
            }

            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            const fallbackPage = window.location.href.split('#')[0];
            let refreshUrl = fallbackPage;

            if (contentType.includes('application/json')) {
                const data = await response.json();
                const ok = Boolean(
                    data?.success === true
                    || data?.success === 1
                    || data?.status === 'success'
                    || data?.status === 1
                );
                if (!ok) {
                    this._showToast(data?.message || data?.error || '评论提交失败，请检查内容后重试', 'error');
                    return;
                }

                this._showToast(data?.message || '评论已提交', 'success');

                const redirectUrl = data?.redirect
                    || data?.url
                    || data?.permalink
                    || data?.comment?.permalink
                    || fallbackPage;
                refreshUrl = this._isSameOriginUrl(redirectUrl) ? redirectUrl : fallbackPage;
            } else {
                this._showToast('评论已提交', 'success');
                refreshUrl = (response.url && this._isSameOriginUrl(response.url)) ? response.url : fallbackPage;
            }

            const refreshed = await this._refreshCommentsFromUrl(refreshUrl);
            if (!refreshed) this.navigate(fallbackPage + '#comments');

            const textarea = document.querySelector('#textarea, textarea[name="text"]');
            if (textarea) textarea.value = '';
        } catch (e) {
            ErrorBoundary.handle(e, {
                type: ErrorType.NETWORK,
                severity: ErrorSeverity.MEDIUM,
                message: '评论提交失败，请稍后重试'
            });
        } finally {
            restore();
        }
    }

    /**
     * 处理加密文章表单
     * @private
     * @param {HTMLFormElement} form - 表单元素
     * @param {Event} event - 事件对象
     */
    async _handleProtectedForm(form, event) {
        event.preventDefault();

        const formData = new FormData(form);
        const submitBtn = form.querySelector('.protected-btn');
        const originalText = submitBtn.textContent;

        submitBtn.textContent = '解锁中...';
        submitBtn.disabled = true;

        try {
            const tokenResponse = await fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'type=getTokenUrl'
            });
            const tokenData = await tokenResponse.json();

            if (!tokenData.tokenUrl) throw new Error('无法获取验证链接');

            await fetch(tokenData.tokenUrl, { method: 'POST', body: formData });

            const checkResponse = await fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'type=checkPassword'
            });
            const checkData = await checkResponse.json();

            if (checkData.hidden) throw new Error('密码错误');

            this._showToast('✓ 解锁成功', 'success');
            this.navigate(window.location.href);
        } catch (error) {
            this._showToast('密码错误，请重试', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    /**
     * 导航到指定URL
     * @param {string} url - 目标URL
     * @returns {Promise<boolean>} 是否成功导航
     */
    async navigate(url) {
        if (!this._swup) {
            console.warn('[SwupManager] Swup not initialized');
            return false;
        }

        try {
            await this._swup.navigate(url);
            return true;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.SWUP,
                severity: ErrorSeverity.HIGH,
                message: '导航失败',
                metadata: { url }
            });
            return false;
        }
    }

    /**
     * 销毁Swup管理器
     */
    destroy() {
        if (this._isDestroyed) return;

        this._isDestroyed = true;
        this._isInitialized = false;

        // 销毁历史管理器
        historyManager.destroy();

        // 销毁Swup实例
        if (this._swup) {
            this._swup.destroy();
            this._swup = null;
        }

        // 清理事件监听器
        this._cleanupEventListeners();

        // 清理VT样式
        this._cleanupVTStyles();

        this._log('SwupManager destroyed');
    }

    /**
     * 获取Swup实例
     * @returns {Object|null} Swup实例
     */
    getSwup() {
        return this._swup;
    }

    /**
     * 获取滚动插件实例
     * @returns {Object|null} 滚动插件实例
     */
    getScrollPlugin() {
        return this._scrollPlugin;
    }

    /**
     * 检查是否正在导航
     * @returns {boolean} 是否正在导航
     */
    isNavigating() {
        return stateManager.getCurrentState() === NavigationState.NAVIGATING
            || stateManager.getCurrentState() === NavigationState.ANIMATING_EXIT
            || stateManager.getCurrentState() === NavigationState.ANIMATING_ENTER;
    }

    /**
     * 获取最后一次导航信息
     * @returns {Object} 导航信息
     */
    getLastNavigation() {
        return { ...this._lastNavigation };
    }

    /**
     * 判断是否应该使用VT
     * @private
     * @param {string} fromType - 源页面类型
     * @param {string} toUrl - 目标URL
     * @returns {boolean} 是否使用VT
     */
    _shouldUseVT(fromType, toUrl) {
        if (!this._enableVT) return false;

        // 检测是否点击了列表页中的文章卡片
        const clickedPostCard = document.querySelector(`[${VT_CONFIG.markerAttr}]`);
        const isClickingPostFromList = fromType === PageType.LIST && clickedPostCard;

        return isClickingPostFromList;
    }

    /**
     * 应用退出动画类
     * @private
     * @param {string} fromType - 源页面类型
     * @param {boolean} useVT - 是否使用VT
     */
    _applyExitClasses(fromType, useVT) {
        document.documentElement.classList.add('ps-animating');

        if (useVT) {
            document.documentElement.classList.add('ps-vt-mode');
            if (fromType === PageType.LIST) {
                document.documentElement.classList.add('ps-list-exit');
            }
        } else {
            if (fromType === PageType.PAGE) {
                document.documentElement.classList.add('ps-page-exit');
            } else if (fromType === PageType.POST) {
                document.documentElement.classList.add('ps-post-exit');
            } else if (fromType === PageType.LIST) {
                document.documentElement.classList.add('ps-list-exit');
            }
        }
    }

    /**
     * 应用进入动画类
     * @private
     * @param {string} toType - 目标页面类型
     * @param {boolean} hasSharedElement - 是否有共享元素
     */
    _applyEnterClasses(toType, hasSharedElement) {
        document.documentElement.classList.add('ps-animating');
        document.documentElement.classList.add('ps-enter-active');

        if (!hasSharedElement) {
            if (toType === PageType.PAGE) {
                document.documentElement.classList.add('ps-page-enter');
            } else if (toType === PageType.POST) {
                document.documentElement.classList.add('ps-post-enter');
            } else if (toType === PageType.LIST) {
                document.documentElement.classList.add('ps-list-enter');
            }
        }
    }

    /**
     * 清理动画类
     * @private
     */
    _cleanupAnimationClasses() {
        document.documentElement.classList.remove(
            'ps-animating',
            'ps-exit-active',
            'ps-enter-active',
            'ps-page-exit',
            'ps-page-enter',
            'ps-post-exit',
            'ps-post-enter',
            'ps-list-exit',
            'ps-list-enter',
            'ps-vt-mode'
        );
    }

    /**
     * 处理替换后的滚动
     * @private
     * @param {string} toType - 目标页面类型
     */
    _handleScrollAfterReplace(toType) {
        const shouldScroll = this._shouldForceScrollToTop(window.location.href);
        const wasListPage = this._lastNavigation.fromType === PageType.LIST;
        const isListPage = toType === PageType.LIST;

        if (shouldScroll && !wasListPage) {
            // 进入文章页/独立页：立即到顶部
            window.scrollTo(0, 0);
        } else if (wasListPage && isListPage) {
            // 列表分页：平滑滚动到顶部
            historyManager.smoothScrollToTop(true);
        }
    }

    /**
     * 判断是否需要强制滚动到顶部
     * @private
     * @param {string} urlString - URL字符串
     * @returns {boolean} 是否需要滚动
     */
    _shouldForceScrollToTop(urlString) {
        try {
            const url = new URL(urlString, window.location.origin);
            if (url.hash) return false;
            const pageType = routeManager.getPageType(url.href);
            return pageType === PageType.POST || pageType === PageType.PAGE;
        } catch {
            return false;
        }
    }

    /**
     * 同步共享元素
     * @private
     */
    _syncSharedElements() {
        if (!this._enableVT) return;

        const url = window.location.href;
        const pageType = routeManager.getCurrentPageType();

        if (pageType === PageType.POST) {
            const postContainer = document.querySelector('.post.post--single');
            const postKey = this._getPostKey(postContainer);
            this._rememberLastPostKey(postKey);
            this._applyPostSharedElementName(postContainer, postKey);
            return;
        }

        // 返回列表页：匹配的卡片
        let listPostKey = (history.state && typeof history.state === 'object')
            ? history.state.lastPostKey
            : null;

        if (!listPostKey && this._lastPost.fromSingle) {
            listPostKey = this._lastPost.key;
        }

        if (pageType === PageType.LIST && listPostKey) {
            // 恢复滚动位置
            const cached = this._scrollPlugin?.getCachedScrollPositions
                ? this._scrollPlugin.getCachedScrollPositions(url)
                : null;
            const cachedY = cached?.window?.top;
            if (typeof cachedY === 'number') {
                window.scrollTo(0, cachedY);
                queueMicrotask(() => window.scrollTo(0, cachedY));
            }

            const card = this._findIndexPostCardById(listPostKey);
            if (card) {
                this._applyPostSharedElementName(card, listPostKey);
                requestAnimationFrame(() => {
                    const rect = card.getBoundingClientRect();
                    if (rect.bottom < 0 || rect.top > window.innerHeight) {
                        requestAnimationFrame(() => {
                            card.scrollIntoView({ block: 'center', inline: 'nearest' });
                        });
                    }
                });
            } else {
                this._clearMarkedViewTransitionNames();
            }
            return;
        }

        this._clearMarkedViewTransitionNames();
    }

    /**
     * 检查是否有共享元素
     * @private
     * @returns {boolean} 是否有共享元素
     */
    _hasSharedElement() {
        return this._enableVT && Boolean(document.querySelector(`[${VT_CONFIG.markerAttr}]`));
    }

    /**
     * 应用文章共享元素名称
     * @private
     * @param {HTMLElement} el - 元素
     * @param {string} postKey - 文章key
     */
    _applyPostSharedElementName(el, postKey) {
        if (!this._enableVT || !el || !postKey) return;

        const name = this._getPostTransitionName(postKey);
        this._clearMarkedViewTransitionNames();
        this._ensureSharedElementTransitionCSS(name);

        el.style.viewTransitionName = name;
        el.setAttribute(VT_CONFIG.markerAttr, name);
    }

    /**
     * 获取文章过渡名称
     * @private
     * @param {string} postKey - 文章key
     * @returns {string} 过渡名称
     */
    _getPostTransitionName(postKey) {
        const safeKey = encodeURIComponent(String(postKey || '')).replace(/%/g, '_');
        return `ps-post-${safeKey}`;
    }

    /**
     * 清除标记的VT名称
     * @private
     */
    _clearMarkedViewTransitionNames() {
        document.querySelectorAll(`[${VT_CONFIG.markerAttr}]`).forEach((el) => {
            el.style.viewTransitionName = '';
            el.removeAttribute(VT_CONFIG.markerAttr);
        });
    }

    /**
     * 确保共享元素过渡CSS
     * @private
     * @param {string} name - 名称
     */
    _ensureSharedElementTransitionCSS(name) {
        let style = document.getElementById(VT_CONFIG.styleId);
        if (!style) {
            style = document.createElement('style');
            style.id = VT_CONFIG.styleId;
            document.head.appendChild(style);
        }

        style.textContent = `
/* PureSuck View Transitions: shared element morph */
::view-transition-group(${name}) {
  animation-duration: ${VT_CONFIG.duration}ms;
  animation-timing-function: ${VT_CONFIG.easing};
  animation-fill-mode: both;
  border-radius: 0.85rem;
  overflow: hidden;
}
::view-transition-old(${name}),
::view-transition-new(${name}) {
  animation-duration: ${VT_CONFIG.duration}ms;
  animation-timing-function: ${VT_CONFIG.easing};
  animation-fill-mode: both;
}
`;
    }

    /**
     * 记录最后文章key
     * @private
     * @param {string} postKey - 文章key
     */
    _rememberLastPostKey(postKey) {
        if (!postKey) return;
        const state = (history.state && typeof history.state === 'object') ? history.state : {};
        if (state.lastPostKey === postKey) return;
        history.replaceState({ ...state, lastPostKey: postKey }, document.title);
        this._lastPost.key = postKey;
    }

    /**
     * 获取文章key
     * @private
     * @param {HTMLElement} el - 元素
     * @returns {string|null} 文章key
     */
    _getPostKey(el) {
        if (!el) return null;
        return el.dataset?.psPostKey || el.getAttribute('data-ps-post-key') || null;
    }

    /**
     * 查找列表页文章卡片
     * @private
     * @param {string} postKey - 文章key
     * @returns {HTMLElement|null} 卡片元素
     */
    _findIndexPostCardById(postKey) {
        if (!postKey) return null;

        const swupRoot = document.getElementById('swup') || document;
        const cards = swupRoot.querySelectorAll('.post.post--index');
        for (const card of cards) {
            const cardKey = this._getPostKey(card);
            if (cardKey === postKey) return card;
        }

        return null;
    }

    /**
     * 更新导航栏
     * @private
     */
    _updateNavigation() {
        if (typeof window.NavIndicator?.update === 'function') {
            window.NavIndicator.update();
        }

        const currentPath = window.location.pathname;
        document.querySelectorAll('.header-nav .nav-item').forEach(item => {
            const link = item.querySelector('a');
            if (link) {
                const linkPath = new URL(link.href).pathname;
                item.classList.toggle('nav-item-current', linkPath === currentPath);
            }
        });
    }

    /**
     * 初始化页面内容
     * @private
     * @param {string} pageType - 页面类型
     * @param {Function} isCurrent - 是否当前页面的检查函数
     */
    _initializePageContent(pageType, isCurrent) {
        const swupRoot = document.getElementById('swup') || document;

        // 代码高亮
        if (typeof hljs !== 'undefined') {
            const blocks = Array.from(swupRoot.querySelectorAll('pre code:not([data-highlighted])'));
            this._scheduleIdleBatched(blocks, 6, (block) => {
                if (!isCurrent()) return;
                hljs.highlightElement(block);
                block.dataset.highlighted = 'true';
            }, isCurrent);
        }

        // 图片懒加载
        if (typeof imageLazyLoader !== 'undefined') {
            imageLazyLoader.autoInit({ eagerCount: 3 });
        }

        // 回到顶部按钮
        if (typeof initGoTopButton === 'function') {
            initGoTopButton(swupRoot);
        }

        // TOC
        if (pageType === PageType.POST && typeof initializeStickyTOC === 'function') {
            if (swupRoot.querySelector('#toc-section') || swupRoot.querySelector('.toc')) {
                initializeStickyTOC();
            }
        }

        // Shortcodes
        if (typeof runShortcodes === 'function') {
            runShortcodes(swupRoot);
        }

        // 评论初始化
        this._scheduleCommentsInit(swupRoot);
    }

    /**
     * 调度评论初始化
     * @private
     * @param {Document|Element} root - 根元素
     */
    _scheduleCommentsInit(root) {
        if (typeof initializeCommentsOwO !== 'function') return;
        const scope = root?.querySelector ? root : document;
        const commentTextarea = scope.querySelector('.OwO-textarea');
        if (!commentTextarea) return;

        const commentsRoot = commentTextarea.closest('#comments')
            || commentTextarea.closest('.post-comments')
            || commentTextarea;

        if (!commentsRoot || commentsRoot.dataset.psOwoInit) return;
        commentsRoot.dataset.psOwoInit = 'pending';

        const runInit = () => {
            if (!commentsRoot.isConnected) return;
            if (commentsRoot.dataset.psOwoInit === 'done') return;
            commentsRoot.dataset.psOwoInit = 'done';
            initializeCommentsOwO();
        };

        if (window.location.hash === '#comments' || document.activeElement === commentTextarea) {
            this._scheduleIdleTask(runInit);
            return;
        }

        if (typeof IntersectionObserver !== 'function') {
            this._scheduleIdleTask(runInit);
            return;
        }

        const io = new IntersectionObserver((entries, observer) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    observer.disconnect();
                    this._scheduleIdleTask(runInit);
                    break;
                }
            }
        }, { rootMargin: '200px 0px', threshold: 0.01 });

        io.observe(commentsRoot);
    }

    /**
     * 从URL刷新评论
     * @private
     * @param {string} urlString - URL字符串
     * @returns {Promise<boolean>} 是否成功刷新
     */
    async _refreshCommentsFromUrl(urlString) {
        const current = document.getElementById('comments');
        if (!current) return false;

        if (!this._isSameOriginUrl(urlString)) return false;

        // 保存并禁用滚动恢复，防止DOM替换后浏览器自动恢复滚动位置
        const prevScrollRestoration = history.scrollRestoration;
        history.scrollRestoration = 'manual';

        const prevScrollY = window.scrollY;
        const active = document.activeElement;
        const activeId = active?.id;

        try {
            const res = await fetch(urlString, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'text/html,*/*;q=0.8'
                }
            });
            if (!res.ok) return false;

            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const next = doc.getElementById('comments');
            if (!next) return false;

            current.replaceWith(next);

            // 使用 requestAnimationFrame 确保滚动和焦点恢复在正确的时机执行
            requestAnimationFrame(() => {
                window.scrollTo(0, prevScrollY);
                if (activeId) {
                    const el = document.getElementById(activeId);
                    if (el?.focus) {
                        try { el.focus({ preventScroll: true }); } catch { el.focus(); }
                    }
                }
            });

            this._scheduleCommentsInit(document, { eager: true });

            // 延迟恢复滚动恢复设置，确保DOM操作完成
            setTimeout(() => {
                history.scrollRestoration = prevScrollRestoration;
            }, 100);

            return true;
        } catch (error) {
            // 发生错误时立即恢复滚动恢复设置
            history.scrollRestoration = prevScrollRestoration;
            return false;
        }
    }

    /**
     * 判断是否是搜索表单
     * @private
     * @param {HTMLFormElement} form - 表单元素
     * @returns {boolean} 是否是搜索表单
     */
    _isSearchForm(form) {
        if (!form || form.nodeName !== 'FORM') return false;
        if (form.matches('form.search-container, form[role="search"], form[data-ps-search]')) return true;
        return Boolean(form.querySelector('input[name="s"]'));
    }

    /**
     * 判断是否是评论表单
     * @private
     * @param {HTMLFormElement} form - 表单元素
     * @returns {boolean} 是否是评论表单
     */
    _isCommentForm(form) {
        if (!form || form.nodeName !== 'FORM') return false;
        if (form.id === 'cf') return true;
        if (form.matches('form[no-pjax]') && form.querySelector('textarea[name="text"]')) return true;
        return false;
    }

    /**
     * 判断是否是加密文章表单
     * @private
     * @param {HTMLFormElement} form - 表单元素
     * @returns {boolean} 是否是加密文章表单
     */
    _isProtectedForm(form) {
        return form && form.classList.contains('protected-form');
    }

    /**
     * 构建GET URL
     * @private
     * @param {HTMLFormElement} form - 表单元素
     * @returns {URL} URL对象
     */
    _buildGetUrlFromForm(form) {
        const action = form.getAttribute('action') || window.location.href;
        const url = new URL(action, window.location.origin);
        const params = new URLSearchParams(url.search);

        const formData = new FormData(form);
        for (const [key, value] of formData.entries()) {
            if (typeof value !== 'string') continue;
            if (params.has(key)) params.delete(key);
            params.append(key, value);
        }
        url.search = params.toString();
        return url;
    }

    /**
     * 判断是否是同源URL
     * @private
     * @param {string} urlString - URL字符串
     * @returns {boolean} 是否同源
     */
    _isSameOriginUrl(urlString) {
        try {
            const url = new URL(urlString, window.location.origin);
            return url.origin === window.location.origin;
        } catch {
            return false;
        }
    }

    /**
     * 设置表单忙碌状态
     * @private
     * @param {HTMLFormElement} form - 表单元素
     * @param {boolean} busy - 是否忙碌
     * @param {string} label - 标签文本
     * @returns {Function} 恢复函数
     */
    _setFormBusyState(form, busy, label) {
        const submit = form.querySelector('button[type="submit"], input[type="submit"], button.submit, #submit');
        if (!submit) return () => {};

        const prev = {
            disabled: submit.disabled,
            text: submit.tagName === 'INPUT' ? submit.value : submit.textContent
        };

        submit.disabled = Boolean(busy);
        if (label) {
            if (submit.tagName === 'INPUT') submit.value = label;
            else submit.textContent = label;
        }

        return () => {
            submit.disabled = prev.disabled;
            if (submit.tagName === 'INPUT') submit.value = prev.text;
            else submit.textContent = prev.text;
        };
    }

    /**
     * 显示提示消息
     * @private
     * @param {string} message - 消息内容
     * @param {string} variant - 变体类型
     */
    _showToast(message, variant) {
        if (typeof MoxToast === 'function') {
            const isSuccess = variant === 'success';
            const isError = variant === 'error';
            MoxToast({
                message: String(message || ''),
                duration: isError ? 3500 : 2200,
                position: 'bottom',
                backgroundColor: isSuccess
                    ? 'rgba(52, 199, 89, 0.9)'
                    : isError
                        ? 'rgba(255, 59, 48, 0.9)'
                        : 'rgba(0, 0, 0, 0.75)',
                textColor: '#fff',
                borderColor: isSuccess
                    ? 'rgba(52, 199, 89, 0.3)'
                    : isError
                        ? 'rgba(255, 59, 48, 0.3)'
                        : 'rgba(255, 255, 255, 0.12)'
            });
            return;
        }
        alert(String(message || ''));
    }

    /**
     * 调度空闲任务
     * @private
     * @param {Function} task - 任务函数
     */
    _scheduleIdleTask(task) {
        if (typeof task !== 'function') return;
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(task, { timeout: 800 });
        } else {
            setTimeout(task, 0);
        }
    }

    /**
     * 调度空闲批处理
     * @private
     * @param {Array} items - 项目数组
     * @param {number} batchSize - 批次大小
     * @param {Function} handler - 处理函数
     * @param {Function} shouldContinue - 是否继续的检查函数
     */
    _scheduleIdleBatched(items, batchSize, handler, shouldContinue) {
        if (!items?.length || typeof handler !== 'function') return;
        let index = 0;
        const total = items.length;

        const runBatch = () => {
            if (typeof shouldContinue === 'function' && !shouldContinue()) return;
            const end = Math.min(total, index + batchSize);
            for (; index < end; index++) {
                handler(items[index], index);
            }
            if (index < total) {
                this._scheduleIdleTask(runBatch);
            }
        };

        this._scheduleIdleTask(runBatch);
    }

    /**
     * 移除预加载类
     * @private
     */
    _removePreloadClasses() {
        const preloadClasses = ['ps-preload-list-enter', 'ps-preload-post-enter', 'ps-preload-page-enter'];
        const hasPreloadClass = preloadClasses.some(cls => document.documentElement.classList.contains(cls));

        if (hasPreloadClass) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    preloadClasses.forEach(cls => document.documentElement.classList.remove(cls));
                });
            });
        }
    }

    /**
     * 清理VT样式
     * @private
     */
    _cleanupVTStyles() {
        const style = document.getElementById(VT_CONFIG.styleId);
        if (style) {
            style.remove();
        }
        this._clearMarkedViewTransitionNames();
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
        // 事件监听器通过Swup的destroy方法自动清理
    }

    /**
     * 记录日志
     * @private
     * @param {string} message - 日志消息
     * @param {Object} [data] - 附加数据
     */
    _log(message, data) {
        console.log(`[SwupManager] ${message}`, data || '');
    }

    /**
     * 运行进入动画（占位，实际由动画层实现）
     * @private
     * @param {string} toType - 目标页面类型
     * @param {boolean} hasSharedElement - 是否有共享元素
     */
    _runEnterAnimation(toType, hasSharedElement) {
        // 发布事件，由动画层处理
        eventBus.emit('swup:enterAnimation', { toType, hasSharedElement });
    }
}

/**
 * 导航事件名称常量
 * @readonly
 * @enum {string}
 */
export const NavigationEvents = {
    /** 访问开始事件 */
    VISIT_START: NAVIGATION_EVENTS.VISIT_START,
    /** 内容替换事件 */
    CONTENT_REPLACE: NAVIGATION_EVENTS.CONTENT_REPLACE,
    /** 访问结束事件 */
    VISIT_END: NAVIGATION_EVENTS.VISIT_END,
    /** 页面视图事件 */
    PAGE_VIEW: NAVIGATION_EVENTS.PAGE_VIEW,
    /** 导航错误事件 */
    NAVIGATION_ERROR: NAVIGATION_EVENTS.NAVIGATION_ERROR
};

// 创建全局单例
export const swupManager = new SwupManager();
