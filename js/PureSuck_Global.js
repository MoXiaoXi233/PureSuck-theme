(function (window, document) {
    'use strict';

    const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
    if (!PS || typeof PS.registerModule !== 'function') return;

    const GoTop = (function () {
        let button = null;
        let clickBound = false;
        let observer = null;
        let sentinel = null;

        function ensureSentinel() {
            if (sentinel && sentinel.isConnected) return sentinel;

            sentinel = document.createElement('div');
            sentinel.id = 'go-top-sentinel';
            sentinel.setAttribute('aria-hidden', 'true');
            sentinel.style.cssText = 'position:absolute;top:100px;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden;';
            document.body.appendChild(sentinel);
            return sentinel;
        }

        function syncButton(root) {
            const scope = root && root.querySelector ? root : document;
            button = scope.querySelector('#go-top') || document.querySelector('#go-top');
        }

        function onIntersect(entries) {
            if (!button) return;
            const entry = entries && entries[0] ? entries[0] : null;
            if (!entry) return;

            if (entry.isIntersecting) {
                button.classList.remove('visible');
            } else {
                button.classList.add('visible');
            }
        }

        function bindObserver() {
            if (!button || typeof window.IntersectionObserver !== 'function') return;

            if (observer) {
                observer.disconnect();
            }

            observer = new IntersectionObserver(onIntersect, {
                root: null,
                threshold: 0,
                rootMargin: '0px'
            });
            observer.observe(ensureSentinel());
        }

        function bindClick() {
            if (clickBound) return;
            clickBound = true;

            document.addEventListener('click', function (event) {
                const target = event.target instanceof Element
                    ? event.target.closest('#go-top .go')
                    : null;
                if (!target) return;

                event.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });

                window.setTimeout(function () {
                    const current = document.querySelector('#go-top');
                    if (current) current.classList.remove('visible');
                }, 400);
            }, true);
        }

        return {
            init: function init(root) {
                syncButton(root);
                bindClick();
                bindObserver();
            }
        };
    })();

    const Theme = (function () {
        let watched = false;

        function prefersReducedMotion() {
            try {
                return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            } catch (error) {
                return false;
            }
        }

        function supportsViewTransition() {
            return typeof document.startViewTransition === 'function' && !prefersReducedMotion();
        }

        function runThemeTransition(update) {
            if (!supportsViewTransition()) {
                update();
                return;
            }

            const root = document.documentElement;
            root.classList.add('ps-theme-vt');

            let transition;
            try {
                transition = document.startViewTransition(function () {
                    update();
                });
            } catch (error) {
                root.classList.remove('ps-theme-vt');
                update();
                return;
            }

            if (transition && transition.finished && typeof transition.finished.finally === 'function') {
                transition.finished.finally(function () {
                    root.classList.remove('ps-theme-vt');
                });
                return;
            }

            window.setTimeout(function () {
                root.classList.remove('ps-theme-vt');
            }, 380);
        }

        function getRootDomain() {
            const host = window.location.hostname;
            const parts = host.split('.');
            if (parts.length <= 2) return host;
            return '.' + parts.slice(-2).join('.');
        }

        function setThemeCookie(theme) {
            document.cookie = 'theme=' + theme + '; path=/; domain=' + getRootDomain() + '; SameSite=Lax; max-age=31536000';
        }

        function getCookie(name) {
            const escaped = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]+)'));
            return match ? match[1] : null;
        }

        function getEffectiveTheme(theme) {
            if (theme === 'auto') {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            return theme;
        }

        function applyThemeAttribute(themeValue) {
            const root = document.documentElement;
            if (root.getAttribute('data-theme') === themeValue) return;
            root.setAttribute('data-theme', themeValue);
        }

        function updateIcon(theme) {
            const icon = document.getElementById('theme-icon');
            if (!icon) return;

            icon.classList.remove('icon-sun-inv', 'icon-moon-inv', 'icon-auto');
            if (theme === 'light') {
                icon.classList.add('icon-sun-inv');
            } else if (theme === 'dark') {
                icon.classList.add('icon-moon-inv');
            } else {
                icon.classList.add('icon-auto');
            }
        }

        function applyTheme(theme) {
            const normalized = theme === 'light' || theme === 'dark' ? theme : 'auto';
            const applied = getEffectiveTheme(normalized);

            applyThemeAttribute(applied);
            localStorage.setItem('theme', normalized);
            setThemeCookie(normalized);
            updateIcon(normalized);
        }

        function setTheme(theme) {
            const nextApplied = getEffectiveTheme(theme);
            const currentApplied = document.documentElement.getAttribute('data-theme');

            if (currentApplied === nextApplied) {
                applyTheme(theme);
                return;
            }

            runThemeTransition(function () {
                applyTheme(theme);
            });
        }

        function toggleTheme() {
            const current = localStorage.getItem('theme') || 'auto';
            const next = current === 'light' ? 'dark' : (current === 'dark' ? 'auto' : 'light');

            setTheme(next);

            if (typeof window.MoxToast === 'function') {
                const message = next === 'light'
                    ? 'Theme switched to light'
                    : next === 'dark'
                        ? 'Theme switched to dark'
                        : 'Theme follows system';
                window.MoxToast({ message: message });
            }
        }

        function bindSystemThemeWatcher() {
            if (watched || typeof window.matchMedia !== 'function') return;
            watched = true;

            const media = window.matchMedia('(prefers-color-scheme: dark)');
            if (!media || typeof media.addEventListener !== 'function') return;

            media.addEventListener('change', function (event) {
                if (localStorage.getItem('theme') !== 'auto') return;
                applyThemeAttribute(event.matches ? 'dark' : 'light');
                updateIcon('auto');
            });
        }

        function init() {
            const saved = getCookie('theme') || localStorage.getItem('theme') || 'auto';
            applyTheme(saved);
            bindSystemThemeWatcher();
        }

        return {
            init: init,
            set: setTheme,
            toggle: toggleTheme
        };
    })();

    const NavIndicator = (function () {
        let indicator = null;
        let navContainer = null;
        let navItems = [];
        let metricsCache = new Map();
        let resizeBound = false;
        let resizeTimer = 0;

        function createIndicator() {
            const el = document.createElement('div');
            el.className = 'nav-indicator';
            return el;
        }

        function cacheAllMetrics() {
            if (!navContainer) return;
            metricsCache.clear();

            const containerRect = navContainer.getBoundingClientRect();
            navItems.forEach(function (item) {
                const rect = item.getBoundingClientRect();
                metricsCache.set(item, {
                    width: rect.width,
                    height: rect.height,
                    left: rect.left - containerRect.left,
                    top: rect.top - containerRect.top
                });
            });
        }

        function updateIndicator(targetItem) {
            if (!indicator || !targetItem) return;

            let metrics = metricsCache.get(targetItem);
            if (!metrics) {
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

            window.requestAnimationFrame(function () {
                indicator.style.width = metrics.width + 'px';
                indicator.style.height = metrics.height + 'px';
                indicator.style.transform = 'translate(' + metrics.left + 'px, ' + metrics.top + 'px) scale(1)';
                indicator.classList.add('active');
            });
        }

        function hideIndicator() {
            if (!indicator) return;
            indicator.classList.remove('active');
        }

        function getActiveNavItem() {
            const currentPath = window.location.pathname;

            for (let i = 0; i < navItems.length; i += 1) {
                const item = navItems[i];
                const link = item.querySelector('a');
                if (!link) continue;

                try {
                    const path = new URL(link.href, window.location.origin).pathname;
                    if (path === currentPath) return item;
                } catch (error) {
                    // 忽略异常链接，避免指示器更新被中断。
                }
            }

            return null;
        }

        function bindResizeListener() {
            if (resizeBound) return;
            resizeBound = true;

            window.addEventListener('resize', function () {
                if (resizeTimer) {
                    clearTimeout(resizeTimer);
                }

                resizeTimer = window.setTimeout(function () {
                    metricsCache.clear();
                    cacheAllMetrics();
                    const active = getActiveNavItem();
                    if (active) updateIndicator(active);
                }, 200);
            });
        }

        function init() {
            navContainer = document.querySelector('.header-nav');
            if (!navContainer) return;

            indicator = navContainer.querySelector('.nav-indicator');
            if (!indicator) {
                indicator = createIndicator();
                navContainer.appendChild(indicator);
            }

            navItems = Array.from(navContainer.querySelectorAll('.nav-item'));
            window.requestAnimationFrame(function () {
                cacheAllMetrics();
                const active = getActiveNavItem();
                if (active) updateIndicator(active);
                else hideIndicator();
            });

            bindResizeListener();
        }

        function update() {
            if (!navContainer || !navContainer.isConnected) {
                init();
                return;
            }

            navItems = Array.from(navContainer.querySelectorAll('.nav-item'));
            metricsCache.clear();

            const active = getActiveNavItem();
            if (!active) {
                hideIndicator();
                return;
            }

            window.requestAnimationFrame(function () {
                cacheAllMetrics();
                updateIndicator(active);
            });
        }

        return {
            init: init,
            update: update
        };
    })();

    Theme.init();
    PS.theme = PS.theme && typeof PS.theme === 'object' ? PS.theme : {};
    PS.theme.set = Theme.set;
    PS.theme.toggle = Theme.toggle;
    PS.nav = NavIndicator;

    window.setTheme = Theme.set;
    window.toggleTheme = Theme.toggle;
    window.NavIndicator = NavIndicator;

    PS.registerModule({
        id: 'ps-global-ui',
        priority: 20,
        init: function initGlobalUi(root) {
            GoTop.init(root);
            NavIndicator.init();
            NavIndicator.update();
        }
    });
})(window, document);
