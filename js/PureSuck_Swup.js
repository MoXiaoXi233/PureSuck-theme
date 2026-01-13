/**
 * PureSuck Swup 4 配置 - 重构版
 * 完整的页面过渡动画系统
 * 支持独立页面、文章页、列表页的完整动画
 */

(function() {
    'use strict';

    // ==================== 全局状态 ====================
    const STATE = {
        isAnimating: false,
        isSwupNavigating: false,
        currentPageToken: 0,
        lastNavigation: {
            fromType: null,
            toType: null,
            toUrl: '',
            isSwup: false,
            fromTypeDetail: null,
            predictedToType: null,
            useVT: false
        },
        lastPost: {
            key: null,
            fromSingle: false
        }
    };

    // ==================== View Transitions 配置 ====================
    const VT = {
        styleId: 'ps-vt-shared-element-style',
        markerAttr: 'data-ps-vt-name',
        duration: 500,
        easing: 'cubic-bezier(.2,.8,.2,1)'
    };

    function supportsViewTransitions() {
        return typeof document.startViewTransition === 'function'
            && typeof CSS !== 'undefined'
            && typeof CSS.supports === 'function'
            && CSS.supports('view-transition-name: ps-test');
    }

    const HAS_VT = supportsViewTransitions();

    // ==================== 页面类型定义 ====================
    const PageType = {
        LIST: 'list',   // 首页、分类页、标签页、搜索页
        POST: 'post',   // 文章详情页
        PAGE: 'page'    // 独立页面（关于、友链、归档等）
    };

    /**
     * 获取当前页面的类型
     * @param {string} url - 可选，用于获取目标页面类型
     * @returns {string} 页面类型
     */
    function getPageType(url) {
        const swupRoot = document.getElementById('swup');
        const dataType = swupRoot?.dataset?.psPageType || '';

        if (dataType === 'post') return PageType.POST;
        if (dataType === 'page') return PageType.PAGE;
        return PageType.LIST;
    }

    /**
     * 检查是否是独立页面（通过DOM判断）
     */
    function isStandalonePage() {
        return Boolean(document.querySelector('.post.post--index.main-item:not(.post--single)'));
    }

    /**
     * 检查是否是文章页（通过DOM判断）
     */
    function isArticlePage() {
        return Boolean(document.querySelector('.post.post--single'));
    }

    // ==================== 空闲任务调度 ====================
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

                if (deadline?.timeRemaining) {
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
                scheduleIdleTask(runBatch);
            }
        };

        scheduleIdleTask(runBatch);
    }

    // ==================== 可见性追踪 ====================
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
                    if (entry.isIntersecting) {
                        this.visible.add(el);
                    } else {
                        this.visible.delete(el);
                    }
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

        reset() {
            if (!this.io) return;
            this.io.disconnect();
            this.init();
        }
    };

    VISIBILITY.init();

    // ==================== View Transitions 辅助函数 ====================
    function getPostTransitionName(postKey) {
        const safeKey = encodeURIComponent(String(postKey || '')).replace(/%/g, '_');
        return `ps-post-${safeKey}`;
    }

    function getSwupRoot() {
        return document.getElementById('swup') || document;
    }

    function getPostKeyFromElement(el) {
        if (!el) return null;
        return el.dataset?.psPostKey || el.getAttribute('data-ps-post-key') || null;
    }

    function rememberLastPostKey(postKey) {
        if (!postKey) return;
        const state = (history.state && typeof history.state === 'object') ? history.state : {};
        if (state.lastPostKey === postKey) return;
        history.replaceState({ ...state, lastPostKey: postKey }, document.title);
        STATE.lastPost.key = postKey;
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
  animation-duration: ${VT.duration}ms;
  animation-timing-function: ${VT.easing};
  animation-fill-mode: both;
  border-radius: 0.85rem;
  overflow: hidden;
}
::view-transition-old(${name}),
::view-transition-new(${name}) {
  animation-duration: ${VT.duration}ms;
  animation-timing-function: ${VT.easing};
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

    function findIndexPostCardById(postKey) {
        if (!postKey) return null;

        const cards = getSwupRoot().querySelectorAll('.post.post--index');
        for (const card of cards) {
            const cardKey = getPostKeyFromElement(card);
            if (cardKey === postKey) return card;
        }

        return null;
    }

    function waitForViewTransition() {
        if (!HAS_VT || typeof document.getAnimations !== 'function') {
            return Promise.resolve();
        }
        const animations = document.getAnimations({ subtree: true });
        const vtAnimations = animations.filter((anim) => {
            const target = anim?.effect?.target;
            const text = target?.toString ? target.toString() : '';
            return text.includes('view-transition');
        });
        if (!vtAnimations.length) return Promise.resolve();
        return Promise.allSettled(vtAnimations.map((anim) => anim.finished));
    }

    // ==================== 动画配置（重构版） ====================
    const ANIM = {
        // 退出动画配置
        exit: {
            // 列表页退出
            list: {
                duration: 240,
                stagger: 25,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
            },
            // 文章页退出
            post: {
                duration: 320,
                contentStagger: 30,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
            },
            // 独立页退出
            page: {
                duration: 320,
                innerStagger: 20,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
            }
        },
        // 进入动画配置
        enter: {
            // 文章页内容渐入
            post: {
                duration: 380,
                stagger: 32,
                y: 16,
                easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
                maxItems: 24,
                batchSize: 8,
                batchGap: 80
            },
            // 列表页卡片渐入
            list: {
                duration: 520,
                stagger: 65,
                y: 48,
                easing: 'cubic-bezier(0.16, 0.55, 0.35, 1)',
                maxItems: 14,
                batchSize: 6,
                batchGap: 100
            },
            // 独立页渐入
            page: {
                // 第一层：整个卡片
                card: {
                    duration: 520,
                    y: 40,
                    scale: 0.98,
                    easing: 'cubic-bezier(0.16, 0.55, 0.35, 1)'
                },
                // 第二层：内部内容
                inner: {
                    duration: 360,
                    stagger: 28,
                    y: 12,
                    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
                    maxItems: 16,
                    batchSize: 6,
                    batchGap: 70
                }
            },
            // VT 同步配置
            vt: {
                duration: VT.duration,
                leadMs: 100 // VT完成后提前多久开始进入动画
            }
        },
        // 滚动动画
        scroll: {
            duration: 550,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
        }
    };

    // ==================== 工具函数 ====================
    function prefersReducedMotion() {
        return typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function isAnimatableElement(el) {
        return el?.nodeType === 1 && el?.matches && !el.matches('script, style, link, meta');
    }

    function isElementVisible(el) {
        if (!el) return false;

        const cached = VISIBILITY.get(el);
        if (cached !== null) return cached;

        VISIBILITY.observe(el);
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

    function markAnimationElements(root = document) {
        const scope = root?.querySelector ? root : document;

        scope.querySelectorAll('.post:not([data-swup-animation])').forEach(el => {
            el.setAttribute('data-swup-animation', '');
            VISIBILITY.observe(el);
        });

        const pager = scope.querySelector('.main-pager');
        if (pager && !pager.hasAttribute('data-swup-animation')) {
            pager.setAttribute('data-swup-animation', '');
            VISIBILITY.observe(pager);
        }
    }

    function cleanupAnimationClasses() {
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

    // ==================== 动画控制器 ====================
    const AnimController = {
        activeAnimations: [],

        /**
         * 打断所有正在进行的动画
         * 包括 Web Animations API 动画和 CSS 动画
         */
        abort() {
            // 1. 打断所有 Web Animations API 动画
            for (const anim of this.activeAnimations) {
                try {
                    if (anim && typeof anim.cancel === 'function') {
                        anim.cancel();
                    }
                } catch (e) {
                    // 忽略错误
                }
            }
            this.activeAnimations = [];

            // 2. 清理所有正在进行的 CSS 动画
            // 移除动画类以停止 CSS 动画
            document.documentElement.classList.remove(
                'ps-page-exit',
                'ps-post-exit',
                'ps-list-exit'
            );

            // 3. 清理所有可能残留的样式
            document.querySelectorAll('[data-ps-animating]').forEach(el => {
                const computed = window.getComputedStyle(el);
                // 只有当元素确实在动画中时才强制清理
                if (computed.opacity !== '1' || computed.transform !== 'none') {
                    el.style.willChange = '';
                    el.style.opacity = '';
                    el.style.transform = '';
                }
                el.removeAttribute('data-ps-animating');
            });

            // 4. 强制重绘以应用更改
            void document.documentElement.offsetHeight;
        },

        /**
         * 注册一个动画
         */
        register(anim) {
            if (anim) {
                this.activeAnimations.push(anim);
                const onEnd = () => {
                    const idx = this.activeAnimations.indexOf(anim);
                    if (idx > -1) this.activeAnimations.splice(idx, 1);
                };
                anim.onfinish = onEnd;
                anim.oncancel = onEnd;
            }
        }
    };

    // ==================== 进入动画 ====================
    /**
     * 执行页面进入动画
     * @param {string} toType - 目标页面类型
     * @param {boolean} hasSharedElement - 是否有共享元素（VT）
     */
    function runEnterAnimation(toType, hasSharedElement) {
        if (prefersReducedMotion()) return;

        const baseDelay = hasSharedElement
            ? Math.max(0, ANIM.enter.vt.duration - ANIM.enter.vt.leadMs)
            : 0;

        if (toType === PageType.POST) {
            const targets = collectPostEnterTargets();
            animateLightEnter(targets, baseDelay, {
                duration: ANIM.enter.post.duration,
                stagger: ANIM.enter.post.stagger,
                y: ANIM.enter.post.y,
                easing: ANIM.enter.post.easing,
                batchSize: ANIM.enter.post.batchSize,
                batchGap: ANIM.enter.post.batchGap
            });
        } else if (toType === PageType.PAGE) {
            // 独立页面：两层动画
            const pageTargets = collectPageEnterTargets();

            // 第一层：整个卡片动画（与列表卡片同步）
            if (pageTargets.card) {
                animateLightEnter([pageTargets.card], baseDelay, {
                    duration: ANIM.enter.page.card.duration,
                    stagger: 0,
                    y: ANIM.enter.page.card.y,
                    scale: ANIM.enter.page.card.scale,
                    easing: ANIM.enter.page.card.easing,
                    batchSize: 1,
                    batchGap: 0
                });
            }

            // 第二层：内部内容动画（在卡片动画完成后开始）
            if (pageTargets.inner.length > 0) {
                const innerDelay = baseDelay + ANIM.enter.page.card.duration + 60;
                animateLightEnter(pageTargets.inner, innerDelay, {
                    duration: ANIM.enter.page.inner.duration,
                    stagger: ANIM.enter.page.inner.stagger,
                    y: ANIM.enter.page.inner.y,
                    easing: ANIM.enter.page.inner.easing,
                    batchSize: ANIM.enter.page.inner.batchSize,
                    batchGap: ANIM.enter.page.inner.batchGap
                });
            }
        } else if (toType === PageType.LIST) {
            const targets = collectListEnterTargets();
            animateLightEnter(targets, baseDelay, {
                duration: ANIM.enter.list.duration,
                stagger: ANIM.enter.list.stagger,
                y: ANIM.enter.list.y,
                easing: ANIM.enter.list.easing,
                batchSize: ANIM.enter.list.batchSize,
                batchGap: ANIM.enter.list.batchGap
            });
        }
    }

    /**
     * 收集文章页进入动画的目标元素
     */
    function collectPostEnterTargets() {
        const scope = getSwupRoot();
        const postBody = scope.querySelector('.post.post--single .post-body');

        if (!postBody) return [];

        const selector = [
            '.post-meta',
            '.post-content > *',
            '.protected-block',
            '.license-info-card'
        ].join(',');

        const maxItems = ANIM.enter.post.maxItems;
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

        return [];
    }

    /**
     * 收集独立页面进入动画的目标元素
     * 返回 { card: 整个卡片, inner: 内部元素 }
     */
    function collectPageEnterTargets() {
        const scope = getSwupRoot();
        const main = scope.querySelector('main.main') || scope;
        if (!main) return { card: null, inner: [] };

        // 独立页面的文章卡片（整个卡片作为第一层动画）
        const pageArticle = main.querySelector('.post.post--index.main-item:not(.post--single)');
        if (!pageArticle) return { card: null, inner: [] };

        const innerTargets = [];

        // 收集内部元素（第二层动画）
        const postBody = pageArticle.querySelector('.post-body');
        if (postBody) {
            // 标题
            const title = postBody.querySelector('.post-title');
            if (title) innerTargets.push(title);

            // meta
            const meta = postBody.querySelector('.post-meta');
            if (meta) innerTargets.push(meta);

            // .inner-post-wrapper 的直接子元素（正文内容）
            const innerWrapper = postBody.querySelector('.inner-post-wrapper');
            if (innerWrapper) {
                const children = Array.from(innerWrapper.children);
                for (const child of children) {
                    if (child !== meta && isAnimatableElement(child) && isElementVisible(child)) {
                        innerTargets.push(child);
                    }
                }
            }
        }

        // 评论区
        const commentsRoot = scope.querySelector('.post-comments');
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
                innerTargets
            );
        }

        // pager
        const pager = scope.querySelector('.main-pager');
        if (pager && isElementVisible(pager)) innerTargets.push(pager);

        return {
            card: pageArticle,
            inner: uniqElements(innerTargets).slice(0, ANIM.enter.page.inner.maxItems)
        };
    }

    /**
     * 收集列表页进入动画的目标元素
     */
    function collectListEnterTargets() {
        const scope = getSwupRoot();
        const main = scope.querySelector('main.main') || scope;
        if (!main) return [];

        const wrapper = main.querySelector('.wrapper') || main;
        const targets = [];

        const archiveTitle = wrapper.querySelector('.archive-title');
        if (archiveTitle) targets.push(archiveTitle);

        if (wrapper.children?.length) {
            for (const child of wrapper.children) {
                if (!child?.classList) continue;
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
        const vtEl = vtMarker?.closest('.post');

        return takeVisibleElements(
            uniqElements(targets),
            ANIM.enter.list.maxItems,
            [],
            new Set(),
            vtEl
        ).items;
    }

    /**
     * 执行轻量级进入动画
     * @param {Array} targets - 目标元素数组
     * @param {number} baseDelay - 基础延迟（毫秒）
     * @param {Object} options - 动画配置
     */
    function animateLightEnter(targets, baseDelay = 0, options = {}) {
        if (!targets?.length) return;

        const duration = options.duration ?? 380;
        const stagger = options.stagger ?? 32;
        const y = options.y ?? 16;
        const scale = options.scale ?? 1; // 支持缩放效果
        const easing = options.easing ?? 'cubic-bezier(0.2, 0.8, 0.2, 1)';
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
                // 初始状态：从下方移动 + 可选缩放
                const initialTransform = scale !== 1
                    ? `translate3d(0, ${y}px, 0) scale(${scale})`
                    : `translate3d(0, ${y}px, 0)`;
                el.style.transform = initialTransform;
                el.setAttribute('data-ps-animating', '');
            });

            requestAnimationFrame(() => {
                batch.forEach((el, batchIndex) => {
                    const absoluteIndex = index + batchIndex;
                    const fromTransform = scale !== 1
                        ? `translate3d(0, ${y}px, 0) scale(${scale})`
                        : `translate3d(0, ${y}px, 0)`;
                    const keyframes = [
                        { opacity: 0, transform: fromTransform },
                        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
                    ];

                    const anim = el.animate(keyframes, {
                        duration,
                        easing,
                        delay: baseDelay + absoluteIndex * stagger,
                        fill: 'both'
                    });

                    AnimController.register(anim);

                    const cleanup = () => {
                        el.style.willChange = '';
                        el.style.opacity = '';
                        el.style.transform = '';
                        el.removeAttribute('data-ps-animating');
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

    // ==================== 滚动动画 ====================
    /**
     * 平滑滚动到顶部
     * @param {boolean} force - 是否强制滚动
     */
    function smoothScrollToTop(force = false) {
        if (!force && window.scrollY < 100) return;

        const startY = window.scrollY;
        const duration = ANIM.scroll.duration;
        const startTime = performance.now();

        function animateScroll(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 使用 ease-out 缓动
            const eased = 1 - Math.pow(1 - progress, 3);
            window.scrollTo(0, startY * (1 - eased));

            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            }
        }

        requestAnimationFrame(animateScroll);
    }

    /**
     * 判断是否需要强制滚动到顶部
     */
    function shouldForceScrollToTop(urlString) {
        try {
            const url = new URL(urlString, window.location.origin);
            if (url.hash) return false;
            const pageType = getPageType(url.href);
            // 文章页和独立页需要滚动到顶部
            return pageType === PageType.POST || pageType === PageType.PAGE;
        } catch {
            return false;
        }
    }

    // ==================== 评论相关函数 ====================
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
        if (form.matches('form.search-container, form[role="search"], form[data-ps-search]')) return true;
        return Boolean(form.querySelector('input[name="s"]'));
    }

    function isTypechoCommentForm(form) {
        if (!form || form.nodeName !== 'FORM') return false;
        if (form.id === 'cf') return true;
        if (form.matches('form[no-pjax]') && form.querySelector('textarea[name="text"]')) return true;
        return false;
    }

    function setFormBusyState(form, busy, label) {
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

    async function refreshCommentsFromUrl(urlString) {
        const current = document.getElementById('comments');
        if (!current) return false;

        if (!isSameOriginUrl(urlString)) return false;

        const prevScrollY = window.scrollY;
        const active = document.activeElement;
        const activeId = active?.id;

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

        window.scrollTo(0, prevScrollY);
        if (activeId) {
            const el = document.getElementById(activeId);
            if (el?.focus) {
                try { el.focus({ preventScroll: true }); } catch { el.focus(); }
            }
        }

        scheduleCommentsInit(document, { eager: true });

        return true;
    }

    function scheduleCommentsInit(root, options = {}) {
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

    // ==================== VT 同步逻辑 ====================
    /**
     * 同步共享元素的 VT 名称
     */
    function syncPostSharedElementFromLocation(scrollPlugin) {
        const url = window.location.href;
        const pageType = getPageType(url);

        if (!HAS_VT) return;

        if (pageType === PageType.POST) {
            const postContainer = document.querySelector('.post.post--single');
            const postKey = getPostKeyFromElement(postContainer);
            rememberLastPostKey(postKey);
            applyPostSharedElementName(postContainer, postKey);
            return;
        }

        // 返回列表页：匹配的卡片
        let listPostKey = (history.state && typeof history.state === 'object')
            ? history.state.lastPostKey
            : null;

        if (!listPostKey && STATE.lastPost.fromSingle) {
            listPostKey = STATE.lastPost.key;
        }

        if (pageType === PageType.LIST && listPostKey) {
            // 恢复滚动位置
            const cached = scrollPlugin?.getCachedScrollPositions
                ? scrollPlugin.getCachedScrollPositions(url)
                : null;
            const cachedY = cached?.window?.top;
            if (typeof cachedY === 'number') {
                window.scrollTo(0, cachedY);
                queueMicrotask(() => window.scrollTo(0, cachedY));
            }

            const card = findIndexPostCardById(listPostKey);
            if (card) {
                applyPostSharedElementName(card, listPostKey);
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
    }

    // ==================== Swup 初始化 ====================
    function initSwup() {
        if (typeof Swup === 'undefined') {
            console.error('[Swup] Swup 未定义');
            return;
        }

        // ========== Swup 4 基础配置 ==========
        const plugins = [];
        const scrollPlugin = (typeof SwupScrollPlugin === 'function')
            ? new SwupScrollPlugin({
                doScrollingRightAway: true,
                animateScroll: {
                    betweenPages: false, // 禁用默认动画，使用自定义平滑滚动
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
            animateHistoryBrowsing: HAS_VT,
            native: HAS_VT,
            animationSelector: false
        });

        // ========== 表单提交处理 ==========
        document.addEventListener('submit', async (event) => {
            const form = event.target?.closest('form');
            if (!form) return;

            const method = (form.getAttribute('method') || 'get').toLowerCase();

            // 搜索表单
            if (method === 'get' && isSearchForm(form)) {
                const url = buildGetUrlFromForm(form);
                if (isSameOriginUrl(url.href)) {
                    event.preventDefault();
                    swup.navigate(url.href);
                }
                return;
            }

            // 评论表单
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
                        psToast('评论已提交', 'success');
                        refreshUrl = (response.url && isSameOriginUrl(response.url)) ? response.url : fallbackPage;
                    }

                    const refreshed = await refreshCommentsFromUrl(refreshUrl);
                    if (!refreshed) swup.navigate(fallbackPage + '#comments');

                    const textarea = document.querySelector('#textarea, textarea[name="text"]');
                    if (textarea) textarea.value = '';
                } catch (e) {
                    psToast('评论提交失败，请稍后重试', 'error');
                } finally {
                    restore();
                }
            }
        }, true);

        // ========== 点击事件：设置 VT 共享元素 ==========
        document.addEventListener('click', (event) => {
            if (!HAS_VT) return;
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

            const postKey = getPostKeyFromElement(postCard);
            if (!postKey) return;

            rememberLastPostKey(postKey);
            applyPostSharedElementName(postCard, postKey);
        }, true);

        // ========== 动画流程：visit:start ==========
        swup.hooks.on('visit:start', (visit) => {
            STATE.isSwupNavigating = true;

            // 打断之前的动画
            AnimController.abort();

            // 检测源页面类型
            let fromType = getPageType();

            // 更精确的类型检测
            if (isArticlePage()) {
                fromType = PageType.POST;
            } else if (isStandalonePage()) {
                fromType = PageType.PAGE;
            }

            STATE.lastNavigation.fromType = fromType;
            STATE.lastNavigation.fromTypeDetail = fromType;
            STATE.lastNavigation.toUrl = visit.to?.url || '';
            STATE.lastNavigation.isSwup = true;

            // 添加动画状态类
            document.documentElement.classList.add('ps-animating');

            // 预测目标页面类型（通过 URL 模式）
            const toUrl = visit.to?.url || '';
            let predictedToType = PageType.LIST;
            let useVT = false;

            // 检测是否点击了列表页中的文章卡片
            const clickedPostCard = document.querySelector(`[${VT.markerAttr}]`);
            const isClickingPostFromList = fromType === PageType.LIST && clickedPostCard;

            if (isClickingPostFromList) {
                predictedToType = PageType.POST;
            } else if (toUrl.includes('/archives/') || toUrl.includes('/about/') || toUrl.includes('/links/') || toUrl.includes('/tags/')) {
                predictedToType = PageType.PAGE;
            }

            // 只有从列表点击文章卡片时使用 VT
            useVT = HAS_VT && isClickingPostFromList;

            if (useVT) {
                document.documentElement.classList.add('ps-vt-mode');
                // VT模式下也要添加退出动画类，让非共享元素有退出效果
                if (fromType === PageType.LIST) {
                    document.documentElement.classList.add('ps-list-exit');
                }
            } else {
                // 非 VT 模式：应用完整的退出动画
                if (fromType === PageType.PAGE) {
                    document.documentElement.classList.add('ps-page-exit');
                } else if (fromType === PageType.POST) {
                    document.documentElement.classList.add('ps-post-exit');
                } else if (fromType === PageType.LIST) {
                    document.documentElement.classList.add('ps-list-exit');
                }
            }

            STATE.lastPost.fromSingle = fromType === PageType.POST;

            // 存储预测的目标类型和 VT 模式，供后续使用
            STATE.lastNavigation.predictedToType = predictedToType;
            STATE.lastNavigation.useVT = useVT;
        });

        // ========== 动画流程：content:replace ==========
        swup.hooks.on('content:replace', () => {
            const toType = getPageType();

            STATE.isSwupNavigating = false;
            STATE.lastNavigation.toType = toType;

            // 清理旧类
            cleanupAnimationClasses();

            // 新的动画状态
            document.documentElement.classList.add('ps-animating');
            document.documentElement.classList.add('ps-enter-active');

            // 重置可见性追踪
            VISIBILITY.reset();

            // 滚动处理：列表分页平滑滚动，其他页面立即到顶部
            const shouldScroll = shouldForceScrollToTop(window.location.href);
            const wasListPage = STATE.lastNavigation.fromType === PageType.LIST;
            const isListPage = toType === PageType.LIST;

            if (shouldScroll && !wasListPage) {
                // 进入文章页/独立页：立即到顶部
                window.scrollTo(0, 0);
            } else if (wasListPage && isListPage) {
                // 列表分页：平滑滚动到顶部
                smoothScrollToTop(true);
            }

            // 标记新元素
            scheduleIdleTask(() => {
                markAnimationElements(document.getElementById('swup') || document);
            });

            // VT 共享元素
            syncPostSharedElementFromLocation(scrollPlugin);

            // 检测是否有 VT 共享元素
            const hasSharedElement = HAS_VT && Boolean(document.querySelector(`[${VT.markerAttr}]`));

            // 应用进入动画类（VT 模式下不添加，避免干扰共享元素变形）
            if (!hasSharedElement) {
                if (toType === PageType.PAGE) {
                    document.documentElement.classList.add('ps-page-enter');
                } else if (toType === PageType.POST) {
                    document.documentElement.classList.add('ps-post-enter');
                } else if (toType === PageType.LIST) {
                    document.documentElement.classList.add('ps-list-enter');
                }
            }

            // 触发进入动画
            Promise.resolve().then(() => {

                document.dispatchEvent(new CustomEvent('swup:contentReplaced', {
                    detail: {
                        emittedBy: 'ps-after-content-replace',
                        url: window.location.href,
                        pageType: toType,
                        hasSharedElement
                    }
                }));

                // 在 VT 完成后执行进入动画
                scheduleIdleTask(() => {
                    if (!HAS_VT) {
                        runEnterAnimation(toType, false);
                        return;
                    }
                    waitForViewTransition().then(() => {
                        scheduleIdleTask(() => runEnterAnimation(toType, hasSharedElement));
                    });
                });
            });
        });

        // ========== 动画流程：visit:end ==========
        swup.hooks.on('visit:end', () => {
            STATE.isSwupNavigating = false;

            // 延迟清理，确保动画完成
            setTimeout(() => {
                cleanupAnimationClasses();
            }, 1000);
        });

        // ========== 页面加载完成 ==========
        swup.hooks.on('page:view', () => {
            const swupRoot = document.getElementById('swup') || document;
            const pageType = getPageType(window.location.href);
            const token = ++STATE.currentPageToken;
            const isCurrent = () => token === STATE.currentPageToken;

            // 更新导航栏
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

            // 标记元素
            scheduleIdleTask(() => {
                markAnimationElements(swupRoot);
            });

            // 分段初始化
            const phases = [];

            if (pageType === PageType.POST && typeof hljs !== 'undefined') {
                phases.push(() => {
                    if (!isCurrent()) return;
                    const blocks = Array.from(swupRoot.querySelectorAll('pre code:not(.hljs)'));
                    scheduleIdleBatched(blocks, 6, (block) => {
                        if (!isCurrent()) return;
                        hljs.highlightElement(block);
                    }, isCurrent);
                });
            }

            if (pageType === PageType.POST && typeof initializeStickyTOC === 'function') {
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

            // 用户自定义回调
            if (typeof window.pjaxCustomCallback === 'function') {
                window.pjaxCustomCallback();
            }
        });

        // ========== 加密文章表单 ==========
        document.addEventListener('submit', (event) => {
            const form = event.target?.closest('.protected-form');
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

        // ========== 初始加载 ==========
        scheduleIdleTask(() => {
            markAnimationElements(document.getElementById('swup') || document);
        });

        syncPostSharedElementFromLocation(scrollPlugin);

        // 初始加载的进入动画
        STATE.lastNavigation.isSwup = false;
        if (getPageType(window.location.href) === PageType.LIST) {
            runEnterAnimation(PageType.LIST, false);
        }

        // 移除预加载类
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
