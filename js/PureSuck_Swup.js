(function (window, document) {
    'use strict';

    const PS = window.PS || null;
    if (!PS || typeof PS.registerModule !== 'function') return;

    if (PS.isFeatureEnabled('swup', true)) {
        PS.setManagedBySwup(true);
    }

    const VT_ATTR = 'data-ps-vt-name';
    const TRANSITION_CLASSES = [
        'ps-animating',
        'ps-phase-enter',
        'ps-phase-exit',
        'ps-mode-card',
        'ps-mode-vt',
        'ps-vt-reveal',
        'ps-enter-list',
        'ps-enter-post',
        'ps-enter-page',
        'ps-exit-list',
        'ps-exit-post',
        'ps-exit-page'
    ];

    const DURATION = {
        enter: 560,
        prime: 680,
        safety: 1500,
        vtMorph: 400,
        vtRevealGap: 40
    };

    const state = {
        swup: null,
        listenersBound: false,
        lastFromType: 'list',
        requestedMode: 'card',
        initialEnterPlayed: false,
        clickedPostKey: '',
        lastPostKey: '',
        timers: { cleanup: 0, safety: 0, prime: 0, reveal: 0 }
    };

    function getSwupRoot() {
        return document.getElementById('swup') || document;
    }

    function getPageType() {
        return PS.getPageType(getSwupRoot());
    }

    function prefersReducedMotion() {
        try {
            return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function canUseViewTransition() {
        if (!PS.isFeatureEnabled('viewTransition', true)) return false;
        if (prefersReducedMotion()) return false;
        return typeof document.startViewTransition === 'function';
    }

    function isValidMouseClick(event) {
        if (!event || event.defaultPrevented) return false;
        if (event.button !== 0) return false;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
        return true;
    }

    function isSameOriginUrl(urlString) {
        try {
            const url = new URL(urlString, window.location.origin);
            return url.origin === window.location.origin;
        } catch (e) {
            return false;
        }
    }

    function getPostKeyFromElement(el) {
        if (!el) return '';
        return String(el.getAttribute('data-ps-post-key') || el.dataset.psPostKey || '').trim();
    }

    function escapeAttrValue(value) {
        const raw = String(value || '');
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(raw);
        }
        return raw.replace(/["\\]/g, '\\$&');
    }

    function getLastPostKey() {
        if (state.lastPostKey) return state.lastPostKey;
        if (history.state && typeof history.state === 'object' && history.state.lastPostKey) {
            return String(history.state.lastPostKey);
        }
        return '';
    }

    function rememberLastPostKey(postKey) {
        const normalized = String(postKey || '').trim();
        if (!normalized) return;

        state.lastPostKey = normalized;
        const historyState = history.state && typeof history.state === 'object' ? history.state : {};
        if (historyState.lastPostKey === normalized) return;

        try {
            history.replaceState(Object.assign({}, historyState, { lastPostKey: normalized }), document.title);
        } catch (e) {
            // ignore
        }
    }

    function getTransitionName(postKey) {
        const safeKey = encodeURIComponent(String(postKey)).replace(/%/g, '_');
        return 'ps-post-' + safeKey;
    }

    function clearSharedMarkers() {
        document.querySelectorAll('[' + VT_ATTR + ']').forEach((el) => {
            el.removeAttribute(VT_ATTR);
            el.style.viewTransitionName = '';
        });
    }

    function markSharedElement(el, postKey) {
        if (!el || !postKey || !canUseViewTransition()) return false;
        clearSharedMarkers();
        const name = getTransitionName(postKey);
        el.setAttribute(VT_ATTR, name);
        el.style.viewTransitionName = name;
        return true;
    }

    function syncSharedMarkerForCurrentPage() {
        if (!canUseViewTransition()) {
            clearSharedMarkers();
            return false;
        }

        const pageType = getPageType();
        const root = getSwupRoot();
        const fallbackKey = getLastPostKey();

        if (pageType === 'post') {
            const single = root.querySelector('.post.post--single[data-ps-post-key]');
            if (!single) {
                clearSharedMarkers();
                return false;
            }
            const key = getPostKeyFromElement(single) || fallbackKey;
            if (!key) {
                clearSharedMarkers();
                return false;
            }
            rememberLastPostKey(key);
            return markSharedElement(single, key);
        }

        if (pageType === 'list') {
            if (!fallbackKey) {
                clearSharedMarkers();
                return false;
            }
            const selector = '.post.post--index[data-ps-post-key="' + escapeAttrValue(fallbackKey) + '"]';
            const card = root.querySelector(selector);
            if (!card) {
                clearSharedMarkers();
                return false;
            }
            return markSharedElement(card, fallbackKey);
        }

        clearSharedMarkers();
        return false;
    }

    function clearTimer(name) {
        if (!state.timers[name]) return;
        clearTimeout(state.timers[name]);
        state.timers[name] = 0;
    }

    function clearAllTimers() {
        clearTimer('cleanup');
        clearTimer('safety');
        clearTimer('prime');
        clearTimer('reveal');
    }

    function cleanupTransitionState(options) {
        const config = Object.assign({ keepSharedMarker: true }, options || {});

        clearAllTimers();
        document.documentElement.classList.remove.apply(document.documentElement.classList, TRANSITION_CLASSES);

        const root = getSwupRoot();
        root.classList.remove('ps-vt-active');
        root.classList.remove('ps-enter-prime');

        if (!config.keepSharedMarker) clearSharedMarkers();
    }

    function setTransitionState(phase, mode, pageType) {
        const html = document.documentElement;

        html.classList.remove(
            'ps-phase-enter',
            'ps-phase-exit',
            'ps-mode-card',
            'ps-mode-vt',
            'ps-vt-reveal',
            'ps-enter-list',
            'ps-enter-post',
            'ps-enter-page',
            'ps-exit-list',
            'ps-exit-post',
            'ps-exit-page'
        );

        html.classList.add('ps-animating');
        html.classList.add(phase === 'enter' ? 'ps-phase-enter' : 'ps-phase-exit');
        html.classList.add(mode === 'vt' ? 'ps-mode-vt' : 'ps-mode-card');
        html.classList.add((phase === 'enter' ? 'ps-enter-' : 'ps-exit-') + pageType);

        getSwupRoot().classList.toggle('ps-vt-active', mode === 'vt');
    }

    function startPrimeGuard() {
        const root = getSwupRoot();
        root.classList.add('ps-enter-prime');

        const unlock = () => {
            root.classList.remove('ps-enter-prime');
            clearTimer('prime');
        };

        requestAnimationFrame(() => requestAnimationFrame(unlock));
        state.timers.prime = window.setTimeout(unlock, DURATION.prime);
    }

    function startExitTransition(fromType, mode) {
        if (prefersReducedMotion()) {
            cleanupTransitionState({ keepSharedMarker: mode === 'vt' });
            return;
        }

        setTransitionState('exit', mode, fromType);
    }

    function startEnterTransition(toType, mode, options) {
        const config = Object.assign(
            {
                fromType: state.lastFromType || 'list',
                force: false
            },
            options || {}
        );

        if (prefersReducedMotion()) {
            cleanupTransitionState({ keepSharedMarker: mode === 'vt' });
            return;
        }

        startPrimeGuard();
        setTransitionState('enter', mode, toType);

        let cleanupDelay = DURATION.enter;
        if (!config.force && mode === 'vt' && toType === 'list') {
            const html = document.documentElement;
            const revealDelay = DURATION.vtMorph + DURATION.vtRevealGap;

            clearTimer('reveal');
            state.timers.reveal = window.setTimeout(() => {
                html.classList.add('ps-vt-reveal');
                clearTimer('reveal');
            }, revealDelay);

            cleanupDelay = revealDelay + DURATION.enter + 200;
        }

        clearTimer('cleanup');
        state.timers.cleanup = window.setTimeout(() => {
            cleanupTransitionState({ keepSharedMarker: mode === 'vt' });
        }, cleanupDelay);

        clearTimer('safety');
        state.timers.safety = window.setTimeout(() => {
            cleanupTransitionState({ keepSharedMarker: mode === 'vt' });
        }, Math.max(DURATION.safety, cleanupDelay + 240));
    }

    function determineExitMode(fromType) {
        if (!canUseViewTransition()) return 'card';
        if (fromType === 'list') return (state.clickedPostKey || getLastPostKey()) ? 'vt' : 'card';
        if (fromType === 'post') return getLastPostKey() ? 'vt' : 'card';
        return 'card';
    }
    function prepareSharedMarkerBeforeExit(fromType, requestedMode) {
        if (requestedMode !== 'vt' || !canUseViewTransition()) {
            clearSharedMarkers();
            return 'card';
        }

        const root = getSwupRoot();

        if (fromType === 'list') {
            const key = state.clickedPostKey || getLastPostKey();
            if (!key) {
                clearSharedMarkers();
                return 'card';
            }
            const selector = '.post.post--index[data-ps-post-key="' + escapeAttrValue(key) + '"]';
            const card = root.querySelector(selector);
            if (!card) {
                clearSharedMarkers();
                return 'card';
            }
            rememberLastPostKey(key);
            return markSharedElement(card, key) ? 'vt' : 'card';
        }

        if (fromType === 'post') {
            const single = root.querySelector('.post.post--single[data-ps-post-key]');
            if (!single) {
                clearSharedMarkers();
                return 'card';
            }
            const key = getPostKeyFromElement(single) || getLastPostKey();
            if (!key) {
                clearSharedMarkers();
                return 'card';
            }
            rememberLastPostKey(key);
            return markSharedElement(single, key) ? 'vt' : 'card';
        }

        clearSharedMarkers();
        return 'card';
    }

    function resolveEnterMode(toType, requestedMode) {
        if (requestedMode !== 'vt' || !canUseViewTransition()) {
            clearSharedMarkers();
            return 'card';
        }

        if (toType !== 'post' && toType !== 'list') {
            clearSharedMarkers();
            return 'card';
        }

        return syncSharedMarkerForCurrentPage() ? 'vt' : 'card';
    }

    function playInitialEnterFromPreload() {
        if (state.initialEnterPlayed) return;

        const preloadClasses = ['ps-preload-list-enter', 'ps-preload-post-enter', 'ps-preload-page-enter'];
        const html = document.documentElement;
        const hasPreload = preloadClasses.some((cls) => html.classList.contains(cls));
        const pageType = getPageType();
        const allowListFallback = pageType === 'list' && !prefersReducedMotion();
        if (!hasPreload && !allowListFallback) return;
        state.initialEnterPlayed = true;

        requestAnimationFrame(() => {
            preloadClasses.forEach((cls) => html.classList.remove(cls));
            startEnterTransition(pageType, 'card', { fromType: 'initial', force: true });
        });
    }

    function updateNavCurrentState() {
        const currentPath = window.location.pathname;
        document.querySelectorAll('.header-nav .nav-item').forEach((item) => {
            const link = item.querySelector('a[href]');
            if (!link) return;
            try {
                const linkPath = new URL(link.href, window.location.origin).pathname;
                item.classList.toggle('nav-item-current', linkPath === currentPath);
            } catch (e) {
                item.classList.remove('nav-item-current');
            }
        });

        if (window.NavIndicator && typeof window.NavIndicator.update === 'function') {
            window.NavIndicator.update();
        }
    }

    function buildGetUrlFromForm(form) {
        const action = form.getAttribute('action') || window.location.href;
        const url = new URL(action, window.location.origin);
        const params = new URLSearchParams(url.search);

        for (const [key, value] of new FormData(form).entries()) {
            if (typeof value !== 'string') continue;
            params.delete(key);
            params.append(key, value);
        }

        url.search = params.toString();
        return url;
    }

    function isSearchForm(form) {
        if (!form || form.nodeName !== 'FORM') return false;
        if (form.matches('form.search-container, form[role="search"], form[data-ps-search]')) return true;
        return Boolean(form.querySelector('input[name="s"]'));
    }

    function isTypechoCommentForm(form) {
        if (!form || form.nodeName !== 'FORM') return false;
        if (form.id === 'cf') return true;
        return form.matches('form[no-pjax]') && Boolean(form.querySelector('textarea[name="text"]'));
    }

    function setBusyButton(form, label) {
        const submit = form.querySelector('button[type="submit"], input[type="submit"], button.submit, #submit');
        if (!submit) return function noop() {};

        const prevDisabled = submit.disabled;
        const prevText = submit.tagName === 'INPUT' ? submit.value : submit.textContent;
        submit.disabled = true;
        if (submit.tagName === 'INPUT') submit.value = label;
        else submit.textContent = label;

        return function restore() {
            submit.disabled = prevDisabled;
            if (submit.tagName === 'INPUT') submit.value = prevText;
            else submit.textContent = prevText;
        };
    }

    function psToast(message, type) {
        if (typeof window.MoxToast !== 'function') {
            alert(String(message || ''));
            return;
        }

        const isSuccess = type === 'success';
        const isError = type === 'error';
        window.MoxToast({
            message: String(message || ''),
            duration: isError ? 3500 : 2200,
            position: 'bottom',
            backgroundColor: isSuccess
                ? 'rgba(52, 199, 89, 0.9)'
                : isError
                    ? 'rgba(230, 72, 63, 0.9)'
                    : 'rgba(0, 0, 0, 0.75)',
            textColor: '#fff',
            borderColor: isSuccess
                ? 'rgba(52, 199, 89, 0.3)'
                : isError
                    ? 'rgba(255, 59, 48, 0.3)'
                    : 'rgba(255, 255, 255, 0.16)'
        });
    }

    async function refreshCommentsFromUrl(urlString, options) {
        const cfg = Object.assign({ restoreScroll: true }, options || {});
        const currentList = document.getElementById('comments-list');
        if (!currentList || !isSameOriginUrl(urlString)) return false;

        const beforeY = window.scrollY;
        const activeId = document.activeElement && document.activeElement.id;

        const respond = document.querySelector('.respond');
        const holder = document.getElementById('comment-form-place-holder');
        const respondInsideList = Boolean(respond && currentList.contains(respond));

        const response = await fetch(urlString, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'text/html,*/*;q=0.8'
            }
        });
        if (!response.ok) return false;

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const nextList = doc.getElementById('comments-list');
        if (!nextList) return false;

        if (respondInsideList && respond && holder && holder.parentNode) {
            holder.parentNode.insertBefore(respond, holder);
        }

        currentList.replaceWith(nextList);

        if (respondInsideList) {
            const parentInput = document.getElementById('comment-parent');
            if (parentInput && parentInput.parentNode) parentInput.parentNode.removeChild(parentInput);
            const cancelReply = document.getElementById('cancel-comment-reply-link');
            if (cancelReply) cancelReply.style.display = 'none';
        }

        requestAnimationFrame(() => {
            if (cfg.restoreScroll) window.scrollTo(0, beforeY);
            if (!activeId) return;
            const activeEl = document.getElementById(activeId);
            if (!activeEl || typeof activeEl.focus !== 'function') return;
            try {
                activeEl.focus({ preventScroll: true });
            } catch (e) {
                activeEl.focus();
            }
        });

        return true;
    }
    function patchTypechoComment() {
        const reply = function reply(cid, coid) {
            const comment = document.getElementById(cid);
            if (!comment) return false;

            const respond = document.querySelector('.respond');
            if (!respond) return false;
            const form = respond.tagName === 'FORM' ? respond : respond.querySelector('form');
            if (!form) return false;

            let input = document.getElementById('comment-parent');
            if (!input) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.id = 'comment-parent';
                input.name = 'parent';
                form.appendChild(input);
            }
            input.value = coid;

            let holder = document.getElementById('comment-form-place-holder');
            if (!holder) {
                holder = document.createElement('div');
                holder.id = 'comment-form-place-holder';
                if (respond.parentNode) respond.parentNode.insertBefore(holder, respond);
            }

            comment.appendChild(respond);
            const cancel = document.getElementById('cancel-comment-reply-link');
            if (cancel) cancel.style.display = '';

            const textarea = respond.querySelector('textarea[name="text"]');
            if (textarea) textarea.focus();
            return false;
        };

        const cancelReply = function cancelReply() {
            const respond = document.querySelector('.respond');
            const holder = document.getElementById('comment-form-place-holder');
            const input = document.getElementById('comment-parent');
            const cancel = document.getElementById('cancel-comment-reply-link');

            if (input && input.parentNode) input.parentNode.removeChild(input);
            if (!respond || !holder || !holder.parentNode) return false;

            holder.parentNode.insertBefore(respond, holder);
            if (cancel) cancel.style.display = 'none';
            return false;
        };

        if (window.TypechoComment && typeof window.TypechoComment === 'object') {
            window.TypechoComment.reply = reply;
            window.TypechoComment.cancelReply = cancelReply;
        } else {
            window.TypechoComment = { reply, cancelReply };
        }
    }

    async function handleCommentSubmit(form) {
        const action = form.getAttribute('action') || '';
        if (!isSameOriginUrl(action)) return;
        const restore = setBusyButton(form, '提交中...');

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
                psToast('评论提交失败，请稍后重试', 'error');
                return;
            }

            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            const fallback = window.location.href.split('#')[0];
            let refreshUrl = fallback;

            if (contentType.includes('application/json')) {
                const data = await response.json();
                const ok = Boolean(
                    data && (data.success === true || data.success === 1 || data.status === 'success' || data.status === 1)
                );
                if (!ok) {
                    psToast((data && (data.message || data.error)) || '评论提交失败，请检查内容后重试', 'error');
                    return;
                }
                psToast((data && data.message) || '评论已提交', 'success');
                const redirect = (data && (data.redirect || data.url || data.permalink || (data.comment && data.comment.permalink))) || fallback;
                refreshUrl = isSameOriginUrl(redirect) ? redirect : fallback;
            } else {
                psToast('评论已提交', 'success');
                refreshUrl = response.url && isSameOriginUrl(response.url) ? response.url : fallback;
            }

            const refreshed = await refreshCommentsFromUrl(refreshUrl);
            if (!refreshed) {
                if (state.swup) state.swup.navigate(fallback + '#comments');
                else window.location.href = fallback + '#comments';
            }

            const textarea = form.querySelector('textarea[name="text"], #textarea');
            if (textarea) textarea.value = '';
        } catch (error) {
            psToast('评论提交失败，请稍后重试', 'error');
        } finally {
            restore();
        }
    }

    async function handleProtectedSubmit(form) {
        const submitBtn = form.querySelector('.protected-btn');
        const restore = submitBtn
            ? (() => {
                const text = submitBtn.textContent;
                submitBtn.textContent = '解锁中...';
                submitBtn.disabled = true;
                return () => {
                    submitBtn.textContent = text;
                    submitBtn.disabled = false;
                };
            })()
            : function noop() {};

        try {
            const tokenResp = await fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'type=getTokenUrl'
            });
            const tokenData = await tokenResp.json();
            if (!tokenData || !tokenData.tokenUrl) throw new Error('token-missing');

            await fetch(tokenData.tokenUrl, { method: 'POST', body: new FormData(form) });

            const checkResp = await fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'type=checkPassword'
            });
            const checkData = await checkResp.json();
            if (checkData && checkData.hidden) throw new Error('wrong-password');

            psToast('解锁成功', 'success');
            if (state.swup && state.swup.cache && typeof state.swup.cache.clear === 'function') {
                state.swup.cache.clear();
                state.swup.navigate(window.location.href);
            } else {
                window.location.reload();
            }
        } catch (error) {
            psToast('密码错误，请重试', 'error');
        } finally {
            restore();
        }
    }

    async function handleCommentPageClick(link) {
        const url = link.getAttribute('href');
        if (!url) return;
        const navigator = link.closest('.page-navigator');
        if (navigator) navigator.classList.add('loading');

        try {
            const refreshed = await refreshCommentsFromUrl(url, { restoreScroll: false });
            if (refreshed) {
                const comments = document.getElementById('comments');
                if (comments) {
                    const target = comments.querySelector('.comment-list > li') || comments.querySelector('.comment-title') || comments;
                    if (target && typeof target.scrollIntoView === 'function') {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
                return;
            }
            if (state.swup) state.swup.navigate(url);
            else window.location.href = url;
        } finally {
            if (navigator) navigator.classList.remove('loading');
        }
    }

    function bindGlobalListeners() {
        if (state.listenersBound) return;
        state.listenersBound = true;

        document.addEventListener('click', (event) => {
            if (!isValidMouseClick(event)) return;
            const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
            if (!link) return;

            const pageNavigator = link.closest('.page-navigator');
            if (pageNavigator) {
                event.preventDefault();
                event.stopPropagation();
                handleCommentPageClick(link);
                return;
            }

            const href = link.getAttribute('href') || '';
            if (href.indexOf('replyTo') > -1) {
                event.preventDefault();
                return;
            }

            if (link.target && link.target !== '_self') return;
            if (link.hasAttribute('download')) return;
            if (!isSameOriginUrl(link.href)) return;

            state.clickedPostKey = '';

            const postCard = link.closest('.post.post--index[data-ps-post-key]');
            if (!postCard) return;
            const postKey = getPostKeyFromElement(postCard);
            if (!postKey) return;

            state.clickedPostKey = postKey;
            rememberLastPostKey(postKey);
            markSharedElement(postCard, postKey);
        }, true);

        document.addEventListener('submit', (event) => {
            const form = event.target && event.target.closest ? event.target.closest('form') : null;
            if (!form) return;

            const method = (form.getAttribute('method') || 'get').toLowerCase();
            if (method === 'get' && isSearchForm(form) && state.swup) {
                const url = buildGetUrlFromForm(form);
                if (isSameOriginUrl(url.href)) {
                    event.preventDefault();
                    state.swup.navigate(url.href);
                }
                return;
            }

            if (isTypechoCommentForm(form)) {
                event.preventDefault();
                handleCommentSubmit(form);
                return;
            }

            if (form.classList.contains('protected-form')) {
                event.preventDefault();
                handleProtectedSubmit(form);
            }
        }, true);
    }
    function registerRuntimeModules() {
        PS.registerModule({
            id: 'ps-theme-enhance',
            priority: 100,
            init: function initThemeEnhance(root) {
                if (typeof window.runShortcodes === 'function') {
                    window.runShortcodes(root);
                }
                updateNavCurrentState();
                if (window.OwoManager && typeof window.OwoManager.init === 'function') {
                    window.OwoManager.init();
                }
            },
            destroy: function destroyThemeEnhance() {
                if (window.OwoManager && typeof window.OwoManager.destroy === 'function') {
                    window.OwoManager.destroy();
                }
            }
        });

        PS.registerModule({
            id: 'ps-custom-callback',
            priority: 200,
            match: function matchCustomCallback(context) {
                return Boolean(context.isSwup && typeof window.pjaxCustomCallback === 'function');
            },
            init: function initCustomCallback() {
                try {
                    window.pjaxCustomCallback();
                } catch (error) {
                    PS.log('custom callback failed:', error);
                }
            }
        });
    }

    function createPlugins() {
        const plugins = [];

        if (typeof window.SwupScrollPlugin === 'function') {
            plugins.push(new window.SwupScrollPlugin({
                doScrollingRightAway: true,
                animateScroll: { betweenPages: false, samePageWithHash: true, samePage: true }
            }));
        }

        if (PS.isFeatureEnabled('swupPreload', true) && typeof window.SwupPreloadPlugin === 'function') {
            plugins.push(new window.SwupPreloadPlugin({
                preloadHoveredLinks: true,
                preloadInitialPage: true,
                preloadVisibleLinks: {
                    delay: 420,
                    threshold: 0.2,
                    containers: ['#swup'],
                    ignore: function ignore(linkEl) {
                        if (!linkEl) return true;
                        if (linkEl.closest('#comments, .main-lastinfo, .header-credit')) return true;
                        const href = linkEl.getAttribute('href') || '';
                        return href.indexOf('#') === 0;
                    }
                }
            }));
        }

        if (typeof window.SwupHeadPlugin === 'function') {
            plugins.push(new window.SwupHeadPlugin({
                persistAssets: true,
                awaitAssets: false,
                attributes: []
            }));
        }

        return plugins;
    }

    function initSwup() {
        registerRuntimeModules();
        bindGlobalListeners();

        if (!PS.isFeatureEnabled('swup', true)) {
            PS.setManagedBySwup(false);
            cleanupTransitionState({ keepSharedMarker: false });
            syncSharedMarkerForCurrentPage();
            playInitialEnterFromPreload();
            PS.initModules(document, { reason: 'swup-disabled', isSwup: false, via: 'ssr' });
            return;
        }

        if (typeof window.Swup !== 'function') {
            PS.log('Swup script missing, fallback to native navigation.');
            PS.setManagedBySwup(false);
            cleanupTransitionState({ keepSharedMarker: false });
            syncSharedMarkerForCurrentPage();
            playInitialEnterFromPreload();
            PS.initModules(document, { reason: 'swup-missing', isSwup: false, via: 'ssr' });
            return;
        }

        PS.setManagedBySwup(true);
        patchTypechoComment();

        try {
            const swup = new window.Swup({
                containers: ['#swup', '#right-sidebar'],
                plugins: createPlugins(),
                cache: true,
                native: true,
                preload: PS.isFeatureEnabled('swupPreload', true),
                animateHistoryBrowsing: true,
                animationSelector: false,
                resolveUrl: function resolveUrl(url) {
                    const normalized = new URL(url, window.location.origin);
                    return normalized.pathname + normalized.search + normalized.hash;
                },
                linkSelector: 'a[href]:not([data-no-swup]):not([no-pjax]):not(a[href^="#"])'
            });

            state.swup = swup;
            window.swupInstance = swup;

            swup.hooks.on('visit:start', function onVisitStart() {
                cleanupTransitionState({ keepSharedMarker: true });
                state.lastFromType = getPageType();
                state.requestedMode = determineExitMode(state.lastFromType);
                state.requestedMode = prepareSharedMarkerBeforeExit(state.lastFromType, state.requestedMode);

                PS.destroyModules(getSwupRoot(), {
                    reason: 'visit:start',
                    isSwup: true,
                    fromType: state.lastFromType,
                    transitionMode: state.requestedMode
                });

                startExitTransition(state.lastFromType, state.requestedMode);
            });

            swup.hooks.on('content:replace', function onContentReplace() {
                const toType = getPageType();
                const enterMode = resolveEnterMode(toType, state.requestedMode);

                if (toType === 'post' || toType === 'page') {
                    window.scrollTo(0, 0);
                }

                startEnterTransition(toType, enterMode, { fromType: state.lastFromType });
            });

            swup.hooks.on('page:view', function onPageView() {
                PS.initModules(getSwupRoot(), {
                    reason: 'page:view',
                    isSwup: true,
                    fromType: state.lastFromType,
                    toType: getPageType(),
                    transitionMode: state.requestedMode
                });

                state.clickedPostKey = '';
                syncSharedMarkerForCurrentPage();
                updateNavCurrentState();
            });

            swup.hooks.on('visit:end', function onVisitEnd() {
                clearTimer('safety');
                state.timers.safety = window.setTimeout(() => {
                    cleanupTransitionState({ keepSharedMarker: true });
                }, DURATION.safety);
            });

            PS.initModules(getSwupRoot(), {
                reason: 'swup:init',
                isSwup: true,
                toType: getPageType(),
                transitionMode: 'card'
            });

            syncSharedMarkerForCurrentPage();
            playInitialEnterFromPreload();
        } catch (error) {
            PS.log('Swup init failed, fallback to native navigation:', error);
            PS.setManagedBySwup(false);
            state.swup = null;
            cleanupTransitionState({ keepSharedMarker: false });
            playInitialEnterFromPreload();
            PS.initModules(document, { reason: 'swup-fallback', isSwup: false, via: 'ssr' });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSwup);
    } else {
        initSwup();
    }
})(window, document);
