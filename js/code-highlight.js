/**
 * 按需加载代码高亮 v3
 *
 * 优化策略：
 * 1. 只在页面有代码块时才加载 highlight.js（本地文件）
 * 2. 加载后立即高亮所有代码块（避免 tabs/翻页时看到高亮过程）
 * 3. 支持行号和复制按钮功能（使用原有实现）
 */

(function() {
    'use strict';

    // 配置
    const CONFIG = {
        // 本地文件路径
        localUrl: window.THEME_URL + '/js/lib/highlight.min.js',

        // 是否启用行号（从 Typecho 配置读取）
        showLineNumbers: true,

        // 是否启用复制按钮（从 Typecho 配置读取）
        showCopyButton: true
    };

    // 从 Typecho 配置读取设置
    function loadThemeSettings() {
        const body = document.body;
        if (!body) return;

        // 读取 data-code-line-numbers 属性
        const lineNumbersAttr = body.getAttribute('data-code-line-numbers');
        if (lineNumbersAttr !== null) {
            CONFIG.showLineNumbers = lineNumbersAttr === 'true';
        }

        // 读取 data-code-copy-button 属性
        const copyButtonAttr = body.getAttribute('data-code-copy-button');
        if (copyButtonAttr !== null) {
            CONFIG.showCopyButton = copyButtonAttr === 'true';
        }
    }

    // 状态
    let hljsLoaded = false;
    let hljsLoading = false;

    /**
     * 检查页面是否有代码块
     */
    function hasCodeBlocks() {
        return document.querySelector('pre code') !== null;
    }

    /**
     * 加载 highlight.js
     */
    function loadHighlightJS() {
        if (hljsLoaded || hljsLoading) {
            return hljsLoaded ? Promise.resolve() : new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (hljsLoaded) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 50);
            });
        }

        hljsLoading = true;

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = CONFIG.localUrl;
            script.async = true;

            script.onload = () => {
                hljsLoaded = true;
                hljsLoading = false;
                resolve();
            };

            script.onerror = () => {
                hljsLoading = false;
                console.error('[CodeHighlight] 加载失败');
                reject(new Error('Failed to load highlight.js'));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * 添加行号（原有实现）
     */
    function addLineNumbers(codeBlock) {
        if (!CONFIG.showLineNumbers) return;
        if (codeBlock.classList.contains('code-block-extension-code-show-num')) return;

        codeBlock.classList.add('code-block-extension-code-show-num');
        const codeHtml = codeBlock.innerHTML;
        const lines = codeHtml.split('\n').map((line, index) => {
            return `<span class="code-block-extension-code-line" data-line-num="${index + 1}">${line}</span>`;
        }).join('\n');
        codeBlock.innerHTML = lines;
    }

    /**
     * 添加复制按钮（原有实现，支持 HTTP 环境）
     */
    function addCopyButton(preElement) {
        if (!CONFIG.showCopyButton) return;
        if (preElement.parentElement.classList.contains('code-block-wrapper')) return;

        // 创建包装容器
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        // 将 pre 元素包装起来
        preElement.parentNode.insertBefore(wrapper, preElement);
        wrapper.appendChild(preElement);

        // 创建复制按钮
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.innerText = 'Copy';
        button.setAttribute('onclick', 'window.handleCodeCopy(event)');

        wrapper.appendChild(button);
    }

    /**
     * 复制按钮点击处理（原有实现）
     */
    window.handleCodeCopy = async function(event) {
        event.stopPropagation();
        event.preventDefault();

        const button = event.currentTarget;
        const codeBlock = button.parentElement.querySelector('code');

        // 获取代码文本
        const code = codeBlock.textContent;

        // 保存当前滚动位置
        const scrollY = window.scrollY;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(code);
                button.innerText = 'Copied!';
            } else {
                // 使用 document.execCommand() 作为后备（HTTP 环境）
                const textArea = document.createElement('textarea');
                textArea.value = code;
                textArea.style.position = 'fixed';
                textArea.style.top = '0';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    button.innerText = 'Copied!';
                } catch (err) {
                    console.error('复制文本失败:', err);
                    alert('复制文本失败，请重试。');
                }
                document.body.removeChild(textArea);
            }
        } catch (err) {
            console.error('复制文本失败:', err);
            alert('复制文本失败，请重试。');
        }

        // 恢复滚动位置
        window.scrollTo(0, scrollY);

        setTimeout(() => {
            button.innerText = 'Copy';
        }, 2000);
    };

    /**
     * 高亮单个代码块
     */
    function highlightBlock(codeBlock) {
        if (!codeBlock || codeBlock.dataset.highlighted === 'yes') return;

        const preElement = codeBlock.parentElement;
        if (!preElement || preElement.tagName !== 'PRE') return;

        try {
            // 1. 执行高亮
            if (typeof hljs !== 'undefined' && typeof hljs.highlightElement === 'function') {
                hljs.highlightElement(codeBlock);
            }

            // 2. 添加行号（在高亮之后）
            addLineNumbers(codeBlock);

            // 3. 添加复制按钮
            addCopyButton(preElement);
        } catch (e) {
            console.error('[CodeHighlight] 高亮失败:', e);
        }
    }

    /**
     * 高亮所有代码块（同步版本）
     * 直接遍历所有代码块并高亮，确保在动画前完成
     */
    function highlightAllBlocks() {
        const codeBlocks = Array.from(document.querySelectorAll('pre code'));
        if (codeBlocks.length === 0) return;

        for (const block of codeBlocks) {
            if (block.isConnected) {
                highlightBlock(block);
            }
        }
    }

    /**
     * 初始化代码高亮
     */
    async function init() {
        // 加载主题设置
        loadThemeSettings();

        // 检查是否有代码块
        if (!hasCodeBlocks()) {
            return;
        }

        try {
            // 加载 highlight.js
            await loadHighlightJS();

            // 立即高亮所有代码块
            highlightAllBlocks();
        } catch (e) {
            console.error('[CodeHighlight] 初始化失败:', e);
        }
    }

    /**
     * 重新初始化（用于 PJAX/Swup 页面切换）
     */
    function reinit() {
        // 如果已经加载了 hljs，直接高亮新代码块
        if (hljsLoaded) {
            highlightAllBlocks();
        } else {
            // 否则重新初始化
            init();
        }
    }

    // 导出到全局
    window.CodeHighlight = {
        init,
        reinit,
        config: CONFIG
    };

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 监听 Swup 页面切换事件 - 同步执行，高亮完成后再开始动画
    document.addEventListener('swup:contentReplaced', reinit);
})();
