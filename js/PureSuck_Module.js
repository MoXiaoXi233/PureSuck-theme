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

        // ✅ 一次性获取所有 boundingClientRect，避免循环中多次触发 reflow
        const rects = state.elements.map(el => el.getBoundingClientRect().top);

        for (let index = 0; index < rects.length; index++) {
            if (rects[index] <= activationOffset) {
                activeIndex = index;
            } else {
                break;
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
            bindObserver();
            setActive(getInitialActiveIndex());
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
    let ticking = false;

    function sync(root) {
        const scope = root && root.querySelector ? root : document;
        button = scope.querySelector('#go-top') || document.querySelector('#go-top');
        anchor = button ? button.querySelector('.go') : null;
    }

    function updateVisibility() {
        if (!button) return;
        if (window.scrollY > 100) {
            button.classList.add('visible');
        } else {
            button.classList.remove('visible');
        }
    }

    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            updateVisibility();
        });
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
            window.addEventListener('scroll', onScroll, { passive: true });
            document.addEventListener('click', onClick, true);
        }

        updateVisibility();
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

        button.addEventListener('click', function () {
            this.classList.toggle('active');

            if (contentDiv.style.maxHeight && contentDiv.style.maxHeight !== '0px') {
                contentDiv.style.maxHeight = '0px';
                if (icon) {
                    icon.classList.remove('icon-up-open');
                    icon.classList.add('icon-down-open');
                }
            } else {
                contentDiv.style.maxHeight = contentDiv.scrollHeight + "px";
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

        const updateCache = () => {
            cachedWidths = tabLinks.map(l => l.offsetWidth);
            cachedOffsets = tabLinks.map(l => l.offsetLeft);
        };

        const updateIndicator = index => {
            requestAnimationFrame(() => {
                indicator.style.width = `${cachedWidths[index] * 0.75}px`;
                indicator.style.left = `${cachedOffsets[index] + cachedWidths[index] * 0.125}px`;
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

const initializeStickyTOC = (() => {
    let state = {
        section: null,
        sidebar: null,
        threshold: 0,
        observer: null,
        bound: false
    };

    function updateThreshold() {
        if (!state.section || !state.sidebar) return;
        // 计算 TOC 上方所有元素的高度和
        const tocAboveElements = Array.from(state.sidebar.children).filter(element => element !== state.section);
        state.threshold = tocAboveElements.reduce((total, element) => total + element.offsetHeight, 0) + 50;
    }

    function handleIntersection(entries) {
        if (!state.section || entries.length === 0) return;

        const [entry] = entries;
        // 当哨兵元素（位于阈值位置）离开视口顶部时，TOC 应该变为 sticky
        const shouldStick = !entry.isIntersecting;
        state.section.classList.toggle("sticky", shouldStick);
    }

    function createOrUpdateSentinel() {
        if (!state.section || !state.sidebar) return;

        // 先断开旧观察
        if (state.observer) {
            state.observer.disconnect();
        }

        // 更新阈值
        updateThreshold();

        // 创建或更新哨兵元素
        let sentinel = document.getElementById('toc-sticky-sentinel');
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = 'toc-sticky-sentinel';
            // 固定在阈值位置（从页面顶部算起）
            sentinel.style.position = 'absolute';
            sentinel.style.top = state.threshold + 'px';
            sentinel.style.left = '0';
            sentinel.style.width = '1px';
            sentinel.style.height = '1px';
            sentinel.style.pointerEvents = 'none';
            sentinel.style.visibility = 'hidden';
            document.body.appendChild(sentinel);
        } else {
            sentinel.style.top = state.threshold + 'px';
        }

        // 重新观察哨兵
        if (typeof IntersectionObserver !== 'undefined') {
            state.observer = new IntersectionObserver(handleIntersection, {
                root: null,
                threshold: 0,
                rootMargin: '0px 0px 0px 0px'
            });
            state.observer.observe(sentinel);
        }
    }

    function handleResize() {
        // Resize 时更新哨兵位置
        createOrUpdateSentinel();
    }

    return function initializeStickyTOC() {
        const tocSection = document.getElementById("toc-section");
        const rightSidebar = document.querySelector(".right-sidebar");
        if (!tocSection || !rightSidebar) return;

        state.section = tocSection;
        state.sidebar = rightSidebar;

        if (state.bound) return;
        state.bound = true;

        if (typeof IntersectionObserver !== 'undefined') {
            // ✅ 使用 IntersectionObserver + 哨兵元素
            createOrUpdateSentinel();
        } else {
            // 降级：使用 scroll 事件
            let raf = 0;
            updateThreshold();
            const requestUpdate = () => {
                if (raf) return;
                raf = window.requestAnimationFrame(() => {
                    raf = 0;
                    const shouldStick = window.scrollY >= state.threshold;
                    tocSection.classList.toggle("sticky", shouldStick);
                });
            };
            requestUpdate();
            window.addEventListener("scroll", requestUpdate, { passive: true });
        }

        window.addEventListener("resize", handleResize);
        window.addEventListener("orientationchange", handleResize);
        window.addEventListener("load", handleResize, { once: true });
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

// 保存 mediumZoom 实例引用，用于 PJAX 后增量更新
let mediumZoomInstance = null;
let trackedZoomImages = new WeakSet(); // 追踪已绑定的图片

function runShortcodes(root) {
    history.scrollRestoration = 'auto';
    bindCollapsiblePanels(root);
    bindTabs(root);
    handleGoTopButton(root);
    initializeTOC();

    // ✅ mediumZoom 增量更新：只对新图片添加 zoom
    const scope = root && root.querySelector ? root : document;
    const newImages = Array.from(scope.querySelectorAll('[data-zoomable]'));

    if (mediumZoomInstance) {
        // 只为新图片添加 zoom
        const untrackedImages = newImages.filter(img => !trackedZoomImages.has(img));
        if (untrackedImages.length > 0) {
            mediumZoomInstance.attach(untrackedImages);
            untrackedImages.forEach(img => trackedZoomImages.add(img));
        }
    } else {
        // 首次初始化
        mediumZoomInstance = mediumZoom('[data-zoomable]', {
            background: 'rgba(0, 0, 0, 0.85)',
            margin: 24
        });
        newImages.forEach(img => trackedZoomImages.add(img));
    }

    Comments_Submit();
}

document.addEventListener('DOMContentLoaded', function () {
    runShortcodes();
});

/**
 * ========================================
 * 主题管理系统
 * ========================================
 */

(function() {
    'use strict';

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
    function setTheme(theme) {
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
        setTheme(savedTheme);
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

    /**
     * 创建指示器元素
     */
    function createIndicator() {
        const el = document.createElement('div');
        el.className = 'nav-indicator';
        return el;
    }

    /**
     * 更新指示器位置和大小
     */
    function updateIndicator(targetItem) {
        if (!indicator || !targetItem) return;

        const itemRect = targetItem.getBoundingClientRect();
        const containerRect = navContainer.getBoundingClientRect();

        // 计算相对于容器的位置
        const left = itemRect.left - containerRect.left;
        const top = itemRect.top - containerRect.top;

        // 使用 transform 代替 left/top，性能更好（GPU加速）
        indicator.style.width = `${itemRect.width}px`;
        indicator.style.height = `${itemRect.height}px`;
        indicator.style.transform = `translate(${left}px, ${top}px) scale(1)`;

        // 添加激活状态
        requestAnimationFrame(() => {
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

        // 初始定位
        const activeItem = getActiveNavItem();
        if (activeItem) {
            // 使用 requestAnimationFrame 确保元素已渲染
            requestAnimationFrame(() => {
                updateIndicator(activeItem);
            });
        }

        // ✅ 监听窗口大小变化 - 使用 200ms 防抖
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const activeItem = getActiveNavItem();
                if (activeItem) {
                    updateIndicator(activeItem);
                }
            }, 200); // ✅ 从 100ms 增加到 200ms，减少频繁计算
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

        const activeItem = getActiveNavItem();
        if (activeItem) {
            requestAnimationFrame(() => {
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
