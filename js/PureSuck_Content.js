(function (window, document) {
    'use strict';

    const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
    const loadedScripts = new Map();
    let tabObserver = null;

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

    function loadScriptOnce(src) {
        if (!src) return Promise.resolve(false);
        if (loadedScripts.has(src)) return loadedScripts.get(src);

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

        loadedScripts.set(src, promise);
        return promise;
    }

    function getMediumZoomSrc() {
        const fromConfig = PS && PS.config && PS.config.assets && PS.config.assets.mediumZoom
            ? String(PS.config.assets.mediumZoom)
            : '';

        if (fromConfig) return fromConfig;
        return resolveUrl('/js/lib/medium-zoom.min.js');
    }

    function bindCollapsiblePanels(scope) {
        const panels = scope.querySelectorAll('.collapsible-panel');

        panels.forEach(function (panel) {
            if (panel.dataset.psCollapsibleBound === '1') return;
            panel.dataset.psCollapsibleBound = '1';

            const button = panel.querySelector('.collapsible-header');
            const content = panel.querySelector('.collapsible-content');
            const icon = button ? button.querySelector('.icon') : null;
            if (!button || !content) return;

            button.addEventListener('click', function () {
                const isOpen = Boolean(content.style.maxHeight && content.style.maxHeight !== '0px');
                button.classList.toggle('active', !isOpen);

                if (isOpen) {
                    content.style.maxHeight = '0px';
                    if (icon) {
                        icon.classList.remove('icon-up-open');
                        icon.classList.add('icon-down-open');
                    }
                    return;
                }

                content.style.maxHeight = content.scrollHeight + 'px';
                if (icon) {
                    icon.classList.remove('icon-down-open');
                    icon.classList.add('icon-up-open');
                }
            });
        });
    }

    function isNearViewport(el, margin) {
        if (!el || typeof el.getBoundingClientRect !== 'function') return true;
        const rect = el.getBoundingClientRect();
        const pad = Number.isFinite(margin) ? margin : 0;
        return rect.top <= window.innerHeight + pad && rect.bottom >= -pad;
    }

    function initTabContainer(container) {
        if (!container || container.dataset.psTabsBound === '1') return;

        const tabHeader = container.querySelector('.tab-header');
        const tabLinks = tabHeader ? Array.from(tabHeader.querySelectorAll('.tab-link')) : [];
        const tabPanes = Array.from(container.querySelectorAll('.tab-pane'));
        const indicator = tabHeader ? tabHeader.querySelector('.tab-indicator') : null;
        if (!tabHeader || !tabLinks.length || !indicator) return;

        container.dataset.psTabsBound = '1';
        delete container.dataset.psTabObserved;

        const cache = {
            widths: new Array(tabLinks.length).fill(0),
            offsets: new Array(tabLinks.length).fill(0)
        };

        let activeIndex = tabLinks.findIndex(function (link) {
            return link.classList.contains('active');
        });
        if (activeIndex < 0) activeIndex = 0;

        function updateCache() {
            tabLinks.forEach(function (link, index) {
                cache.widths[index] = link.offsetWidth;
                cache.offsets[index] = link.offsetLeft;
            });
        }

        function updateIndicator(index) {
            if (index < 0 || index >= tabLinks.length) return;

            const width = cache.widths[index] || tabLinks[index].offsetWidth;
            const offset = cache.offsets[index] || tabLinks[index].offsetLeft;
            indicator.style.width = width * 0.75 + 'px';
            indicator.style.transform = 'translateX(' + (offset + width * 0.125) + 'px)';
        }

        function setActive(index, focus) {
            if (index < 0 || index >= tabLinks.length || index === activeIndex) return;

            tabHeader.classList.remove('dir-left', 'dir-right');
            tabHeader.classList.add(index > activeIndex ? 'dir-right' : 'dir-left');

            tabLinks.forEach(function (link, i) {
                const selected = i === index;
                link.classList.toggle('active', selected);
                link.setAttribute('aria-selected', selected ? 'true' : 'false');
                link.tabIndex = selected ? 0 : -1;
            });

            tabPanes.forEach(function (pane, i) {
                const selected = i === index;
                pane.classList.toggle('active', selected);
                pane.setAttribute('aria-hidden', selected ? 'false' : 'true');
            });

            activeIndex = index;
            updateCache();
            updateIndicator(index);
            if (focus) tabLinks[index].focus();
        }

        function onClick(event) {
            const target = event.target instanceof Element ? event.target.closest('.tab-link') : null;
            if (!target || !tabHeader.contains(target)) return;

            const index = tabLinks.indexOf(target);
            if (index >= 0) setActive(index, false);
        }

        function onKeyDown(event) {
            if (!event.target || !tabHeader.contains(event.target)) return;
            const current = tabLinks.indexOf(event.target);
            if (current < 0) return;

            let next = -1;
            if (event.key === 'ArrowRight') next = (current + 1) % tabLinks.length;
            if (event.key === 'ArrowLeft') next = (current - 1 + tabLinks.length) % tabLinks.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = tabLinks.length - 1;
            if (next < 0) return;

            event.preventDefault();
            setActive(next, true);
        }

        tabHeader.addEventListener('click', onClick);
        tabHeader.addEventListener('keydown', onKeyDown);

        let resizeObserver = null;
        if (typeof window.ResizeObserver === 'function') {
            resizeObserver = new ResizeObserver(function () {
                updateCache();
                updateIndicator(activeIndex);
            });
            resizeObserver.observe(tabHeader);
            tabLinks.forEach(function (link) {
                resizeObserver.observe(link);
            });
        }

        updateCache();
        setActive(activeIndex, false);
        updateIndicator(activeIndex);

        container.__psTabCleanup = function cleanupTabsContainer() {
            tabHeader.removeEventListener('click', onClick);
            tabHeader.removeEventListener('keydown', onKeyDown);
            tabHeader.classList.remove('dir-left', 'dir-right');
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
            delete container.dataset.psTabsBound;
            delete container.dataset.psTabObserved;
        };
    }

    function getTabObserver() {
        if (tabObserver || typeof window.IntersectionObserver !== 'function') return tabObserver;

        tabObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                tabObserver.unobserve(entry.target);
                initTabContainer(entry.target);
            });
        }, {
            root: null,
            rootMargin: '240px 0px',
            threshold: 0
        });

        return tabObserver;
    }

    function bindTabs(scope) {
        const containers = scope.querySelectorAll('.tab-container');

        containers.forEach(function (container) {
            if (container.dataset.psTabsBound === '1') return;
            if (container.dataset.psTabObserved === '1') return;

            if (isNearViewport(container, 220) || typeof window.IntersectionObserver !== 'function') {
                initTabContainer(container);
                return;
            }

            const observer = getTabObserver();
            if (!observer) {
                initTabContainer(container);
                return;
            }

            container.dataset.psTabObserved = '1';
            observer.observe(container);
        });
    }

    function cleanupTabs(scope) {
        const containers = scope.querySelectorAll('.tab-container');
        containers.forEach(function (container) {
            if (tabObserver && container.dataset.psTabObserved === '1') {
                tabObserver.unobserve(container);
            }
            if (typeof container.__psTabCleanup === 'function') {
                container.__psTabCleanup();
                delete container.__psTabCleanup;
            }
            delete container.dataset.psTabObserved;
        });
    }

    function optimizeContentEmbeds(scope, context) {
        const pageType = context && context.pageType ? context.pageType : '';
        if (pageType !== 'post' && pageType !== 'page') {
            return function noop() { };
        }

        const contentScope = scope.querySelector('.post-content') || scope;
        const embeds = Array.from(contentScope.querySelectorAll('iframe[src]'));
        if (!embeds.length) {
            return function noop() { };
        }

        const deferred = [];
        const timers = [];
        let observer = null;

        function deferEmbed(iframe) {
            const src = iframe.getAttribute('src');
            if (!src || src === 'about:blank') return;

            iframe.dataset.psDeferredSrc = src;
            iframe.setAttribute('src', 'about:blank');
            deferred.push(iframe);
        }

        function activateEmbed(iframe) {
            const src = iframe && iframe.dataset ? iframe.dataset.psDeferredSrc : '';
            if (!src) return;

            iframe.setAttribute('src', src);
            delete iframe.dataset.psDeferredSrc;
            if (observer) observer.unobserve(iframe);
        }

        embeds.forEach(function (iframe) {
            if (!(iframe instanceof HTMLIFrameElement)) return;

            if (!iframe.hasAttribute('loading')) iframe.setAttribute('loading', 'lazy');
            if (!iframe.hasAttribute('fetchpriority')) iframe.setAttribute('fetchpriority', 'low');

            const rect = iframe.getBoundingClientRect();
            const nearViewport = rect.top <= window.innerHeight * 1.1 && rect.bottom >= -140;
            const isSwup = Boolean(context && context.isSwup);

            if (!isSwup && nearViewport) return;

            deferEmbed(iframe);

            if (isSwup && nearViewport) {
                const timer = window.setTimeout(function () {
                    activateEmbed(iframe);
                }, 320);
                timers.push(timer);
            }
        });

        const needObserver = deferred.filter(function (iframe) {
            const rect = iframe.getBoundingClientRect();
            const isSwup = Boolean(context && context.isSwup);
            return !(isSwup && rect.top <= window.innerHeight * 1.1 && rect.bottom >= -140);
        });

        if (needObserver.length && typeof window.IntersectionObserver === 'function') {
            observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    activateEmbed(entry.target);
                });
            }, {
                root: null,
                rootMargin: '360px 0px',
                threshold: 0
            });

            needObserver.forEach(function (iframe) {
                observer.observe(iframe);
            });
        } else {
            needObserver.forEach(function (iframe) {
                activateEmbed(iframe);
            });
        }

        return function cleanupEmbeds() {
            timers.forEach(function (timer) {
                clearTimeout(timer);
            });

            if (observer) {
                observer.disconnect();
                observer = null;
            }

            deferred.forEach(function (iframe) {
                if (!iframe || !iframe.dataset) return;
                delete iframe.dataset.psDeferredSrc;
            });
        };
    }

    function attachMediumZoom(scope) {
        const images = Array.from(scope.querySelectorAll('[data-zoomable]'));
        if (!images.length) return Promise.resolve(null);

        const src = getMediumZoomSrc();
        return loadScriptOnce(src).then(function (ok) {
            if (!ok || typeof window.mediumZoom !== 'function') return null;

            if (!PS.zoom) {
                PS.zoom = window.mediumZoom({
                    background: 'rgba(0, 0, 0, 0.85)',
                    margin: 24
                });
            }

            PS.zoom.attach(images);
            return function cleanupZoom() {
                if (!PS.zoom || typeof PS.zoom.detach !== 'function') return;
                PS.zoom.detach(images);
            };
        }).catch(function () {
            return null;
        });
    }

    function safeRun(cleanup) {
        if (typeof cleanup !== 'function') return;
        try {
            cleanup();
        } catch (error) { }
    }

    function init(root, context) {
        const scope = root && root.querySelector ? root : document;
        const pageType = context && context.pageType ? context.pageType : '';

        if (pageType !== 'post' && pageType !== 'page') {
            return function noop() { };
        }

        bindCollapsiblePanels(scope);
        bindTabs(scope);

        const cleanups = [
            function cleanupTabsInScope() {
                cleanupTabs(scope);
            },
            optimizeContentEmbeds(scope, context || {})
        ];

        let disposed = false;
        attachMediumZoom(scope).then(function (cleanup) {
            if (typeof cleanup !== 'function') return;
            if (disposed) {
                safeRun(cleanup);
                return;
            }
            cleanups.push(cleanup);
        });

        return function cleanupContentModule() {
            disposed = true;

            for (let i = cleanups.length - 1; i >= 0; i -= 1) {
                safeRun(cleanups[i]);
            }
        };
    }

    window.PS_CONTENT = {
        init: init
    };
})(window, document);
