(function (window, document) {
    'use strict';

    const rawConfig = window.PS_CONFIG && typeof window.PS_CONFIG === 'object'
        ? window.PS_CONFIG
        : {};

    const defaultFeatures = {
        swup: true,
        viewTransition: true,
        swupPreload: true,
        perfDebug: false
    };

    const features = Object.assign({}, defaultFeatures, rawConfig.features || {});

    function toBool(value, fallback) {
        if (typeof value === 'boolean') return value;
        if (value === '1' || value === 1) return true;
        if (value === '0' || value === 0) return false;
        return fallback;
    }

    Object.keys(features).forEach((key) => {
        features[key] = toBool(features[key], defaultFeatures[key]);
    });

    const runtime = {
        managedBySwup: false,
        currentRoot: null,
        lastContext: null,
        cycle: 0
    };

    const moduleMap = new Map();
    const cleanupMap = new Map();

    function log() {
        if (!features.perfDebug) return;
        const args = Array.prototype.slice.call(arguments);
        args.unshift('[PS]');
        console.log.apply(console, args);
    }

    function normalizeRoot(root) {
        if (root && root.nodeType === 1) {
            return root;
        }
        return document.getElementById('swup') || document;
    }

    function resolveSwupRoot(root) {
        const normalized = normalizeRoot(root);
        if (normalized.id === 'swup') return normalized;
        return document.getElementById('swup') || normalized;
    }

    function getPageType(root) {
        const swupRoot = resolveSwupRoot(root);
        const pageType = swupRoot && swupRoot.dataset ? swupRoot.dataset.psPageType : '';
        if (pageType === 'post' || pageType === 'page' || pageType === 'list') {
            return pageType;
        }
        return 'list';
    }

    function getReducedMotion() {
        try {
            return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function buildContext(root, extras) {
        const normalizedRoot = normalizeRoot(root);
        const swupRoot = resolveSwupRoot(normalizedRoot);
        const base = {
            root: normalizedRoot,
            swupRoot,
            pageType: getPageType(swupRoot),
            features,
            reducedMotion: getReducedMotion(),
            reason: 'manual',
            via: runtime.managedBySwup ? 'swup' : 'ssr',
            cycle: runtime.cycle + 1,
            url: window.location.href,
            isSwup: runtime.managedBySwup
        };

        return Object.assign(base, extras || {});
    }

    function sortedModules() {
        const modules = Array.from(moduleMap.values());
        modules.sort((a, b) => {
            const pa = typeof a.priority === 'number' ? a.priority : 100;
            const pb = typeof b.priority === 'number' ? b.priority : 100;
            if (pa !== pb) return pa - pb;
            return String(a.id).localeCompare(String(b.id));
        });
        return modules;
    }

    function matchesModule(module, context) {
        if (!module || typeof module !== 'object') return false;

        if (Array.isArray(module.pageTypes) && module.pageTypes.length > 0) {
            if (!module.pageTypes.includes(context.pageType)) {
                return false;
            }
        }

        if (typeof module.match === 'function') {
            try {
                return Boolean(module.match(context));
            } catch (error) {
                log('module.match failed:', module.id, error);
                return false;
            }
        }

        return true;
    }

    function callCleanup(moduleId, context) {
        const cleanup = cleanupMap.get(moduleId);
        if (!cleanup) return;

        cleanupMap.delete(moduleId);
        try {
            cleanup(context && context.root ? context.root : runtime.currentRoot || document, context || runtime.lastContext || {});
        } catch (error) {
            log('cleanup failed:', moduleId, error);
        }
    }

    function registerModule(definition) {
        if (!definition || typeof definition !== 'object') {
            throw new Error('PS.registerModule requires an object.');
        }
        if (!definition.id) {
            throw new Error('PS.registerModule requires a stable `id`.');
        }

        const normalized = Object.assign({ priority: 100 }, definition);
        moduleMap.set(normalized.id, normalized);

        if (runtime.lastContext && matchesModule(normalized, runtime.lastContext)) {
            callCleanup(normalized.id, runtime.lastContext);
            try {
                const cleanup = normalized.init ? normalized.init(runtime.currentRoot || document, runtime.lastContext) : null;
                if (typeof cleanup === 'function') {
                    cleanupMap.set(normalized.id, cleanup);
                }
            } catch (error) {
                log('late init failed:', normalized.id, error);
            }
        }

        return normalized;
    }

    function destroyModules(root, extras) {
        const context = buildContext(root, Object.assign({ reason: 'destroy' }, extras || {}));
        const modules = sortedModules().reverse();

        modules.forEach((module) => {
            callCleanup(module.id, context);
            if (typeof module.destroy === 'function') {
                try {
                    module.destroy(context.root, context);
                } catch (error) {
                    log('module.destroy failed:', module.id, error);
                }
            }
        });

        runtime.currentRoot = context.root;
        runtime.lastContext = context;
        runtime.cycle += 1;

        return context;
    }

    function initModules(root, extras) {
        const context = buildContext(root, Object.assign({ reason: 'init' }, extras || {}));
        const modules = sortedModules();

        modules.forEach((module) => {
            callCleanup(module.id, context);

            if (!matchesModule(module, context)) {
                return;
            }

            if (typeof module.init !== 'function') {
                return;
            }

            try {
                const cleanup = module.init(context.root, context);
                if (typeof cleanup === 'function') {
                    cleanupMap.set(module.id, cleanup);
                }
            } catch (error) {
                log('module.init failed:', module.id, error);
            }
        });

        runtime.currentRoot = context.root;
        runtime.lastContext = context;
        runtime.cycle += 1;

        return context;
    }

    const PS = window.PS && typeof window.PS === 'object' ? window.PS : {};

    PS.config = rawConfig;
    PS.features = features;
    PS.runtime = runtime;
    PS.log = log;
    PS.getPageType = getPageType;
    PS.isFeatureEnabled = function (featureKey, fallback) {
        return toBool(features[featureKey], fallback !== undefined ? fallback : true);
    };
    PS.setManagedBySwup = function (value) {
        runtime.managedBySwup = Boolean(value);
    };
    PS.registerModule = registerModule;
    PS.initModules = initModules;
    PS.destroyModules = destroyModules;

    // 收敛的全局命名空间（Phase 2.5）
    PS.swup = null;      // Swup 实例
    PS.zoom = null;      // mediumZoom 实例
    PS.lazy = null;      // LazyLoadManager
    PS.theme = {         // 主题切换
        set: null,
        toggle: null
    };
    PS.nav = {           // 导航指示器
        init: null,
        update: null
    };

    window.PS = PS;

    function bootstrapWithoutSwup() {
        if (runtime.managedBySwup) return;
        initModules(document, { reason: 'dom-ready', via: 'ssr', isSwup: false });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapWithoutSwup);
    } else {
        bootstrapWithoutSwup();
    }
})(window, document);
