/**
 * PureSuck Swup 4 配置 - 重构版
 * 完整的页面过渡动画系统
 * 支持独立页面、文章页、列表页的完整动画
 */

(function() {
    'use strict';

    // ==================== 简化的RAF管理器 ====================
    /**
     * 轻量级RAF管理器（替代177行的AnimationFrameManager）
     * 只保留必要的取消功能，删除不必要的优先级、统计等复杂逻辑
     */
    const RAF = {
        activeIds: new Set(),

        schedule(callback) {
            const id = requestAnimationFrame(() => {
                this.activeIds.delete(id);
                callback();
            });
            this.activeIds.add(id);
            return id;
        },

        cancel(id) {
            if (this.activeIds.has(id)) {
                cancelAnimationFrame(id);
                this.activeIds.delete(id);
            }
        },

        cancelAll() {
            this.activeIds.forEach(id => cancelAnimationFrame(id));
            this.activeIds.clear();
        }
    };

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
        duration: 520,
        easing: 'cubic-bezier(0.15,0.3,0.15,1)',
        // ✅ 预计算选择器字符串，避免重复拼接
        markerSelector: '[data-ps-vt-name]'
    };

    function supportsViewTransitions() {
        return typeof document.startViewTransition === 'function'
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
        budgetMs: 12,
        // 队列大小限制，防止内存泄漏
        maxQueueSize: 100
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
                    // Idle task error silently ignored
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

        // 检查队列是否已满，防止内存泄漏
        if (IDLE.queue.length >= IDLE.maxQueueSize) {
            return;
        }

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

    // ==================== 简化的任务调度器 ====================
    // 轻量级批量处理器，避免过度设计
    const TaskScheduler = {
        async run(items, handler, options = {}) {
            if (!items?.length) return;

            // ✅ 小数组直接同步处理，避免 Promise/RAF 开销
            if (items.length <= 8) {
                for (let i = 0; i < items.length; i++) {
                    try {
                        handler(items[i], i);
                    } catch (e) {}
                }
                return;
            }

            const batchSize = 8; // 固定批次大小，避免复杂的自适应逻辑

            for (let i = 0; i < items.length; i += batchSize) {
                const end = Math.min(i + batchSize, items.length);

                // 使用RAF批量处理，避免阻塞主线程
                await new Promise(resolve => {
                    requestAnimationFrame(() => {
                        for (let j = i; j < end; j++) {
                            try {
                                handler(items[j], j);
                            } catch (e) {}
                        }
                        resolve();
                    });
                });
            }
        }
    };

    // 视口信息缓存（仅保留必要的属性，删除未使用的 isVisible/batchCheckVisible 方法）
    const VIEWPORT = {
        cachedHeight: 0,

        update() {
            this.cachedHeight = window.innerHeight;
        },

        init() {
            this.update();
            // 使用 window resize 代替 ResizeObserver，避免过度触发
            let resizeTimer = 0;
            const handleResize = () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    this.update();
                }, 100);
            };
            window.addEventListener('resize', handleResize, { passive: true });
            window.addEventListener('orientationchange', handleResize, { passive: true });
        }
    };

    VIEWPORT.init();

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
        // ✅ 使用预计算的选择器，避免模板字符串拼接
        const elements = document.querySelectorAll(VT.markerSelector);
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            el.style.viewTransitionName = '';
            el.removeAttribute(VT.markerAttr);
        }
    }

    /**
     * 应用文章卡片共享元素的 View Transitions 名称
     * 优化：移除动态 style 插入，改用静态 CSS
     * 性能提升：消除强制布局和样式重计算
     */
    function applyPostSharedElementName(el, postKey) {
        if (!HAS_VT || !el || !postKey) return;

        const name = getPostTransitionName(postKey);
        clearMarkedViewTransitionNames();

        // 优化：直接设置 view-transition-name，不再动态生成 style 标签
        // CSS 变量在静态 CSS 中定义 (vt.css)
        el.style.viewTransitionName = name;
        el.setAttribute(VT.markerAttr, name);
    }

    function findIndexPostCardById(postKey) {
        if (!postKey) return null;

        // ✅ 使用 getSwupRoot() 缓存结果，避免重复查询
        const root = getSwupRoot();
        const cards = root.querySelectorAll('.post.post--index');
        const len = cards.length;

        for (let i = 0; i < len; i++) {
            const card = cards[i];
            const cardKey = getPostKeyFromElement(card);
            if (cardKey === postKey) return card;
        }

        return null;
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
        enter: {
            post: {
                duration: 380,
                stagger: 40,
                y: 16,
                easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
                maxItems: 24,
                batchSize: 8,
                batchGap: 100
            },
            list: {
                duration: 520,
                stagger: 65,
                y: 48,
                easing: 'cubic-bezier(0.16, 0.55, 0.35, 1)',
                maxItems: 20,
                batchSize: 6,
                batchGap: 100
            },
            page: {
                card: {
                    duration: 380,
                    y: 40,
                    scale: 0.98,
                    easing: 'cubic-bezier(0.16, 0.55, 0.35, 1)'
                },
                inner: {
                    duration: 360,
                    stagger: 35,
                    y: 12,
                    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
                    maxItems: 16,
                    batchSize: 6,
                    batchGap: 90
                }
            },
            vt: {
                duration: VT.duration,
                leadMs: 100
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
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function isAnimatableElement(el) {
        return el?.nodeType === 1 && el?.matches && !el.matches('script, style, link, meta');
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
            // 移除视口过滤：确保所有元素都被收集，避免页面滚动时顶部元素不显示
            // if (!isElementVisible(el)) continue;
            target.push(el);
            if (target.length >= max) break;
        }

        return { items: target, seen: used };
    }

    /**
     * 标记动画元素
     * 优化：改进选择器性能，避免使用 :not() 伪类
     * 性能提升：在 JavaScript 中过滤比 CSS 伪类选择器更快
     */
    function markAnimationElements(root = document) {
        const scope = root?.querySelector ? root : document;

        // 优化：先选择所有 .post 元素，然后在 JavaScript 中过滤
        // 性能提升：:not() 伪类选择器在大DOM树上性能较差
        const allPosts = scope.querySelectorAll('.post');
        for (const el of allPosts) {
            if (!el.hasAttribute('data-swup-animation')) {
                el.setAttribute('data-swup-animation', '');
            }
        }

        const pager = scope.querySelector('.main-pager');
        if (pager && !pager.hasAttribute('data-swup-animation')) {
            pager.setAttribute('data-swup-animation', '');
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
            'ps-vt-mode',
            'ps-pre-enter'
        );
    }

    // ==================== 动画控制器 ====================
    const AnimController = {
        activeAnimations: [],
        animatingElements: new WeakSet(), // 追踪正在动画的元素

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

            // 2. 清理 CSS 动画类
            document.documentElement.classList.remove(
                'ps-page-exit',
                'ps-post-exit',
                'ps-list-exit'
            );

            // 3. 清理所有动画中的元素样式
            document.querySelectorAll('[data-ps-animating]').forEach(el => {
                this.cleanupElement(el);
            });
        },

        /**
         * 清理单个元素的动画相关样式
         */
        cleanupElement(el) {
            if (!el) return;
            el.style.opacity = '';
            el.style.transform = '';
            el.removeAttribute('data-ps-animating');
            this.animatingElements.delete(el);
        },

        /**
         * 注册一个动画
         */
        register(anim, element = null) {
            if (!anim) return;

            // 追踪正在动画的元素，用于后续清理
            if (element) {
                this.animatingElements.add(element);
            }

            this.activeAnimations.push(anim);

            const onEnd = () => {
                const idx = this.activeAnimations.indexOf(anim);
                if (idx > -1) this.activeAnimations.splice(idx, 1);
                // 动画结束后立即清理元素
                if (element) {
                    this.cleanupElement(element);
                }
            };

            anim.onfinish = onEnd;
            anim.oncancel = onEnd;
        }
    };

    // ==================== 性能优化：初始渲染 ====================
    /**
     * 优化初始渲染性能
     * 主要优化图片加载策略
     */
    function optimizeInitialRender(pageType) {
        const swupRoot = document.getElementById('swup');
        if (!swupRoot) return;

        // 优化图片加载
        optimizeImageLoading(swupRoot, pageType);
    }

    /**
     * 优化图片加载
     * 添加原生懒加载和异步解码属性
     */
    function optimizeImageLoading(root, pageType) {
        const images = root.querySelectorAll('img');

        images.forEach((img, index) => {
            // 首屏图片立即加载，其余懒加载
            const isAboveFold = (pageType === PageType.POST && index < 3) ||
                                (pageType === PageType.LIST && index < 2);

            if (!isAboveFold && !img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }

            // 所有图片使用异步解码
            if (!img.hasAttribute('decoding')) {
                img.setAttribute('decoding', 'async');
            }

            // 添加 fetchpriority 属性，优化加载优先级
            if (isAboveFold && !img.hasAttribute('fetchpriority')) {
                img.setAttribute('fetchpriority', 'high');
            }
        });

        // 在浏览器空闲时预加载即将进入视口的图片
        scheduleProgressiveImagePreload(root, images);
    }

    /**
     * 渐进式图片预加载
     * 使用 IntersectionObserver 和 requestIdleCallback 优化图片加载
     * @param {Element} root - 根元素
     * @param {NodeList} images - 图片列表
     */
    function scheduleProgressiveImagePreload(root, images) {
        if (!images || images.length === 0) return;

        // 收集懒加载图片
        const lazyImages = Array.from(images).filter(img =>
            img.hasAttribute('loading') && img.getAttribute('loading') === 'lazy'
        );

        if (lazyImages.length === 0) return;

        // 使用 IntersectionObserver 监听图片即将进入视口
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    observer.unobserve(img);

                    // 在浏览器空闲时预加载图片
                    scheduleIdleTask(() => {
                        // 如果图片还没有加载，触发加载
                        if (!img.complete && img.dataset.src) {
                            img.src = img.dataset.src;
                        }
                    });
                }
            });
        }, {
            // 提前 300px 开始预加载
            rootMargin: '300px 0px',
            threshold: 0.01
        });

        // 观察所有懒加载图片
        lazyImages.forEach(img => imageObserver.observe(img));
    }

    // ==================== 进入动画 ====================

    /**
     * 设置页面进入动画的初始状态
     * 优化：使用 CSS 类替代内联样式，消除强制同步布局
     * 性能提升：避免 cssText += 操作触发的样式重计算和布局
     */
    function setInitialAnimationState(pageType) {
        if (prefersReducedMotion()) return;

        let targets = [];
        let className = '';

        if (pageType === PageType.POST) {
            targets = collectPostEnterTargets();
            className = 'ps-enter-hidden-post';
        } else if (pageType === PageType.PAGE) {
            // 独立页：两层动画
            const pageTargets = collectPageEnterTargets();

            requestAnimationFrame(() => {
                // Card: 使用类名
                if (pageTargets.card) {
                    pageTargets.card.classList.add('ps-enter-hidden-page-card');
                }
                // Inner: 使用类名
                pageTargets.inner.forEach(el => {
                    if (el) {
                        el.classList.add('ps-enter-hidden-page-inner');
                    }
                });
            });
            return;
        } else if (pageType === PageType.LIST) {
            targets = collectListEnterTargets();
            className = 'ps-enter-hidden-list';
        }

        if (!targets.length || !className) return;

        requestAnimationFrame(() => {
            // 优化：使用 classList.add 替代 cssText +=
            // 性能提升：避免触发样式重计算
            targets.forEach(el => {
                if (el) el.classList.add(className);
            });
        });
    }

    /**
     * 执行页面进入动画（异步版本，支持时间切片）
     * @param {string} toType - 目标页面类型
     * @param {boolean} hasSharedElement - 是否有共享元素（VT）
     */
    async function runEnterAnimation(toType, hasSharedElement) {
        if (prefersReducedMotion()) return;

        const baseDelay = hasSharedElement
            ? Math.max(0, ANIM.enter.vt.duration - ANIM.enter.vt.leadMs)
            : 0;

        // 注意：由于已经通过 setInitialAnimationState 设置过初始状态，
        // 这里传递 skipInitialState = true 避免重复DOM操作
        const skipInitialState = true;

        if (toType === PageType.POST) {
            const targets = collectPostEnterTargets();
            await animateLightEnter(targets, baseDelay, {
                duration: ANIM.enter.post.duration,
                stagger: ANIM.enter.post.stagger,
                y: ANIM.enter.post.y,
                easing: ANIM.enter.post.easing,
                batchSize: ANIM.enter.post.batchSize
            }, skipInitialState);
        } else if (toType === PageType.PAGE) {
            // 独立页面：两层动画
            const pageTargets = collectPageEnterTargets();

            // 第一层：整个卡片动画
            if (pageTargets.card) {
                await animateLightEnter([pageTargets.card], baseDelay, {
                    duration: ANIM.enter.page.card.duration,
                    stagger: 0,
                    y: ANIM.enter.page.card.y,
                    scale: ANIM.enter.page.card.scale,
                    easing: ANIM.enter.page.card.easing,
                    batchSize: 1
                }, skipInitialState);
            }

            // 第二层：内部内容动画
            if (pageTargets.inner.length > 0) {
                const innerDelay = baseDelay + ANIM.enter.page.card.duration + 60;
                await animateLightEnter(pageTargets.inner, innerDelay, {
                    duration: ANIM.enter.page.inner.duration,
                    stagger: ANIM.enter.page.inner.stagger,
                    y: ANIM.enter.page.inner.y,
                    easing: ANIM.enter.page.inner.easing,
                    batchSize: ANIM.enter.page.inner.batchSize
                }, skipInitialState);
            }
        } else if (toType === PageType.LIST) {
            const targets = collectListEnterTargets();
            await animateLightEnter(targets, baseDelay, {
                duration: ANIM.enter.list.duration,
                stagger: ANIM.enter.list.stagger,
                y: ANIM.enter.list.y,
                easing: ANIM.enter.list.easing,
                batchSize: ANIM.enter.list.batchSize
            }, skipInitialState);
        }

        // 动画完成后，清理 .post-comments 容器的初始状态
        if (toType === PageType.POST) {
            RAF.schedule(() => {
                const commentsSection = document.querySelector('.post.post--single .post-comments');
                if (commentsSection) {
                    commentsSection.style.opacity = '';
                    commentsSection.style.transform = '';
                    commentsSection.style.willChange = '';
                }
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
                '#comments-list > .comment-title',
                '#comments-list li',
                '#comments-list > .page-navigator',
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
        if (pager) belowTargets.push(pager);

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
                    if (child !== meta && isAnimatableElement(child)) {
                        innerTargets.push(child);
                    }
                }
            }
        }

        // 评论区
        const commentsRoot = scope.querySelector('.post-comments');
        if (commentsRoot) {
            const commentsSelector = [
                '#comments-list > .comment-title',
                '#comments-list li',
                '#comments-list > .page-navigator',
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
        if (pager) innerTargets.push(pager);

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

        const vtMarker = main.querySelector(VT.markerSelector);
        const vtEl = vtMarker?.closest('.post');

        // 列表页：直接返回所有卡片，不过滤可见性（透明度归动画管）
        const allTargets = uniqElements(targets);
        if (vtEl) {
            const idx = allTargets.indexOf(vtEl);
            if (idx > -1) allTargets.splice(idx, 1);
        }
        return allTargets.slice(0, ANIM.enter.list.maxItems);
    }

    /**
     * 轻量级进入动画
     * 优化：
     * 1. 使用 CSS 类替代内联样式设置初始状态
     * 2. 动画开始时添加 will-change，结束后立即移除
     * 3. 减少不必要的 contain 属性设置
     */
    async function animateLightEnter(targets, baseDelay = 0, options = {}, skipInitialState = false) {
        if (!targets?.length) return;

        const { duration = 380, stagger = 32, y = 16, scale = 1, easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)' } = options;

        // 优化：不再使用内联样式设置初始状态，因为已在 setInitialAnimationState 中设置
        if (!skipInitialState) {
            // 备用：如果需要设置初始状态，使用类名而不是内联样式
            const className = scale !== 1 ? 'ps-enter-hidden-page-card' : 'ps-enter-hidden-post';
            await TaskScheduler.run(targets, (el) => {
                el.classList.add(className);
            }, { priority: 'user-blocking' });
        }

        await TaskScheduler.run(targets, (el, index) => {
            const anim = el.animate([
                { opacity: 0, transform: `translate3d(0,${y}px,0)${scale !== 1 ? ` scale(${scale})` : ''}` },
                { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }
            ], {
                duration,
                easing,
                delay: baseDelay + index * stagger,
                fill: 'both',
                composite: 'replace'
            });

            anim.onfinish = () => {
                // 动画结束后清理样式
                el.style.opacity = '';
                el.style.transform = '';
            };

            AnimController.register(anim, el);
        }, { priority: 'user-blocking' });
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
                RAF.schedule(animateScroll);
            }
        }

        RAF.schedule(animateScroll);
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

    /**
     * 从指定 URL 刷新评论区
     */
    async function refreshCommentsFromUrl(urlString, options = {}) {
        const { restoreScroll = true } = options;
        // ★ 只刷新评论列表，不动评论表单和OwO
        const current = document.getElementById('comments-list');
        if (!current) return false;

        if (!isSameOriginUrl(urlString)) return false;

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
            // ★ 只提取评论列表部分
            const next = doc.getElementById('comments-list');
            if (!next) return false;

            // ★ 只替换评论列表，评论表单和OwO保持不变
            current.replaceWith(next);

            RAF.schedule(() => {
                if (restoreScroll) {
                    window.scrollTo(0, prevScrollY);
                }
                if (activeId) {
                    const el = document.getElementById(activeId);
                    if (el?.focus) {
                        try { el.focus({ preventScroll: true }); } catch { el.focus(); }
                    }
                }
            });

            // ★ 不再需要重新初始化OwO，因为评论表单没有被替换
            // scheduleCommentsInit(document, { eager: true });

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

    function scheduleCommentsInit(root, options = {}) {
        window.OwoManager?.init();
    }

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

        let listPostKey = (history.state && typeof history.state === 'object')
            ? history.state.lastPostKey
            : null;

        if (!listPostKey && STATE.lastPost.fromSingle) {
            listPostKey = STATE.lastPost.key;
        }

        if (pageType === PageType.LIST && listPostKey) {
            const cached = scrollPlugin?.getCachedScrollPositions?.(url);
            const cachedY = cached?.window?.top;
            if (typeof cachedY === 'number') {
                window.scrollTo(0, cachedY);
                queueMicrotask(() => window.scrollTo(0, cachedY));
            }

            const card = findIndexPostCardById(listPostKey);
            if (card) {
                applyPostSharedElementName(card, listPostKey);
                const checkAndScroll = () => {
                    RAF.schedule(() => {
                        const rect = card.getBoundingClientRect();
                        if (rect.bottom < 0 || rect.top > VIEWPORT.cachedHeight) {
                            RAF.schedule(() => {
                                card.scrollIntoView({ block: 'center', inline: 'nearest' });
                            });
                        }
                    });
                };

                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(checkAndScroll, { timeout: 100 });
                } else {
                    checkAndScroll();
                }
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
            return;
        }

        // ========== Swup 4 基础配置 ==========
        const plugins = [];

        const scrollPlugin = (typeof SwupScrollPlugin === 'function')
            ? new SwupScrollPlugin({
                doScrollingRightAway: true,
                animateScroll: {
                    betweenPages: false,
                    samePageWithHash: true,
                    samePage: true
                },
                scrollContainers: '.__non_existent_selector__',
                scrollFunction: (container, top, left, animate, onStart, onEnd) => {
                    // 直接执行滚动，不使用 requestIdleCallback（滚动是用户期望立即响应的操作）
                    const target = container instanceof HTMLHtmlElement || container instanceof HTMLBodyElement ? window : container;
                    onStart();
                    target.addEventListener('scrollend', onEnd, { once: true });
                    // 用户主动滚动时中断平滑滚动（不读取当前位置，避免强制重排）
                    target.addEventListener('wheel', () => {
                        window.scrollTo({ behavior: 'instant' });
                    }, { once: true, passive: true });
                    container.scrollTo({ top, left, behavior: animate ? 'smooth' : 'instant' });
                }
            })
            : null;

        if (scrollPlugin) plugins.push(scrollPlugin);

        // Preload Plugin
        const preloadPlugin = (typeof SwupPreloadPlugin === 'function')
            ? new SwupPreloadPlugin({
                throttle: 5,
                preloadHoveredLinks: true,
                preloadVisibleLinks: {
                    threshold: 0.2,
                    delay: 500,
                    containers: ['#swup'],
                    ignore: (el) => el.closest('#comments, .page-navigator') || el.getAttribute('href')?.startsWith('#')
                },
                preloadInitialPage: true
            })
            : null;

        if (preloadPlugin) plugins.push(preloadPlugin);

        const headPlugin = (typeof SwupHeadPlugin === 'function')
            ? new SwupHeadPlugin({
                persistAssets: true,
                awaitAssets: false
                // 移除 attributes 配置：修改 <html> 的 lang/dir 属性会触发样式重算
                // 如果页面 lang 不变化（如都是中文），无需同步此属性
            })
            : null;

        if (headPlugin) plugins.push(headPlugin);

        const swup = new Swup({
            containers: ['#swup'],
            plugins,
            cache: true,
            preload: true,
            resolveUrl: (url) => {
                const resolved = new URL(url, window.location.origin);
                return resolved.pathname + resolved.search + resolved.hash;
            },
            linkSelector: 'a[href]:not([data-no-swup]):not(.page-navigator a):not(#comments a):not(a[href^="#"])',
            animateHistoryBrowsing: HAS_VT,
            native: HAS_VT,
            animationSelector: false
        });

        window.swupInstance = swup;

        // ========== Typecho 评论系统修复 ==========
        // 重写 TypechoComment 方法，使其动态查找 DOM
        // 解决 Swup 替换 DOM 后引用失效的问题
        (function() {
            const reply = function(cid, coid) {
                const comment = document.getElementById(cid);
                if (!comment) return false;

                const parent = comment.parentNode;

                // 动态查找 respond 元素
                let respond = document.querySelector('.respond');
                if (!respond) return false;

                let input = document.getElementById('comment-parent');
                const form = respond.tagName === 'FORM' ? respond : respond.querySelector('form');
                const textarea = respond.querySelector('textarea');

                // 创建 parent 字段（如果不存在）
                if (!input) {
                    input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = 'parent';
                    input.id = 'comment-parent';
                    form.appendChild(input);
                }

                input.value = coid;

                // 创建占位符并移动表单
                let holder = document.getElementById('comment-form-place-holder');
                if (!holder) {
                    holder = document.createElement('div');
                    holder.id = 'comment-form-place-holder';
                    respond.parentNode.insertBefore(holder, respond);
                }

                comment.appendChild(respond);

                // 显示取消按钮
                const cancelBtn = document.getElementById('cancel-comment-reply-link');
                if (cancelBtn) {
                    cancelBtn.style.display = '';
                }

                // 聚焦输入框
                if (textarea && textarea.name === 'text') {
                    textarea.focus();
                }

                return false;
            };

            const cancelReply = function() {
                let respond = document.querySelector('.respond');
                if (!respond) return false;

                const holder = document.getElementById('comment-form-place-holder');
                const input = document.getElementById('comment-parent');
                const cancelBtn = document.getElementById('cancel-comment-reply-link');

                // 移除 parent 字段
                if (input) {
                    input.parentNode.removeChild(input);
                }

                if (!holder) return true;

                // 恢复表单位置
                cancelBtn.style.display = 'none';
                holder.parentNode.insertBefore(respond, holder);

                return false;
            };

            // 覆盖或创建 TypechoComment 对象
            if (window.TypechoComment) {
                window.TypechoComment.reply = reply;
                window.TypechoComment.cancelReply = cancelReply;
            } else {
                window.TypechoComment = {
                    reply: reply,
                    cancelReply: cancelReply
                };
            }
        })();

        // ========== 评论区链接拦截 ==========
        document.addEventListener('click', (event) => {
            const link = event.target?.closest('a[href*="replyTo"]');
            if (!link) return;
            if (event.defaultPrevented) return;
            if (event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            event.preventDefault();
            event.stopPropagation();
        }, false);

        /**
         * 处理评论分页点击 - 使用 AJAX 局部刷新
         */
        async function handleCommentPaginationClick(link, event) {
            event.preventDefault();
            event.stopPropagation();

            const url = link.getAttribute('href');
            if (!url) return;

            // 显示加载状态
            const pageNavigator = link.closest('.page-navigator');
            if (pageNavigator) {
                pageNavigator.classList.add('loading');
            }

            try {
                // 不恢复滚动位置，稍后手动滚动到评论区顶部
                const refreshed = await refreshCommentsFromUrl(url, { restoreScroll: false });
                if (refreshed) {
                    // 刷新成功后，滚动到评论区顶部
                    const commentsSection = document.getElementById('comments');
                    if (commentsSection) {
                        // 获取第一个评论
                        const firstComment = commentsSection.querySelector('.comment-list > li');
                        if (firstComment) {
                            firstComment.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                            // 如果没有评论，滚动到评论区标题
                            const title = commentsSection.querySelector('.comment-title');
                            if (title) {
                                title.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }
                    }
                } else {
                    // 如果刷新失败，回退到 swup 导航
                    swup.navigate(url);
                }
            } catch (error) {
                // 出错时回退到 swup 导航
                swup.navigate(url);
            } finally {
                if (pageNavigator) {
                    pageNavigator.classList.remove('loading');
                }
            }
        }

        // 在捕获阶段拦截评论分页链接
        // 回复按钮和取消回复保持原生行为，让 Typecho 自己处理
        document.addEventListener('click', (event) => {
            const link = event.target?.closest('a[href]');
            if (!link) return;

            // 只处理评论分页
            const pageNavigator = link.closest('.page-navigator');
            if (!pageNavigator) return;

            // 已被阻止或修饰键点击，不处理
            if (event.defaultPrevented) return;
            if (event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            handleCommentPaginationClick(link, event);
        }, true);

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

            AnimController.abort();
            RAF.cancelAll();

            if (typeof window.OwoManager !== 'undefined' && window.OwoManager.destroy) {
                window.OwoManager.destroy();
            }

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

            // ✅ 预隐藏类：在 DOM 替换前添加，确保新内容被 CSS 自动隐藏
            // 解决闪烁问题：DOM 替换后、JS 执行前，内容已被隐藏
            document.documentElement.classList.add('ps-pre-enter');

            // 预测目标页面类型（通过 URL 模式）
            const toUrl = visit.to?.url || '';
            let predictedToType = PageType.LIST;
            let useVT = false;

            // 检测是否点击了列表页中的文章卡片
            const clickedPostCard = document.querySelector(VT.markerSelector);
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
                // VT模式下完全依赖浏览器原生动画，不添加自定义动画类
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

            // 性能优化：立即隐藏视口外的重内容，减少初始渲染压力
            optimizeInitialRender(toType);

            // ✅ 先设置元素级隐藏状态，再移除预隐藏类（避免闪烁）
            // 1. 立即设置内联样式（在DOM替换后第一时间隐藏元素）
            setInitialAnimationState(toType);

            // 2. 清理旧类（包括 ps-pre-enter）
            cleanupAnimationClasses();

            // 新的动画状态
            document.documentElement.classList.add('ps-animating');
            document.documentElement.classList.add('ps-enter-active');

            // 更新视口信息（窗口大小可能变化）
            VIEWPORT.update();

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

            // VT 共享元素（必须同步执行，VT 动画依赖于 viewTransitionName 的设置）
            syncPostSharedElementFromLocation(scrollPlugin);

            // 检测是否有 VT 共享元素
            const hasSharedElement = HAS_VT && Boolean(document.querySelector(VT.markerSelector));

            // 3. 添加进入动画类（在同一帧内完成）
            if (!hasSharedElement) {
                if (toType === PageType.PAGE) {
                    document.documentElement.classList.add('ps-page-enter');
                } else if (toType === PageType.POST) {
                    document.documentElement.classList.add('ps-post-enter');
                } else if (toType === PageType.LIST) {
                    document.documentElement.classList.add('ps-list-enter');
                }
            }

            document.dispatchEvent(new CustomEvent('swup:contentReplaced', {
                detail: {
                    emittedBy: 'ps-after-content-replace',
                    url: window.location.href,
                    pageType: toType,
                    hasSharedElement
                }
            }));

            requestAnimationFrame(() => {
                runEnterAnimation(toType, hasSharedElement);
            });
        });

        // ========== 动画流程：visit:end ==========
        swup.hooks.on('visit:end', () => {
            STATE.isSwupNavigating = false;

            // 使用 requestIdleCallback 在浏览器空闲时清理，避免阻塞
            scheduleIdleTask(() => {
                cleanupAnimationClasses();
            });
        });

        // ========== 页面加载完成 ==========
        swup.hooks.on('page:view', () => {
            const swupRoot = document.getElementById('swup') || document;
            const pageType = getPageType(window.location.href);
            const token = ++STATE.currentPageToken;
            const isCurrent = () => token === STATE.currentPageToken;

            // 更新导航栏（使用 requestIdleCallback 避免阻塞）
            scheduleIdleTask(() => {
                if (!isCurrent()) return;

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
            });

            // 标记元素
            scheduleIdleTask(() => {
                markAnimationElements(swupRoot);
            });

            // 分段初始化
            const phases = [];

            // TOC 初始化延迟（使用 requestIdleCallback）
            if ((pageType === PageType.POST || pageType === PageType.PAGE) && typeof initializeStickyTOC === 'function') {
                phases.push(() => {
                    if (!isCurrent()) return;
                    // 使用 requestIdleCallback 在浏览器空闲时初始化
                    scheduleIdleTask(() => {
                        if (!isCurrent()) return;
                        if (swupRoot.querySelector('#toc-section') || swupRoot.querySelector('.toc')) {
                            initializeStickyTOC();
                        }
                    });
                });
            }

            // Shortcodes 延迟（使用 requestIdleCallback）
            if (typeof runShortcodes === 'function') {
                phases.push(() => {
                    if (!isCurrent()) return;
                    scheduleIdleTask(() => {
                        if (!isCurrent()) return;
                        runShortcodes(swupRoot);
                    });
                });
            }

            // 评论区延迟初始化
            phases.push(() => {
                if (isCurrent()) {
                    setTimeout(() => {
                        if (!isCurrent()) return;
                        scheduleCommentsInit(swupRoot);
                    }, 600);
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

                // 清除 Swup 缓存，确保从服务器获取解锁后的内容
                swup.cache.clear();
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

        syncPostSharedElementFromLocation();

        // 修复初始加载闪烁：使用原子化类切换 + 提前设置内联样式
        STATE.lastNavigation.isSwup = false;
        const initialPageType = getPageType(window.location.href);

        // 移除预加载类（所有页面类型）
        const preloadClasses = ['ps-preload-list-enter', 'ps-preload-post-enter', 'ps-preload-page-enter'];
        const hasPreloadClass = preloadClasses.some(cls => document.documentElement.classList.contains(cls));

        if (hasPreloadClass) {
            // 方案2+3：使用 requestAnimationFrame 确保原子化类切换 + 提前设置内联样式
            requestAnimationFrame(() => {
                // 1. 提前设置内联样式（立即隐藏元素，不依赖CSS类）
                setInitialAnimationState(initialPageType);

                // 2. 原子化类切换（在同一帧内完成）
                preloadClasses.forEach(cls => document.documentElement.classList.remove(cls));

                if (initialPageType === PageType.LIST) {
                    document.documentElement.classList.add('ps-list-enter');
                } else if (initialPageType === PageType.POST) {
                    document.documentElement.classList.add('ps-post-enter');
                } else if (initialPageType === PageType.PAGE) {
                    document.documentElement.classList.add('ps-page-enter');
                }

                // 3. 立即执行进入动画（减少异步层级）
                requestAnimationFrame(() => {
                    runEnterAnimation(initialPageType, false);
                });
            });

            // 延迟清理动画类，确保动画完成
            setTimeout(() => {
                cleanupAnimationClasses();
            }, 1000);
        } else {
            // 没有预加载类，直接执行动画
            setInitialAnimationState(initialPageType);
            requestAnimationFrame(() => {
                runEnterAnimation(initialPageType, false);
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
