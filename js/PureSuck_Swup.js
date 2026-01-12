/**
 * PureSuck Swup 4 配置
 * 包含完整的页面过渡动画逻辑
 */

(function() {
    'use strict';

    const NAV_STATE = {
        isSwupNavigating: false
    };

    let PAGE_VIEW_TOKEN = 0;
    const LAST_POST = {
        key: null,
        fromSingle: false
    };

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

    const HAS_VT = supportsViewTransitions();

    const IDLE = {
        scheduled: false,
        queue: [],
        timeout: 800,
        budgetMs: 12
    };
    const BREATH = {
        phaseGapMs: 140,
        batchGapMs: 90
    };

    function scheduleIdleDrain() {
        if (IDLE.scheduled) return;
        IDLE.scheduled = true;

        const run = (deadline) => {
            const start = Date.now();

            while (IDLE.queue.length) {
                const task = IDLE.queue.shift();
                try {
                    task();
                } catch (err) {
                    console.error('[Swup] Idle task error:', err);
                }

                if (deadline && typeof deadline.timeRemaining === 'function') {
                    if (deadline.timeRemaining() < 8) break;
                } else if (Date.now() - start > IDLE.budgetMs) {
                    break;
                }
            }

            IDLE.scheduled = false;
            if (IDLE.queue.length) scheduleIdleDrain();
        };

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(run, { timeout: IDLE.timeout });
        } else {
            setTimeout(run, 0);
        }
    }

    function scheduleIdleTask(task) {
        if (typeof task !== 'function') return;
        IDLE.queue.push(task);
        scheduleIdleDrain();
    }

    function schedulePhasedTasks(phases, shouldContinue, gapMs = BREATH.phaseGapMs) {
        if (!Array.isArray(phases) || !phases.length) return;
        let index = 0;
        const runNext = () => {
            if (typeof shouldContinue === 'function' && !shouldContinue()) return;
            const phase = phases[index++];
            if (typeof phase !== 'function') return;
            scheduleIdleTask(() => {
                if (typeof shouldContinue === 'function' && !shouldContinue()) return;
                phase();
                if (index < phases.length) {
                    setTimeout(runNext, gapMs);
                }
            });
        };
        runNext();
    }

    function scheduleIdleBatched(items, batchSize, handler, shouldContinue) {
        if (!items || !items.length || typeof handler !== 'function') return;
        let index = 0;
        const total = items.length;

        const runBatch = () => {
            if (typeof shouldContinue === 'function' && !shouldContinue()) return;
            const end = Math.min(total, index + batchSize);
            for (; index < end; index++) {
                handler(items[index], index);
            }
            if (index < total) {
                scheduleIdleTask(runBatch);
            }
        };

        scheduleIdleTask(runBatch);
    }

    const VISIBILITY = {
        io: null,
        observed: new WeakSet(),
        seen: new WeakSet(),
        visible: new WeakSet(),
        init() {
            if (this.io || typeof IntersectionObserver !== 'function') return;
            this.io = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    const el = entry.target;
                    this.seen.add(el);
                    if (entry.isIntersecting) this.visible.add(el);
                    else this.visible.delete(el);
                }
            }, { rootMargin: '200px 0px', threshold: 0.01 });
        },
        observe(el) {
            if (!this.io || !el || this.observed.has(el)) return;
            this.observed.add(el);
            this.io.observe(el);
        },
        get(el) {
            if (!this.io || !el) return null;
            if (!this.seen.has(el)) return null;
            return this.visible.has(el);
        },
        // ✅ 优化：只断开观察，不重建 WeakSet（GC 会自动清理）
        reset() {
            if (!this.io) return;
            this.io.disconnect();
            // WeakSet 会被 GC 自动清理，无需手动重建
            // 只需重新初始化 IO
            this.init();
        }
    };

    VISIBILITY.init();

    function getPostTransitionName(postKey) {
        const safeKey = encodeURIComponent(String(postKey || '')).replace(/%/g, '_');
        return `ps-post-${safeKey}`;
    }

    function getSwupRoot() {
        return document.getElementById('swup') || document;
    }

    function getPostKeyFromElement(el) {
        if (!el) return null;
        if (el.dataset && el.dataset.psPostKey) return el.dataset.psPostKey;
        return el.getAttribute('data-ps-post-key') || null;
    }

    function rememberLastPostKey(postKey) {
        if (!postKey) return;
        const state = (history.state && typeof history.state === 'object') ? history.state : {};
        if (state.lastPostKey === postKey) return;
        history.replaceState({ ...state, lastPostKey: postKey }, document.title);
        LAST_POST.key = postKey;
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

    function applyPostSharedElementName(el, postKey) {
        if (!HAS_VT || !el || !postKey) return;

        const name = getPostTransitionName(postKey);
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

    function findIndexPostCardById(postKey) {
        if (!postKey) return null;

        const cards = getSwupRoot().querySelectorAll('.post.post--index');
        for (const card of cards) {
            const cardKey = getPostKeyFromElement(card);
            if (cardKey === postKey) return card;
        }

        return null;
    }

    // ========== 动画类型检测 ==========
    function getPageType(url) {
        const swupRoot = document.getElementById('swup');
        const dataType = swupRoot && swupRoot.dataset ? swupRoot.dataset.psPageType : '';
        if (dataType === 'post') return 'post';
        if (dataType === 'page') return 'post';
        if (dataType === 'list') return 'list';
        return 'list';
    }

    function waitForViewTransition() {
        if (!HAS_VT || typeof document.getAnimations !== 'function') return Promise.resolve();
        const animations = document.getAnimations({ subtree: true });
        const vtAnimations = animations.filter((anim) => {
            const target = anim && anim.effect ? anim.effect.target : null;
            const text = target && typeof target.toString === 'function' ? target.toString() : '';
            return text.includes('view-transition');
        });
        if (!vtAnimations.length) return Promise.resolve();
        return Promise.allSettled(vtAnimations.map((anim) => anim.finished));
    }
    // ========== 添加动画属性到元素 ==========
    function markAnimationElements(root = document) {
        const scope = root && root.querySelector ? root : document;
        // 标记文章卡片
        scope.querySelectorAll('.post:not([data-swup-animation])').forEach(el => {
            el.setAttribute('data-swup-animation', '');
            VISIBILITY.observe(el);
        });

        // 标记分页器
        const pager = scope.querySelector('.main-pager');
        if (pager && !pager.hasAttribute('data-swup-animation')) {
            pager.setAttribute('data-swup-animation', '');
            VISIBILITY.observe(pager);
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

	    function psToast(message, variant) {
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

	    function isSameOriginUrl(urlString) {
	        try {
	            const url = new URL(urlString, window.location.origin);
	            return url.origin === window.location.origin;
	        } catch {
	            return false;
	        }
	    }

	    function buildGetUrlFromForm(form) {
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

	    function isSearchForm(form) {
	        if (!form || form.nodeName !== 'FORM') return false;
	        if (form.matches('form.search-container, form[role=\"search\"], form[data-ps-search]')) return true;
	        return Boolean(form.querySelector('input[name=\"s\"]'));
	    }

	    function isTypechoCommentForm(form) {
	        if (!form || form.nodeName !== 'FORM') return false;
	        if (form.id === 'cf') return true;
	        if (form.matches('form[no-pjax]') && form.querySelector('textarea[name=\"text\"]')) return true;
	        return false;
	    }

	    function setFormBusyState(form, busy, label) {
	        const submit = form.querySelector('button[type=\"submit\"], input[type=\"submit\"], button.submit, #submit');
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

    async function refreshCommentsFromUrl(urlString) {
        const current = document.getElementById('comments');
        if (!current) return false;

	        if (!isSameOriginUrl(urlString)) return false;

	        // Preserve current scroll + focus (stay in place).
	        const prevScrollY = window.scrollY;
	        const active = document.activeElement;
	        const activeId = active && active.id ? active.id : null;

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

	        // Restore scroll position and try to keep focus (preventScroll to avoid jumps).
	        window.scrollTo(0, prevScrollY);
	        if (activeId) {
	            const el = document.getElementById(activeId);
	            if (el && typeof el.focus === 'function') {
	                try { el.focus({ preventScroll: true }); } catch { el.focus(); }
	            }
	        }

        // Re-init comment widgets after DOM replacement.
        scheduleCommentsInit(document, { eager: true });

        return true;
    }

    function scheduleCommentsInit(root, options = {}) {
        if (typeof initializeCommentsOwO !== 'function') return;
        const scope = root && root.querySelector ? root : document;
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

        if (options.eager || window.location.hash === '#comments' || document.activeElement === commentTextarea) {
            scheduleIdleTask(runInit);
            return;
        }

        if (typeof IntersectionObserver !== 'function') {
            scheduleIdleTask(runInit);
            return;
        }

        const io = new IntersectionObserver((entries, observer) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    observer.disconnect();
                    scheduleIdleTask(runInit);
                    break;
                }
            }
        }, { rootMargin: '200px 0px', threshold: 0.01 });

        io.observe(commentsRoot);
    }

    // ========== Light enter animation (post/page/list) (avoid View Transition conflicts) ==========
    const LIGHT_ENTER = {
        maxItemsPost: 24,
        maxItemsPage: 18,
        maxItemsList: 14,
        duration: 320,
        stagger: 28,
        y: 10,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        vtMs: 500,         // keep in sync with ensureSharedElementTransitionCSS()
        vtLeadMs: 80,      // start a bit before VT ends (feels faster, still safe)
        lastHref: '',
        lastAt: 0,
        // List cards: closer to animate.css `fadeInUp` (but in px, not 100%).
        listDuration: 500,
        listStagger: 80,
        listY: 60,
        // animate.css default easing: cubic-bezier(0.215, 0.61, 0.355, 1)
        listEasing: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
        batchSize: 8,
        batchGap: 90,
        listBatchSize: 6,
        listBatchGap: 120,
        // Track last navigation direction (so we can avoid stacking animations).
        lastFromType: null,
        lastToType: null,
        lastToUrl: '',
        lastIsSwup: false
    };

    function prefersReducedMotion() {
        return typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function isHomeUrl(urlString) {
        try {
            const url = new URL(urlString, window.location.origin);
            const path = url.pathname || '/';
            return path === '/'
                || path === '/index.php'
                || path === '/index.html'
                || path === '/index.htm';
        } catch {
            return false;
        }
    }

    function isAnimatableElement(el) {
        return el && el.nodeType === 1 && el.matches && !el.matches('script, style, link, meta');
    }

    function isElementVisible(el) {
        if (!el) return false;

        // ✅ 优先使用 IntersectionObserver 缓存（异步，不触发布局）
        const cached = VISIBILITY.get(el);
        if (cached !== null) return cached;

        // ✅ 添加到观察器（异步，不会立即阻塞）
        VISIBILITY.observe(el);

        // ✅ 避免同步布局读取（让浏览器喘气），先保留动画目标
        return true;
    }

    function uniqElements(arr) {
        const out = [];
        const seen = new Set();
        for (const el of arr || []) {
            if (!el || seen.has(el)) continue;
            seen.add(el);
            out.push(el);
        }
        return out;
    }

    function takeVisibleElements(elements, limit, out, seen, skipEl) {
        const max = typeof limit === 'number' ? limit : Infinity;
        const target = out || [];
        const used = seen || new Set();

        for (const el of elements || []) {
            if (!el || el === skipEl || used.has(el)) continue;
            used.add(el);
            if (!isAnimatableElement(el)) continue;
            if (!isElementVisible(el)) continue;
            target.push(el);
            if (target.length >= max) break;
        }

        return { items: target, seen: used };
    }

    function getPostContentContainer() {
        const scope = getSwupRoot();
        return scope.querySelector('.post.post--single .post-content')
            || scope.querySelector('.post.post--single .post-body')
            || scope.querySelector('.post-content')
            || scope.querySelector('.post-body');
    }

    function resolvePostEnterRoot(container) {
        if (!container) return null;
        const children = Array.from(container.children || []).filter((el) => el && el.nodeType === 1);
        if (children.length === 1) {
            const only = children[0];
            if (only && only.matches && only.matches('.post-body, .post-content, article, .entry-content')) return only;
        }
        return container;
    }

    function collectPostEnterTargets(container) {
        // Prefer richer, "post-inner" ordering for post pages (title/meta/content/license...).
        const scope = getSwupRoot();
        const postBody = scope.querySelector('.post.post--single .post-body');
        if (postBody) {
            const selector = [
                '.post-meta',
                '.post-content > *',
                '.protected-block',
                '.license-info-card'
            ].join(',');

            const maxItems = LIGHT_ENTER.maxItemsPost;
            const reserveBelow = 8;

            const bodyTargets = takeVisibleElements(
                postBody.querySelectorAll(selector),
                maxItems
            ).items;

            const commentsRoot = scope.querySelector('.post.post--single .post-comments')
                || scope.querySelector('.post-comments');
            const belowTargets = [];

            if (commentsRoot) {
                const commentsSelector = [
                    '#comments > .comment-title',
                    '#comments > .comment-list > li',
                    '#comments > .page-navigator',
                    '#comments > .respond'
                ].join(',');

                takeVisibleElements(
                    commentsRoot.querySelectorAll(commentsSelector),
                    reserveBelow,
                    belowTargets
                );

                // Fallback (e.g. protected posts where comments are hidden)
                if (!belowTargets.length) {
                    takeVisibleElements(
                        commentsRoot.querySelectorAll('.post-wrapper > *'),
                        6,
                        belowTargets
                    );
                }
            }

            const pager = scope.querySelector('.main-pager');
            if (pager && isElementVisible(pager)) belowTargets.push(pager);

            if (bodyTargets.length || belowTargets.length) {
                const belowUnique = uniqElements(belowTargets);
                const belowCap = Math.min(reserveBelow, belowUnique.length);
                const bodyCap = Math.max(0, maxItems - belowCap);

                const picked = uniqElements([
                    ...bodyTargets.slice(0, bodyCap),
                    ...belowUnique
                ]);

                return picked.slice(0, maxItems);
            }
        }

        const root = resolvePostEnterRoot(container);
        if (!root) return [];
        return takeVisibleElements(
            Array.from(root.children || []),
            LIGHT_ENTER.maxItemsPost
        ).items;
    }

    function collectPageEnterTargets() {
        const scope = getSwupRoot();
        const main = scope.querySelector('main.main') || scope.querySelector('#swup');
        if (!main) return [];

        // A Typecho "page" (about/links/archives...) uses `post--index` but not `post--single`.
        const pageArticle = main.querySelector('.post.post--index.main-item:not(.post--single)');
        if (!pageArticle) return [];

        const postBody = pageArticle.querySelector('.post-body') || pageArticle;
        const wrapper = postBody.querySelector('.post-wrapper') || postBody;

        const inner = wrapper.querySelector('.inner-post-wrapper');
        const targets = [];

        const take = (els, limit = Infinity) => {
            if (!els || !els.length) return;
            for (const el of els) {
                if (!isAnimatableElement(el) || !isElementVisible(el)) continue;
                targets.push(el);
                if (targets.length >= limit) return;
            }
        };

        const title = wrapper.querySelector('.post-title');
        if (title && isElementVisible(title)) targets.push(title);

        // Prefer "block" level segments first (gives natural reading order).
        if (inner && inner.children && inner.children.length) {
            take(Array.from(inner.children));
        } else if (wrapper.children && wrapper.children.length) {
            take(Array.from(wrapper.children));
        }

        // If the page only has a few big blocks, refine into more granular items for a visible stagger:
        // - tag clouds: `.cloud-item`
        // - archives timeline: `.timeline-item`
        // - generic section bodies: direct children
        const unique = uniqElements(targets);
        if (unique.length <= 4) {
            const refined = [];
            const cloudItems = Array.from(pageArticle.querySelectorAll('.cloud-container > .cloud-item')).slice(0, 10);
            const timelineYears = Array.from(pageArticle.querySelectorAll('.timeline-year')).slice(0, 6);
            const timelineItems = Array.from(pageArticle.querySelectorAll('#timeline .timeline-item')).slice(0, 12);
            const sectionBodyChildren = Array.from(pageArticle.querySelectorAll('.section-body > *')).slice(0, 10);

            refined.push(...cloudItems, ...timelineYears, ...timelineItems, ...sectionBodyChildren);
            take(uniqElements(refined), LIGHT_ENTER.maxItemsPage);
        }

        // Include comments area (match post page behavior).
        const commentsRoot = scope.querySelector('.post.post--single .post-comments')
            || scope.querySelector('.post-comments');
        if (commentsRoot) {
            const commentsSelector = [
                '#comments > .comment-title',
                '#comments > .comment-list > li',
                '#comments > .page-navigator',
                '#comments > .respond'
            ].join(',');
            takeVisibleElements(
                commentsRoot.querySelectorAll(commentsSelector),
                8,
                targets
            );
        }

        const pager = scope.querySelector('.main-pager');
        if (pager && isElementVisible(pager)) targets.push(pager);

        return uniqElements(targets)
            .slice(0, LIGHT_ENTER.maxItemsPage);
    }

    function collectListEnterTargets() {
        const scope = getSwupRoot();
        const main = scope.querySelector('main.main') || scope.querySelector('#swup');
        if (!main) return [];

        const wrapper = main.querySelector('.wrapper') || main;

        const targets = [];
        const archiveTitle = wrapper.querySelector('.archive-title');
        if (archiveTitle) targets.push(archiveTitle);

        // Prefer animating the cards as a whole (avoid animating deep children).
        if (wrapper.children && wrapper.children.length) {
            for (const child of wrapper.children) {
                if (!child || !child.classList) continue;
                if (child.classList.contains('post') && child.classList.contains('post--index')) {
                    targets.push(child);
                }
            }
        } else {
            targets.push(...Array.from(wrapper.querySelectorAll('.post.post--index')));
        }

        const pager = main.querySelector('.main-pager');
        if (pager) targets.push(pager);
        const lastInfo = main.querySelector('.main-lastinfo');
        if (lastInfo) targets.push(lastInfo);

        const vtMarker = main.querySelector(`[${VT.markerAttr}]`);
        const vtEl = vtMarker ? vtMarker.closest('.post') : null;

        return takeVisibleElements(
            uniqElements(targets),
            LIGHT_ENTER.maxItemsList,
            [],
            new Set(),
            vtEl
        ).items;
    }

    function animateLightEnter(targets, baseDelay = 0, options = {}) {
        if (!targets || !targets.length) return;

        const duration = options.duration ?? LIGHT_ENTER.duration;
        const stagger = options.stagger ?? LIGHT_ENTER.stagger;
        const y = options.y ?? LIGHT_ENTER.y;
        const easing = options.easing ?? LIGHT_ENTER.easing;
        const batchSize = options.batchSize ?? 8;
        const batchGap = options.batchGap ?? BREATH.batchGapMs;

        let index = 0;
        const total = targets.length;

        const runBatch = () => {
            const batch = targets.slice(index, index + batchSize);
            if (!batch.length) return;

            batch.forEach((el) => {
                el.style.willChange = 'transform, opacity';
                el.style.opacity = '0';
                el.style.transform = `translate3d(0, ${y}px, 0)`;
            });

            requestAnimationFrame(() => {
                batch.forEach((el, batchIndex) => {
                    const absoluteIndex = index + batchIndex;
                    const anim = el.animate(
                        [
                            { opacity: 0, transform: `translate3d(0, ${y}px, 0)` },
                            { opacity: 1, transform: 'translate3d(0, 0, 0)' }
                        ],
                        {
                            duration,
                            easing,
                            delay: baseDelay + absoluteIndex * stagger,
                            fill: 'both'
                        }
                    );

                    const cleanup = () => {
                        el.style.willChange = '';
                        el.style.opacity = '';
                        el.style.transform = '';
                    };
                    anim.onfinish = cleanup;
                    anim.oncancel = cleanup;
                });
            });

            index += batchSize;
            if (index < total) {
                setTimeout(runBatch, batchGap);
            }
        };

        runBatch();
    }

    function runLightEnterAnimation() {
        if (prefersReducedMotion()) return;
        if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') return;

        const pageType = getPageType(window.location.href);
        if (pageType !== 'post' && pageType !== 'list') return;

        const href = window.location.href;
        const now = Date.now();
        if (LIGHT_ENTER.lastHref === href && now - LIGHT_ENTER.lastAt < 200) return;
        LIGHT_ENTER.lastHref = href;
        LIGHT_ENTER.lastAt = now;

        let targets = [];
        let baseDelay = 0;
        let animOptions = {};

        if (pageType === 'post' && document.querySelector('.post.post--single')) {
            targets = collectPostEnterTargets(getPostContentContainer());
            const hasSharedElement = HAS_VT
                && Boolean(document.querySelector(`.post.post--single[${VT.markerAttr}]`));
            baseDelay = hasSharedElement ? Math.max(0, LIGHT_ENTER.vtMs - LIGHT_ENTER.vtLeadMs) : 0;
            animOptions = {
                batchSize: LIGHT_ENTER.batchSize,
                batchGap: LIGHT_ENTER.batchGap
            };
        } else if (pageType === 'post') {
            targets = collectPageEnterTargets();
            // Independent pages: use list-style card enter to match home list feel.
            baseDelay = Math.max(0, LIGHT_ENTER.vtMs - LIGHT_ENTER.vtLeadMs);
            animOptions = {
                duration: LIGHT_ENTER.listDuration,
                stagger: LIGHT_ENTER.listStagger,
                y: LIGHT_ENTER.listY,
                easing: LIGHT_ENTER.listEasing,
                batchSize: LIGHT_ENTER.listBatchSize,
                batchGap: LIGHT_ENTER.listBatchGap
            };
        } else if (pageType === 'list') {
            targets = collectListEnterTargets();
            const hasSharedElement = HAS_VT
                && Boolean(document.querySelector(`[${VT.markerAttr}]`));
            baseDelay = hasSharedElement ? Math.max(0, LIGHT_ENTER.vtMs - LIGHT_ENTER.vtLeadMs) : 0;
            animOptions = {
                duration: LIGHT_ENTER.listDuration,
                stagger: LIGHT_ENTER.listStagger,
                y: LIGHT_ENTER.listY,
                easing: LIGHT_ENTER.listEasing,
                batchSize: LIGHT_ENTER.listBatchSize,
                batchGap: LIGHT_ENTER.listBatchGap
            };
        }

        animateLightEnter(targets, baseDelay, animOptions);
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
            plugins,
            resolveUrl: (url) => {
                const resolved = new URL(url, window.location.origin);
                return resolved.pathname + resolved.search + resolved.hash;
            },
            // Important: browser back/forward is "history browsing". If disabled, VT won't run there.
            animateHistoryBrowsing: HAS_VT,
            native: HAS_VT,  // View Transitions API (supported browsers only)
            animationSelector: false,  // 禁用 Swup 的动画等待，使用自定义动画
            plugins
        });

        // ========== Forms: search + comments (Typecho) ==========
        // Delegate on document so it works after Swup replaces content.
        document.addEventListener('submit', async (event) => {
            const form = event.target && event.target.closest ? event.target.closest('form') : null;
            if (!form) return;

            // Search (GET) -> Swup navigate
            const method = (form.getAttribute('method') || 'get').toLowerCase();
            if (method === 'get' && isSearchForm(form)) {
                const url = buildGetUrlFromForm(form);
                if (isSameOriginUrl(url.href)) {
                    event.preventDefault();
                    swup.navigate(url.href);
                }
                return;
            }

            // Comment submit -> AJAX + Swup refresh
            if (isTypechoCommentForm(form)) {
                const action = form.getAttribute('action') || '';
                if (!isSameOriginUrl(action)) return;

                event.preventDefault();

                const restore = setFormBusyState(form, true, '提交中...');
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
	                            psToast(data?.message || data?.error || '评论提交失败，请检查内容后重试', 'error');
	                            return;
	                        }

	                        psToast(data?.message || '评论已提交', 'success');

	                        const redirectUrl = data?.redirect
	                            || data?.url
	                            || data?.permalink
	                            || data?.comment?.permalink
	                            || fallbackPage;
	                        refreshUrl = isSameOriginUrl(redirectUrl) ? redirectUrl : fallbackPage;
	                    } else {
	                        // HTML fallback: most Typecho installs redirect after success; `response.url` is final URL.
	                        psToast('评论已提交', 'success');
	                        refreshUrl = (response.url && isSameOriginUrl(response.url)) ? response.url : fallbackPage;
	                    }

	                    const refreshed = await refreshCommentsFromUrl(refreshUrl);
	                    if (!refreshed) swup.navigate(fallbackPage + '#comments');

	                    const textarea = document.querySelector('#textarea, textarea[name=\"text\"]');
	                    if (textarea) textarea.value = '';
                } catch (e) {
                    psToast('评论提交失败，请稍后重试', 'error');
                } finally {
                    restore();
                }
            }
        }, true);

        // ========== Index: set view-transition-name on clicked post card ==========
        // Use capture to run before Swup intercepts the click.
        document.addEventListener('click', (event) => {
            if (!HAS_VT) return;
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

            const postCard = link.closest('.post.post--index');
            if (!postCard) return;

            const postKey = getPostKeyFromElement(postCard);
            if (!postKey) return;

            rememberLastPostKey(postKey);
            applyPostSharedElementName(postCard, postKey);
        }, true);

        // ========== 页面过渡开始 ==========
        const syncPostSharedElementFromLocation = () => {
            const url = window.location.href;
            const pageType = getPageType(url);

            if (!HAS_VT) return;

            if (pageType === 'post') {
                const postContainer = document.querySelector('.post.post--single');
                const postKey = getPostKeyFromElement(postContainer);
                rememberLastPostKey(postKey);
                applyPostSharedElementName(postContainer, postKey);
                return;
            }

            // Collapse morph (post -> list): bind the matching card on the list page.
            let listPostKey = (history.state && typeof history.state === 'object')
                ? history.state.lastPostKey
                : null;

            if (!listPostKey && LAST_POST.fromSingle) {
                listPostKey = LAST_POST.key;
            }

            if (pageType === 'list' && listPostKey) {
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

                const card = findIndexPostCardById(listPostKey);
                if (card) {
                    applyPostSharedElementName(card, listPostKey);
                    // If layout changed and the card isn't visible, ensure it's within viewport for the morph.
                    requestAnimationFrame(() => {
                        const rect = card.getBoundingClientRect();
                        if (rect.bottom < 0 || rect.top > window.innerHeight) {
                            requestAnimationFrame(() => {
                                card.scrollIntoView({ block: 'center', inline: 'nearest' });
                            });
                        }
                    });
                } else {
                    clearMarkedViewTransitionNames();
                }
                return;
            }

            clearMarkedViewTransitionNames();
        };

        // Light enter animation: run strictly after content replaced.
        document.addEventListener('swup:contentReplaced', () => {
            scheduleIdleTask(() => {
                if (!HAS_VT) {
                    runLightEnterAnimation();
                    return;
                }
                waitForViewTransition().then(() => {
                    scheduleIdleTask(runLightEnterAnimation);
                });
            });
        });

        swup.hooks.on('visit:start', (visit) => {
            NAV_STATE.isSwupNavigating = true;
            LAST_POST.fromSingle = Boolean(document.querySelector('.post.post--single'));
            const fromType = getPageType();
            const toType = null;

            LIGHT_ENTER.lastFromType = fromType;
            LIGHT_ENTER.lastToType = toType;
            LIGHT_ENTER.lastToUrl = visit.to && visit.to.url ? visit.to.url : '';
            LIGHT_ENTER.lastIsSwup = true;

            // 添加动画状态类
            document.documentElement.classList.add('is-animating');

            // 标记当前页面元素（仅扫描 swup 容器，减少 DOM 遍历）
            scheduleIdleTask(() => {
                markAnimationElements(document.getElementById('swup') || document);
            });

            // 根据页面类型应用退出动画
            if (fromType === 'list') {
                document.documentElement.classList.add('transition-list-out');
            } else if (fromType === 'post') {
                document.documentElement.classList.add('transition-post-out');
            }

        });

        // ========== 新内容已替换，准备进入动画 ==========
        swup.hooks.on('content:replace', () => {
            NAV_STATE.isSwupNavigating = false;
            // 清理旧的动画类
            cleanupAnimationClasses();

            // 保持动画状态
            document.documentElement.classList.add('is-animating');

            VISIBILITY.reset();

            // 确保进入文章页时立即在顶部（避免 scroll-behavior:smooth 导致“滑上去”的鬼畜）
            if (shouldForceScrollToTop(window.location.href)) {
                window.scrollTo(0, 0);
            }

            // 标记新页面元素（仅扫描 swup 容器，减少 DOM 遍历）
            scheduleIdleTask(() => {
                markAnimationElements(document.getElementById('swup') || document);
            });

            // View Transitions shared element: apply to the new page as well
            syncPostSharedElementFromLocation();

            // 根据目标页面类型应用进入动画
            const toType = getPageType(window.location.href);
            if (toType === 'list') {
                document.documentElement.classList.add('transition-list-in');
            } else if (toType === 'post') {
                document.documentElement.classList.add('transition-post-in');
            }

            // Ensure `swup:contentReplaced` exists for light-enter animation timing.
            Promise.resolve().then(() => {
                const url = window.location.href;
                document.dispatchEvent(new CustomEvent('swup:contentReplaced', {
                    detail: { emittedBy: 'ps-after-content-replace', url, pageType: getPageType(url) }
                }));
            });
        });

        // ========== 页面过渡完成 ==========
        swup.hooks.on('visit:end', () => {
            NAV_STATE.isSwupNavigating = false;
            // 延迟清理动画类，确保动画完成（0.6s + 360ms延迟 = 960ms）
            setTimeout(() => {
                cleanupAnimationClasses();
            }, 1000);
        });

        // ========== 页面完全加载后的回调 ==========
        swup.hooks.on('page:view', () => {
            const swupRoot = document.getElementById('swup') || document;
            const pageType = getPageType(window.location.href);
            const token = ++PAGE_VIEW_TOKEN;
            const isCurrent = () => token === PAGE_VIEW_TOKEN;

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

            // 标记新页面元素（确保 PJAX 渲染后的元素也被标记）
            scheduleIdleTask(() => {
                markAnimationElements(swupRoot);
            });

            const phases = [];

            // 非关键逻辑放到分段 idle 队列，减少切换时的主线程阻塞
            if (pageType === 'post' && typeof hljs !== 'undefined') {
                phases.push(() => {
                    const blocks = Array.from(swupRoot.querySelectorAll('pre code:not(.hljs)'));
                    scheduleIdleBatched(
                        blocks,
                        6,
                        (block) => {
                            if (!isCurrent()) return;
                            hljs.highlightElement(block);
                        },
                        isCurrent
                    );
                });
            }

            if (pageType === 'post' && typeof initializeStickyTOC === 'function') {
                phases.push(() => {
                    if (!isCurrent()) return;
                    if (swupRoot.querySelector('#toc-section') || swupRoot.querySelector('.toc')) {
                        initializeStickyTOC();
                    }
                });
            }

            if (typeof runShortcodes === 'function') {
                phases.push(() => {
                    if (!isCurrent()) return;
                    runShortcodes(swupRoot);
                });
            }

            phases.push(() => {
                if (isCurrent()) {
                    scheduleCommentsInit(swupRoot);
                }
            });

            schedulePhasedTasks(phases, isCurrent);

            // 用户自定义回调（可能依赖 DOM，放最后）
            if (typeof window.pjaxCustomCallback === 'function') {
                window.pjaxCustomCallback();
            }
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
        scheduleIdleTask(() => {
            markAnimationElements(document.getElementById('swup') || document);
        });

        // Initial load
        syncPostSharedElementFromLocation();

        // Initial load doesn't trigger Swup hooks, so run a soft enter for list pages here.
        LIGHT_ENTER.lastIsSwup = false;
        if (getPageType(window.location.href) === 'list') {
            runLightEnterAnimation();
        }
        // Remove first-paint preload class after the animation has taken over via inline styles.
        if (document.documentElement.classList.contains('ps-preload-list-enter')) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    document.documentElement.classList.remove('ps-preload-list-enter');
                });
            });
        }

    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSwup);
    } else {
        initSwup();
    }
})();
