/** 这个JS包含了各种需要处理的的内容 **/
/** 回到顶部按钮，TOC目录，内部卡片部分内容解析都在这里 **/

const initializeTOC = (() => {
    let state = null;
    let listenersBound = false;
    let hashTimer = 0;
    let scrollEndTimer = 0;
    let scrollEndHandler = null;
    let rafId = null; // 用于节流 IntersectionObserver 回调
    let debounceTimer = null; // 用于防抖 IntersectionObserver 回调

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

    function getInitialActiveIndex() {
        if (!state) return 0;
        const activationOffset = state.activationOffset;
        let activeIndex = 0;

        state.elements.forEach((element, index) => {
            if (element.getBoundingClientRect().top <= activationOffset) {
                activeIndex = index;
            }
        });

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
        if (!state) return;
        
        // 添加防抖,减少频繁更新
        if (debounceTimer) clearTimeout(debounceTimer);
        
        debounceTimer = setTimeout(() => {
            // 双重检查 state，因为防抖期间可能已重置
            if (!state || !state.indexByElement) {
                debounceTimer = null;
                return;
            }
            
            // 取消之前的 RAF,避免重复处理
            if (rafId) cancelAnimationFrame(rafId);
            
            // 使用 requestAnimationFrame 批处理更新,减少频繁的 DOM 操作
            rafId = requestAnimationFrame(() => {
                // RAF 执行时再次检查 state
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
            
            debounceTimer = null;
        }, 16); // 约 1 帧的防抖时间
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
            window.addEventListener("resize", refreshLayout, { passive: true });
            window.addEventListener("orientationchange", refreshLayout);
            window.addEventListener("load", refreshLayout, { once: true });
        }

        refreshLayout();
    };
})();

function handleGoTopButton() {
    const goTopBtn = document.getElementById('go-top'); // 按钮容器
    const goTopAnchor = document.querySelector('#go-top .go');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            goTopBtn.classList.add('visible'); // 显示按钮
        } else {
            goTopBtn.classList.remove('visible'); // 隐藏按钮
        }
    });

    goTopAnchor.addEventListener('click', function (e) {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        setTimeout(() => {
            goTopBtn.classList.remove('visible'); // 隐藏
        }, 400); // 等待滚动完成
    });
}

function bindCollapsiblePanels() {
    const panels = document.querySelectorAll('.collapsible-panel');

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

function bindTabs() {
    const tabContainers = document.querySelectorAll('.tab-container');

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
        raf: 0,
        bound: false
    };

    function updateThreshold() {
        if (!state.section || !state.sidebar) return;
        const tocAboveElements = Array.from(state.sidebar.children).filter(element => element !== state.section);
        state.threshold = tocAboveElements.reduce((total, element) => total + element.offsetHeight, 0) + 50;
    }

    function requestUpdate() {
        if (state.raf) return;
        state.raf = window.requestAnimationFrame(() => {
            state.raf = 0;
            if (!state.section) return;
            const shouldStick = window.scrollY >= state.threshold;
            state.section.classList.toggle("sticky", shouldStick);
        });
    }

    function handleResize() {
        updateThreshold();
        requestUpdate();
    }

    return function initializeStickyTOC() {
        const tocSection = document.getElementById("toc-section");
        const rightSidebar = document.querySelector(".right-sidebar");
        if (!tocSection || !rightSidebar) return;

        state.section = tocSection;
        state.sidebar = rightSidebar;
        state.threshold = 0;

        updateThreshold();
        requestUpdate();

        if (state.bound) return;
        state.bound = true;

        window.addEventListener("scroll", requestUpdate, { passive: true });
        window.addEventListener("resize", handleResize);
        window.addEventListener("orientationchange", handleResize);
        window.addEventListener("load", handleResize, { once: true });
    };
})();


function Comments_Submit() {
    const form = document.getElementById("cf");
    if (!form) return;

    // 防止 PJAX 重复绑定
    if (form.dataset.binded === "1") return;
    form.dataset.binded = "1";

    const submitButton = form.querySelector("#submit");
    const textarea = form.querySelector("#textarea");

    if (!submitButton || !textarea) return;

    let isSubmitting = false;
    const originalText = submitButton.textContent;

    // 只监听 submit（关键）
    form.addEventListener("submit", function (e) {
        // 防止重复提交
        if (isSubmitting) {
            e.preventDefault();
            return;
        }

        // 内容为空，交给浏览器 / Typecho 提示
        if (textarea.value.trim() === "") {
            return;
        }

        isSubmitting = true;

        submitButton.disabled = true;
        submitButton.textContent = "提交中…";
    });

    // HTML5 校验失败时恢复
    form.addEventListener(
        "invalid",
        function () {
            reset();
        },
        true
    );

    // 页面未跳转（例如 Typecho 校验失败）
    window.addEventListener("pageshow", function () {
        reset();
    });

    function reset() {
        isSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

// 保存 mediumZoom 实例引用，用于 PJAX 后重新初始化
let mediumZoomInstance = null;

function runShortcodes() {
    history.scrollRestoration = 'auto';
    bindCollapsiblePanels();
    bindTabs();
    handleGoTopButton();
    initializeTOC();

    // mediumZoom 图片放大
    if (mediumZoomInstance) {
        mediumZoomInstance.detach();
    }
    mediumZoomInstance = mediumZoom('[data-zoomable]', {
        background: 'rgba(0, 0, 0, 0.85)',
        margin: 24
    });

    Comments_Submit()
}

document.addEventListener('DOMContentLoaded', function () {
    runShortcodes();
});

// PJAX 完成后重新初始化
document.addEventListener('pjax:success', function() {
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
     * 设置主题（使用 View Transitions 优化）
     * @param {string} theme - 主题值 ('light' | 'dark' | 'auto')
     */
    function setTheme(theme) {
        // 计算实际要应用的主题色
        const targetTheme = theme === 'auto'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : theme;

        // 获取当前主题色
        const currentTheme = document.documentElement.getAttribute('data-theme');

        // ✅ 如果颜色没变，直接跳过（避免不必要的闪烁）
        if (targetTheme === currentTheme) {
            // 仍然需要更新存储，但不需要视觉切换
            localStorage.setItem('theme', theme);
            setThemeCookie(theme);
            updateIcon(theme);
            return;
        }

        // 检查是否支持 View Transitions API
        const supportsVT = 'startViewTransition' in document;

        if (supportsVT) {
            // ✅ 使用 VT 实现整体切换（更干净、更统一）
            document.documentElement.classList.add('vt-theme-switching');

            document.startViewTransition(() => {
                applyThemeInternal(theme);
            }).finished.then(() => {
                // VT 完成后移除 class，恢复 CSS transition
                document.documentElement.classList.remove('vt-theme-switching');
            });
        } else {
            // 降级：直接切换
            applyThemeInternal(theme);
        }
    }

    /**
     * 应用主题（核心逻辑）
     * @param {string} theme - 主题值
     */
    function applyThemeInternal(theme) {
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
                const currentTheme = document.documentElement.getAttribute('data-theme');

                // ✅ 如果颜色没变，跳过（避免闪烁）
                if (newTheme === currentTheme) {
                    return;
                }

                // ✅ 颜色改变时使用 VT 过渡
                if ('startViewTransition' in document) {
                    document.documentElement.classList.add('vt-theme-switching');

                    document.startViewTransition(() => {
                        applyThemeAttribute(newTheme);
                        updateIcon('auto');
                    }).finished.then(() => {
                        document.documentElement.classList.remove('vt-theme-switching');
                    });
                } else {
                    applyThemeAttribute(newTheme);
                    updateIcon('auto');
                }
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
