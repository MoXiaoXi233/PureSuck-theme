(function (window, document) {
    'use strict';

    const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
    const scriptCache = new Map();
    const formHandlers = new WeakMap();

    const HASH_COMMENT_RE = /^#comment-(\d+)$/i;
    const HASH_LIST_COMMENT_RE = /^#li-comment-(\d+)$/i;

    let pageshowBound = false;
    let typechoCommentPatched = false;

    function safeRun(cleanup) {
        if (typeof cleanup !== 'function') return;
        try {
            cleanup();
        } catch (error) { }
    }

    function isSameOriginUrl(urlString) {
        try {
            const url = new URL(urlString, window.location.origin);
            return url.origin === window.location.origin;
        } catch (error) {
            return false;
        }
    }

    function isPrimaryAction(event) {
        if (!event || event.defaultPrevented) return false;
        if (typeof event.button === 'number' && event.button !== 0) return false;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
        return true;
    }

    function showToast(message, type) {
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

    function getThemeUrl() {
        const fromConfig = PS && PS.config && typeof PS.config.themeUrl === 'string' ? PS.config.themeUrl : '';
        if (fromConfig) return fromConfig.replace(/\/+$/, '');

        if (typeof window.THEME_URL === 'string' && window.THEME_URL) {
            return window.THEME_URL.replace(/\/+$/, '');
        }

        return '';
    }

    function resolveUrl(path) {
        if (!path) return '';
        if (/^(https?:)?\/\//i.test(path)) return path;

        const themeUrl = getThemeUrl();
        if (!themeUrl) return path;
        if (path.indexOf('/') === 0) return themeUrl + path;
        return themeUrl + '/' + path;
    }

    function getOwOScriptSrc() {
        const fromConfig = PS && PS.config && PS.config.assets && PS.config.assets.owo
            ? String(PS.config.assets.owo)
            : '';

        if (fromConfig) return fromConfig;
        return resolveUrl('/js/OwO.min.js');
    }

    function loadScriptOnce(src) {
        if (!src) return Promise.resolve(false);
        if (scriptCache.has(src)) return scriptCache.get(src);

        const promise = new Promise(function (resolve) {
            const found = Array.from(document.getElementsByTagName('script')).find(function (script) {
                return script && script.src === src;
            });

            if (found) {
                if (found.dataset.psLoaded === '1') {
                    resolve(true);
                    return;
                }

                found.addEventListener('load', function () {
                    found.dataset.psLoaded = '1';
                    resolve(true);
                }, { once: true });
                found.addEventListener('error', function () {
                    resolve(false);
                }, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.defer = true;
            script.async = true;
            script.addEventListener('load', function () {
                script.dataset.psLoaded = '1';
                resolve(true);
            }, { once: true });
            script.addEventListener('error', function () {
                resolve(false);
            }, { once: true });
            document.head.appendChild(script);
        });

        scriptCache.set(src, promise);
        return promise;
    }

    function getRespondElement(scope) {
        const root = scope && scope.querySelector ? scope : document;
        return root.querySelector('.respond') || document.querySelector('.respond');
    }

    function getCommentFormElement(scope) {
        const root = scope && scope.querySelector ? scope : document;
        return root.querySelector('#cf') || document.getElementById('cf');
    }

    function getCommentsListElement(scope) {
        const root = scope && scope.querySelector ? scope : document;
        return root.querySelector('#comments-list') || document.getElementById('comments-list');
    }

    function getCommentsRootElement(scope) {
        const root = scope && scope.querySelector ? scope : document;
        return root.querySelector('#comments') || document.getElementById('comments');
    }

    function getCommentTitleElement(scope) {
        const respond = getRespondElement(scope);
        if (!respond) return null;
        return respond.querySelector('.response.comment-title');
    }

    function getCancelReplyElement(scope) {
        const root = scope && scope.querySelector ? scope : document;
        return root.querySelector('#cancel-comment-reply-link') || document.getElementById('cancel-comment-reply-link');
    }

    function getStatusElement(scope) {
        const root = scope && scope.querySelector ? scope : document;
        return root.querySelector('#comment-form-status') || document.getElementById('comment-form-status');
    }

    function getRespondHash(scope) {
        const respond = getRespondElement(scope);
        if (!respond || !respond.id) return '#respond';
        return '#' + respond.id;
    }

    function normalizeCommentHash(rawHash, scope) {
        const respondHash = getRespondHash(scope);
        const hash = String(rawHash || '').trim();
        if (!hash) return '';

        const withPrefix = hash.charAt(0) === '#' ? hash : ('#' + hash);
        const lower = withPrefix.toLowerCase();

        if (lower === '#comments' || lower === '#comment') return '#comments';
        if (lower === '#respond' || lower === respondHash.toLowerCase() || lower.indexOf('#respond-') === 0) return respondHash;

        const listMatch = lower.match(HASH_LIST_COMMENT_RE);
        if (listMatch) return '#comment-' + listMatch[1];

        const commentMatch = lower.match(HASH_COMMENT_RE);
        if (commentMatch) return '#comment-' + commentMatch[1];

        return withPrefix;
    }

    function buildRelativeUrl(urlString) {
        const url = new URL(urlString, window.location.href);
        return url.pathname + url.search;
    }

    function syncAddressBar(urlString, hash, mode, scope) {
        const base = buildRelativeUrl(urlString || window.location.href);
        const normalizedHash = normalizeCommentHash(hash, scope);
        const nextUrl = base + normalizedHash;
        const currentUrl = window.location.pathname + window.location.search + window.location.hash;

        if (nextUrl === currentUrl) return normalizedHash;

        try {
            const method = mode === 'push' ? 'pushState' : 'replaceState';
            const current = history.state && typeof history.state === 'object' ? history.state : {};
            const nextState = Object.assign({}, current, { url: nextUrl, source: current.source || 'ps-comment' });
            if (mode === 'push') nextState.random = Math.random();
            history[method](nextState, document.title, nextUrl);
        } catch (error) {
            if (mode === 'push') window.location.assign(nextUrl);
            else window.location.replace(nextUrl);
        }

        return normalizedHash;
    }

    function markCommentInteractionLinks(scope) {
        const root = scope && scope.querySelector ? scope : document;
        root.querySelectorAll('.page-navigator a[href], .comment-list a[href*="replyTo="]').forEach(function (link) {
            link.setAttribute('data-no-swup', '1');
        });
    }

    function ensureReplyPlaceholder(scope) {
        const respond = getRespondElement(scope);
        if (!respond) return null;

        let holder = document.getElementById('comment-form-place-holder');
        if (!holder) {
            holder = document.createElement('div');
            holder.id = 'comment-form-place-holder';
            if (respond.parentNode) respond.parentNode.insertBefore(holder, respond);
        }
        return holder;
    }

    function ensureParentInput(form) {
        if (!form) return null;

        let input = document.getElementById('comment-parent');
        if (!input) input = form.querySelector('input[name="parent"]');

        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'parent';
            form.appendChild(input);
        }

        input.id = 'comment-parent';
        input.name = 'parent';
        return input;
    }

    function getReplyParentId(form) {
        if (!form) return '';
        const input = form.querySelector('#comment-parent, input[name="parent"]');
        if (!input) return '';
        return String(input.value || '').trim();
    }

    function getReplyPrefix(scope) {
        const root = scope && scope.querySelector ? scope : document;
        const replyLink = root.querySelector('.comment-list .cr a, .comment-list a[href*="replyTo="]');
        const text = replyLink ? String(replyLink.textContent || '').trim() : '';
        return text || 'Reply';
    }

    function getDefaultTitle(titleEl) {
        if (!titleEl) return 'Post a Comment';
        if (!titleEl.dataset.psDefaultTitle) {
            const current = String(titleEl.textContent || '').trim();
            titleEl.dataset.psDefaultTitle = current || 'Post a Comment';
        }
        return titleEl.dataset.psDefaultTitle;
    }

    function getCommentAuthorName(commentEl) {
        if (!commentEl || !commentEl.querySelector) return '';
        const author = commentEl.querySelector('.ca');
        if (!author) return '';
        return String(author.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function getCommentAuthorByParentId(parentId) {
        const normalized = String(parentId || '').trim();
        if (!normalized) return '';
        return getCommentAuthorName(document.getElementById('comment-' + normalized));
    }

    function setFormStatus(scope, message, isActive) {
        const status = getStatusElement(scope);
        if (!status) return;

        const text = String(message || '').trim();
        const lastText = status.dataset.psStatusText || '';
        status.textContent = text;
        status.dataset.psStatusText = text;
        status.classList.toggle('is-active', Boolean(isActive));

        if (text && text !== lastText) {
            status.classList.remove('is-live');
            void status.offsetWidth;
            status.classList.add('is-live');

            if (status._psLiveTimer) {
                clearTimeout(status._psLiveTimer);
            }
            status._psLiveTimer = window.setTimeout(function () {
                status.classList.remove('is-live');
                status._psLiveTimer = 0;
            }, 560);
        }
    }
    function isCommentModerationEnabled(scope) {
        const fromConfig = PS && PS.config && PS.config.features
            ? PS.config.features.commentsRequireModeration
            : null;

        if (typeof fromConfig === 'boolean') {
            return fromConfig;
        }

        const status = getStatusElement(scope);
        if (!status || !status.dataset) return false;
        const value = String(status.dataset.requireModeration || '').trim().toLowerCase();
        return value === '1' || value === 'true' || value === 'on' || value === 'yes';
    }

    function resolveIdleStatus(scope) {
        const form = getCommentFormElement(scope);
        if (!form) return '';

        const authorInput = form.querySelector('#author, input[name="author"]');
        const mailInput = form.querySelector('#mail, input[name="mail"]');

        if (authorInput && mailInput) {
            const author = String(authorInput.value || '').trim();
            const mail = String(mailInput.value || '').trim();
            const moderationEnabled = isCommentModerationEnabled(scope);

            if (author && mail) {
                if (moderationEnabled) {
                    return '欢迎回来，' + author + '。你的评论将在审核后通过';
                }
                return '欢迎回来，' + author + '。可直接发表评论。';
            }
            return '填写昵称和邮箱后即可发表评论。';
        }

        return '已登录，可直接发表评论。';
    }

    function setReplyTitle(authorName, scope) {
        const titleEl = getCommentTitleElement(scope);
        const respond = getRespondElement(scope);
        const cancel = getCancelReplyElement(scope);
        if (!respond) return;

        const displayName = String(authorName || '').trim();

        // Keep the main title static; only drive status line and reply controls.
        if (titleEl) {
            titleEl.classList.remove('is-replying');
            titleEl.textContent = getDefaultTitle(titleEl);
        }
        respond.classList.remove('is-replying');
        if (cancel) cancel.style.display = '';
        setFormStatus(scope, displayName ? ('正在回复 ' + displayName) : '正在回复该评论。', true);
    }

    function restoreDefaultTitle(scope) {
        const titleEl = getCommentTitleElement(scope);
        const respond = getRespondElement(scope);
        const cancel = getCancelReplyElement(scope);
        if (!respond) return;

        if (titleEl) {
            titleEl.textContent = getDefaultTitle(titleEl);
            titleEl.classList.remove('is-replying');
        }
        respond.classList.remove('is-replying');
        if (cancel) cancel.style.display = 'none';
        setFormStatus(scope, resolveIdleStatus(scope), false);
    }

    function syncReplyUiByState(scope) {
        const form = getCommentFormElement(scope);
        const parentId = getReplyParentId(form);
        if (!form || !parentId) {
            restoreDefaultTitle(scope);
            return;
        }
        setReplyTitle(getCommentAuthorByParentId(parentId), scope);
    }

    function collectCommentIds(scope) {
        const root = scope && scope.querySelector ? scope : document;
        return Array.from(root.querySelectorAll('#comments-list div[id^="comment-"]')).map(function (el) { return el.id; });
    }

    function findInsertedCommentId(beforeIds, scope) {
        const before = beforeIds instanceof Set ? beforeIds : new Set(beforeIds || []);
        const after = collectCommentIds(scope);
        for (let i = 0; i < after.length; i += 1) {
            if (!before.has(after[i])) return after[i];
        }
        return '';
    }

    function resolveHashTarget(hash, scope) {
        const normalized = normalizeCommentHash(hash, scope);
        if (!normalized) return null;

        if (normalized === '#comments') return getCommentsRootElement(scope);
        if (normalized === getRespondHash(scope)) return getRespondElement(scope);

        const commentMatch = normalized.match(HASH_COMMENT_RE);
        if (commentMatch) {
            const id = 'comment-' + commentMatch[1];
            return document.getElementById(id) || document.getElementById('li-' + id);
        }

        return document.getElementById(normalized.slice(1));
    }

    function flashCommentTarget(target) {
        if (!target || !target.classList) return;
        const marker = (target.closest && target.closest('li[id^="li-comment-"]')) || target;
        marker.classList.remove('ps-comment-focus');
        void marker.offsetWidth;
        marker.classList.add('ps-comment-focus');
        window.setTimeout(function () {
            marker.classList.remove('ps-comment-focus');
        }, 1500);
    }

    function scrollToHash(hash, options, scope) {
        const cfg = Object.assign({ behavior: 'smooth', highlight: false }, options || {});
        let target = resolveHashTarget(hash, scope);
        if (!target && hash) target = getCommentsRootElement(scope);
        if (!target || typeof target.scrollIntoView !== 'function') return false;

        target.scrollIntoView({ behavior: cfg.behavior, block: 'start' });
        if (cfg.highlight) flashCommentTarget(target);
        return true;
    }

    function normalizeCurrentHash(scope) {
        const normalized = normalizeCommentHash(window.location.hash, scope);
        if (window.location.hash !== normalized) {
            syncAddressBar(window.location.href, normalized, 'replace', scope);
        }
        return normalized;
    }

    function focusCommentTextarea(scope) {
        const respond = getRespondElement(scope);
        if (!respond) return;
        const textarea = respond.querySelector('textarea[name="text"], #textarea');
        if (!textarea || typeof textarea.focus !== 'function') return;
        try {
            textarea.focus({ preventScroll: true });
        } catch (error) {
            textarea.focus();
        }
    }

    function replyToComment(cid, coid, options) {
        const cfg = Object.assign({ syncHash: true }, options || {});
        const comment = document.getElementById(String(cid || '').trim());
        const respond = getRespondElement(document);
        if (!comment || !respond) return false;

        const form = getCommentFormElement(respond);
        if (!form) return false;

        ensureReplyPlaceholder(document);
        const input = ensureParentInput(form);
        if (!input) return false;
        input.value = String(coid || '').trim();

        comment.appendChild(respond);
        setReplyTitle(getCommentAuthorName(comment), document);

        if (cfg.syncHash) {
            syncAddressBar(window.location.href, normalizeCommentHash('#' + String(cid || '').trim(), document) || '#comments', 'replace', document);
        }

        focusCommentTextarea(document);
        return false;
    }

    function cancelReply(options) {
        const cfg = Object.assign({ syncHash: false, hash: '#comments' }, options || {});
        const respond = getRespondElement(document);
        const holder = document.getElementById('comment-form-place-holder');
        const input = document.getElementById('comment-parent');

        if (input && input.parentNode) input.parentNode.removeChild(input);
        if (respond && holder && holder.parentNode) holder.parentNode.insertBefore(respond, holder);

        restoreDefaultTitle(document);

        if (cfg.syncHash) {
            syncAddressBar(window.location.href, cfg.hash, 'replace', document);
        }

        return false;
    }

    function patchTypechoComment() {
        if (typechoCommentPatched) return;
        typechoCommentPatched = true;

        const reply = function (cid, coid) {
            return replyToComment(cid, coid, { syncHash: true });
        };

        const cancel = function () {
            return cancelReply({ syncHash: true, hash: '#comments' });
        };

        if (window.TypechoComment && typeof window.TypechoComment === 'object') {
            window.TypechoComment.reply = reply;
            window.TypechoComment.cancelReply = cancel;
            return;
        }

        window.TypechoComment = { reply: reply, cancelReply: cancel };
    }

    function createLifecycleState() {
        return {
            disposed: false,
            controllers: new Set(),
            submitting: false,
            paging: false
        };
    }

    function trackedFetch(url, options, lifecycle) {
        const controller = new AbortController();
        const requestOptions = Object.assign({}, options || {}, { signal: controller.signal });

        if (lifecycle && lifecycle.controllers) lifecycle.controllers.add(controller);
        return fetch(url, requestOptions).finally(function () {
            if (lifecycle && lifecycle.controllers) lifecycle.controllers.delete(controller);
        });
    }

    function abortTrackedFetch(lifecycle) {
        if (!lifecycle || !lifecycle.controllers) return;
        lifecycle.controllers.forEach(function (controller) {
            try {
                controller.abort();
            } catch (error) { }
        });
        lifecycle.controllers.clear();
    }

    async function refreshCommentsFromUrl(urlString, options, lifecycle) {
        const cfg = Object.assign({
            restoreScroll: false,
            resetReply: false,
            beforeIds: null
        }, options || {});

        const list = getCommentsListElement(document);
        if (!list || !isSameOriginUrl(urlString)) return null;

        const requestUrl = new URL(urlString, window.location.href);
        const sourceHash = normalizeCommentHash(requestUrl.hash, document);
        requestUrl.hash = '';

        const beforeY = window.scrollY || window.pageYOffset || 0;
        const activeId = document.activeElement && document.activeElement.id ? document.activeElement.id : '';
        const beforeIds = cfg.beforeIds instanceof Set ? cfg.beforeIds : new Set(collectCommentIds(document));

        if (cfg.resetReply) {
            cancelReply({ syncHash: false });
        }

        list.classList.add('is-loading');
        try {
            const response = await trackedFetch(requestUrl.toString(), {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'text/html,*/*;q=0.8'
                }
            }, lifecycle);

            if (!response.ok) return null;
            if (lifecycle && lifecycle.disposed) return null;

            const html = await response.text();
            if (lifecycle && lifecycle.disposed) return null;

            const doc = new DOMParser().parseFromString(html, 'text/html');
            const nextList = doc.getElementById('comments-list');
            if (!nextList) return null;

            const currentList = getCommentsListElement(document);
            if (!currentList) return null;
            currentList.replaceWith(nextList);

            markCommentInteractionLinks(document);
            syncReplyUiByState(document);

            if (cfg.restoreScroll) {
                window.scrollTo(0, beforeY);
            }

            if (activeId) {
                const activeEl = document.getElementById(activeId);
                if (activeEl && typeof activeEl.focus === 'function') {
                    try {
                        activeEl.focus({ preventScroll: true });
                    } catch (error) {
                        activeEl.focus();
                    }
                }
            }

            const baseUrl = requestUrl.pathname + requestUrl.search;
            const insertedId = findInsertedCommentId(beforeIds, document);
            return { baseUrl: baseUrl, sourceHash: sourceHash, insertedId: insertedId };
        } finally {
            const latestList = getCommentsListElement(document);
            if (latestList) latestList.classList.remove('is-loading');
        }
    }

    function extractCommentHashFromData(data) {
        if (!data || typeof data !== 'object') return '';
        const commentObj = data.comment && typeof data.comment === 'object' ? data.comment : null;
        const coid = commentObj && (commentObj.coid || commentObj.id || commentObj.commentId);
        if (!coid) return '';
        return normalizeCommentHash('#comment-' + String(coid), document);
    }

    function isSubmitSuccess(data) {
        if (!data || typeof data !== 'object') return false;
        if (data.success === true || data.success === 1) return true;
        if (data.status === true || data.status === 1 || data.status === 'success') return true;
        if (data.code === 0 || data.result === 'ok') return true;
        return false;
    }

    function setBusyButton(form, label) {
        const submit = form.querySelector('#submit, button[type="submit"], input[type="submit"]');
        if (!submit) return function noop() { };

        if (!form.dataset.psSubmitText) {
            form.dataset.psSubmitText = submit.tagName === 'INPUT' ? submit.value : submit.textContent;
        }

        const prevDisabled = submit.disabled;
        const prevText = submit.tagName === 'INPUT' ? submit.value : submit.textContent;
        submit.disabled = true;

        if (submit.tagName === 'INPUT') submit.value = label;
        else submit.textContent = label;

        return function restoreButton() {
            submit.disabled = prevDisabled;
            if (submit.tagName === 'INPUT') submit.value = prevText;
            else submit.textContent = prevText;
        };
    }

    function resetSubmitState(form) {
        if (!form) return;
        const submit = form.querySelector('#submit, button[type="submit"], input[type="submit"]');
        if (!submit) return;

        const original = form.dataset.psSubmitText || (submit.tagName === 'INPUT' ? submit.value : submit.textContent);
        submit.disabled = false;
        if (submit.tagName === 'INPUT') submit.value = original;
        else submit.textContent = original;
        form.dataset.psSubmitting = '0';
    }

    function bindPageshowReset() {
        if (pageshowBound) return;
        pageshowBound = true;

        window.addEventListener('pageshow', function () {
            const form = getCommentFormElement(document);
            if (!form || form.dataset.psSubmitting !== '1') return;
            resetSubmitState(form);
        });
    }

    function fallbackNavigate(url) {
        if (PS && PS.swup && typeof PS.swup.navigate === 'function') {
            PS.swup.navigate(url);
            return;
        }
        window.location.href = url;
    }

    async function handleCommentSubmit(form, lifecycle) {
        if (!form || lifecycle.submitting) return;

        const action = form.getAttribute('action') || window.location.href;
        if (!isSameOriginUrl(action)) return;

        lifecycle.submitting = true;
        form.dataset.psSubmitting = '1';
        setFormStatus(document, '正在提交评论...', true);

        const replyParentId = getReplyParentId(form);
        const beforeIds = new Set(collectCommentIds(document));
        const restoreButton = setBusyButton(form, '提交中...');

        try {
            const response = await trackedFetch(action, {
                method: 'POST',
                body: new FormData(form),
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/html;q=0.9,*/*;q=0.8'
                }
            }, lifecycle);

            if (!response.ok) {
                showToast('评论提交失败，请稍后重试！', 'error');
                return;
            }

            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            let message = '评论已提交~';
            let refreshUrl = buildRelativeUrl(window.location.href);
            let commentHash = '';

            if (contentType.indexOf('application/json') > -1) {
                const data = await response.json().catch(function () {
                    return null;
                });

                if (!isSubmitSuccess(data)) {
                    const reason = data && (data.message || data.error)
                        ? String(data.message || data.error)
                        : '评论提交失败！';
                    showToast(reason, 'error');
                    return;
                }

                if (data && data.message) message = String(data.message);

                const redirect = data && (
                    data.redirect
                    || data.url
                    || data.permalink
                    || (data.comment && data.comment.permalink)
                );

                if (redirect && isSameOriginUrl(redirect)) {
                    const redirectUrl = new URL(redirect, window.location.href);
                    commentHash = normalizeCommentHash(redirectUrl.hash, document);
                    redirectUrl.hash = '';
                    refreshUrl = redirectUrl.toString();
                }

                if (!commentHash) commentHash = extractCommentHashFromData(data);
            } else {
                const responseUrl = response.url && isSameOriginUrl(response.url) ? response.url : window.location.href;
                const parsed = new URL(responseUrl, window.location.href);
                commentHash = normalizeCommentHash(parsed.hash, document);
                parsed.hash = '';
                refreshUrl = parsed.toString();
            }

            const refreshed = await refreshCommentsFromUrl(refreshUrl, {
                restoreScroll: false,
                resetReply: true,
                beforeIds: beforeIds
            }, lifecycle);

            if (!refreshed) {
                fallbackNavigate(buildRelativeUrl(refreshUrl) + (commentHash || '#comments'));
                return;
            }

            const textarea = form.querySelector('textarea[name="text"], #textarea');
            if (textarea) textarea.value = '';

            let finalHash = commentHash;
            if (!resolveHashTarget(finalHash, document)) {
                if (refreshed.insertedId) finalHash = '#' + refreshed.insertedId;
                else if (replyParentId) finalHash = normalizeCommentHash('#comment-' + replyParentId, document);
                else finalHash = '#comments';
            }

            const syncedHash = syncAddressBar(refreshed.baseUrl, finalHash, 'replace', document);
            scrollToHash(syncedHash || '#comments', { behavior: 'smooth', highlight: true }, document);
            showToast(message, 'success');
            setFormStatus(document, '评论已提交，已刷新并定位~', true);
        } catch (error) {
            if (error && error.name === 'AbortError') return;
            showToast('评论提交失败，请稍后重试！', 'error');
            setFormStatus(document, '提交失败，请稍后重试！', true);
        } finally {
            restoreButton();
            form.dataset.psSubmitting = '0';
            lifecycle.submitting = false;
            if (!getReplyParentId(form)) {
                window.setTimeout(function () {
                    if (lifecycle.disposed) return;
                    setFormStatus(document, resolveIdleStatus(document), false);
                }, 900);
            }
        }
    }

    async function handleCommentPageClick(link, lifecycle) {
        if (!link || lifecycle.paging) return;
        const href = link.getAttribute('href');
        if (!href) return;

        lifecycle.paging = true;
        const navigator = link.closest('.page-navigator');
        if (navigator) navigator.classList.add('loading');
        setFormStatus(document, '正在切换评论页...', true);

        try {
            const refreshed = await refreshCommentsFromUrl(href, {
                restoreScroll: false,
                resetReply: true
            }, lifecycle);

            if (!refreshed) {
                fallbackNavigate(href);
                return;
            }

            const linkUrl = new URL(href, window.location.href);
            const hashFromLink = normalizeCommentHash(linkUrl.hash || '#comments', document);
            const syncedHash = syncAddressBar(refreshed.baseUrl, hashFromLink || '#comments', 'push', document);

            const scrolled = scrollToHash(syncedHash, { behavior: 'smooth', highlight: false }, document);
            if (!scrolled) {
                const fallback = getCommentsRootElement(document);
                if (fallback && typeof fallback.scrollIntoView === 'function') {
                    fallback.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
            setFormStatus(document, resolveIdleStatus(document), false);
        } finally {
            if (navigator) navigator.classList.remove('loading');
            lifecycle.paging = false;
        }
    }

    function bindCommentForm(form, lifecycle) {
        if (!form || formHandlers.has(form)) {
            return formHandlers.get(form) || function noop() { };
        }

        bindPageshowReset();
        form.dataset.psSubmitting = '0';

        const onSubmit = function (event) {
            event.preventDefault();
            if (form.dataset.psSubmitting === '1') return;
            handleCommentSubmit(form, lifecycle);
        };

        const onInvalid = function () {
            resetSubmitState(form);
        };

        form.addEventListener('submit', onSubmit);
        form.addEventListener('invalid', onInvalid, true);

        const cleanup = function cleanupCommentForm() {
            form.removeEventListener('submit', onSubmit);
            form.removeEventListener('invalid', onInvalid, true);
            formHandlers.delete(form);
            resetSubmitState(form);
        };

        formHandlers.set(form, cleanup);
        return cleanup;
    }

    function bindFormStatusWatcher(form, scope) {
        if (!form) return function noop() { };

        const authorInput = form.querySelector('#author, input[name="author"]');
        const mailInput = form.querySelector('#mail, input[name="mail"]');
        if (!authorInput && !mailInput) return function noop() { };

        const onInput = function () {
            if (getReplyParentId(form)) return;
            setFormStatus(scope, resolveIdleStatus(scope), false);
        };

        if (authorInput) {
            authorInput.addEventListener('input', onInput);
            authorInput.addEventListener('change', onInput);
        }
        if (mailInput) {
            mailInput.addEventListener('input', onInput);
            mailInput.addEventListener('change', onInput);
        }

        return function cleanupFormStatusWatcher() {
            if (authorInput) {
                authorInput.removeEventListener('input', onInput);
                authorInput.removeEventListener('change', onInput);
            }
            if (mailInput) {
                mailInput.removeEventListener('input', onInput);
                mailInput.removeEventListener('change', onInput);
            }
        };
    }

    function bindCommentPagination(scope, lifecycle) {
        if (!scope || !scope.addEventListener) return function noop() { };

        const onClick = function (event) {
            const target = event.target && event.target.closest ? event.target.closest('a[href]') : null;
            if (!target || !scope.contains(target)) return;

            const navLink = target.closest('.page-navigator a[href]');
            if (!navLink) return;
            if (!isPrimaryAction(event)) return;

            event.preventDefault();
            event.stopPropagation();
            handleCommentPageClick(navLink, lifecycle);
        };

        scope.addEventListener('click', onClick, true);
        return function cleanupCommentPagination() {
            scope.removeEventListener('click', onClick, true);
        };
    }

    function bindCommentHashSync(scope, context) {
        const onHashChange = function () {
            const normalized = normalizeCurrentHash(scope);
            if (!normalized) return;

            const isCommentTarget = normalized === '#comments'
                || normalized === getRespondHash(scope)
                || HASH_COMMENT_RE.test(normalized);

            if (isCommentTarget) {
                scrollToHash(normalized, { behavior: 'smooth', highlight: HASH_COMMENT_RE.test(normalized) }, scope);
            }
        };

        window.addEventListener('hashchange', onHashChange);

        const normalized = normalizeCurrentHash(scope);
        if (normalized) {
            const behavior = context && context.isSwup ? 'smooth' : 'auto';
            window.requestAnimationFrame(function () {
                scrollToHash(normalized, { behavior: behavior, highlight: false }, scope);
            });
        }

        return function cleanupHashSync() {
            window.removeEventListener('hashchange', onHashChange);
        };
    }

    function initOwo(scope) {
        const panel = scope.querySelector('.OwO[data-owo-ssr]');
        if (!panel) return Promise.resolve(null);

        const src = getOwOScriptSrc();
        return loadScriptOnce(src).then(function (ok) {
            if (!ok || !window.OwoManager || typeof window.OwoManager.init !== 'function') return null;
            window.OwoManager.init({ force: true });

            return function cleanupOwo() {
                if (!window.OwoManager || typeof window.OwoManager.destroy !== 'function') return;
                window.OwoManager.destroy();
            };
        }).catch(function () {
            return null;
        });
    }

    function init(root, context) {
        const scope = root && root.querySelector ? root : document;
        const cleanups = [];
        const lifecycle = createLifecycleState();

        patchTypechoComment();
        markCommentInteractionLinks(scope);
        ensureReplyPlaceholder(scope);
        syncReplyUiByState(scope);

        cleanups.push(bindCommentPagination(scope, lifecycle));
        cleanups.push(bindCommentHashSync(scope, context || {}));

        const form = getCommentFormElement(scope);
        if (form) {
            cleanups.push(bindCommentForm(form, lifecycle));
            cleanups.push(bindFormStatusWatcher(form, scope));
            if (context && context.isSwup) resetSubmitState(form);
            if (!getReplyParentId(form)) {
                setFormStatus(scope, resolveIdleStatus(scope), false);
            }
        }

        initOwo(scope).then(function (cleanup) {
            if (typeof cleanup !== 'function') return;
            if (lifecycle.disposed) {
                safeRun(cleanup);
                return;
            }
            cleanups.push(cleanup);
        });

        return function cleanupCommentModule() {
            lifecycle.disposed = true;
            abortTrackedFetch(lifecycle);
            for (let i = cleanups.length - 1; i >= 0; i -= 1) {
                safeRun(cleanups[i]);
            }
        };
    }

    window.PS_COMMENT = {
        init: init
    };
})(window, document);
