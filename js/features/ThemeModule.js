/**
 * PureSuck ThemeModule - 主题切换模块
 * 控制深色、浅色模式，支持跨子域 Cookie 同步
 * 集成 View Transitions API 提供平滑过渡
 * 
 * @module features/ThemeModule
 */

import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';

/**
 * 主题类型枚举
 * @readonly
 * @enum {string}
 */
export const ThemeType = {
    /** 浅色模式 */
    LIGHT: 'light',
    /** 深色模式 */
    DARK: 'dark',
    /** 自动模式（跟随系统） */
    AUTO: 'auto'
};

/**
 * 主题模块类
 * 管理主题切换的所有功能
 */
class ThemeModule {
    constructor() {
        this.initialized = false;
        this.currentTheme = ThemeType.AUTO;
    }

    /**
     * 检查是否支持 View Transitions API
     * @returns {boolean} 是否支持
     */
    supportsViewTransition() {
        return typeof document.startViewTransition === 'function';
    }

    /**
     * 检查是否启用了减少动画偏好
     * @returns {boolean} 是否启用
     */
    prefersReducedMotion() {
        return typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * 运行主题 View Transition
     * @param {Function} update - 更新函数
     */
    runThemeViewTransition(update) {
        if (!this.supportsViewTransition() || this.prefersReducedMotion()) {
            update();
            return;
        }

        const root = document.documentElement;
        root.classList.add('ps-theme-vt');

        let transition;
        try {
            transition = document.startViewTransition(() => {
                update();
            });
        } catch (e) {
            root.classList.remove('ps-theme-vt');
            update();
            return;
        }

        if (transition && transition.finished) {
            transition.finished.finally(() => {
                root.classList.remove('ps-theme-vt');
            });
        } else {
            setTimeout(() => {
                root.classList.remove('ps-theme-vt');
            }, 300);
        }
    }

    /**
     * 获取根域名（用于跨子域 Cookie）
     * @returns {string} 根域名，如 .xxx.cn
     */
    getRootDomain() {
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length <= 2) return host; // localhost 或 xxx.com
        return '.' + parts.slice(-2).join('.');
    }

    /**
     * 写入跨子域 Cookie
     * @param {string} theme - 主题值
     */
    setThemeCookie(theme) {
        try {
            const rootDomain = this.getRootDomain();
            document.cookie = `theme=${theme}; path=/; domain=${rootDomain}; SameSite=Lax; max-age=31536000`;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.UNKNOWN,
                severity: ErrorSeverity.LOW,
                message: '设置主题 Cookie 失败',
                metadata: { module: 'ThemeModule', theme }
            });
        }
    }

    /**
     * 读取 Cookie
     * @param {string} name - Cookie 名称
     * @returns {string|null} Cookie 值
     */
    getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    /**
     * 应用主题属性
     * @param {string} themeValue - 主题值
     */
    applyThemeAttribute(themeValue) {
        const root = document.documentElement;
        if (root.getAttribute('data-theme') === themeValue) {
            return;
        }
        root.setAttribute('data-theme', themeValue);
    }

    /**
     * 获取有效主题（处理 auto 模式）
     * @param {string} theme - 主题值
     * @returns {string} 有效主题值
     */
    getEffectiveTheme(theme) {
        if (theme === ThemeType.AUTO) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? ThemeType.DARK : ThemeType.LIGHT;
        }
        return theme;
    }

    /**
     * 更新主题图标
     * @param {string} theme - 主题值
     */
    updateIcon(theme) {
        const iconElement = document.getElementById('theme-icon');
        if (!iconElement) return;

        iconElement.classList.remove('icon-sun-inv', 'icon-moon-inv', 'icon-auto');

        if (theme === ThemeType.LIGHT) {
            iconElement.classList.add('icon-sun-inv');
        } else if (theme === ThemeType.DARK) {
            iconElement.classList.add('icon-moon-inv');
        } else {
            iconElement.classList.add('icon-auto');
        }
    }

    /**
     * 应用主题（内部方法，不使用 View Transition）
     * @param {string} theme - 主题值 ('light' | 'dark' | 'auto')
     */
    applyTheme(theme) {
        if (theme === ThemeType.AUTO) {
            // 自动模式：跟随系统
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
                ? ThemeType.DARK 
                : ThemeType.LIGHT;
            this.applyThemeAttribute(systemTheme);
            localStorage.setItem('theme', ThemeType.AUTO);
            this.setThemeCookie(ThemeType.AUTO);
        } else {
            // 明暗模式
            this.applyThemeAttribute(theme);
            localStorage.setItem('theme', theme);
            this.setThemeCookie(theme);
        }

        this.currentTheme = theme;
        this.updateIcon(theme);
    }

    /**
     * 设置主题（带 View Transition）
     * @param {string} theme - 主题值 ('light' | 'dark' | 'auto')
     * @public
     */
    setTheme(theme) {
        try {
            const root = document.documentElement;
            const currentApplied = root.getAttribute('data-theme');
            const nextApplied = this.getEffectiveTheme(theme);

            if (currentApplied === nextApplied) {
                this.applyTheme(theme);
                return;
            }

            this.runThemeViewTransition(() => {
                this.applyTheme(theme);
            });
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.UNKNOWN,
                severity: ErrorSeverity.MEDIUM,
                message: '设置主题失败',
                metadata: { module: 'ThemeModule', theme }
            });
        }
    }

    /**
     * 切换主题
     * @public
     */
    toggleTheme() {
        try {
            const currentTheme = localStorage.getItem('theme') || ThemeType.AUTO;
            let newTheme;

            if (currentTheme === ThemeType.LIGHT) {
                newTheme = ThemeType.DARK;
                if (typeof MoxToast === 'function') {
                    MoxToast({ message: '已切换至深色模式' });
                }
            } else if (currentTheme === ThemeType.DARK) {
                newTheme = ThemeType.AUTO;
                if (typeof MoxToast === 'function') {
                    MoxToast({ message: '模式将跟随系统 ㆆᴗㆆ' });
                }
            } else {
                newTheme = ThemeType.LIGHT;
                if (typeof MoxToast === 'function') {
                    MoxToast({ message: '已切换至浅色模式' });
                }
            }

            this.setTheme(newTheme);
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.UNKNOWN,
                severity: ErrorSeverity.MEDIUM,
                message: '切换主题失败',
                metadata: { module: 'ThemeModule' }
            });
        }
    }

    /**
     * 获取当前主题
     * @returns {string} 当前主题值
     * @public
     */
    getTheme() {
        return this.currentTheme;
    }

    /**
     * 初始化主题系统
     */
    initTheme() {
        try {
            // 优先读取 Cookie（跨站同步）
            const cookieTheme = this.getCookie('theme');
            const savedTheme = cookieTheme || localStorage.getItem('theme') || ThemeType.AUTO;
            this.applyTheme(savedTheme);
            this.initialized = true;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.UNKNOWN,
                severity: ErrorSeverity.HIGH,
                message: '主题系统初始化失败',
                metadata: { module: 'ThemeModule' }
            });
        }
    }

    /**
     * 监听系统主题变化
     */
    watchSystemTheme() {
        try {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (localStorage.getItem('theme') === ThemeType.AUTO) {
                    const newTheme = e.matches ? ThemeType.DARK : ThemeType.LIGHT;
                    this.applyThemeAttribute(newTheme);
                    this.updateIcon(ThemeType.AUTO);
                }
            });
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.UNKNOWN,
                severity: ErrorSeverity.LOW,
                message: '监听系统主题变化失败',
                metadata: { module: 'ThemeModule' }
            });
        }
    }

    /**
     * 初始化模块
     * @public
     */
    init() {
        if (this.initialized) return;
        this.initTheme();
        this.watchSystemTheme();
    }

    /**
     * 销毁模块
     */
    destroy() {
        this.initialized = false;
    }
}

// 创建单例实例
const themeModule = new ThemeModule();

// 导出到全局（保持向后兼容）
window.setTheme = (theme) => themeModule.setTheme(theme);
window.toggleTheme = () => themeModule.toggleTheme();

/**
 * 初始化主题模块
 * @public
 */
export function initTheme() {
    themeModule.init();
}

/**
 * 设置主题
 * @param {string} theme - 主题值
 * @public
 */
export function setTheme(theme) {
    return themeModule.setTheme(theme);
}

/**
 * 切换主题
 * @public
 */
export function toggleTheme() {
    return themeModule.toggleTheme();
}

/**
 * 获取当前主题
 * @returns {string} 当前主题值
 * @public
 */
export function getTheme() {
    return themeModule.getTheme();
}

/**
 * 获取主题模块实例
 * @returns {ThemeModule} 主题模块实例
 * @public
 */
export function getThemeModule() {
    return themeModule;
}

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}

export default ThemeModule;
