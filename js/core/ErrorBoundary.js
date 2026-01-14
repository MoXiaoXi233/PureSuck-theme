/**
 * PureSuck ErrorBoundary - 错误边界
 * 统一的错误处理机制，提供错误分类、降级策略和用户通知
 * 
 * @module core/ErrorBoundary
 */

import { eventBus } from './EventBus.js';
import { NavigationState, stateManager } from './StateManager.js';

/**
 * 错误类型枚举
 * @readonly
 * @enum {string}
 */
export const ErrorType = {
    /** 动画错误 */
    ANIMATION: 'animation',
    /** Swup导航错误 */
    SWUP: 'swup',
    /** View Transitions错误 */
    VT: 'vt',
    /** 渲染错误 */
    RENDERING: 'rendering',
    /** 状态管理错误 */
    STATE: 'state',
    /** 网络错误 */
    NETWORK: 'network',
    /** 未知错误 */
    UNKNOWN: 'unknown'
};

/**
 * 错误严重级别
 * @readonly
 * @enum {string}
 */
export const ErrorSeverity = {
    /** 低级别，不影响核心功能 */
    LOW: 'low',
    /** 中级别，影响部分功能 */
    MEDIUM: 'medium',
    /** 高级别，严重影响用户体验 */
    HIGH: 'high',
    /** 致命错误，需要立即处理 */
    CRITICAL: 'critical'
};

/**
 * 错误事件名称
 * @private
 */
const ERROR_EVENTS = {
    ERROR_OCCURRED: 'error:occurred',
    ERROR_HANDLED: 'error:handled',
    ERROR_RECOVERED: 'error:recovered'
};

/**
 * 降级策略配置
 * @private
 */
const FALLBACK_STRATEGIES = {
    [ErrorType.ANIMATION]: {
        /** 禁用所有动画 */
        disableAnimations: () => {
            document.documentElement.classList.add('no-animations');
            document.documentElement.style.setProperty('--animation-duration', '0ms');
        },
        /** 简化动画 */
        simplifyAnimations: () => {
            document.documentElement.classList.add('simplified-animations');
        }
    },
    [ErrorType.SWUP]: {
        /** 禁用Swup，使用传统导航 */
        disableSwup: () => {
            console.warn('[ErrorBoundary] Swup disabled due to error');
            // 标记Swup为禁用状态
            document.documentElement.dataset.swupDisabled = 'true';
        },
        /** 重新加载页面 */
        reloadPage: () => {
            window.location.reload();
        }
    },
    [ErrorType.VT]: {
        /** 禁用View Transitions */
        disableVT: () => {
            document.documentElement.classList.remove('ps-vt-mode');
            console.warn('[ErrorBoundary] View Transitions disabled due to error');
        }
    },
    [ErrorType.RENDERING]: {
        /** 禁用渐进渲染 */
        disableProgressiveRendering: () => {
            document.documentElement.dataset.progressiveRendering = 'false';
        },
        /** 立即渲染所有内容 */
        immediateRender: () => {
            const hiddenElements = document.querySelectorAll('[style*="opacity: 0"]');
            hiddenElements.forEach(el => {
                el.style.opacity = '1';
                el.style.transform = 'none';
            });
        }
    },
    [ErrorType.STATE]: {
        /** 重置状态 */
        resetState: () => {
            if (stateManager) {
                stateManager.reset();
            }
        }
    },
    [ErrorType.NETWORK]: {
        /** 显示离线提示 */
        showOfflineMessage: () => {
            if (typeof MoxToast === 'function') {
                MoxToast({
                    message: '网络连接异常，请检查网络设置',
                    duration: 5000
                });
            }
        }
    },
    [ErrorType.UNKNOWN]: {
        /** 通用降级策略 */
        genericFallback: () => {
            console.warn('[ErrorBoundary] Unknown error occurred');
        }
    }
};

/**
 * 错误日志记录器
 * @private
 */
class ErrorLogger {
    constructor() {
        this._logs = [];
        this._maxLogs = 100;
        this._enableLogging = true;
    }

    /**
     * 记录错误
     * @param {Error} error - 错误对象
     * @param {Object} context - 错误上下文
     */
    log(error, context) {
        if (!this._enableLogging) return;

        const logEntry = {
            timestamp: Date.now(),
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context: {
                type: context.type || ErrorType.UNKNOWN,
                severity: context.severity || ErrorSeverity.MEDIUM,
                ...context
            },
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        this._logs.push(logEntry);

        // 限制日志数量
        if (this._logs.length > this._maxLogs) {
            this._logs.shift();
        }

        // 输出到控制台
        console.error(`[ErrorBoundary] ${context.type || 'Unknown'} error:`, error, context);

        // 发布错误事件
        eventBus.emit(ERROR_EVENTS.ERROR_OCCURRED, logEntry);
    }

    /**
     * 获取所有日志
     * @returns {Array} 错误日志
     */
    getLogs() {
        return [...this._logs];
    }

    /**
     * 清空日志
     */
    clear() {
        this._logs = [];
    }

    /**
     * 获取指定类型的错误日志
     * @param {string} type - 错误类型
     * @returns {Array} 错误日志
     */
    getLogsByType(type) {
        return this._logs.filter(log => log.context.type === type);
    }

    /**
     * 导出日志
     * @returns {string} JSON格式的日志
     */
    exportLogs() {
        return JSON.stringify(this._logs, null, 2);
    }
}

/**
 * 错误边界类
 * 提供统一的错误处理机制
 */
export class ErrorBoundary {
    constructor() {
        this._logger = new ErrorLogger();
        this._errorCounts = new Map();
        this._maxErrorsPerType = 5;
        this._recoveryStrategies = new Map();
    }

    /**
     * 处理错误（静态方法）
     * @static
     * @param {Error} error - 错误对象
     * @param {Object} context - 错误上下文
     * @param {string} [context.type] - 错误类型
     * @param {string} [context.severity] - 错误严重级别
     * @param {string} [context.message] - 用户友好的错误消息
     * @param {Object} [context.metadata] - 附加元数据
     * @returns {boolean} 是否成功处理错误
     */
    static handle(error, context = {}) {
        const boundary = ErrorBoundary.getInstance();
        return boundary._handleError(error, context);
    }

    /**
     * 获取ErrorBoundary单例实例
     * @private
     * @returns {ErrorBoundary} 单例实例
     */
    static getInstance() {
        if (!ErrorBoundary._instance) {
            ErrorBoundary._instance = new ErrorBoundary();
        }
        return ErrorBoundary._instance;
    }

    /**
     * 处理错误（实例方法）
     * @private
     * @param {Error} error - 错误对象
     * @param {Object} context - 错误上下文
     * @returns {boolean} 是否成功处理错误
     */
    _handleError(error, context) {
        // 标准化错误对象
        const normalizedError = this._normalizeError(error);
        
        // 标准化上下文
        const normalizedContext = this._normalizeContext(context);

        // 记录错误
        this._logger.log(normalizedError, normalizedContext);

        // 检查错误频率
        if (this._shouldSuppressError(normalizedContext.type)) {
            console.warn('[ErrorBoundary] Error suppressed due to frequency limit');
            return false;
        }

        // 增加错误计数
        this._incrementErrorCount(normalizedContext.type);

        // 通知用户
        this._notifyUser(normalizedError, normalizedContext);

        // 执行降级策略
        this._executeFallback(normalizedContext);

        // 发布错误处理事件
        eventBus.emit(ERROR_EVENTS.ERROR_HANDLED, {
            error: normalizedError,
            context: normalizedContext
        });

        return true;
    }

    /**
     * 标准化错误对象
     * @private
     * @param {*} error - 错误对象
     * @returns {Error} 标准化的错误对象
     */
    _normalizeError(error) {
        if (error instanceof Error) {
            return error;
        }

        // 如果是字符串，创建Error对象
        if (typeof error === 'string') {
            return new Error(error);
        }

        // 如果是其他类型，转换为字符串
        return new Error(String(error));
    }

    /**
     * 标准化上下文
     * @private
     * @param {Object} context - 上下文对象
     * @returns {Object} 标准化的上下文对象
     */
    _normalizeContext(context) {
        return {
            type: context.type || ErrorType.UNKNOWN,
            severity: context.severity || ErrorSeverity.MEDIUM,
            message: context.message || this._getDefaultMessage(context.type),
            metadata: context.metadata || {},
            timestamp: Date.now()
        };
    }

    /**
     * 获取默认错误消息
     * @private
     * @param {string} type - 错误类型
     * @returns {string} 默认消息
     */
    _getDefaultMessage(type) {
        const messages = {
            [ErrorType.ANIMATION]: '动画执行出错，已简化动画效果',
            [ErrorType.SWUP]: '页面导航出错，请刷新页面重试',
            [ErrorType.VT]: '页面过渡出错，已切换到普通模式',
            [ErrorType.RENDERING]: '页面渲染出错，正在尝试恢复',
            [ErrorType.STATE]: '状态管理出错，已重置',
            [ErrorType.NETWORK]: '网络连接异常',
            [ErrorType.UNKNOWN]: '发生未知错误'
        };
        return messages[type] || messages[ErrorType.UNKNOWN];
    }

    /**
     * 通知用户
     * @private
     * @param {Error} error - 错误对象
     * @param {Object} context - 错误上下文
     */
    _notifyUser(error, context) {
        // 根据严重级别决定是否通知用户
        if (context.severity === ErrorSeverity.LOW) {
            // 低级别错误不通知用户
            return;
        }

        // 检查MoxToast是否可用
        if (typeof MoxToast === 'function') {
            const duration = context.severity === ErrorSeverity.CRITICAL ? 6000 : 3000;
            
            MoxToast({
                message: context.message,
                duration: duration
            });
        } else {
            // 如果MoxToast不可用，使用console.warn
            console.warn('[ErrorBoundary]', context.message);
        }
    }

    /**
     * 执行降级策略
     * @private
     * @param {Object} context - 错误上下文
     */
    _executeFallback(context) {
        const strategies = FALLBACK_STRATEGIES[context.type];
        
        if (!strategies) {
            console.warn('[ErrorBoundary] No fallback strategy for type:', context.type);
            return;
        }

        // 根据严重级别选择策略
        const strategyName = this._selectStrategy(context);
        
        if (strategies[strategyName]) {
            try {
                strategies[strategyName]();
                console.log(`[ErrorBoundary] Executed fallback strategy: ${strategyName}`);
            } catch (fallbackError) {
                console.error('[ErrorBoundary] Fallback strategy failed:', fallbackError);
            }
        }
    }

    /**
     * 选择降级策略
     * @private
     * @param {Object} context - 错误上下文
     * @returns {string} 策略名称
     */
    _selectStrategy(context) {
        // 根据错误类型和严重级别选择策略
        switch (context.type) {
            case ErrorType.ANIMATION:
                return context.severity === ErrorSeverity.HIGH 
                    ? 'disableAnimations' 
                    : 'simplifyAnimations';
            
            case ErrorType.SWUP:
                return context.severity === ErrorSeverity.CRITICAL 
                    ? 'reloadPage' 
                    : 'disableSwup';
            
            case ErrorType.VT:
                return 'disableVT';
            
            case ErrorType.RENDERING:
                return context.severity === ErrorSeverity.HIGH 
                    ? 'immediateRender' 
                    : 'disableProgressiveRendering';
            
            case ErrorType.STATE:
                return 'resetState';
            
            case ErrorType.NETWORK:
                return 'showOfflineMessage';
            
            default:
                return 'genericFallback';
        }
    }

    /**
     * 检查是否应该抑制错误
     * @private
     * @param {string} type - 错误类型
     * @returns {boolean} 是否抑制
     */
    _shouldSuppressError(type) {
        const count = this._errorCounts.get(type) || 0;
        return count > this._maxErrorsPerType;
    }

    /**
     * 增加错误计数
     * @private
     * @param {string} type - 错误类型
     */
    _incrementErrorCount(type) {
        const count = this._errorCounts.get(type) || 0;
        this._errorCounts.set(type, count + 1);
    }

    /**
     * 注册恢复策略
     * @param {string} errorType - 错误类型
     * @param {Function} strategy - 恢复策略
     */
    registerRecoveryStrategy(errorType, strategy) {
        if (typeof strategy !== 'function') {
            console.warn('[ErrorBoundary] Invalid recovery strategy');
            return;
        }
        this._recoveryStrategies.set(errorType, strategy);
    }

    /**
     * 尝试恢复
     * @param {string} errorType - 错误类型
     * @returns {boolean} 是否成功恢复
     */
    recover(errorType) {
        const strategy = this._recoveryStrategies.get(errorType);
        
        if (!strategy) {
            console.warn('[ErrorBoundary] No recovery strategy for type:', errorType);
            return false;
        }

        try {
            strategy();
            
            // 重置错误计数
            this._errorCounts.set(errorType, 0);
            
            // 发布恢复事件
            eventBus.emit(ERROR_EVENTS.ERROR_RECOVERED, { errorType });
            
            console.log(`[ErrorBoundary] Recovered from ${errorType} error`);
            return true;
        } catch (error) {
            console.error('[ErrorBoundary] Recovery failed:', error);
            return false;
        }
    }

    /**
     * 获取错误日志
     * @returns {Array} 错误日志
     */
    getLogs() {
        return this._logger.getLogs();
    }

    /**
     * 获取指定类型的错误日志
     * @param {string} type - 错误类型
     * @returns {Array} 错误日志
     */
    getLogsByType(type) {
        return this._logger.getLogsByType(type);
    }

    /**
     * 导出错误日志
     * @returns {string} JSON格式的日志
     */
    exportLogs() {
        return this._logger.exportLogs();
    }

    /**
     * 清空错误日志
     */
    clearLogs() {
        this._logger.clear();
    }

    /**
     * 获取错误统计信息
     * @returns {Object} 错误统计
     */
    getErrorStats() {
        const stats = {};
        for (const [type, count] of this._errorCounts) {
            stats[type] = count;
        }
        return {
            errorCounts: stats,
            totalErrors: Array.from(this._errorCounts.values()).reduce((a, b) => a + b, 0),
            logCount: this._logger.getLogs().length
        };
    }

    /**
     * 重置错误计数
     * @param {string} [type] - 错误类型，如果不指定则重置所有
     */
    resetErrorCounts(type) {
        if (type) {
            this._errorCounts.delete(type);
        } else {
            this._errorCounts.clear();
        }
    }

    /**
     * 销毁错误边界
     */
    destroy() {
        this._logger.clear();
        this._errorCounts.clear();
        this._recoveryStrategies.clear();
        ErrorBoundary._instance = null;
    }
}

/**
 * 错误事件名称常量
 * @readonly
 * @enum {string}
 */
export const ErrorEvents = {
    /** 错误发生事件 */
    ERROR_OCCURRED: ERROR_EVENTS.ERROR_OCCURRED,
    /** 错误处理事件 */
    ERROR_HANDLED: ERROR_EVENTS.ERROR_HANDLED,
    /** 错误恢复事件 */
    ERROR_RECOVERED: ERROR_EVENTS.ERROR_RECOVERED
};

/**
 * 便捷的错误处理函数
 * @param {Error} error - 错误对象
 * @param {Object} context - 错误上下文
 * @returns {boolean} 是否成功处理错误
 */
export function handleError(error, context) {
    return ErrorBoundary.handle(error, context);
}

/**
 * 创建带错误处理的包装函数
 * @param {Function} fn - 要包装的函数
 * @param {Object} context - 错误上下文
 * @returns {Function} 包装后的函数
 */
export function withErrorHandling(fn, context) {
    return (...args) => {
        try {
            return fn(...args);
        } catch (error) {
            ErrorBoundary.handle(error, context);
            return null;
        }
    };
}

/**
 * 创建异步错误处理包装函数
 * @param {Function} fn - 要包装的异步函数
 * @param {Object} context - 错误上下文
 * @returns {Function} 包装后的函数
 */
export function withAsyncErrorHandling(fn, context) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            ErrorBoundary.handle(error, context);
            return null;
        }
    };
}
