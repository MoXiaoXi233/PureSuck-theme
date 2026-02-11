(function (window, document) {
    'use strict';

    const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
    if (!PS || typeof PS.registerModule !== 'function') return;

    const MODULE_CONFIG = {
        toc: { globalName: 'PS_TOC', path: '/js/PureSuck_TOC.js' },
        content: { globalName: 'PS_CONTENT', path: '/js/PureSuck_Content.js' },
        comment: { globalName: 'PS_COMMENT', path: '/js/PureSuck_Comment.js' }
    };

    const scriptCache = new Map();

    function getThemeUrl() {
        const fromConfig = PS.config && typeof PS.config.themeUrl === 'string' ? PS.config.themeUrl : '';
        if (fromConfig) return fromConfig.replace(/\/+$/, '');

        if (typeof window.THEME_URL === 'string' && window.THEME_URL) {
            return window.THEME_URL.replace(/\/+$/, '');
        }

        return '';
    }

    function resolveModuleUrl(path) {
        if (!path) return '';
        if (/^(https?:)?\/\//i.test(path)) return path;

        const themeUrl = getThemeUrl();
        if (!themeUrl) return path;
        if (path.indexOf('/') === 0) return themeUrl + path;
        return themeUrl + '/' + path;
    }

    function loadScriptOnce(src) {
        if (!src) return Promise.resolve(false);
        if (scriptCache.has(src)) return scriptCache.get(src);

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

        scriptCache.set(src, promise);
        return promise;
    }

    function loadRuntimeModule(name) {
        const config = MODULE_CONFIG[name];
        if (!config) return Promise.resolve(null);

        const api = window[config.globalName];
        if (api && typeof api === 'object') return Promise.resolve(api);

        const src = resolveModuleUrl(config.path);
        return loadScriptOnce(src).then(function () {
            const loaded = window[config.globalName];
            return loaded && typeof loaded === 'object' ? loaded : null;
        }).catch(function () {
            return null;
        });
    }

    function runWhenIdle(task, options) {
        const cfg = Object.assign({ timeout: 1400, delay: 0 }, options || {});
        let canceled = false;
        let delayTimer = 0;
        let idleId = 0;

        const runTask = function () {
            if (canceled) return;

            if (typeof window.requestIdleCallback === 'function') {
                idleId = window.requestIdleCallback(function () {
                    if (canceled) return;
                    task();
                }, { timeout: cfg.timeout });
                return;
            }

            idleId = window.setTimeout(function () {
                if (canceled) return;
                task();
            }, 0);
        };

        if (cfg.delay > 0) {
            delayTimer = window.setTimeout(runTask, cfg.delay);
        } else {
            runTask();
        }

        return function cancelTask() {
            canceled = true;
            if (delayTimer) {
                clearTimeout(delayTimer);
                delayTimer = 0;
            }
            if (idleId) {
                if (typeof window.cancelIdleCallback === 'function') {
                    window.cancelIdleCallback(idleId);
                } else {
                    clearTimeout(idleId);
                }
                idleId = 0;
            }
        };
    }

    function hasCommentArea(scope) {
        return Boolean(scope.querySelector('#cf, .respond, .OwO[data-owo-ssr]'));
    }

    function hasContentEnhanceTarget(scope) {
        return Boolean(
            scope.querySelector('.collapsible-panel')
            || scope.querySelector('.tab-container')
            || scope.querySelector('[data-zoomable]')
            || scope.querySelector('.post-content iframe[src]')
        );
    }

    function hasRuntimeTocSection() {
        return Boolean(document.getElementById('toc-section'));
    }

    function runCommentModule(scope, context) {
        if (!hasCommentArea(scope)) return Promise.resolve(null);

        return loadRuntimeModule('comment').then(function (api) {
            if (!api || typeof api.init !== 'function') return null;
            return api.init(scope, context || {});
        });
    }

    function runContentModule(scope, context) {
        const pageType = context && context.pageType ? context.pageType : '';
        const isContentPage = pageType === 'post' || pageType === 'page';
        if (!isContentPage) return Promise.resolve(null);
        if (!hasContentEnhanceTarget(scope)) return Promise.resolve(null);

        return loadRuntimeModule('content').then(function (api) {
            if (!api || typeof api.init !== 'function') return null;
            return api.init(scope, context || {});
        });
    }

    function runTocModule(scope, context) {
        const pageType = context && context.pageType ? context.pageType : '';
        const showTOC = !(context && context.features) || context.features.showTOC !== false;
        const shouldHandle = hasRuntimeTocSection() || (showTOC && (pageType === 'post' || pageType === 'page'));

        if (!shouldHandle) return Promise.resolve(null);

        return loadRuntimeModule('toc').then(function (api) {
            if (!api || typeof api.ensureRuntimeTocSection !== 'function') return null;
            if (typeof api.initializeTOC !== 'function' || typeof api.initializeStickyTOC !== 'function') return null;

            api.ensureRuntimeTocSection(scope, pageType, function () {
                api.initializeTOC();
                api.initializeStickyTOC();
            });

            return null;
        });
    }

    function safeRun(cleanup) {
        if (typeof cleanup !== 'function') return;
        try {
            cleanup();
        } catch (error) { }
    }

    function createEnhanceLifecycle(root, context) {
        const scope = root && root.querySelector ? root : document;
        const cleanups = [];
        const cancels = [];
        let destroyed = false;

        function trackCleanup(cleanup) {
            if (typeof cleanup !== 'function') return;
            if (destroyed) {
                safeRun(cleanup);
                return;
            }
            cleanups.push(cleanup);
        }

        function schedule(task, options) {
            const cancel = runWhenIdle(function () {
                Promise.resolve(task()).then(trackCleanup).catch(function () {
                    // 某个按需模块加载失败时，不影响页面其余功能。
                });
            }, options || {});
            cancels.push(cancel);
        }

        schedule(function () {
            return runCommentModule(scope, context);
        }, {
            delay: 0,
            timeout: 1200
        });

        schedule(function () {
            return runContentModule(scope, context);
        }, {
            delay: context && context.isSwup ? 220 : 80,
            timeout: 2200
        });

        schedule(function () {
            return runTocModule(scope, context);
        }, {
            delay: context && context.isSwup ? 380 : 120,
            timeout: 2400
        });

        return function cleanupEnhanceLifecycle() {
            destroyed = true;

            cancels.forEach(function (cancel) {
                safeRun(cancel);
            });

            for (let i = cleanups.length - 1; i >= 0; i -= 1) {
                safeRun(cleanups[i]);
            }
        };
    }

    PS.registerModule({
        id: 'ps-page-enhance',
        priority: 120,
        init: function initPageEnhance(root, context) {
            return createEnhanceLifecycle(root, context || {});
        }
    });
})(window, document);
