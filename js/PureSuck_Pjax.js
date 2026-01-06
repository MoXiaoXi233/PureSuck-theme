/**
 * PureSuck PJAX 控制器
 * 处理 PJAX 导航、滚动位置恢复、加密文章等
 */

(function() {
    'use strict';

    // 全局状态
    let pjaxResolve = null;
    let eventsBound = false; // 防止重复绑定事件
    let cleanupCallbacks = []; // 清理回调队列
    let scrollPositions = new Map(); // 保存每个 URL 的滚动位置
    let isBackNavigation = false; // 标记是否是返回导航

    // 初始化 PJAX
    function initPjax() {
        const pjax = new Pjax({
            history: false,         // ✅ 手动管理 history,以便在返回时启动 VT
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
        // 重新为 sidebar 和 header 设置 VT name
        const sidebar = document.querySelector('.right-sidebar');
        const header = document.querySelector('.header');

        if (sidebar) {
            sidebar.style.viewTransitionName = 'sidebar-static';
        }

        if (header) {
            header.style.viewTransitionName = 'header-static';
        }

        if (pjaxResolve) {
            pjaxResolve();
            pjaxResolve = null;
        }
    }

    // PJAX 发送事件 (在请求发送前)
    function onPjaxSend() {
        // 不需要任何处理,让浏览器和 PJAX 自己处理
    }

    // PJAX 成功事件
    function onPjaxSuccess() {
        // ✅ 滚动逻辑移交给 onPopstate 的 .then() 处理
        // 不在这里重置 isBackNavigation，避免干扰滚动恢复

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
        if (!window.vtController || !window.navigationStack) {
            return;
        }

        const targetUrl = window.location.href;
        const direction = window.navigationStack.getDirection(targetUrl);

        // 阻止默认行为,手动控制
        event.preventDefault();

        if (direction === 'back') {
            // 标记为返回导航
            isBackNavigation = true;

            // 准备 reverse transition
            window.vtController.prepareReverseTransition();

            // 启动 VT 并在回调中让 PJAX 加载
            window.vtController.executeTransition(() => {
                return new Promise((resolve) => {
                    pjaxResolve = resolve;
                    // 手动调用 PJAX 加载
                    window.pjax.loadUrl(targetUrl, {
                        push: false,
                        replace: false,
                        history: false
                    });
                });
            }).then(() => {
                window.navigationStack.pop();
                // 恢复滚动位置
                const savedScrollY = scrollPositions.get(targetUrl);
                if (savedScrollY !== undefined) {
                    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
                }
                // ✅ 在滚动恢复后重置标记
                isBackNavigation = false;
            });
        } else if (direction === 'forward') {
            // 标记为返回导航
            isBackNavigation = true;

            // 启动 VT 并在回调中让 PJAX 加载
            window.vtController.executeTransition(() => {
                return new Promise((resolve) => {
                    pjaxResolve = resolve;
                    window.pjax.loadUrl(targetUrl, {
                        push: false,
                        replace: false,
                        history: false
                    });
                });
            }).then(() => {
                window.navigationStack.forward();
                // 恢复滚动位置
                const savedScrollY = scrollPositions.get(targetUrl);
                if (savedScrollY !== undefined) {
                    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
                }
                // ✅ 在滚动恢复后重置标记
                isBackNavigation = false;
            });
        }
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
            // ❌ 移除时间戳破坏缓存的行为，改用 PJAX 的缓存控制
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
                        // PJAX 会自动处理缓存
                        window.pjax.loadUrl(currentUrl, {
                            triggerElement: form,
                            push: false,
                            replace: true
                        });
                    });
                }).then(() => {
                    resolve();
                });
            });
        })
        .catch(() => {
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

            // 同页锚点：让浏览器自己处理
            if (linkPath === currentPath || href.startsWith('#')) {
                // 不阻止默认行为，让浏览器自己跳转
                return;
            }

            e.preventDefault();

            // ✅ 保存当前页面的滚动位置
            scrollPositions.set(window.location.href, window.scrollY);

            const [url, anchorHash] = [href.slice(0, hashIndex), href.slice(hashIndex + 1)];
            const isCardLink = !!link.closest('.post');
            const linkType = window.pageTypeDetector?.detectFromUrl(url) || 'unknown';

            // 准备过渡动画
            if (isCardLink) {
                window.vtController?.prepareTransition(link.closest('.post'));
            } else {
                // 非卡片链接（导航、分页等）也需要设置固定元素的VT name
                const header = document.querySelector('.header');
                if (header) {
                    header.style.viewTransitionName = 'header-static';
                }

                const rightSidebar = document.querySelector('.right-sidebar');
                if (rightSidebar) {
                    rightSidebar.style.viewTransitionName = 'sidebar-static';
                }

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
            }) || Promise.resolve();

            vtPromise.then(() => {
                // 等待DOM更新后，让浏览器自己滚动到锚点
                setTimeout(() => {
                    // ✅ 手动管理 history，因为 PJAX history: false
                    const currentUrl = window.location.href;
                    const targetUrl = anchorHash ? `${url}#${anchorHash}` : url;
                    if (currentUrl !== targetUrl) {
                        window.history.pushState({ scrollY: 0 }, document.title, targetUrl);
                    }

                    if (anchorHash) {
                        const target = document.getElementById(anchorHash);
                        if (target) {
                            // 让浏览器自己跳转，不做额外计算
                            target.scrollIntoView({ behavior: 'smooth' });
                        }
                    }

                    // 更新导航栈用于 View Transition
                    if (window.navigationStack) {
                        window.navigationStack.push({ url: targetUrl, type: linkType });
                    }
                }, 100);
            });
            return;
        }

        // 处理普通链接
        e.preventDefault();

        // ✅ 保存当前页面的滚动位置
        scrollPositions.set(window.location.href, window.scrollY);

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
            // 非卡片链接（导航等）也需要设置固定元素的VT name
            const header = document.querySelector('.header');
            if (header) {
                header.style.viewTransitionName = 'header-static';
            }

            const rightSidebar = document.querySelector('.right-sidebar');
            if (rightSidebar) {
                rightSidebar.style.viewTransitionName = 'sidebar-static';
            }

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

            // ✅ 普通导航需要滚动到顶部
            window.scrollTo({ top: 0, behavior: 'instant' });
        }) || new Promise(resolve => {
            pjaxResolve = resolve;
            window.pjax.loadUrl(link.href, { triggerElement: link });
            // ✅ 普通导航需要滚动到顶部
            window.scrollTo({ top: 0, behavior: 'instant' });
        });

        navigationPromise.then(() => {
            // ✅ 手动管理 history，因为 PJAX history: false
            const currentUrl = window.location.href;
            if (currentUrl !== link.href) {
                window.history.pushState({ scrollY: 0 }, document.title, link.href);
            }

            // 更新导航栈用于 View Transition
            if (window.navigationStack) {
                window.navigationStack.push({
                    url: link.href,
                    type: linkType
                });
            }
        });
    }

    // PJAX 错误处理
    function onPjaxError(e) {
        if (e.triggerElement && e.triggerElement.href) {
            window.location.href = e.triggerElement.href;
        }
    }

    // 绑定所有事件
    function bindEvents() {
        // 防止重复绑定
        if (eventsBound) return;
        eventsBound = true;

        // 使用捕获阶段确保在 PJAX 之前处理 popstate
        const popstateHandler = onPopstate.bind(this);
        window.addEventListener('popstate', popstateHandler, true);
        cleanupCallbacks.push(() => window.removeEventListener('popstate', popstateHandler, true));

        // ✅ 添加 pjax:send 事件监听,在 PJAX 发送请求前启动 VT
        document.addEventListener('pjax:send', onPjaxSend);
        cleanupCallbacks.push(() => document.removeEventListener('pjax:send', onPjaxSend));

        document.addEventListener('pjax:complete', onPjaxComplete);
        document.addEventListener('pjax:success', onPjaxSuccess);
        document.addEventListener('pjax:error', onPjaxError);
        document.addEventListener('submit', onProtectedFormSubmit);

        const clickHandler = onLinkClick.bind(this);
        document.addEventListener('click', clickHandler, true);
        cleanupCallbacks.push(() => document.removeEventListener('click', clickHandler, true));
    }

    // 清理事件监听器
    function cleanup() {
        cleanupCallbacks.forEach(callback => callback());
        cleanupCallbacks = [];
        eventsBound = false;
    }

    // 初始化
    function init() {
        if (typeof Pjax === 'undefined') {
            return;
        }

        // ✅ 手动管理滚动恢复，避免浏览器自动干扰
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
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
        onPopstate,
        cleanup
    };
})();
