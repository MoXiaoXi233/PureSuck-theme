/**
 * PureSuck PJAX 控制器
 * 处理 PJAX 导航、滚动位置恢复、加密文章等
 */

(function() {
    'use strict';

    // 全局状态
    let pjaxResolve = null;
    let isPopstateNavigation = false;

    // 初始化 PJAX
    function initPjax() {
        const pjax = new Pjax({
            history: false,
            scrollRestoration: true,
            scrollTop: 0,
            cacheBust: false,
            timeout: 6500,
            elements: `a[href^="${window.location.origin}"]:not(a[target="_blank"], a[no-pjax]), form[action]:not([no-pjax])`,
            selectors: [
                "pjax",
                "script[data-pjax]",
                "title",
                ".nav.header-item.header-nav",
                ".main",
                ".right-sidebar"
            ]
        });

        return pjax;
    }

    // PJAX 完成事件
    function onPjaxComplete() {
        if (pjaxResolve) {
            pjaxResolve();
            pjaxResolve = null;
        }
    }

    // PJAX 成功事件
    function onPjaxSuccess() {
        // 只在 popstate 导航时恢复滚动位置
        if (isPopstateNavigation && window.navigationStack && window.navigationStack.stack) {
            const currentUrl = window.location.href;
            const targetPage = window.navigationStack.stack.find(p => p.url === currentUrl);
            if (targetPage && targetPage.scrollY !== undefined) {
                window.scrollTo({ top: targetPage.scrollY, behavior: 'instant' });
            } else {
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
            // 重置标记
            isPopstateNavigation = false;
        } else if (!isPopstateNavigation) {
            // 普通导航：滚动到顶部
            window.scrollTo({ top: 0, behavior: 'instant' });
        }

        // 触发分层渲染
        if (window.layeredRenderer) {
            const main = document.querySelector('.main');
            window.layeredRenderer.render(window.location.href, main);
        }

        // 执行用户自定义回调
        if (window.pjaxCustomCallback) {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => {
                    window.pjaxCustomCallback();
                }, { timeout: 2000 });
            } else {
                setTimeout(() => {
                    window.pjaxCustomCallback();
                }, 500);
            }
        }
    }

    // Popstate 事件处理
    function onPopstate(event) {
        // 标记为 popstate 导航
        isPopstateNavigation = true;

        // 保存当前页面的滚动位置
        if (window.navigationStack && window.navigationStack.currentIndex >= 0) {
            const currentScrollY = window.scrollY || window.pageYOffset || 0;
            const currentPage = window.navigationStack.stack[window.navigationStack.currentIndex];
            if (currentPage) {
                currentPage.scrollY = currentScrollY;
            }
        }

        if (!window.vtController || !window.navigationStack) {
            console.error('[Popstate] ❌ VT Controller 或 NavigationStack 未初始化');
            return;
        }

        const targetUrl = window.location.href;
        const direction = window.navigationStack.getDirection(targetUrl);

        // 判断导航方向并执行相应的过渡
        if (direction === 'back') {
            handleBackNavigation(targetUrl);
        } else if (direction === 'forward') {
            handleForwardNavigation(targetUrl);
        } else {
            window.pjax.loadUrl(targetUrl, {
                push: false,
                replace: false,
                skipPushState: true
            });
        }
    }

    // 处理后退导航
    function handleBackNavigation(targetUrl) {
        window.vtController.prepareReverseTransition(targetUrl);

        window.vtController.executeTransition(() => {
            return new Promise((resolve) => {
                pjaxResolve = resolve;
                window.pjax.loadUrl(targetUrl, {
                    push: false,
                    replace: false,
                    skipPushState: true
                });
            });
        }).then(() => {
            window.navigationStack.pop();
        });
    }

    // 处理前进导航
    function handleForwardNavigation(targetUrl) {
        window.vtController.executeTransition(() => {
            return new Promise((resolve) => {
                pjaxResolve = resolve;
                window.pjax.loadUrl(targetUrl, {
                    push: false,
                    replace: false,
                    skipPushState: true
                });
            });
        }).then(() => {
            window.navigationStack.forward();
        });
    }

    // 加密文章表单提交处理
    function onProtectedFormSubmit(e) {
        const form = e.target.closest('.protected-form');
        if (!form) return;

        e.preventDefault();

        const formData = new FormData(form);
        const submitBtn = form.querySelector('.protected-btn');
        const originalText = submitBtn.textContent;
        const currentUrl = window.location.href;

        // 显示加载状态
        submitBtn.textContent = '解锁中...';
        submitBtn.disabled = true;

        // 🔥 三层 AJAX 解决 Typecho 加密文章密码错乱问题
        // 第一层：获取 Token URL
        fetch(window.location.href, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'type=getTokenUrl'
        })
        .then(response => response.json())
        .then(data => {
            if (!data.tokenUrl) {
                throw new Error('无法获取验证链接');
            }

            // 第二层：使用 Token URL 提交密码
            return fetch(data.tokenUrl, {
                method: 'POST',
                body: formData
            });
        })
        .then(() => {
            // 第三层：检查文章是否已解锁
            return fetch(window.location.href, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'type=checkPassword'
            });
        })
        .then(response => response.json())
        .then(data => {
            if (data.hidden) {
                // 文章仍为加密状态，密码错误
                throw new Error('密码错误');
            }

            // 密码正确，显示成功提示
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

            // 使用 PJAX 重新加载页面
            // 添加时间戳避免 PJAX 缓存
            const urlWithTimestamp = currentUrl + (currentUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();

            const main = document.querySelector('.site-main');
            if (main) {
                main.style.viewTransitionName = 'main-content';
                main.style.willChange = 'opacity';
            }

            return new Promise((resolve) => {
                window.vtController?.executeTransition(async () => {
                    await new Promise(resolve => {
                        pjaxResolve = resolve;
                        // 使用 replace 避免产生新的 history 记录
                        window.pjax.loadUrl(urlWithTimestamp, {
                            triggerElement: form,
                            push: false,
                            replace: true
                        });
                    });
                }).then(() => {
                    // 恢复原 URL（去掉时间戳）
                    window.history.replaceState(window.history.state, document.title, currentUrl);
                    resolve();
                });
            });
        })
        .catch(error => {
            console.error('解锁失败:', error);

            // 使用 MoxToast 显示错误提示
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
            // 恢复按钮状态
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    }

    // 处理带锚点的链接点击
    function onLinkClick(e) {
        const link = e.target.closest(`a[href^="${window.location.origin}"]:not([target="_blank"]):not([no-pjax])`);
        if (!link) return;

        const href = link.getAttribute('href');
        const hashIndex = href.indexOf('#');

        // 处理带锚点的链接
        if (hashIndex !== -1) {
            const currentPath = window.location.pathname;
            const linkPath = new URL(href, window.location.origin).pathname;

            // 同页锚点，让默认行为处理
            if (linkPath === currentPath || href.startsWith('#')) return;

            e.preventDefault();

            const [url, hash] = [href.slice(0, hashIndex), href.slice(hashIndex + 1)];
            const isCardLink = !!link.closest('.post');
            const linkType = window.pageTypeDetector?.detectFromUrl(url) || 'unknown';

            // 准备过渡动画
            if (isCardLink) {
                window.vtController?.prepareTransition(link.closest('.post'));
            } else {
                const main = document.querySelector('.site-main');
                if (main) {
                    main.style.viewTransitionName = 'main-content';
                    main.style.willChange = 'opacity';
                }
            }

            // 执行 View Transition + Pjax
            const vtPromise = window.vtController?.executeTransition(async () => {
                await new Promise(resolve => {
                    pjaxResolve = resolve;
                    window.pjax.loadUrl(url, { triggerElement: link });
                });

                // DOM 更新后立即滚动到顶部
                if (window.scrollY > 0) {
                    window.scrollTo({ top: 0, behavior: 'instant' });
                }
            }) || Promise.resolve();

            vtPromise.then(() => {
                // 等待一帧后滚动到锚点
                setTimeout(() => {
                    const target = document.getElementById(hash);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        window.history.replaceState(window.history.state, document.title, `${url}#${hash}`);
                    }
                }, 100);

                // 更新导航栈
                if (window.location.href !== url && !window.location.href.startsWith(url + '#')) {
                    window.navigationStack?.push({ url, type: linkType, scrollY: 0 });
                    window.history.pushState({
                        url,
                        type: linkType,
                        timestamp: Date.now(),
                        stackIndex: window.navigationStack?.currentIndex || 0
                    }, document.title, url);
                }
            });
            return;
        }

        // 处理普通链接
        e.preventDefault();

        const linkType = window.pageTypeDetector?.detectFromUrl(link.href) || 'unknown';
        const isCard = !!link.closest('.post');
        const isPagination = link.closest('.pagination') || /page\/\d+/.test(link.href);

        // 准备过渡动画
        if (isCard && window.vtController) {
            window.vtController.prepareTransition(link.closest('.post'));
        } else if (isPagination && window.vtController) {
            const dir = link.classList.contains('next') || /下一页|»/.test(link.textContent) ? 'next' : 'prev';
            window.vtController.prepareListTransition(dir);
        } else {
            const main = document.querySelector('.site-main');
            if (main) {
                main.style.viewTransitionName = 'main-content';
                main.style.willChange = 'opacity';
            }
        }

        // 执行 View Transition + Pjax
        const navigationPromise = window.vtController?.executeTransition(async () => {
            await new Promise(resolve => {
                pjaxResolve = resolve;
                window.pjax.loadUrl(link.href, { triggerElement: link });
            });

            // DOM 更新后立即滚动到顶部
            if (window.scrollY > 0) {
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
        }) || new Promise(resolve => {
            pjaxResolve = resolve;
            window.pjax.loadUrl(link.href, { triggerElement: link });
        });

        navigationPromise.then(() => {
            // 更新导航栈
            if (window.location.href !== link.href) {
                window.navigationStack?.push({
                    url: link.href,
                    type: linkType,
                    scrollY: 0
                });

                window.history.pushState({
                    url: link.href,
                    type: linkType,
                    timestamp: Date.now(),
                    stackIndex: window.navigationStack?.currentIndex || 0
                }, document.title, link.href);
            }
        });
    }

    // PJAX 错误处理
    function onPjaxError(e) {
        console.error('[PJAX] 错误:', e);
        if (e.triggerElement && e.triggerElement.href) {
            window.location.href = e.triggerElement.href;
        }
    }

    // 绑定所有事件
    function bindEvents() {
        document.addEventListener('pjax:complete', onPjaxComplete);
        document.addEventListener('pjax:success', onPjaxSuccess);
        document.addEventListener('pjax:error', onPjaxError);
        document.addEventListener('popstate', onPopstate);
        document.addEventListener('submit', onProtectedFormSubmit);
        document.addEventListener('click', onLinkClick, true);
    }

    // 初始化
    function init() {
        if (typeof Pjax === 'undefined') {
            console.error('[PJAX] Pjax 库未加载');
            return;
        }

        window.pjax = initPjax();
        bindEvents();
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 暴露全局方法
    window.PureSuckPjax = {
        init,
        onPjaxComplete,
        onPjaxSuccess,
        onPopstate
    };
})();
