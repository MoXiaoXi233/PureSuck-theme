/**
 * PureSuck Swup 4 配置
 * 包含完整的页面过渡动画逻辑
 */

(function() {
    'use strict';

    // ========== View Transitions: shared element (index card -> post container) ==========
    const VT = {
        styleId: 'ps-vt-shared-element-style',
        markerAttr: 'data-ps-vt-name'
    };

    function supportsViewTransitions() {
        return typeof document.startViewTransition === 'function'
            && typeof CSS !== 'undefined'
            && typeof CSS.supports === 'function'
            && CSS.supports('view-transition-name: ps-test');
    }

    function getArchiveIdFromUrl(urlString) {
        try {
            const url = new URL(urlString, window.location.origin);
            const match = url.pathname.match(/\/archives\/(\d+)(?:\/|\.html)?(?:$|[?#])/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    function getPostTransitionName(postId) {
        return `ps-post-${postId}`;
    }

    function clearMarkedViewTransitionNames() {
        document.querySelectorAll(`[${VT.markerAttr}]`).forEach((el) => {
            el.style.viewTransitionName = '';
            el.removeAttribute(VT.markerAttr);
        });
    }

    function ensureSharedElementTransitionCSS(name) {
        let style = document.getElementById(VT.styleId);
        if (!style) {
            style = document.createElement('style');
            style.id = VT.styleId;
            document.head.appendChild(style);
        }

        style.textContent = `
/* PureSuck View Transitions: shared element morph */
::view-transition-group(${name}) {
  animation-duration: 500ms;
  animation-timing-function: cubic-bezier(.2,.8,.2,1);
  animation-fill-mode: both;
  border-radius: 0.85rem;
  overflow: hidden;
}
::view-transition-old(${name}),
::view-transition-new(${name}) {
  animation-duration: 500ms;
  animation-timing-function: cubic-bezier(.2,.8,.2,1);
  animation-fill-mode: both;
}
`;
    }

    function applyPostSharedElementName(el, postId) {
        if (!supportsViewTransitions() || !el || !postId) return;

        const name = getPostTransitionName(postId);
        clearMarkedViewTransitionNames();
        ensureSharedElementTransitionCSS(name);

        el.style.viewTransitionName = name;
        el.setAttribute(VT.markerAttr, name);
    }

    function shouldForceScrollToTop(urlString) {
        try {
            const url = new URL(urlString, window.location.origin);
            if (url.hash) return false;
            return getPageType(url.href) === 'post';
        } catch {
            return false;
        }
    }

    function findIndexPostCardById(postId) {
        if (!postId) return null;

        const cards = document.querySelectorAll('.post.post--index');
        for (const card of cards) {
            const link = card.querySelector('a[href]');
            if (!link) continue;
            const linkPostId = getArchiveIdFromUrl(link.href);
            if (linkPostId === postId) return card;
        }

        return null;
    }

    // ========== 动画类型检测 ==========
    function getPageType(url) {
        // 判断是否为文章页
        if (url.includes('/archives/') || url.match(/\/\d+\.html/)) {
            return 'post';
        }
        // 判断是否为独立页面
        if (url.includes('/about.html') || url.includes('/links.html') || url.match(/\/[^/]+\.html$/)) {
            return 'post';
        }
        // 默认为列表页
        return 'list';
    }

    // ========== 添加动画属性到元素 ==========
    function markAnimationElements() {
        // 标记文章卡片
        document.querySelectorAll('.post').forEach(el => {
            el.setAttribute('data-swup-animation', '');
        });

        // 标记分页器
        const pager = document.querySelector('.main-pager');
        if (pager) {
            pager.setAttribute('data-swup-animation', '');
        }
    }

    // ========== 清理动画类 ==========
    function cleanupAnimationClasses() {
        document.documentElement.classList.remove(
            'transition-list-in',
            'transition-list-out',
            'transition-post-in',
            'transition-post-out',
            'is-animating'
        );
    }

    // ========== 初始化 Swup ==========
    function initSwup() {
        if (typeof Swup === 'undefined') {
            console.error('[Swup] Swup 对象未定义');
            return;
        }

        // ========== Swup 4 基础配置 ==========
        const plugins = [];
        const scrollPlugin = (typeof SwupScrollPlugin === 'function')
            ? new SwupScrollPlugin({
                // Ensure browser back/forward restores the exact previous position instantly.
                doScrollingRightAway: true,
                animateScroll: {
                    betweenPages: false,
                    samePageWithHash: true,
                    samePage: true
                }
            })
            : null;

        if (scrollPlugin) plugins.push(scrollPlugin);

        const swup = new Swup({
            containers: ['#swup'],
            // Important: browser back/forward is "history browsing". If disabled, VT won't run there.
            animateHistoryBrowsing: supportsViewTransitions(),
            native: supportsViewTransitions(),  // View Transitions API (supported browsers only)
            animationSelector: false,  // 禁用 Swup 的动画等待，使用自定义动画
            plugins
        });

        // Used for "collapse" (post -> list) when there is no click target (e.g. browser back)
        let pendingPostIdForList = null;

        // ========== Index: set view-transition-name on clicked post card ==========
        // Use capture to run before Swup intercepts the click.
        document.addEventListener('click', (event) => {
            if (!supportsViewTransitions()) return;
            if (event.defaultPrevented) return;
            if (event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
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

            const postId = getArchiveIdFromUrl(toUrl.href);
            if (!postId) return;

            const postCard = link.closest('.post.post--index');
            if (!postCard) return;

            applyPostSharedElementName(postCard, postId);
        }, true);

        // ========== 页面过渡开始 ==========
        const syncPostSharedElementFromLocation = () => {
            const url = window.location.href;
            const pageType = getPageType(url);

            if (!supportsViewTransitions()) return;

            if (pageType === 'post') {
                const currentPostId = getArchiveIdFromUrl(url);
                const postContainer = document.querySelector('.post.post--single');
                applyPostSharedElementName(postContainer, currentPostId);
                return;
            }

            // Collapse morph (post -> list): bind the matching card on the list page.
            if (pageType === 'list' && pendingPostIdForList) {
                // Snap to cached scroll position first (ScrollPlugin is the source of truth).
                const cached = scrollPlugin?.getCachedScrollPositions
                    ? scrollPlugin.getCachedScrollPositions(url)
                    : null;
                const cachedY = cached && cached.window && typeof cached.window.top === 'number'
                    ? cached.window.top
                    : null;
                if (typeof cachedY === 'number') {
                    window.scrollTo(0, cachedY);
                    queueMicrotask(() => window.scrollTo(0, cachedY));
                }

                const card = findIndexPostCardById(pendingPostIdForList);
                if (card) {
                    // If layout changed and the card isn't visible, ensure it's within viewport for the morph.
                    const rect = card.getBoundingClientRect();
                    if (rect.bottom < 0 || rect.top > window.innerHeight) {
                        card.scrollIntoView({ block: 'center', inline: 'nearest' });
                    }
                    applyPostSharedElementName(card, pendingPostIdForList);
                } else {
                    clearMarkedViewTransitionNames();
                }
                pendingPostIdForList = null;
                return;
            }

            clearMarkedViewTransitionNames();
        };

        // Fallback for legacy naming: some setups dispatch this lifecycle event.
        document.addEventListener('swup:contentReplaced', syncPostSharedElementFromLocation);

        swup.hooks.on('visit:start', (visit) => {
            const fromType = getPageType(visit.from.url);
            const toType = getPageType(visit.to.url);

            // For collapse animation: remember the post id we are leaving (post -> list)
            if (supportsViewTransitions() && fromType === 'post' && toType === 'list') {
                pendingPostIdForList = getArchiveIdFromUrl(visit.from.url);
            } else {
                pendingPostIdForList = null;
            }

            // 添加动画状态类
            document.documentElement.classList.add('is-animating');

            // 标记当前页面元素
            markAnimationElements();

            // 根据页面类型应用退出动画
            if (fromType === 'list') {
                document.documentElement.classList.add('transition-list-out');
            } else if (fromType === 'post') {
                document.documentElement.classList.add('transition-post-out');
            }

            console.log(`[Swup] 页面过渡: ${fromType} → ${toType}`);
        });

        // ========== 新内容已替换，准备进入动画 ==========
        swup.hooks.on('content:replace', () => {
            // 清理旧的动画类
            cleanupAnimationClasses();

            // 保持动画状态
            document.documentElement.classList.add('is-animating');

            // 确保进入文章页时立即在顶部（避免 scroll-behavior:smooth 导致“滑上去”的鬼畜）
            if (shouldForceScrollToTop(window.location.href)) {
                window.scrollTo(0, 0);
            }

            // 标记新页面元素
            markAnimationElements();

            // View Transitions shared element: apply to the new page as well
            syncPostSharedElementFromLocation();

            // 根据目标页面类型应用进入动画
            const toType = getPageType(window.location.href);
            if (toType === 'list') {
                document.documentElement.classList.add('transition-list-in');
            } else if (toType === 'post') {
                document.documentElement.classList.add('transition-post-in');
            }
        });

        // ========== 页面过渡完成 ==========
        swup.hooks.on('visit:end', () => {
            // 延迟清理动画类，确保动画完成（0.6s + 360ms延迟 = 960ms）
            setTimeout(() => {
                cleanupAnimationClasses();
            }, 1000);
        });

        // ========== 页面完全加载后的回调 ==========
        swup.hooks.on('page:view', () => {
            // 更新导航栏指示器
            if (typeof window.NavIndicator === 'object' && typeof window.NavIndicator.update === 'function') {
                window.NavIndicator.update();
            }

            // 更新导航栏高亮
            const currentPath = window.location.pathname;
            document.querySelectorAll('.header-nav .nav-item').forEach(item => {
                const link = item.querySelector('a');
                if (link) {
                    const linkPath = new URL(link.href).pathname;
                    item.classList.toggle('nav-item-current', linkPath === currentPath);
                }
            });

            // 代码高亮
            if (typeof hljs !== 'undefined') {
                document.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }

            // TOC 目录
            if (typeof initializeStickyTOC === 'function') {
                initializeStickyTOC();
            }

            // Shortcodes
            if (typeof runShortcodes === 'function') {
                runShortcodes();
            }

            // 评论 OwO
            const commentTextarea = document.querySelector('.OwO-textarea');
            if (commentTextarea && typeof initializeCommentsOwO === 'function') {
                initializeCommentsOwO();
            }

            // 用户自定义回调
            if (typeof window.pjaxCustomCallback === 'function') {
                window.pjaxCustomCallback();
            }

            // 标记新页面元素（确保 PJAX 渲染后的元素也被标记）
            markAnimationElements();
        });

        // ========== 加密文章表单处理 ==========
        document.addEventListener('submit', (event) => {
            const form = event.target.closest('.protected-form');
            if (!form) return;

            event.preventDefault();

            const formData = new FormData(form);
            const submitBtn = form.querySelector('.protected-btn');
            const originalText = submitBtn.textContent;

            submitBtn.textContent = '解锁中...';
            submitBtn.disabled = true;

            fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'type=getTokenUrl'
            })
            .then(response => response.json())
            .then(data => {
                if (!data.tokenUrl) throw new Error('无法获取验证链接');
                return fetch(data.tokenUrl, { method: 'POST', body: formData });
            })
            .then(() => {
                return fetch(window.location.href, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'type=checkPassword'
                });
            })
            .then(response => response.json())
            .then(data => {
                if (data.hidden) throw new Error('密码错误');

                if (typeof MoxToast === 'function') {
                    MoxToast({
                        message: '✓ 解锁成功',
                        duration: 2000,
                        position: 'bottom',
                        backgroundColor: 'rgba(52, 199, 89, 0.9)',
                        textColor: '#fff',
                        borderColor: 'rgba(52, 199, 89, 0.3)'
                    });
                }

                swup.navigate(window.location.href);
            })
            .catch(() => {
                if (typeof MoxToast === 'function') {
                    MoxToast({
                        message: '密码错误，请重试',
                        duration: 3000,
                        position: 'bottom',
                        backgroundColor: 'rgba(255, 59, 48, 0.9)',
                        textColor: '#fff',
                        borderColor: 'rgba(255, 59, 48, 0.3)'
                    });
                } else {
                    alert('密码错误，请重试');
                }
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
        });

        // ========== 初始加载时标记元素 ==========
        markAnimationElements();

        // Initial load
        syncPostSharedElementFromLocation();

        console.log('[Swup] 已启用 Swup 4 (完整动画模式)');
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSwup);
    } else {
        initSwup();
    }
})();
