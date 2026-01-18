/**
 * PureSuck Swup 4 配置 - 重构版
 * 完整的页面过渡动画系统
 * 支持独立页面、文章页、列表页的完整动画
 */

(function() {
    'use strict';

    // ==================== AnimationFrameManager ====================
    /**
     * 统一管理所有 requestAnimationFrame 调用
     * 解决多个动画同时执行时的冲突问题
     */
    const AnimationFrameManager = {
        // 存储所有活动的动画帧ID
        frameIds: new Set(),
        // 存储元素到动画帧的映射，用于防止同一元素被多个动画同时操作
        elementToFrameId: new WeakMap(),
        // 存储优先级队列（数字越大优先级越高）
        priorityQueue: [],
        // 当前正在执行的帧ID
        currentFrameId: null,
        // 最大并发动画数
        maxConcurrentAnimations: 10,
        // 统计信息
        stats: {
            totalScheduled: 0,
            totalCancelled: 0,
            totalCompleted: 0
        },

        /**
         * 调度一个动画帧任务
         * @param {Function} callback - 要执行的回调函数
         * @param {Object} options - 选项
         * @param {Element} options.element - 关联的DOM元素（用于冲突检测）
         * @param {number} options.priority - 优先级（默认0，范围-10到10）
         * @param {string} options.group - 动画组标识（用于批量取消）
         * @returns {number} 动画帧ID
         */
        schedule(callback, options = {}) {
            if (typeof callback !== 'function') {
                return null;
            }

            const { element = null, priority = 0, group = null } = options;

            // 检查元素是否已经在动画中
            if (element && this.elementToFrameId.has(element)) {
                const existingFrameId = this.elementToFrameId.get(element);
                // 取消旧动画（新动画优先级更高或相同）
                this.cancel(existingFrameId);
                this.stats.totalCancelled++;
            }

            // 创建包装回调
            const frameId = ++this.stats.totalScheduled;
            const wrappedCallback = (timestamp) => {
                // 检查是否已被取消
                if (!this.frameIds.has(frameId)) {
                    return;
                }

                // 移除元素映射
                if (element) {
                    this.elementToFrameId.delete(element);
                }

                // 执行回调
                try {
                    callback(timestamp);
                } catch (error) {
                    // Animation callback error silently ignored
                }

                // 标记完成
                this.frameIds.delete(frameId);
                this.stats.totalCompleted++;
            };

            // 存储帧ID和元数据
            this.frameIds.add(frameId);
            if (element) {
                this.elementToFrameId.set(element, frameId);
            }

            // 添加到优先级队列
            if (priority !== 0) {
                this.priorityQueue.push({ frameId, priority, group });
                this.priorityQueue.sort((a, b) => b.priority - a.priority);
            }

            // 调度动画帧
            const rafId = requestAnimationFrame(wrappedCallback);
            
            // 存储 rafId 以便取消
            this.frameIds.add(rafId);

            return frameId;
        },

        /**
         * 取消指定的动画帧
         * @param {number} frameId - 要取消的帧ID
         */
        cancel(frameId) {
            if (!frameId) return;

            // 从集合中移除
            if (this.frameIds.has(frameId)) {
                this.frameIds.delete(frameId);
                this.stats.totalCancelled++;
            }

            // 从优先级队列中移除
            const queueIndex = this.priorityQueue.findIndex(item => item.frameId === frameId);
            if (queueIndex > -1) {
                this.priorityQueue.splice(queueIndex, 1);
            }
        },

        /**
         * 取消所有指定组的动画
         * @param {string} group - 组标识
         */
        cancelGroup(group) {
            if (!group) return;

            const toCancel = this.priorityQueue
                .filter(item => item.group === group)
                .map(item => item.frameId);

            toCancel.forEach(frameId => this.cancel(frameId));
        },

        /**
         * 取消所有动画
         */
        cancelAll() {
            const count = this.frameIds.size;
            this.frameIds.clear();
            this.priorityQueue = [];
            this.stats.totalCancelled += count;
        },

        /**
         * 获取当前活动动画数量
         * @returns {number}
         */
        getActiveCount() {
            return this.frameIds.size;
        },

        /**
         * 获取统计信息
         * @returns {Object}
         */
        getStats() {
            return {
                ...this.stats,
                active: this.frameIds.size,
                queued: this.priorityQueue.length
            };
        },

        /**
         * 清理统计信息
         */
        resetStats() {
            this.stats = {
                totalScheduled: 0,
                totalCancelled: 0,
                totalCompleted: 0
            };
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

    // ==================== 代码高亮懒加载 ====================
    // 用于视口外代码块的按需高亮
    function setupLazyHighlighting(blocks, isCurrent) {
        if (!blocks.length || typeof IntersectionObserver !== 'function') {
            // 降级：直接延迟处理
            setTimeout(() => {
                if (!isCurrent()) return;
                scheduleIdleBatched(blocks, 2, (block) => {
                    if (!isCurrent()) return;
                    hljs.highlightElement(block);
                    block.dataset.highlighted = 'true';
                }, isCurrent);
            }, 500);
            return;
        }

        let highlighted = 0;
        const total = blocks.length;

        const io = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const block = entry.target;
                io.unobserve(block);
                if (block.dataset.highlighted === 'true') continue;

                // 使用 requestIdleCallback 延迟执行
                scheduleIdleTask(() => {
                    if (!isCurrent()) return;
                    hljs.highlightElement(block);
                    block.dataset.highlighted = 'true';
                    highlighted++;

                    // 全部完成后断开观察
                    if (highlighted >= total) {
                        io.disconnect();
                    }
                });
            }
        }, { rootMargin: '100px 0px', threshold: 0.01 });

        blocks.forEach(block => io.observe(block));
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

    // ==================== 可见性检查 ====================
    // 性能优化版：使用 IntersectionObserver 避免强制 reflow
    const VIEWPORT = {
        top: 0,
        bottom: 0,
        buffer: 150,
        visibleElements: new WeakSet(),

        update() {
            this.top = 0;
            this.bottom = window.innerHeight + this.buffer;
        },

        isVisible(el) {
            if (!el) return false;

            // 使用缓存的结果，避免重复的 reflow
            if (this.visibleElements.has(el)) {
                return true;
            }

            // 一次性读取布局信息
            const rect = el.getBoundingClientRect();
            const isVisible = rect.top < this.bottom && rect.bottom > this.top;

            // 缓存可见元素
            if (isVisible && rect.top < window.innerHeight) {
                this.visibleElements.add(el);
            }

            return isVisible;
        },

        clearCache() {
            this.visibleElements = new WeakSet();
        },

        init() {
            this.update();
            window.addEventListener('resize', () => {
                this.update();
                this.clearCache();
            }, { passive: true });
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
                maxItems: 20,  // 覆盖常见的一页文章数
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
        return VIEWPORT.isVisible(el);
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

    function markAnimationElements(root = document) {
        const scope = root?.querySelector ? root : document;

        // 仅标记元素，不再进行 observe（已移除 VISIBILITY 系统）
        scope.querySelectorAll('.post:not([data-swup-animation])').forEach(el => {
            el.setAttribute('data-swup-animation', '');
        });

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
            'ps-vt-mode'
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
            el.style.willChange = '';
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
     * 策略：使用 content-visibility 延迟渲染视口外内容，同时避免副作用
     *
     * @param {string} pageType - 页面类型
     */
    function optimizeInitialRender(pageType) {
        const swupRoot = document.getElementById('swup');
        if (!swupRoot) return;

        if (pageType === PageType.POST) {
            optimizePostPage(swupRoot);
        } else if (pageType === PageType.PAGE) {
            optimizeStandalonePage(swupRoot);
        } else if (pageType === PageType.LIST) {
            optimizeListPage(swupRoot);
        }

        // 优化图片加载
        optimizeImageLoading(swupRoot, pageType);
    }

    /**
     * 优化文章页渲染
     */
    function optimizePostPage(root) {
        // 暂时禁用 content-visibility 优化，可能导致性能问题
        return;
    }

    /**
     * 优化独立页渲染
     */
    function optimizeStandalonePage(root) {
        // 暂时禁用 content-visibility 优化，可能导致性能问题
        return;
    }

    /**
     * 优化列表页渲染
     */
    function optimizeListPage(root) {
        // 暂时禁用优化，避免副作用
        return;
    }

    /**
     * 判断元素是否应该跳过 content-visibility 优化
     * 避免影响关键功能和显示
     */
    function shouldSkipContentVisibility(element) {
        // 有 id 的元素（锚点目标）
        if (element.id) return true;

        // 列表元素（避免 ::marker 问题）
        if (element.tagName === 'UL' || element.tagName === 'OL') return true;

        // 表格（可能有复杂的伪元素）
        if (element.tagName === 'TABLE') return true;

        // 包含表单的元素
        if (element.querySelector('input, textarea, select, button')) return true;

        // 包含 SVG 的元素（可能有复杂渲染）
        if (element.querySelector('svg')) return true;

        // 代码块（可能需要立即高亮）
        if (element.tagName === 'PRE' && element.querySelector('code')) return true;

        return false;
    }

    /**
     * 估算元素高度
     * 根据元素类型返回合理的高度估算值
     */
    function estimateElementHeight(element) {
        const tagName = element.tagName;

        // 根据标签类型估算高度
        if (tagName === 'P') return 100;
        if (tagName === 'H1' || tagName === 'H2') return 60;
        if (tagName === 'H3' || tagName === 'H4') return 50;
        if (tagName === 'BLOCKQUOTE') return 150;
        if (tagName === 'PRE') return 300;
        if (tagName === 'DIV') {
            // DIV 根据内容估算
            const textLength = element.textContent?.length || 0;
            return Math.max(100, Math.min(500, textLength / 5));
        }

        return 200; // 默认值
    }

    /**
     * 在浏览器空闲时逐步移除 content-visibility
     * 让内容正常渲染，避免布局问题
     * @param {Array} elements - 需要渐进显示的元素数组
     */
    function scheduleProgressiveReveal(elements) {
        if (!elements || elements.length === 0) return;

        // 批次大小：每次处理的元素数量
        const batchSize = 3;
        let index = 0;

        const revealBatch = () => {
            const end = Math.min(index + batchSize, elements.length);

            for (let i = index; i < end; i++) {
                const el = elements[i];
                if (!el || !el.isConnected) continue;

                // 移除 content-visibility，让内容正常渲染
                el.style.contentVisibility = '';
                el.style.containIntrinsicSize = '';
                el.removeAttribute('data-ps-deferred');
            }

            index = end;

            // 如果还有剩余元素，继续调度
            if (index < elements.length) {
                scheduleIdleTask(revealBatch);
            }
        };

        // 延迟启动，让首屏动画先完成
        setTimeout(() => {
            scheduleIdleTask(revealBatch);
        }, 800);
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
        if (typeof IntersectionObserver !== 'function') return;

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

    /**
     * 优化字体加载
     * 使用 Font Loading API 和 requestIdleCallback 优化字体加载
     */
    function optimizeFontLoading() {
        // 检查 Font Loading API 是否可用
        if (typeof document.fonts === 'undefined' || typeof document.fonts.load !== 'function') {
            return;
        }

        // 在浏览器空闲时预加载关键字体
        scheduleIdleTask(() => {
            // 预加载常用字重的字体
            const fontsToPreload = [
                // 根据你的主题实际使用的字体调整
                '400 16px system-ui',
                '500 16px system-ui',
                '600 16px system-ui',
                '700 16px system-ui'
            ];

            fontsToPreload.forEach(font => {
                try {
                    document.fonts.load(font).catch(() => {
                        // 忽略加载失败，使用系统字体降级
                    });
                } catch (e) {
                    // 忽略错误
                }
            });
        });

        // 监听字体加载完成事件
        if (document.fonts.ready) {
            document.fonts.ready.then(() => {
                // 字体加载完成后，标记 body 以触发字体相关的 CSS 优化
                document.body.classList.add('fonts-loaded');
            }).catch(() => {
                // 忽略错误
            });
        }
    }

    // ==================== 进入动画 ====================

    /**
     * 提前设置元素的初始动画状态（内联样式）
     * 这样可以避免依赖CSS类的样式计算延迟，立即隐藏元素
     * @param {string} pageType - 页面类型
     */
    function setInitialAnimationState(pageType) {
        if (prefersReducedMotion()) return;

        let targets = [];
        let y = 12; // 默认位移

        if (pageType === PageType.POST) {
            targets = collectPostEnterTargets();
            y = ANIM.enter.post.y;
        } else if (pageType === PageType.PAGE) {
            const pageTargets = collectPageEnterTargets();
            if (pageTargets.card) targets.push(pageTargets.card);
            targets.push(...pageTargets.inner);
            y = ANIM.enter.page.card.y;
        } else if (pageType === PageType.LIST) {
            targets = collectListEnterTargets();
            y = ANIM.enter.list.y;
        }

        // 立即设置所有元素的初始状态（内联样式优先级最高）
        targets.forEach(el => {
            if (!el) return;
            el.style.opacity = '0';
            el.style.transform = `translate3d(0, ${y}px, 0)`;
            el.style.willChange = 'opacity, transform';
        });
    }

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

        // 注意：由于已经通过 setInitialAnimationState 设置过初始状态，
        // 这里传递 skipInitialState = true 避免重复DOM操作
        const skipInitialState = true;

        if (toType === PageType.POST) {
            const targets = collectPostEnterTargets();
            animateLightEnter(targets, baseDelay, {
                duration: ANIM.enter.post.duration,
                stagger: ANIM.enter.post.stagger,
                y: ANIM.enter.post.y,
                easing: ANIM.enter.post.easing,
                batchSize: ANIM.enter.post.batchSize,
                batchGap: ANIM.enter.post.batchGap
            }, skipInitialState);
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
                }, skipInitialState);
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
                }, skipInitialState);
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
            }, skipInitialState);
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

        const vtMarker = main.querySelector(`[${VT.markerAttr}]`);
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
     * 执行轻量级进入动画（性能优化版）
     * @param {Array} targets - 目标元素数组
     * @param {number} baseDelay - 基础延迟（毫秒）
     * @param {Object} options - 动画配置
     * @param {boolean} skipInitialState - 是否跳过初始状态设置（如果已经通过setInitialAnimationState设置）
     */
    function animateLightEnter(targets, baseDelay = 0, options = {}, skipInitialState = false) {
        if (!targets?.length) return;

        const duration = options.duration ?? 380;
        const stagger = options.stagger ?? 32;
        const y = options.y ?? 16;
        const scale = options.scale ?? 1;
        const easing = options.easing ?? 'cubic-bezier(0.2, 0.8, 0.2, 1)';
        const batchSize = options.batchSize ?? 8;
        const batchGap = options.batchGap ?? BREATH.batchGapMs;

        // 性能优化：元素较少时一次性处理，避免setTimeout
        const useSingleBatch = targets.length <= batchSize;

        let index = 0;
        const total = targets.length;

        // 只在未提前设置初始状态时才设置（避免重复DOM操作）
        if (!skipInitialState) {
            targets.forEach((el) => {
                // 动画开始前添加 will-change 提示浏览器优化
                el.style.willChange = 'opacity, transform';
                el.style.opacity = '0';
                const initialTransform = scale !== 1
                    ? `translate3d(0, ${y}px, 0) scale(${scale})`
                    : `translate3d(0, ${y}px, 0)`;
                el.style.transform = initialTransform;
                el.setAttribute('data-ps-animating', '');
            });
        } else {
            // 已经设置过初始状态，只需添加动画标记
            targets.forEach((el) => {
                el.setAttribute('data-ps-animating', '');
            });
        }

        const runBatch = () => {
            const batch = targets.slice(index, index + batchSize);
            if (!batch.length) return;

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

                // 使用新的 register API，传入元素以便自动清理
                AnimController.register(anim, el);
            });

            index += batchSize;
            if (index < total && !useSingleBatch) {
                setTimeout(runBatch, batchGap);
            }
        };

        AnimationFrameManager.schedule(runBatch, {
            priority: 3,
            group: 'enter-animation'
        });
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
                AnimationFrameManager.schedule(animateScroll, {
                    priority: 5,
                    group: 'scroll'
                });
            }
        }

        AnimationFrameManager.schedule(animateScroll, {
            priority: 5,
            group: 'scroll'
        });
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
     * @param {string} urlString - 要获取的 URL
     * @param {Object} options - 选项
     * @param {boolean} options.restoreScroll - 是否恢复滚动位置，默认 true
     */
    async function refreshCommentsFromUrl(urlString, options = {}) {
        const { restoreScroll = true } = options;
        const current = document.getElementById('comments');
        if (!current) return false;

        if (!isSameOriginUrl(urlString)) return false;

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

            // 使用 AnimationFrameManager 确保滚动和焦点恢复在正确的时机执行
            AnimationFrameManager.schedule(() => {
                if (restoreScroll) {
                    window.scrollTo(0, prevScrollY);
                }
                if (activeId) {
                    const el = document.getElementById(activeId);
                    if (el?.focus) {
                        try { el.focus({ preventScroll: true }); } catch { el.focus(); }
                    }
                }
            }, { priority: 3, group: 'comment-refresh' });

            scheduleCommentsInit(document, { eager: true });

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
     * 调度评论区 OwO 初始化
     * 使用 IntersectionObserver 延迟加载，提升性能
     * @param {Element} root - 根元素
     * @param {Object} options - 配置选项
     * @param {boolean} options.eager - 是否立即初始化
     */
    function scheduleCommentsInit(root, options = {}) {
        // 只检查初始化函数是否存在
        if (typeof initializeCommentsOwO !== 'function') {
            return;
        }

        const scope = root?.querySelector ? root : document;
        const commentTextarea = scope.querySelector('.OwO-textarea');
        if (!commentTextarea) return;

        const commentsRoot = commentTextarea.closest('#comments')
            || commentTextarea.closest('.post-comments')
            || commentTextarea;

        if (!commentsRoot || commentsRoot.dataset.psOwoInit === 'done') return;

        // 标记为待初始化
        commentsRoot.dataset.psOwoInit = 'pending';

        const runInit = () => {
            // 检查元素是否仍在 DOM 中
            if (!commentsRoot.isConnected) return;

            // 防止重复初始化
            if (commentsRoot.dataset.psOwoInit === 'done') return;

            // 标记为已初始化
            commentsRoot.dataset.psOwoInit = 'done';

            // 调用初始化函数
            initializeCommentsOwO();
        };

        // 立即初始化的情况：
        // 1. 明确要求 eager 模式
        // 2. URL 包含 #comments 锚点
        // 3. 评论框已获得焦点
        if (options.eager || window.location.hash === '#comments' || document.activeElement === commentTextarea) {
            scheduleIdleTask(runInit);
            return;
        }

        // 降级处理：不支持 IntersectionObserver 时延迟初始化
        if (typeof IntersectionObserver !== 'function') {
            scheduleIdleTask(runInit);
            return;
        }

        // 使用 IntersectionObserver 延迟加载
        // 当评论区进入视口附近时才初始化
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
                AnimationFrameManager.schedule(() => {
                    const rect = card.getBoundingClientRect();
                    if (rect.bottom < 0 || rect.top > window.innerHeight) {
                        AnimationFrameManager.schedule(() => {
                            card.scrollIntoView({ block: 'center', inline: 'nearest' });
                        }, { priority: 4, group: 'vt-scroll' });
                    }
                }, { priority: 4, group: 'vt-check' });
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
            // 排除评论区的链接，让它们保持原生行为
            // 通过 data-no-swup 属性或在捕获阶段阻止来处理
            linkSelector: 'a[href]:not([data-no-swup]):not(.page-navigator a):not(#comments a):not(a[href^="#"])',
            animateHistoryBrowsing: HAS_VT,
            native: HAS_VT,
            animationSelector: false
        });

        // 保存 swup 实例到全局，供拦截代码使用
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

            // 打断之前的动画（包括 AnimationFrameManager 中的动画）
            AnimController.abort();
            AnimationFrameManager.cancelAll();

            // ✅ 清理 OwO 实例（页面切换时释放资源）
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

            // 性能优化：立即隐藏视口外的重内容，减少初始渲染压力
            optimizeInitialRender(toType);

            // 清理旧类
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

            // VT 共享元素
            syncPostSharedElementFromLocation(scrollPlugin);

            // 检测是否有 VT 共享元素
            const hasSharedElement = HAS_VT && Boolean(document.querySelector(`[${VT.markerAttr}]`));

            // 方案2+3+4：提前设置内联样式 + 原子化类切换 + 减少异步层级
            // 1. 立即设置内联样式（在DOM替换后第一时间隐藏元素）
            setInitialAnimationState(toType);

            // 2. 添加进入动画类（在同一帧内完成）
            if (!hasSharedElement) {
                if (toType === PageType.PAGE) {
                    document.documentElement.classList.add('ps-page-enter');
                } else if (toType === PageType.POST) {
                    document.documentElement.classList.add('ps-post-enter');
                } else if (toType === PageType.LIST) {
                    document.documentElement.classList.add('ps-list-enter');
                }
            }

            // 3. 简化异步调用链，尽快执行动画
            // 发送自定义事件
            document.dispatchEvent(new CustomEvent('swup:contentReplaced', {
                detail: {
                    emittedBy: 'ps-after-content-replace',
                    url: window.location.href,
                    pageType: toType,
                    hasSharedElement
                }
            }));

            // 根据是否有VT选择执行路径
            if (!HAS_VT) {
                // 无VT：直接在下一帧执行动画
                requestAnimationFrame(() => {
                    runEnterAnimation(toType, false);
                });
            } else {
                // 有VT：等待VT完成后执行动画
                waitForViewTransition().then(() => {
                    requestAnimationFrame(() => {
                        runEnterAnimation(toType, hasSharedElement);
                    });
                });
            }
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

            // 代码高亮：支持文章页、独立页、列表页
            if (typeof hljs !== 'undefined') {
                phases.push(() => {
                    if (!isCurrent()) return;

                    // 性能优化：延迟执行代码高亮，让页面先渲染和动画
                    setTimeout(() => {
                        if (!isCurrent()) return;

                        // 使用 :not([data-highlighted]) 避免重复
                        const allBlocks = Array.from(swupRoot.querySelectorAll('pre code:not([data-highlighted])'));

                        // 性能优化：批量读取布局信息，避免多次 reflow
                        const viewportBlocks = [];
                        const offscreenBlocks = [];

                        VIEWPORT.update();
                        const viewportBottom = window.innerHeight + 150;

                        // 批量读取所有代码块的位置（一次性 reflow）
                        const rects = new Map();
                        for (const block of allBlocks) {
                            const rect = block.getBoundingClientRect();
                            rects.set(block, rect);
                            // 简单判断：顶部在视口内的算可见
                            if (rect.top < viewportBottom && rect.bottom > 0) {
                                viewportBlocks.push(block);
                            } else {
                                offscreenBlocks.push(block);
                            }
                        }

                        // 先高亮视口内的，批次更小避免阻塞
                        scheduleIdleBatched(viewportBlocks, 2, (block) => {
                            if (!isCurrent()) return;
                            hljs.highlightElement(block);
                            block.dataset.highlighted = 'true';
                        }, isCurrent);

                        // 视口外的延迟更久处理（用 IntersectionObserver 按需触发）
                        if (offscreenBlocks.length > 0) {
                            setupLazyHighlighting(offscreenBlocks, isCurrent);
                        }
                    }, 500); // 延迟 500ms，让页面先完全渲染
                });
            }

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

        syncPostSharedElementFromLocation(scrollPlugin);

        // 优化字体加载（在浏览器空闲时）
        optimizeFontLoading();

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
