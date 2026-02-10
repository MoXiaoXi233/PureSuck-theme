/** 这个JS包含了各种需要处理的的内容 **/
/** 回到顶部按钮，TOC目录，内部卡片部分内容解析都在这里 **/

/**
 * TOC 目录高亮 - 简化重构版
 * 核心原则：简单、直接、快速响应
 */
const initializeTOC = (() => {
    let state = null;
    let hashTimer = 0;
    let isClickScrolling = false;  // 点击滚动中，暂停 Observer 响应

    function destroy() {
        if (!state) return;

        clearTimeout(hashTimer);
        hashTimer = 0;
        isClickScrolling = false;

        if (state.observer) {
            state.observer.disconnect();
        }

        if (state.activeLink) {
            state.activeLink.classList.remove('li-active');
        }

        state = null;
    }

    function setActive(index) {
        if (!state || index < 0 || index >= state.headings.length) return;
        if (state.activeIndex === index) return;

        // 移除旧激活状态
        if (state.activeLink) {
            state.activeLink.classList.remove('li-active');
        }

        const heading = state.headings[index];
        const link = state.linkById.get(heading.id);
        if (!link) return;

        // 设置新激活状态
        link.classList.add('li-active');
        state.activeLink = link;
        state.activeIndex = index;

        // 更新侧边栏指示器位置
        const li = state.liById.get(heading.id);
        if (state.indicator && li) {
            state.indicator.style.transform = `translateY(${li.offsetTop}px)`;
        }

        // 自动滚动 TOC 容器，让激活项可见
        if (state.tocSection && li) {
            const cr = state.tocSection.getBoundingClientRect();
            const ir = li.getBoundingClientRect();

            if (ir.top < cr.top || ir.bottom > cr.bottom) {
                state.tocSection.scrollBy({
                    top: ir.top - cr.top - cr.height / 2 + ir.height / 2,
                    behavior: 'smooth'
                });
            }
        }
    }

    function handleIntersect(entries) {
        if (!state || isClickScrolling) return;  // 点击滚动中不响应

        // 直接处理，不加 RAF 节流
        entries.forEach(entry => {
            const index = state.indexMap.get(entry.target);
            if (index == null) return;

            if (entry.isIntersecting) {
                state.visible.add(index);
            } else {
                state.visible.delete(index);
            }
        });

        // 选择最靠前的可见标题
        if (state.visible.size > 0) {
            setActive(Math.min(...state.visible));
        }
    }

    function handleClick(e) {
        const link = e.target.closest('.toc-a');
        if (!link || !state) return;

        const href = link.getAttribute('href');
        if (!href || href[0] !== '#') return;

        e.preventDefault();
        e.stopPropagation();

        const targetId = href.slice(1);
        const target = document.getElementById(targetId);
        if (!target) return;

        // 立即更新激活状态
        const index = state.headings.findIndex(h => h.id === targetId);
        if (index >= 0) setActive(index);

        // 暂停 Observer 响应，避免滚动过程中来回跳
        isClickScrolling = true;

        // 平滑滚动到目标
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // 延迟更新 URL hash，并恢复 Observer 响应
        clearTimeout(hashTimer);
        hashTimer = setTimeout(() => {
            history.replaceState(null, '', href);
            isClickScrolling = false;  // 滚动结束，恢复响应
        }, 600);  // 给足够时间让滚动完成
    }

    return function initializeTOC() {
        // 每次初始化前必须清理
        destroy();

        const tocSection = document.getElementById('toc-section');
        const toc = document.querySelector('.toc');
        const content = document.querySelector('.inner-post-wrapper');

        if (!toc || !content) {
            if (tocSection) tocSection.style.display = 'none';
            return;
        }

        // 只选择有 id 的标题
        const headings = Array.from(content.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'));
        if (!headings.length) {
            if (tocSection) tocSection.style.display = 'none';
            return;
        }

        const indicator = document.querySelector('.siderbar');
        const linkById = new Map();
        const liById = new Map();
        const indexMap = new Map();

        // 建立映射
        headings.forEach((heading, index) => {
            indexMap.set(heading, index);

            // 使用 CSS.escape 安全转义 ID
            const escapedId = CSS.escape(heading.id);
            const link = toc.querySelector(`.toc-a[href="#${escapedId}"]`);
            if (link) {
                linkById.set(heading.id, link);
                link.setAttribute('no-pjax', '');
                link.classList.remove('li-active');

                const li = link.closest('li');
                if (li) liById.set(heading.id, li);
            }
        });

        state = {
            headings,
            linkById,
            liById,
            indexMap,
            indicator,
            tocSection,
            visible: new Set(),
            activeIndex: -1,
            activeLink: null,
            observer: null
        };

        // 显示 TOC
        if (tocSection) tocSection.style.display = 'block';
        if (indicator) indicator.style.transition = 'transform 0.25s ease-out';

        // 绑定点击（只绑定一次）
        if (!toc.dataset.tocBound) {
            toc.addEventListener('click', handleClick, true);
            toc.dataset.tocBound = '1';
        }

        // 创建 IntersectionObserver
        // rootMargin: 顶部留 100px 触发区，底部排除 66%
        state.observer = new IntersectionObserver(handleIntersect, {
            rootMargin: '-100px 0px -66% 0px',
            threshold: 0
        });

        headings.forEach(h => state.observer.observe(h));

        // 初始化：激活第一个可见的或第一个
        requestAnimationFrame(() => {
            if (!state) return;
            // 找到当前视口内最靠前的标题
            const scrollTop = window.scrollY;
            let initialIndex = 0;
            for (let i = 0; i < headings.length; i++) {
                const rect = headings[i].getBoundingClientRect();
                if (rect.top <= 120) {
                    initialIndex = i;
                }
            }
            setActive(initialIndex);
        });
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
window.mediumZoomInstance = null;

function runShortcodes(root) {
    history.scrollRestoration = 'auto';
    bindCollapsiblePanels(root);
    bindTabs(root);
    handleGoTopButton(root);
    initializeTOC();
    initializeStickyTOC();  // 确保 Swup 切换后 TOC sticky 也能工作

    // mediumZoom 初始化
    const scope = root && root.querySelector ? root : document;
    const images = scope.querySelectorAll('[data-zoomable]');

    // 确保实例始终存在（即使当前没有图片）
    if (!window.mediumZoomInstance) {
        window.mediumZoomInstance = mediumZoom({
            background: 'rgba(0, 0, 0, 0.85)',
            margin: 24
        });
    }

    // 增量绑定新图片
    if (images.length > 0) {
        window.mediumZoomInstance.attach(images);
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
            }, 380);  // 与 VT 动画时长保持一致
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
