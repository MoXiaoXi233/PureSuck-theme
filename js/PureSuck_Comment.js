(function (window, document) {
    'use strict';

    const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
    const scriptCache = new Map();
    const formHandlers = new WeakMap();
    let pageshowBound = false;

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

    function getOwOScriptSrc() {
        const fromConfig = PS && PS.config && PS.config.assets && PS.config.assets.owo
            ? String(PS.config.assets.owo)
            : '';

        if (fromConfig) return fromConfig;
        return resolveUrl('/js/OwO.min.js');
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

    function resetSubmitState(form) {
        if (!form) return;
        const submit = form.querySelector('#submit, button[type="submit"], input[type="submit"]');
        if (!submit) return;

        const original = form.dataset.psSubmitText || (submit.tagName === 'INPUT' ? submit.value : submit.textContent);
        submit.disabled = false;

        if (submit.tagName === 'INPUT') submit.value = original;
        else submit.textContent = original;

        form.dataset.psSubmitting = '0';
    }

    function bindPageshowReset() {
        if (pageshowBound) return;
        pageshowBound = true;

        window.addEventListener('pageshow', function () {
            const form = document.getElementById('cf');
            if (!form || form.dataset.psSubmitting !== '1') return;
            resetSubmitState(form);
        });
    }

    function bindCommentForm(form) {
        if (!form || formHandlers.has(form)) {
            return formHandlers.get(form) || function noop() { };
        }

        const submit = form.querySelector('#submit, button[type="submit"], input[type="submit"]');
        const textarea = form.querySelector('#textarea, textarea[name="text"]');
        if (!submit || !textarea) {
            return function noop() { };
        }

        bindPageshowReset();

        if (!form.dataset.psSubmitText) {
            form.dataset.psSubmitText = submit.tagName === 'INPUT' ? submit.value : submit.textContent;
        }

        form.dataset.psSubmitting = '0';

        const onSubmit = function (event) {
            if (form.dataset.psSubmitting === '1') {
                event.preventDefault();
                return;
            }

            if (!textarea.value || textarea.value.trim() === '') {
                return;
            }

            form.dataset.psSubmitting = '1';
            submit.disabled = true;
            if (submit.tagName === 'INPUT') submit.value = 'Submitting...';
            else submit.textContent = 'Submitting...';
        };

        const onInvalid = function () {
            resetSubmitState(form);
        };

        form.addEventListener('submit', onSubmit);
        form.addEventListener('invalid', onInvalid, true);

        const cleanup = function cleanupCommentForm() {
            form.removeEventListener('submit', onSubmit);
            form.removeEventListener('invalid', onInvalid, true);
            formHandlers.delete(form);
            resetSubmitState(form);
        };

        formHandlers.set(form, cleanup);
        return cleanup;
    }

    function initOwo(scope) {
        const panel = scope.querySelector('.OwO[data-owo-ssr]');
        if (!panel) return Promise.resolve(null);

        const src = getOwOScriptSrc();
        return loadScriptOnce(src).then(function (ok) {
            if (!ok || !window.OwoManager || typeof window.OwoManager.init !== 'function') return null;
            window.OwoManager.init({ force: true });

            return function cleanupOwo() {
                if (!window.OwoManager || typeof window.OwoManager.destroy !== 'function') return;
                window.OwoManager.destroy();
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
        const cleanups = [];
        let disposed = false;

        const form = scope.querySelector('#cf');
        if (form && !(context && context.isSwup)) {
            cleanups.push(bindCommentForm(form));
        }

        if (form && context && context.isSwup) {
            resetSubmitState(form);
        }

        initOwo(scope).then(function (cleanup) {
            if (typeof cleanup !== 'function') return;
            if (disposed) {
                safeRun(cleanup);
                return;
            }
            cleanups.push(cleanup);
        });

        return function cleanupCommentModule() {
            disposed = true;
            for (let i = cleanups.length - 1; i >= 0; i -= 1) {
                safeRun(cleanups[i]);
            }
        };
    }

    window.PS_COMMENT = {
        init: init
    };
})(window, document);
