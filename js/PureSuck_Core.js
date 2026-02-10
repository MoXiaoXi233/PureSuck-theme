(function (window, document) {
    'use strict';

    const rawConfig = window.PS_CONFIG && typeof window.PS_CONFIG === 'object'
        ? window.PS_CONFIG
        : {};

    const defaultFeatures = {
        swup: true,
        viewTransition: true,
        swupPreload: true,
        perfDebug: false,
        showTOC: true
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
    const metricsState = {
        seq: 0,
        active: null,
        latest: null,
        history: []
    };

    function log() {
        if (!features.perfDebug) return;
        const args = Array.prototype.slice.call(arguments);
        args.unshift('[PS]');
        console.log.apply(console, args);
    }

    function nowMs() {
        return Math.round((window.performance ? window.performance.now() : Date.now()) * 100) / 100;
    }

    function createBaseDurations() {
        return {
            visitToReplace: 0,
            replaceToView: 0,
            viewToEnterEnd: 0,
            revealTotal: 0,
            criticalToDefer: 0,
            deferToIdle: 0,
            visitTotal: 0
        };
    }

    function cloneMetricsEntry(entry) {
        if (!entry) return null;
        try {
            return JSON.parse(JSON.stringify(entry));
        } catch (error) {
            return null;
        }
    }

    function buildDurations(entry) {
        const marks = entry && entry.marks ? entry.marks : {};
        const start = Number(marks.visitStart || 0);
        const replace = Number(marks.contentReplace || 0);
        const view = Number(marks.pageView || 0);
        const enterStart = Number(marks.enterStart || 0);
        const revealStart = Number(marks.revealStart || 0);
        const enterEnd = Number(marks.enterEnd || 0);
        const end = Number(marks.visitEnd || 0);

        const safeDiff = function (from, to) {
            if (!from || !to || to < from) return 0;
            return Math.round((to - from) * 100) / 100;
        };

        return {
            visitToReplace: safeDiff(start, replace),
            replaceToView: safeDiff(replace, view),
            viewToEnterEnd: safeDiff(view, enterEnd || end),
            revealTotal: safeDiff(revealStart, enterEnd || end),
            criticalToDefer: safeDiff(start, revealStart || enterStart || view),
            deferToIdle: safeDiff(enterEnd || view, end),
            visitTotal: safeDiff(start, end)
        };
    }

    function buildMetricsEntry(meta) {
        const config = Object.assign({}, meta || {});
        const id = 'psv-' + String(Date.now()) + '-' + String(++metricsState.seq);
        return {
            id,
            mode: config.mode || 'card',
            reason: config.reason || 'visit',
            fromType: config.fromType || '',
            toType: config.toType || '',
            url: config.url || window.location.href,
            createdAt: new Date().toISOString(),
            marks: {
                visitStart: nowMs()
            },
            reveal: {
                targets: 0,
                batches: 0,
                firstBatch: 0
            },
            durations: createBaseDurations()
        };
    }

    function finalizeActiveMetrics(extra) {
        if (!metricsState.active) return null;

        const patch = Object.assign({}, extra || {});
        if (!metricsState.active.marks.visitEnd) {
            metricsState.active.marks.visitEnd = nowMs();
        }

        if (patch && typeof patch === 'object') {
            if (patch.reveal && typeof patch.reveal === 'object') {
                metricsState.active.reveal = Object.assign({}, metricsState.active.reveal, patch.reveal);
                delete patch.reveal;
            }
            if (patch.mode) metricsState.active.mode = patch.mode;
            if (patch.reason) metricsState.active.reason = patch.reason;
            if (patch.fromType) metricsState.active.fromType = patch.fromType;
            if (patch.toType) metricsState.active.toType = patch.toType;
            if (patch.url) metricsState.active.url = patch.url;
        }

        metricsState.active.durations = buildDurations(metricsState.active);
        metricsState.latest = cloneMetricsEntry(metricsState.active);
        metricsState.history.push(metricsState.latest);
        if (metricsState.history.length > 240) {
            metricsState.history.splice(0, metricsState.history.length - 240);
        }

        const done = metricsState.latest;
        metricsState.active = null;
        return cloneMetricsEntry(done);
    }

    function createMetricsApi() {
        return {
            clear: function clearMetrics() {
                metricsState.active = null;
                metricsState.latest = null;
                metricsState.history = [];
                metricsState.seq = 0;
            },
            getLatest: function getLatestMetrics() {
                return cloneMetricsEntry(metricsState.latest);
            },
            getHistory: function getMetricsHistory() {
                return metricsState.history.map(cloneMetricsEntry).filter(Boolean);
            },
            beginVisit: function beginVisit(meta) {
                if (metricsState.active) {
                    finalizeActiveMetrics({ reason: 'visit-interrupted' });
                }
                metricsState.active = buildMetricsEntry(meta);
                return metricsState.active.id;
            },
            markVisit: function markVisit(name, payload) {
                if (!metricsState.active || !name) return;
                metricsState.active.marks[name] = nowMs();
                if (payload && typeof payload === 'object') {
                    if (payload.reveal && typeof payload.reveal === 'object') {
                        metricsState.active.reveal = Object.assign({}, metricsState.active.reveal, payload.reveal);
                    }
                    if (payload.mode) metricsState.active.mode = payload.mode;
                    if (payload.reason) metricsState.active.reason = payload.reason;
                    if (payload.fromType) metricsState.active.fromType = payload.fromType;
                    if (payload.toType) metricsState.active.toType = payload.toType;
                    if (payload.url) metricsState.active.url = payload.url;
                }
            },
            finishVisit: function finishVisit(extra) {
                return finalizeActiveMetrics(extra);
            }
        };
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
    PS.metrics = createMetricsApi();
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
