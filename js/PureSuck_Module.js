/** 这个JS包含了各种需要处理的的内容 **/
/** 回到顶部按钮，TOC目录，内部卡片部分内容解析都在这里 **/

const initializeTOC = (() => {
    let state = null;
    let listenersBound = false;
    let hashTimer = 0;
    let scrollEndTimer = 0;
    let scrollEndHandler = null;
    let rafId = null; // 用于节流 IntersectionObserver 回调
    let refreshRaf = 0;

    function reset() {
        if (!state) return;

        if (hashTimer) {
            clearTimeout(hashTimer);
            hashTimer = 0;
        }

        if (scrollEndHandler) {
            window.removeEventListener("scroll", scrollEndHandler);
            scrollEndHandler = null;
        }

        if (scrollEndTimer) {
            clearTimeout(scrollEndTimer);
            scrollEndTimer = 0;
        }

        if (refreshRaf) {
            cancelAnimationFrame(refreshRaf);
            refreshRaf = 0;
        }

        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }

        const previousElement = state.elements[state.activeIndex];
        if (previousElement && previousElement.id) {
            const previousLink = state.linkById.get(previousElement.id);
            if (previousLink) {
                previousLink.classList.remove("li-active");
            }
        }

        state = null;
    }

    function refreshLayout() {
        if (!state) return;
        bindObserver();
        setActive(getInitialActiveIndex());
    }

    function scheduleRefreshLayout() {
        if (refreshRaf) cancelAnimationFrame(refreshRaf);
        refreshRaf = requestAnimationFrame(() => {
            refreshRaf = 0;
            refreshLayout();
        });
    }

    function getInitialActiveIndex() {
        if (!state) return 0;
        const activationOffset = state.activationOffset;
        let activeIndex = 0;

        // ✅ 优先使用 IntersectionObserver 缓存的位置数据，避免触发 reflow
        const hasCachedData = state.topByIndex && state.topByIndex.size > 0;

        if (hasCachedData) {
            // 使用缓存数据计算
            for (let index = 0; index < state.elements.length; index++) {
                const cachedTop = state.topByIndex.get(index);
                if (cachedTop != null && cachedTop <= activationOffset) {
                    activeIndex = index;
                }
            }
        } else {
            // 降级：一次性获取所有 boundingClientRect，避免循环中多次触发 reflow
            const rects = state.elements.map(el => el.getBoundingClientRect().top);

            for (let index = 0; index < rects.length; index++) {
                if (rects[index] <= activationOffset) {
                    activeIndex = index;
                } else {
                    break;
                }
            }
        }

        return activeIndex;
    }

    function bindObserver() {
        if (!state) return;
        if (state.observer) {
            state.observer.disconnect();
        }

        state.intersecting.clear();

        const activationRatio = 0.15;
        const bottomRatio = 1;
        state.activationOffset = Math.round(window.innerHeight * activationRatio);
        state.observer = new IntersectionObserver(handleIntersect, {
            rootMargin: `-${activationRatio * 100}% 0px -${bottomRatio * 100}% 0px`,
            threshold: 0
        });

        state.elements.forEach(element => {
            if (element.id) {
                state.observer.observe(element);
            }
        });
    }

    function handleIntersect(entries) {
        if (!state || !state.indexByElement) return;

        // 取消之前的 RAF，避免重复处理
        if (rafId) cancelAnimationFrame(rafId);

        // IntersectionObserver 已经是异步批量回调，直接用 RAF 优化即可
        rafId = requestAnimationFrame(() => {
            if (!state || !state.indexByElement) {
                rafId = null;
                return;
            }

            let bestIndex = -1;
            let bestDistance = Infinity;

            entries.forEach(entry => {
                if (!entry || !entry.target) return;
                const index = state.indexByElement.get(entry.target);
                if (index == null) return;
                if (entry.isIntersecting) {
                    state.intersecting.add(index);
                    state.topByIndex.set(index, entry.boundingClientRect.top);
                } else {
                    state.intersecting.delete(index);
                }
            });

            state.intersecting.forEach(index => {
                const top = state.topByIndex.get(index);
                if (top == null) return;
                const distance = Math.abs(top - state.activationOffset);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = index;
                }
            });

            // 当没有元素在激活区域内时，找到最接近激活区域的元素
            // 这处理向上/向下滚动到页面顶部/底部的情况
            if (bestIndex < 0 && state.topByIndex.size > 0) {
                let closestDistance = Infinity;
                state.topByIndex.forEach((top, index) => {
                    if (top == null) return;
                    const distance = Math.abs(top - state.activationOffset);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        bestIndex = index;
                    }
                });
            }

            if (bestIndex >= 0) {
                setActive(bestIndex);
            }

            rafId = null;
        });
    }

    function setActive(index) {
        if (!state) return;
        if (index < 0 || index >= state.elements.length) return;
        if (state.activeIndex === index) return;

        const element = state.elements[index];
        if (!element || !element.id) return;
        const link = state.linkById.get(element.id);
        if (!link) return;

        const previousElement = state.elements[state.activeIndex];
        if (previousElement && previousElement.id) {
            const previousLink = state.linkById.get(previousElement.id);
            if (previousLink) {
                previousLink.classList.remove("li-active");
            }
        }

        link.classList.add("li-active");
        state.activeIndex = index;

        const item = state.itemById.get(element.id);
        if (state.siderbar && item) {
            state.siderbar.style.transform = `translate3d(0, ${item.offsetTop + 4}px, 0)`;
        }
    }

    function waitForScrollEnd(done, timeout = 160) {
        if (scrollEndHandler) {
            window.removeEventListener("scroll", scrollEndHandler);
            scrollEndHandler = null;
        }

        if (scrollEndTimer) {
            clearTimeout(scrollEndTimer);
            scrollEndTimer = 0;
        }

        scrollEndHandler = () => {
            if (scrollEndTimer) {
                clearTimeout(scrollEndTimer);
            }
            scrollEndTimer = window.setTimeout(() => {
                window.removeEventListener("scroll", scrollEndHandler);
                scrollEndHandler = null;
                scrollEndTimer = 0;
                done();
            }, timeout);
        };

        window.addEventListener("scroll", scrollEndHandler, { passive: true });
        scrollEndHandler();
    }

    function handleClick(event) {
        if (!state) return;
        const link = event.target instanceof Element ? event.target.closest(".toc-a") : null;
        if (!link) return;

        const href = link.getAttribute("href");
        if (!href || href.charAt(0) !== "#") return;

        event.preventDefault();
        event.stopPropagation();

        const targetId = href.slice(1);
        const targetElement = document.getElementById(targetId);
        if (!targetElement) return;

        // 使用原始实现：getBoundingClientRect + scrollTo
        const targetTop = targetElement.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
            top: targetTop,
            behavior: "smooth"
        });

        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }

        if (hashTimer) {
            clearTimeout(hashTimer);
        }
        hashTimer = window.setTimeout(() => {
            window.location.hash = targetId;
            hashTimer = 0;
        }, 300);

        const index = state.indexById.get(targetId);
        if (index != null) {
            setActive(index);
        }

        waitForScrollEnd(() => {
            // 清理缓存，因为滚动后位置已变化
            state.topByIndex.clear();
            state.intersecting.clear();
            bindObserver();
            // 使用当前目标索引，不重新计算（避免使用过期缓存）
            if (index != null) {
                setActive(index);
            }
        });
    }

    return function initializeTOC() {
        const tocSection = document.getElementById("toc-section");
        const toc = document.querySelector(".toc");
        const postWrapper = document.querySelector(".inner-post-wrapper");

        if (!toc || !postWrapper) {
            reset();
            return;
        }

        const elements = Array.from(postWrapper.querySelectorAll("h1, h2, h3, h4, h5, h6"));
        const links = Array.from(toc.querySelectorAll(".toc-a"));
        const siderbar = document.querySelector(".siderbar");

        if (!elements.length || !links.length || !siderbar) {
            reset();
            return;
        }

        siderbar.style.transition = "transform 0.5s ease";

        if (tocSection) {
            tocSection.style.display = "block";
            const rightSidebar = document.querySelector(".right-sidebar");
            if (rightSidebar) {
                rightSidebar.style.position = "absolute";
                rightSidebar.style.top = "0";
            }
        }

        links.forEach(link => {
            link.setAttribute("no-pjax", "");
            link.classList.remove("li-active");
        });

        state = {
            elements,
            links,
            siderbar,
            activeIndex: -1,
            indexByElement: new Map(),
            indexById: new Map(),
            linkById: new Map(),
            itemById: new Map(),
            topByIndex: new Map(),
            activationOffset: 0,
            observer: null,
            intersecting: new Set()
        };

        state.elements.forEach((element, index) => {
            state.indexByElement.set(element, index);
            if (element.id) {
                state.indexById.set(element.id, index);
            }
        });

        state.links.forEach(link => {
            const href = link.getAttribute("href");
            if (!href || href.charAt(0) !== "#") return;
            const id = href.slice(1);
            state.linkById.set(id, link);
            const item = link.closest("li");
            if (item) {
                state.itemById.set(id, item);
            }
        });

        if (toc.dataset.binded !== "1") {
            toc.addEventListener("click", handleClick, true);
            toc.dataset.binded = "1";
        }

        if (!listenersBound) {
            listenersBound = true;
            window.addEventListener("resize", scheduleRefreshLayout, { passive: true });
            window.addEventListener("orientationchange", scheduleRefreshLayout);
            window.addEventListener("load", scheduleRefreshLayout, { once: true });
        }

        refreshLayout();
    };
})();

const GoTopButton = (() => {
    let bound = false;
    let button = null;
    let anchor = null;
    let sentinel = null;
    let observer = null;

    function sync(root) {
        const scope = root && root.querySelector ? root : document;
        button = scope.querySelector('#go-top') || document.querySelector('#go-top');
        anchor = button ? button.querySelector('.go') : null;
    }

    // ✅ 使用 IntersectionObserver 替代滚动监听，消除强制重排
    function createSentinel() {
        if (sentinel) return sentinel;

        sentinel = document.createElement('div');
        sentinel.id = 'go-top-sentinel';
        sentinel.setAttribute('aria-hidden', 'true');
        sentinel.style.cssText = 'position:absolute;top:100px;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden;';
        document.body.appendChild(sentinel);
        return sentinel;
    }

    function handleIntersect(entries) {
        if (!button) return;
        const [entry] = entries;
        // sentinel 不可见时（滚动超过 100px），显示按钮
        if (entry.isIntersecting) {
            button.classList.remove('visible');
        } else {
            button.classList.add('visible');
        }
    }

    function initObserver() {
        if (observer) {
            observer.disconnect();
        }

        const sentinelEl = createSentinel();
        observer = new IntersectionObserver(handleIntersect, {
            root: null,
            threshold: 0,
            rootMargin: '0px'
        });
        observer.observe(sentinelEl);
    }

    function onClick(event) {
        const target = event.target instanceof Element
            ? event.target.closest('#go-top .go')
            : null;
        if (!target) return;

        event.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        setTimeout(() => {
            const current = document.querySelector('#go-top');
            if (current) current.classList.remove('visible');
        }, 400);
    }

    return function init(root) {
        sync(root);
        if (!button || !anchor) return;

        if (!bound) {
            bound = true;
            document.addEventListener('click', onClick, true);
        }

        // ✅ 每次初始化时重新设置 observer（支持 Swup 页面切换）
        initObserver();
    };
})();

function handleGoTopButton(root) {
    GoTopButton(root);
}

function bindCollapsiblePanels(root) {
    const scope = root && root.querySelector ? root : document;
    const panels = scope.querySelectorAll('.collapsible-panel');

    panels.forEach(panel => {
        if (panel.dataset.binded === "1") return;
        panel.dataset.binded = "1";

        const button = panel.querySelector('.collapsible-header');
        const contentDiv = panel.querySelector('.collapsible-content');
        const icon = button ? button.querySelector('.icon') : null;

        if (!button || !contentDiv) return;

        // ✅ 预缓存 scrollHeight，避免点击时同步读取影响 INP
        let cachedScrollHeight = 0;

        const updateCache = () => {
            cachedScrollHeight = contentDiv.scrollHeight;
        };

        // 使用 requestIdleCallback 预缓存
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(updateCache, { timeout: 500 });
        } else {
            setTimeout(updateCache, 100);
        }

        // 使用 ResizeObserver 监听内容变化时更新缓存
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                // 只在展开状态下更新缓存
                if (contentDiv.style.maxHeight && contentDiv.style.maxHeight !== '0px') {
                    cachedScrollHeight = contentDiv.scrollHeight;
                }
            });
            resizeObserver.observe(contentDiv);
        }

        button.addEventListener('click', function () {
            this.classList.toggle('active');

            if (contentDiv.style.maxHeight && contentDiv.style.maxHeight !== '0px') {
                contentDiv.style.maxHeight = '0px';
                if (icon) {
                    icon.classList.remove('icon-up-open');
                    icon.classList.add('icon-down-open');
                }
            } else {
                // ✅ 使用缓存值，如果缓存为空则降级读取
                const height = cachedScrollHeight || contentDiv.scrollHeight;
                contentDiv.style.maxHeight = height + "px";
                // 更新缓存以备下次使用
                if (!cachedScrollHeight) {
                    cachedScrollHeight = height;
                }
                if (icon) {
                    icon.classList.remove('icon-down-open');
                    icon.classList.add('icon-up-open');
                }
            }
        });
    });
}

function bindTabs(root) {
    const scope = root && root.querySelector ? root : document;
    const tabContainers = scope.querySelectorAll('.tab-container');

    tabContainers.forEach(container => {
        if (container.dataset.binded === "1") return;
        container.dataset.binded = "1";

        const tabHeader = container.querySelector('.tab-header');
        if (!tabHeader) return;

        const tabLinks = Array.from(tabHeader.querySelectorAll('.tab-link'));
        const tabPanes = Array.from(container.querySelectorAll('.tab-pane'));
        const indicator = tabHeader.querySelector('.tab-indicator');

        if (!tabLinks.length || !indicator) return;

        let cachedWidths = [];
        let cachedOffsets = [];

        // ✅ 单次遍历同时读取 offsetWidth 和 offsetLeft，减少强制重排
        const updateCache = () => {
            const metrics = tabLinks.map(l => ({ w: l.offsetWidth, o: l.offsetLeft }));
            cachedWidths = metrics.map(m => m.w);
            cachedOffsets = metrics.map(m => m.o);
        };

        const updateIndicator = index => {
            requestAnimationFrame(() => {
                // ✅ 使用 transform 代替 left，性能更好（GPU加速）
                const x = cachedOffsets[index] + cachedWidths[index] * 0.125;
                indicator.style.width = `${cachedWidths[index] * 0.75}px`;
                indicator.style.transform = `translateX(${x}px)`;
            });
        };

        const updateLayout = () => {
            updateCache();
            const activeIndex = tabLinks.findIndex(l => l.classList.contains('active'));
            updateIndicator(activeIndex >= 0 ? activeIndex : 0);
        };

        if (window.ResizeObserver) {
            new ResizeObserver(updateLayout).observe(tabHeader);
        }

        tabHeader.addEventListener('click', e => {
            const target = e.target.closest('.tab-link');
            if (!target) return;

            const newIndex = tabLinks.indexOf(target);
            const oldIndex = tabLinks.findIndex(l => l.classList.contains('active'));
            if (newIndex === oldIndex) return;

            tabHeader.classList.remove('dir-left', 'dir-right');
            tabHeader.classList.add(newIndex > oldIndex ? 'dir-right' : 'dir-left');

            tabLinks.forEach(l => {
                l.classList.remove('active');
                l.setAttribute('tabindex', '-1');
            });

            tabPanes.forEach(p => p.classList.remove('active'));

            target.classList.add('active');
            target.setAttribute('tabindex', '0');
            target.focus();

            if (tabPanes[newIndex]) {
                tabPanes[newIndex].classList.add('active');
            }
            updateIndicator(newIndex);
        });

        updateLayout();
    });
}

/**
 * TOC Sticky 控制器 - 性能优化版
 */
const initializeStickyTOC = (() => {
    let state = {
        section: null,
        sidebar: null,
        threshold: 0,
        observer: null,
        sentinel: null,
        bound: false,
        resizeTimer: 0,  // ✅ 防抖定时器
        heightCache: new WeakMap()  // ✅ 高度缓存
    };

    // ✅ 同步计算阈值（使用缓存减少重排，但不延迟）
    function updateThreshold() {
        if (!state.section || !state.sidebar) return;

        const children = Array.from(state.sidebar.children);
        let totalHeight = 0;

        children.forEach(el => {
            if (el === state.section) return;

            // ✅ 优先使用缓存的高度
            let height = state.heightCache.get(el);
            if (height == null) {
                height = el.offsetHeight;
                state.heightCache.set(el, height);
            }
            totalHeight += height;
        });

        state.threshold = totalHeight + 50;
    }

    // ✅ resize 时清除缓存
    function clearHeightCache() {
        state.heightCache = new WeakMap();
    }

    function handleIntersection(entries) {
        if (!state.section || entries.length === 0) return;

        const [entry] = entries;
        const shouldStick = !entry.isIntersecting;

        // ✅ 直接切换，无需 RAF（IntersectionObserver 已经是异步的）
        state.section.classList.toggle("sticky", shouldStick);
    }

    function createOrUpdateSentinel() {
        if (!state.section || !state.sidebar) return;

        if (state.observer) {
            state.observer.disconnect();
        }

        // ✅ 同步计算阈值（使用缓存，无延迟）
        updateThreshold();

        if (!state.sentinel) {
            state.sentinel = document.createElement('div');
            state.sentinel.id = 'toc-sticky-sentinel';
            state.sentinel.style.cssText = 'position:absolute;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden';
            document.body.appendChild(state.sentinel);
        }

        state.sentinel.style.top = state.threshold + 'px';

        state.observer = new IntersectionObserver(handleIntersection, {
            root: null,
            threshold: 0,
            rootMargin: '0px'
        });
        state.observer.observe(state.sentinel);
    }

    function syncState() {
        if (!state.section) return;
        const shouldStick = window.scrollY >= state.threshold;
        state.section.classList.toggle("sticky", shouldStick);
    }

    // ✅ 防抖的 resize 处理
    function handleResize() {
        if (state.resizeTimer) {
            clearTimeout(state.resizeTimer);
        }
        state.resizeTimer = setTimeout(() => {
            state.resizeTimer = 0;
            clearHeightCache();  // ✅ resize 时清除缓存
            createOrUpdateSentinel();
            syncState();
        }, 150);  // 150ms 防抖
    }

    return function initializeStickyTOC() {
        const tocSection = document.getElementById("toc-section");
        const rightSidebar = document.querySelector(".right-sidebar");
        if (!tocSection || !rightSidebar) return;

        state.section = tocSection;
        state.sidebar = rightSidebar;

        // ✅ PJAX 切换时只更新必要的部分
        if (state.bound) {
            createOrUpdateSentinel();
            syncState();
            // ✅ 只在 hash 跳转时延迟检查
            if (window.location.hash) {
                setTimeout(syncState, 100);
            }
            return;
        }

        state.bound = true;

        createOrUpdateSentinel();
        syncState();

        window.addEventListener('load', () => {
            syncState();
            if (window.location.hash) {
                setTimeout(syncState, 100);
            }
        }, { once: true });

        window.addEventListener('hashchange', () => {
            setTimeout(syncState, 100);
        }, { passive: true });

        window.addEventListener("resize", handleResize, { passive: true });
        window.addEventListener("orientationchange", handleResize, { passive: true });
    };
})();


let commentResetBound = false;

function resetCommentForm(form) {
    if (!form) return;
    const submitButton = form.querySelector("#submit");
    if (!submitButton) return;
    const originalText = form.dataset.psSubmitText || submitButton.textContent;

    submitButton.disabled = false;
    submitButton.textContent = originalText;
    form.dataset.psSubmitting = "0";
}

function bindCommentReset() {
    if (commentResetBound) return;
    commentResetBound = true;

    window.addEventListener("pageshow", function () {
        const form = document.getElementById("cf");
        if (!form || form.dataset.psSubmitting !== "1") return;
        resetCommentForm(form);
    });
}

function Comments_Submit() {
    const form = document.getElementById("cf");
    if (!form) return;

    // 防止 PJAX 重复绑定
    if (form.dataset.binded === "1") return;
    form.dataset.binded = "1";

    const submitButton = form.querySelector("#submit");
    const textarea = form.querySelector("#textarea");

    if (!submitButton || !textarea) return;

    if (!form.dataset.psSubmitText) {
        form.dataset.psSubmitText = submitButton.textContent;
    }
    form.dataset.psSubmitting = "0";
    bindCommentReset();

    // 只监听 submit（关键）
    form.addEventListener("submit", function (e) {
        // 防止重复提交
        if (form.dataset.psSubmitting === "1") {
            e.preventDefault();
            return;
        }

        // 内容为空，交给浏览器 / Typecho 提示
        if (textarea.value.trim() === "") {
            return;
        }

        form.dataset.psSubmitting = "1";

        submitButton.disabled = true;
        submitButton.textContent = "提交中…";
    });

    // HTML5 校验失败时恢复
    form.addEventListener(
        "invalid",
        function () {
            resetCommentForm(form);
        },
        true
    );
}

// 保存 mediumZoom 实例引用
let mediumZoomInstance = null;

function runShortcodes(root) {
    history.scrollRestoration = 'auto';
    bindCollapsiblePanels(root);
    bindTabs(root);
    handleGoTopButton(root);
    initializeTOC();

    // mediumZoom 初始化（库本身已处理重复绑定）
    const scope = root && root.querySelector ? root : document;
    const images = scope.querySelectorAll('[data-zoomable]');

    if (images.length > 0) {
        if (mediumZoomInstance) {
            // 增量绑定新图片
            mediumZoomInstance.attach(images);
        } else {
            // 首次初始化
            mediumZoomInstance = mediumZoom('[data-zoomable]', {
                background: 'rgba(0, 0, 0, 0.85)',
                margin: 24
            });
        }
    }

    Comments_Submit();
}

document.addEventListener('DOMContentLoaded', function () {
    runShortcodes();
});

/**
 * 主题切换 - 控制深色、浅色模式，带个跨域联动
 */

(function() {
    'use strict';

    function supportsViewTransition() {
        return typeof document.startViewTransition === 'function';
    }

    function prefersReducedMotion() {
        return typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function runThemeViewTransition(update) {
        if (!supportsViewTransition() || prefersReducedMotion()) {
            update();
            return;
        }

        const root = document.documentElement;
        root.classList.add('ps-theme-vt');

        let transition;
        try {
            transition = document.startViewTransition(() => {
                update();
            });
        } catch (e) {
            root.classList.remove('ps-theme-vt');
            update();
            return;
        }

        if (transition && transition.finished) {
            transition.finished.finally(() => {
                root.classList.remove('ps-theme-vt');
            });
        } else {
            setTimeout(() => {
                root.classList.remove('ps-theme-vt');
            }, 300);
        }
    }

    /**
     * 获取根域名（用于跨子域 Cookie）
     * @returns {string} 根域名，如 .xxx.cn
     */
    function getRootDomain() {
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length <= 2) return host; // localhost 或 xxx.com
        return '.' + parts.slice(-2).join('.');
    }

    /**
     * 写入跨子域 Cookie
     * @param {string} theme - 主题值
     */
    function setThemeCookie(theme) {
        const rootDomain = getRootDomain();
        document.cookie = `theme=${theme}; path=/; domain=${rootDomain}; SameSite=Lax; max-age=31536000`;
    }

    /**
     * 读取 Cookie
     * @param {string} name - Cookie 名称
     * @returns {string|null} Cookie 值
     */
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    /**
     * 应用主题属性
     * @param {string} themeValue - 主题值
     */
    function applyThemeAttribute(themeValue) {
        const root = document.documentElement;
        if (root.getAttribute('data-theme') === themeValue) {
            return;
        }
        root.setAttribute('data-theme', themeValue);
    }

    function getEffectiveTheme(theme) {
        if (theme === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return theme;
    }

    /**
     * 更新主题图标
     * @param {string} theme - 主题值
     */
    function updateIcon(theme) {
        const iconElement = document.getElementById('theme-icon');
        if (!iconElement) return;

        iconElement.classList.remove('icon-sun-inv', 'icon-moon-inv', 'icon-auto');

        if (theme === 'light') {
            iconElement.classList.add('icon-sun-inv');
        } else if (theme === 'dark') {
            iconElement.classList.add('icon-moon-inv');
        } else {
            iconElement.classList.add('icon-auto');
        }
    }

    /**
     * 设置主题
     * @param {string} theme - 主题值 ('light' | 'dark' | 'auto')
     */
    function applyTheme(theme) {
        if (theme === 'auto') {
            // 自动模式：跟随系统
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            applyThemeAttribute(systemTheme);
            localStorage.setItem('theme', 'auto');
            setThemeCookie('auto');
        } else {
            // 明暗模式
            applyThemeAttribute(theme);
            localStorage.setItem('theme', theme);
            setThemeCookie(theme);
        }

        updateIcon(theme);
    }

    function setTheme(theme) {
        const root = document.documentElement;
        const currentApplied = root.getAttribute('data-theme');
        const nextApplied = getEffectiveTheme(theme);

        if (currentApplied === nextApplied) {
            applyTheme(theme);
            return;
        }

        runThemeViewTransition(() => {
            applyTheme(theme);
        });
    }

    /**
     * 切换主题
     */
    function toggleTheme() {
        const currentTheme = localStorage.getItem('theme') || 'auto';
        let newTheme;

        if (currentTheme === 'light') {
            newTheme = 'dark';
            if (typeof MoxToast === 'function') {
                MoxToast({ message: '已切换至深色模式' });
            }
        } else if (currentTheme === 'dark') {
            newTheme = 'auto';
            if (typeof MoxToast === 'function') {
                MoxToast({ message: '模式将跟随系统 ㆆᴗㆆ' });
            }
        } else {
            newTheme = 'light';
            if (typeof MoxToast === 'function') {
                MoxToast({ message: '已切换至浅色模式' });
            }
        }

        setTheme(newTheme);
    }

    /**
     * 初始化主题系统
     */
    function initTheme() {
        // 优先读取 Cookie（跨站同步）
        const cookieTheme = getCookie('theme');
        const savedTheme = cookieTheme || localStorage.getItem('theme') || 'auto';
        applyTheme(savedTheme);
    }

    /**
     * 监听系统主题变化
     */
    function watchSystemTheme() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
            if (localStorage.getItem('theme') === 'auto') {
                const newTheme = e.matches ? 'dark' : 'light';
                applyThemeAttribute(newTheme);
                updateIcon('auto');
            }
        });
    }

    // 导出到全局
    window.setTheme = setTheme;
    window.toggleTheme = toggleTheme;

    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initTheme();
            watchSystemTheme();
        });
    } else {
        initTheme();
        watchSystemTheme();
    }
})();

/**
 * 导航指示器 - 动态控制导航高亮
 */
const NavIndicator = (() => {
    let indicator = null;
    let navContainer = null;
    let navItems = [];
    // ✅ 添加位置缓存
    let metricsCache = new Map();

    /**
     * 创建指示器元素
     */
    function createIndicator() {
        const el = document.createElement('div');
        el.className = 'nav-indicator';
        return el;
    }

    /**
     * ✅ 批量缓存所有导航项位置（读操作）
     */
    function cacheAllMetrics() {
        if (!navContainer) return;

        metricsCache.clear();
        const containerRect = navContainer.getBoundingClientRect();

        // 批量读取所有导航项的位置
        navItems.forEach(item => {
            const rect = item.getBoundingClientRect();
            metricsCache.set(item, {
                width: rect.width,
                height: rect.height,
                left: rect.left - containerRect.left,
                top: rect.top - containerRect.top
            });
        });
    }

    /**
     * 更新指示器位置和大小（写操作，使用缓存）
     */
    function updateIndicator(targetItem) {
        if (!indicator || !targetItem) return;

        // 优先使用缓存
        let metrics = metricsCache.get(targetItem);

        if (!metrics) {
            // 缓存未命中，降级读取并缓存
            const containerRect = navContainer.getBoundingClientRect();
            const itemRect = targetItem.getBoundingClientRect();
            metrics = {
                width: itemRect.width,
                height: itemRect.height,
                left: itemRect.left - containerRect.left,
                top: itemRect.top - containerRect.top
            };
            metricsCache.set(targetItem, metrics);
        }

        // 单次 RAF 足够（双重 RAF 会导致 2 帧延迟）
        requestAnimationFrame(() => {
            indicator.style.width = `${metrics.width}px`;
            indicator.style.height = `${metrics.height}px`;
            indicator.style.transform = `translate(${metrics.left}px, ${metrics.top}px) scale(1)`;
            indicator.classList.add('active');
        });
    }

    /**
     * 隐藏指示器
     */
    function hideIndicator() {
        if (!indicator) return;
        indicator.classList.remove('active');
    }

    /**
     * 获取当前激活的导航项
     */
    function getActiveNavItem() {
        const currentPath = window.location.pathname;

        for (const item of navItems) {
            const link = item.querySelector('a');
            if (link) {
                const linkPath = new URL(link.href).pathname;
                if (linkPath === currentPath) {
                    return item;
                }
            }
        }
        return null;
    }

    /**
     * 初始化导航指示器
     */
    function init() {
        navContainer = document.querySelector('.header-nav');
        if (!navContainer) return;

        // 检查是否已存在指示器
        if (navContainer.querySelector('.nav-indicator')) {
            return;
        }

        // 创建并添加指示器
        indicator = createIndicator();
        navContainer.appendChild(indicator);

        // 获取所有导航项
        navItems = Array.from(navContainer.querySelectorAll('.nav-item'));

        // ✅ 初始化时批量缓存所有位置
        requestAnimationFrame(() => {
            cacheAllMetrics();

            // 初始定位
            const activeItem = getActiveNavItem();
            if (activeItem) {
                updateIndicator(activeItem);
            }
        });

        // ✅ 监听窗口大小变化 - 使用 200ms 防抖，resize 时清除并重建缓存
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                metricsCache.clear();  // ✅ 清除缓存
                cacheAllMetrics();     // ✅ 重建缓存
                const activeItem = getActiveNavItem();
                if (activeItem) {
                    updateIndicator(activeItem);
                }
            }, 200);
        });
    }

    /**
     * 更新指示器（供 Swup 调用）
     */
    function update() {
        if (!navContainer) {
            init();
            return;
        }

        // 重新获取导航项（Swup 可能会替换内容）
        navItems = Array.from(navContainer.querySelectorAll('.nav-item'));

        // ✅ Swup 切换后清除并重建缓存
        metricsCache.clear();

        const activeItem = getActiveNavItem();
        if (activeItem) {
            requestAnimationFrame(() => {
                cacheAllMetrics();  // ✅ 重建缓存
                updateIndicator(activeItem);
            });
        } else {
            hideIndicator();
        }
    }

    // 导出到全局
    window.NavIndicator = {
        init,
        update
    };

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
