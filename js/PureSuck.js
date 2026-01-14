/**
 * PureSuck.js - PureSuck主题主入口文件
 * 整合所有模块，提供统一的初始化和管理接口
 * 
 * @module PureSuck
 * @version 2.0.0
 * @description PureSuck主题的核心入口，负责初始化所有功能模块
 */

// ============================================================================
// 核心层模块导入
// ============================================================================

import { 
    StateManager, 
    stateManager, 
    NavigationState,
    StateEvents 
} from './core/StateManager.js';

import { 
    EventBus, 
    eventBus 
} from './core/EventBus.js';

import { 
    PerformanceMonitor, 
    performanceMonitor 
} from './core/PerformanceMonitor.js';

import { 
    DeviceCapability, 
    deviceCapability 
} from './core/DeviceCapability.js';

import { 
    AnimationFrameManager, 
    animationFrameManager 
} from './core/AnimationFrameManager.js';

import { 
    ErrorBoundary, 
    ErrorType, 
    ErrorSeverity,
    ErrorEvents,
    handleError,
    withErrorHandling,
    withAsyncErrorHandling 
} from './core/ErrorBoundary.js';

// ============================================================================
// 导航层模块导入
// ============================================================================

import { 
    SwupManager, 
    swupManager 
} from './navigation/SwupManager.js';

import { 
    RouteManager, 
    routeManager 
} from './navigation/RouteManager.js';

import { 
    HistoryManager, 
    historyManager 
} from './navigation/HistoryManager.js';

// ============================================================================
// 动画层模块导入
// ============================================================================

import { 
    AnimationController, 
    animationController,
    PerformanceLevel,
    AnimationState 
} from './animation/AnimationController.js';

import { 
    VTManager, 
    vtManager 
} from './animation/VTManager.js';

import { 
    getAdaptiveConfig,
    AnimationConfig 
} from './animation/AnimationConfig.js';

import { 
    StaggerManager, 
    staggerManager 
} from './animation/StaggerManager.js';

// ============================================================================
// 渲染层模块导入
// ============================================================================

import { 
    ProgressiveRenderer, 
    progressiveRenderer 
} from './rendering/ProgressiveRenderer.js';

import { 
    LazyLoader, 
    lazyLoader 
} from './rendering/LazyLoader.js';

import { 
    DOMScheduler, 
    domScheduler 
} from './rendering/DOMScheduler.js';

import { 
    VisibilityManager, 
    visibilityManager 
} from './rendering/VisibilityManager.js';

// ============================================================================
// 功能层模块导入
// ============================================================================

import { 
    TOCModule, 
    tocModule 
} from './features/TOCModule.js';

import { 
    ThemeModule, 
    themeModule 
} from './features/ThemeModule.js';

import { 
    CommentModule, 
    commentModule 
} from './features/CommentModule.js';

import { 
    NavIndicator, 
    navIndicator 
} from './features/NavIndicator.js';

import { 
    GoTopButton, 
    goTopButton 
} from './features/GoTopButton.js';

import { 
    TabModule, 
    tabModule 
} from './features/TabModule.js';

import { 
    CollapsiblePanel, 
    collapsiblePanel 
} from './features/CollapsiblePanel.js';

import { 
    StickyTOC, 
    stickyTOC 
} from './features/StickyTOC.js';

// ============================================================================
// 版本信息
// ============================================================================

/**
 * PureSuck版本信息
 * @constant
 * @type {Object}
 */
const VERSION = {
    major: 2,
    minor: 0,
    patch: 0,
    string: '2.0.0',
    build: '2025-01-14'
};

/**
 * 调试模式标志
 * @type {boolean}
 */
let DEBUG = false;

// ============================================================================
// PureSuck主类
// ============================================================================

/**
 * PureSuck主类
 * 负责初始化和管理所有模块
 */
class PureSuck {
    /**
     * 创建PureSuck实例
     * @param {Object} options - 配置选项
     * @param {boolean} [options.debug=false] - 是否启用调试模式
     * @param {boolean} [options.defer=false] - 是否延迟初始化
     * @param {Object} [options.modules] - 模块配置
     */
    constructor(options = {}) {
        this._options = {
            debug: false,
            defer: false,
            modules: {},
            ...options
        };

        this._isInitialized = false;
        this._isDestroyed = false;
        this._initPromise = null;

        // 设置调试模式
        DEBUG = this._options.debug;

        this._log('PureSuck instance created', {
            version: VERSION.string,
            options: this._options
        });
    }

    /**
     * 初始化所有模块
     * @returns {Promise<void>}
     */
    async init() {
        // 如果已经初始化，返回现有的Promise
        if (this._initPromise) {
            return this._initPromise;
        }

        // 如果已销毁，不允许重新初始化
        if (this._isDestroyed) {
            throw new Error('PureSuck has been destroyed and cannot be reinitialized');
        }

        // 如果已初始化，直接返回
        if (this._isInitialized) {
            this._log('PureSuck already initialized');
            return;
        }

        this._initPromise = this._doInit();
        return this._initPromise;
    }

    /**
     * 执行初始化
     * @private
     * @returns {Promise<void>}
     */
    async _doInit() {
        this._log('PureSuck initialization started');

        try {
            // 1. 初始化核心层模块
            await this._initCoreLayer();

            // 2. 初始化导航层模块
            await this._initNavigationLayer();

            // 3. 初始化动画层模块
            await this._initAnimationLayer();

            // 4. 初始化渲染层模块
            await this._initRenderingLayer();

            // 5. 初始化功能层模块
            await this._initFeatureLayer();

            // 6. 设置全局事件监听
            this._setupGlobalEventListeners();

            // 7. 标记为已初始化
            this._isInitialized = true;

            this._log('PureSuck initialization completed', {
                modules: Object.keys(window.PureSuck.modules)
            });

            // 发布初始化完成事件
            eventBus.emit('pureSuck:initialized', {
                version: VERSION.string,
                timestamp: Date.now()
            });

        } catch (error) {
            this._log('PureSuck initialization failed', { error });
            
            // 使用错误边界处理初始化错误
            ErrorBoundary.handle(error, {
                type: ErrorType.UNKNOWN,
                severity: ErrorSeverity.CRITICAL,
                message: 'PureSuck初始化失败，部分功能可能不可用',
                metadata: { phase: 'initialization' }
            });

            throw error;
        } finally {
            this._initPromise = null;
        }
    }

    /**
     * 初始化核心层模块
     * @private
     * @returns {Promise<void>}
     */
    async _initCoreLayer() {
        this._log('Initializing core layer...');

        // 1. 初始化设备能力检测
        const deviceLevel = deviceCapability.getPerformanceLevel();
        this._log('Device performance level:', deviceLevel);

        // 2. 根据设备性能调整动画帧管理器
        animationFrameManager.adaptToPerformance(deviceLevel);

        // 3. 启动性能监控
        performanceMonitor.start();
        this._log('Performance monitoring started');

        // 4. 初始化状态管理器（已在导入时创建）
        this._log('State manager initialized', {
            currentState: stateManager.getCurrentState()
        });

        // 5. 初始化错误边界（已在导入时创建）
        this._log('Error boundary initialized');

        // 6. 订阅核心事件
        this._setupCoreEventListeners();

        this._log('Core layer initialized');
    }

    /**
     * 初始化导航层模块
     * @private
     * @returns {Promise<void>}
     */
    async _initNavigationLayer() {
        this._log('Initializing navigation layer...');

        // 1. 初始化路由管理器
        routeManager.init();
        this._log('Route manager initialized');

        // 2. 初始化历史记录管理器
        historyManager.init();
        this._log('History manager initialized');

        // 3. 初始化Swup管理器
        await swupManager.init({
            animationController,
            progressiveRenderer,
            stateManager
        });
        this._log('Swup manager initialized');

        this._log('Navigation layer initialized');
    }

    /**
     * 初始化动画层模块
     * @private
     * @returns {Promise<void>}
     */
    async _initAnimationLayer() {
        this._log('Initializing animation layer...');

        // 1. 初始化动画控制器
        animationController.init(animationFrameManager, staggerManager);
        this._log('Animation controller initialized');

        // 2. 初始化VT管理器
        vtManager.init();
        this._log('VT manager initialized');

        // 3. 初始化Stagger管理器
        staggerManager.init();
        this._log('Stagger manager initialized');

        this._log('Animation layer initialized');
    }

    /**
     * 初始化渲染层模块
     * @private
     * @returns {Promise<void>}
     */
    async _initRenderingLayer() {
        this._log('Initializing rendering layer...');

        // 1. 初始化渐进渲染器
        progressiveRenderer.init({
            animationController,
            visibilityManager
        });
        this._log('Progressive renderer initialized');

        // 2. 初始化懒加载器
        lazyLoader.init();
        this._log('Lazy loader initialized');

        // 3. 初始化DOM调度器
        domScheduler.init();
        this._log('DOM scheduler initialized');

        // 4. 初始化可见性管理器
        visibilityManager.init();
        this._log('Visibility manager initialized');

        this._log('Rendering layer initialized');
    }

    /**
     * 初始化功能层模块
     * @private
     * @returns {Promise<void>}
     */
    async _initFeatureLayer() {
        this._log('Initializing feature layer...');

        // 1. 初始化主题模块
        themeModule.init();
        this._log('Theme module initialized');

        // 2. 初始化目录模块
        tocModule.init();
        this._log('TOC module initialized');

        // 3. 初始化粘性目录
        stickyTOC.init();
        this._log('Sticky TOC initialized');

        // 4. 初始化评论模块
        commentModule.init();
        this._log('Comment module initialized');

        // 5. 初始化导航指示器
        navIndicator.init();
        this._log('Nav indicator initialized');

        // 6. 初始化回到顶部按钮
        goTopButton.init();
        this._log('Go top button initialized');

        // 7. 初始化标签页模块
        tabModule.init();
        this._log('Tab module initialized');

        // 8. 初始化折叠面板
        collapsiblePanel.init();
        this._log('Collapsible panel initialized');

        this._log('Feature layer initialized');
    }

    /**
     * 设置核心事件监听
     * @private
     */
    _setupCoreEventListeners() {
        // 监听性能更新事件
        eventBus.on('performance:update', (data) => {
            if (DEBUG) {
                this._log('Performance update:', data);
            }
        });

        // 监听性能下降事件
        eventBus.on('performance:low', (data) => {
            this._log('Performance low detected:', data);
        });

        // 监听性能恢复事件
        eventBus.on('performance:recover', (data) => {
            this._log('Performance recovered:', data);
        });

        // 监听状态变更事件
        eventBus.on('state:change', (transition) => {
            if (DEBUG) {
                this._log('State changed:', transition);
            }
        });

        // 监听错误事件
        eventBus.on('error:occurred', (errorLog) => {
            this._log('Error occurred:', errorLog);
        });
    }

    /**
     * 设置全局事件监听
     * @private
     */
    _setupGlobalEventListeners() {
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                eventBus.emit('page:hidden');
            } else {
                eventBus.emit('page:visible');
            }
        });

        // 监听页面卸载
        window.addEventListener('beforeunload', () => {
            this._log('Page unloading, cleaning up...');
            this.cleanup();
        });

        // 监听页面加载完成
        if (document.readyState === 'complete') {
            eventBus.emit('page:loaded');
        } else {
            window.addEventListener('load', () => {
                eventBus.emit('page:loaded');
            });
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        if (this._isDestroyed) {
            return;
        }

        this._log('Cleaning up...');

        // 清理功能层
        try {
            collapsiblePanel.destroy();
            tabModule.destroy();
            goTopButton.destroy();
            navIndicator.destroy();
            commentModule.destroy();
            stickyTOC.destroy();
            tocModule.destroy();
            themeModule.destroy();
        } catch (error) {
            this._log('Error cleaning up feature layer:', error);
        }

        // 清理渲染层
        try {
            visibilityManager.destroy();
            domScheduler.destroy();
            lazyLoader.destroy();
            progressiveRenderer.destroy();
        } catch (error) {
            this._log('Error cleaning up rendering layer:', error);
        }

        // 清理动画层
        try {
            staggerManager.destroy();
            vtManager.destroy();
            animationController.destroy();
        } catch (error) {
            this._log('Error cleaning up animation layer:', error);
        }

        // 清理导航层
        try {
            swupManager.destroy();
            historyManager.destroy();
            routeManager.destroy();
        } catch (error) {
            this._log('Error cleaning up navigation layer:', error);
        }

        // 清理核心层
        try {
            stateManager.destroy();
            performanceMonitor.stop();
            animationFrameManager.destroy();
        } catch (error) {
            this._log('Error cleaning up core layer:', error);
        }

        this._log('Cleanup completed');
    }

    /**
     * 销毁PureSuck实例
     */
    destroy() {
        if (this._isDestroyed) {
            return;
        }

        this._log('Destroying PureSuck...');

        this.cleanup();
        this._isDestroyed = true;
        this._isInitialized = false;

        // 清除全局对象
        if (window.PureSuck && window.PureSuck._instance === this) {
            window.PureSuck = null;
        }

        this._log('PureSuck destroyed');
    }

    /**
     * 获取版本信息
     * @returns {Object} 版本信息
     */
    getVersion() {
        return { ...VERSION };
    }

    /**
     * 检查是否已初始化
     * @returns {boolean}
     */
    isInitialized() {
        return this._isInitialized;
    }

    /**
     * 启用调试模式
     */
    enableDebug() {
        DEBUG = true;
        this._log('Debug mode enabled');
    }

    /**
     * 禁用调试模式
     */
    disableDebug() {
        DEBUG = false;
        this._log('Debug mode disabled');
    }

    /**
     * 记录日志
     * @private
     * @param {string} message - 日志消息
     * @param {*} [data] - 附加数据
     */
    _log(message, data) {
        if (DEBUG || data instanceof Error) {
            console.log(`[PureSuck] ${message}`, data || '');
        }
    }
}

// ============================================================================
// 全局API
// ============================================================================

/**
 * PureSuck全局对象
 * @namespace PureSuck
 */
window.PureSuck = {
    // 版本信息
    version: VERSION.string,
    VERSION,

    // 调试模式
    get DEBUG() {
        return DEBUG;
    },
    set DEBUG(value) {
        DEBUG = Boolean(value);
    },

    // 核心层模块
    core: {
        StateManager,
        stateManager,
        NavigationState,
        StateEvents,
        EventBus,
        eventBus,
        PerformanceMonitor,
        performanceMonitor,
        DeviceCapability,
        deviceCapability,
        AnimationFrameManager,
        animationFrameManager,
        ErrorBoundary,
        ErrorType,
        ErrorSeverity,
        ErrorEvents,
        handleError,
        withErrorHandling,
        withAsyncErrorHandling
    },

    // 导航层模块
    navigation: {
        SwupManager,
        swupManager,
        RouteManager,
        routeManager,
        HistoryManager,
        historyManager
    },

    // 动画层模块
    animation: {
        AnimationController,
        animationController,
        PerformanceLevel,
        AnimationState,
        VTManager,
        vtManager,
        AnimationConfig,
        getAdaptiveConfig,
        StaggerManager,
        staggerManager
    },

    // 渲染层模块
    rendering: {
        ProgressiveRenderer,
        progressiveRenderer,
        LazyLoader,
        lazyLoader,
        DOMScheduler,
        domScheduler,
        VisibilityManager,
        visibilityManager
    },

    // 功能层模块
    features: {
        TOCModule,
        tocModule,
        ThemeModule,
        themeModule,
        CommentModule,
        commentModule,
        NavIndicator,
        navIndicator,
        GoTopButton,
        goTopButton,
        TabModule,
        tabModule,
        CollapsiblePanel,
        collapsiblePanel,
        StickyTOC,
        stickyTOC
    },

    // 所有模块的扁平化引用（向后兼容）
    modules: {
        // 核心层
        StateManager,
        stateManager,
        NavigationState,
        StateEvents,
        EventBus,
        eventBus,
        PerformanceMonitor,
        performanceMonitor,
        DeviceCapability,
        deviceCapability,
        AnimationFrameManager,
        animationFrameManager,
        ErrorBoundary,
        ErrorType,
        ErrorSeverity,
        ErrorEvents,
        handleError,
        withErrorHandling,
        withAsyncErrorHandling,
        // 导航层
        SwupManager,
        swupManager,
        RouteManager,
        routeManager,
        HistoryManager,
        historyManager,
        // 动画层
        AnimationController,
        animationController,
        PerformanceLevel,
        AnimationState,
        VTManager,
        vtManager,
        AnimationConfig,
        getAdaptiveConfig,
        StaggerManager,
        staggerManager,
        // 渲染层
        ProgressiveRenderer,
        progressiveRenderer,
        LazyLoader,
        lazyLoader,
        DOMScheduler,
        domScheduler,
        VisibilityManager,
        visibilityManager,
        // 功能层
        TOCModule,
        tocModule,
        ThemeModule,
        themeModule,
        CommentModule,
        commentModule,
        NavIndicator,
        navIndicator,
        GoTopButton,
        goTopButton,
        TabModule,
        tabModule,
        CollapsiblePanel,
        collapsiblePanel,
        StickyTOC,
        stickyTOC
    },

    // 初始化函数
    /**
     * 初始化PureSuck
     * @param {Object} [options] - 配置选项
     * @param {boolean} [options.debug=false] - 是否启用调试模式
     * @param {boolean} [options.defer=false] - 是否延迟初始化
     * @returns {Promise<PureSuck>}
     */
    init: (options) => {
        const instance = new PureSuck(options);
        window.PureSuck._instance = instance;
        return instance.init().then(() => instance);
    },

    // 销毁函数
    /**
     * 销毁PureSuck实例
     */
    destroy: () => {
        if (window.PureSuck._instance) {
            window.PureSuck._instance.destroy();
        }
    }
};

// ============================================================================
// 自动初始化
// ============================================================================

/**
 * 自动初始化PureSuck
 * @param {Object} [options] - 配置选项
 */
function autoInit(options = {}) {
    // 检查是否延迟初始化
    if (options.defer) {
        console.log('[PureSuck] Deferred initialization enabled');
        return;
    }

    // 在DOMContentLoaded时初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[PureSuck] Auto-initializing...');
            window.PureSuck.init(options);
        });
    } else {
        console.log('[PureSuck] Auto-initializing...');
        window.PureSuck.init(options);
    }
}

// 导出PureSuck类
export { PureSuck, VERSION };

// 导出所有模块（供ES6模块使用）
export {
    // 核心层
    StateManager,
    stateManager,
    NavigationState,
    StateEvents,
    EventBus,
    eventBus,
    PerformanceMonitor,
    performanceMonitor,
    DeviceCapability,
    deviceCapability,
    AnimationFrameManager,
    animationFrameManager,
    ErrorBoundary,
    ErrorType,
    ErrorSeverity,
    ErrorEvents,
    handleError,
    withErrorHandling,
    withAsyncErrorHandling,
    // 导航层
    SwupManager,
    swupManager,
    RouteManager,
    routeManager,
    HistoryManager,
    historyManager,
    // 动画层
    AnimationController,
    animationController,
    PerformanceLevel,
    AnimationState,
    VTManager,
    vtManager,
    AnimationConfig,
    getAdaptiveConfig,
    StaggerManager,
    staggerManager,
    // 渲染层
    ProgressiveRenderer,
    progressiveRenderer,
    LazyLoader,
    lazyLoader,
    DOMScheduler,
    domScheduler,
    VisibilityManager,
    visibilityManager,
    // 功能层
    TOCModule,
    tocModule,
    ThemeModule,
    themeModule,
    CommentModule,
    commentModule,
    NavIndicator,
    navIndicator,
    GoTopButton,
    goTopButton,
    TabModule,
    tabModule,
    CollapsiblePanel,
    collapsiblePanel,
    StickyTOC,
    stickyTOC
};

// 自动初始化（如果未禁用）
if (typeof window !== 'undefined') {
    // 检查是否有配置选项
    const userOptions = window.PureSuckOptions || {};
    
    // 如果没有明确禁用自动初始化，则执行
    if (userOptions.autoInit !== false) {
        autoInit(userOptions);
    }
}
