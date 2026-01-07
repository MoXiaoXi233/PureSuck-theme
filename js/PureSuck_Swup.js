/**
 * PureSuck Swup 4 配置
 * 仅实现基础 Pjax 功能，无动画
 */

(function() {
    'use strict';

    function initSwup() {
        if (typeof Swup === 'undefined') {
            console.error('[Swup] Swup 对象未定义');
            return;
        }

        // ========== Swup 4 基础配置 ==========
        const swup = new Swup({
            containers: ['#swup'],
            animateHistoryBrowsing: false,
            native: false  // 关闭原生动画
        });

        // ========== 页面加载完成后的回调 ==========
        swup.hooks.on('page:view', () => {
            // 更新导航栏高亮
            const currentPath = window.location.pathname;
            document.querySelectorAll('.header-nav .nav-item').forEach(item => {
                const link = item.querySelector('a');
                if (link) {
                    const linkPath = new URL(link.href).pathname;
                    item.classList.toggle('nav-item-current', linkPath === currentPath);
                }
            });

            // 代码高亮
            if (typeof hljs !== 'undefined') {
                document.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }

            // TOC 目录
            if (typeof initializeStickyTOC === 'function') {
                initializeStickyTOC();
            }

            // Shortcodes
            if (typeof runShortcodes === 'function') {
                runShortcodes();
            }

            // 评论 OwO
            const commentTextarea = document.querySelector('.OwO-textarea');
            if (commentTextarea && typeof initializeCommentsOwO === 'function') {
                initializeCommentsOwO();
            }

            // 用户自定义回调
            if (typeof window.pjaxCustomCallback === 'function') {
                window.pjaxCustomCallback();
            }
        });

        // ========== 加密文章表单处理 ==========
        document.addEventListener('submit', (event) => {
            const form = event.target.closest('.protected-form');
            if (!form) return;

            event.preventDefault();

            const formData = new FormData(form);
            const submitBtn = form.querySelector('.protected-btn');
            const originalText = submitBtn.textContent;

            submitBtn.textContent = '解锁中...';
            submitBtn.disabled = true;

            fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'type=getTokenUrl'
            })
            .then(response => response.json())
            .then(data => {
                if (!data.tokenUrl) throw new Error('无法获取验证链接');
                return fetch(data.tokenUrl, { method: 'POST', body: formData });
            })
            .then(() => {
                return fetch(window.location.href, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'type=checkPassword'
                });
            })
            .then(response => response.json())
            .then(data => {
                if (data.hidden) throw new Error('密码错误');

                if (typeof MoxToast === 'function') {
                    MoxToast({
                        message: '✓ 解锁成功',
                        duration: 2000,
                        position: 'bottom',
                        backgroundColor: 'rgba(52, 199, 89, 0.9)',
                        textColor: '#fff',
                        borderColor: 'rgba(52, 199, 89, 0.3)'
                    });
                }

                swup.navigate(window.location.href);
            })
            .catch(() => {
                if (typeof MoxToast === 'function') {
                    MoxToast({
                        message: '密码错误，请重试',
                        duration: 3000,
                        position: 'bottom',
                        backgroundColor: 'rgba(255, 59, 48, 0.9)',
                        textColor: '#fff',
                        borderColor: 'rgba(255, 59, 48, 0.3)'
                    });
                } else {
                    alert('密码错误，请重试');
                }
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
        });

        console.log('[Swup] 已启用 Swup 4 (基础模式)');
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSwup);
    } else {
        initSwup();
    }
})();
