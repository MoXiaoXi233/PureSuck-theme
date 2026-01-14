/**
 * PureSuck CommentModule - 评论模块
 * 处理评论提交和重置逻辑
 * 防止重复提交，支持 AJAX 提交
 * 
 * @module features/CommentModule
 */

import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';

/**
 * 评论模块类
 * 管理评论表单的所有功能
 */
class CommentModule {
    constructor() {
        this.initialized = false;
        this.commentResetBound = false;
        this.form = null;
    }

    /**
     * 重置评论表单
     * @param {HTMLFormElement} form - 评论表单元素
     */
    resetForm(form) {
        if (!form) return;

        try {
            const submitButton = form.querySelector("#submit");
            if (!submitButton) return;
            const originalText = form.dataset.psSubmitText || submitButton.textContent;

            submitButton.disabled = false;
            submitButton.textContent = originalText;
            form.dataset.psSubmitting = "0";
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.UNKNOWN,
                severity: ErrorSeverity.LOW,
                message: '重置评论表单失败',
                metadata: { module: 'CommentModule' }
            });
        }
    }

    /**
     * 绑定评论重置逻辑
     * 监听 pageshow 事件，在页面回退时重置表单状态
     */
    bindCommentReset() {
        if (this.commentResetBound) return;
        this.commentResetBound = true;

        try {
            window.addEventListener("pageshow", () => {
                const form = document.getElementById("cf");
                if (!form || form.dataset.psSubmitting !== "1") return;
                this.resetForm(form);
            });
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.UNKNOWN,
                severity: ErrorSeverity.LOW,
                message: '绑定评论重置失败',
                metadata: { module: 'CommentModule' }
            });
        }
    }

    /**
     * 初始化评论提交功能
     */
    initCommentSubmit() {
        try {
            const form = document.getElementById("cf");
            if (!form) return;

            // 防止 PJAX 重复绑定
            if (form.dataset.binded === "1") return;
            form.dataset.binded = "1";

            const submitButton = form.querySelector("#submit");
            const textarea = form.querySelector("#textarea");

            if (!submitButton || !textarea) return;

            if (!form.dataset.psSubmitText) {
                form.dataset.psSubmitText = submitButton.textContent;
            }
            form.dataset.psSubmitting = "0";
            this.bindCommentReset();

            // 只监听 submit（关键）
            form.addEventListener("submit", (e) => {
                // 防止重复提交
                if (form.dataset.psSubmitting === "1") {
                    e.preventDefault();
                    return;
                }

                // 内容为空，交给浏览器 / Typecho 提示
                if (textarea.value.trim() === "") {
                    return;
                }

                form.dataset.psSubmitting = "1";

                submitButton.disabled = true;
                submitButton.textContent = "提交中…";
            });

            // HTML5 校验失败时恢复
            form.addEventListener(
                "invalid",
                () => {
                    this.resetForm(form);
                },
                true
            );

            this.form = form;
            this.initialized = true;
        } catch (error) {
            ErrorBoundary.handle(error, {
                type: ErrorType.UNKNOWN,
                severity: ErrorSeverity.MEDIUM,
                message: '初始化评论提交失败',
                metadata: { module: 'CommentModule' }
            });
        }
    }

    /**
     * 初始化模块
     * @public
     */
    init() {
        if (this.initialized) return;
        this.initCommentSubmit();
    }

    /**
     * 销毁模块
     */
    destroy() {
        this.initialized = false;
        this.commentResetBound = false;
        this.form = null;
    }
}

// 创建单例实例
const commentModule = new CommentModule();

/**
 * 初始化评论模块
 * @public
 */
export function initCommentModule() {
    commentModule.init();
}

/**
 * 重置评论表单
 * @param {HTMLFormElement} form - 评论表单元素
 * @public
 */
export function resetCommentForm(form) {
    return commentModule.resetForm(form);
}

/**
 * 获取评论模块实例
 * @returns {CommentModule} 评论模块实例
 * @public
 */
export function getCommentModule() {
    return commentModule;
}

// 导出旧的函数名以保持向后兼容
export const Comments_Submit = initCommentModule;

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommentModule);
} else {
    initCommentModule();
}

export default CommentModule;
