<!DOCTYPE HTML>
<html lang="zh-CN">

<head>
    <meta charset="<?= $this->options->charset(); ?>">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="renderer" content="webkit">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php $this->header(); ?>
    <title>
        <?php $this->archiveTitle([
            'category' => _t('分类 %s 下的文章'),
            'search' => _t('包含关键字 %s 的文章'),
            'tag' => _t('标签 %s 下的文章'),
            'author' => _t('%s 发布的文章')
        ], '', ' - '); ?>
        <?= $this->options->title(); ?>
    </title>
    <?php generateDynamicCSS(); ?>
    <!-- Initial Theme Script -->
    <script>
        (function () {
            const savedTheme = localStorage.getItem('theme');
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            const initialTheme = savedTheme === 'auto' || !savedTheme ? systemTheme : savedTheme;
            document.documentElement.setAttribute('data-theme', initialTheme);
        })();
    </script>

    <script>
        (function () {
            // 读取 Cookie 中的 theme
            const matches = document.cookie.match(/(?:^|;)\s*theme=([^;]+)/);
            let mode = matches ? matches[1] : "auto";

            // auto 模式下，根据系统主题提前决定 effective 主题
            if (mode === "auto") {
                mode = window.matchMedia("(prefers-color-scheme: dark)").matches ?
                    "dark" :
                    "light";
            }

            // 提前设定 data-theme，避免闪烁
            document.documentElement.setAttribute("data-theme", mode);
        })();
    </script>

    <!-- Dark Mode -->
    <script>
        /* 自动获取根域名，例如 www.xxx.cn → .xxx.cn */
        function getRootDomain() {
            const host = window.location.hostname;
            const parts = host.split(".");
            if (parts.length <= 2) return host; // 如 localhost
            return "." + parts.slice(-2).join(".");
        }

        /* 写入跨子域 Cookie，用于同步主题 */
        function setThemeCookie(theme) {
            const rootDomain = getRootDomain();
            document.cookie = `theme=${theme}; path=/; domain=${rootDomain}; SameSite=Lax`;
        }

        /* 读取 Cookie */
        function getCookie(name) {
            const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
            return match ? match[2] : null;
        }

        function applyThemeAttribute(themeValue) {
            const root = document.documentElement;
            if (root.getAttribute("data-theme") === themeValue) {
                return;
            }
            const apply = () => {
                root.classList.add("theme-switching");
                root.setAttribute("data-theme", themeValue);
                window.requestAnimationFrame(() => {
                    window.setTimeout(() => {
                        root.classList.remove("theme-switching");
                    }, 80);
                });
            };

            if (document.startViewTransition) {
                document.startViewTransition(() => {
                    apply();
                });
            } else {
                apply();
            }
        }

        function setTheme(theme) {
            // 自动模式 → 跟随系统
            if (theme === "auto") {
                const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                applyThemeAttribute(systemTheme);
                localStorage.setItem("theme", "auto");
                setThemeCookie("auto");
            } else {
                // 明暗模式
                applyThemeAttribute(theme);
                localStorage.setItem("theme", theme);
                setThemeCookie(theme);
            }

            updateIcon(theme);
        }

        function toggleTheme() {
            const currentTheme = localStorage.getItem("theme") || "auto";
            let newTheme;

            if (currentTheme === "light") {
                newTheme = "dark";
                MoxToast({
                    message: "已切换至深色模式"
                });
            } else if (currentTheme === "dark") {
                newTheme = "auto";
                MoxToast({
                    message: "模式将跟随系统 ㆆᴗㆆ"
                });
            } else {
                newTheme = "light";
                MoxToast({
                    message: "已切换至浅色模式"
                });
            }

            setTheme(newTheme);
        }

        function updateIcon(theme) {
            const iconElement = document.getElementById("theme-icon");
            if (iconElement) {
                iconElement.classList.remove("icon-sun-inv", "icon-moon-inv", "icon-auto");
                if (theme === "light") {
                    iconElement.classList.add("icon-sun-inv");
                } else if (theme === "dark") {
                    iconElement.classList.add("icon-moon-inv");
                } else {
                    iconElement.classList.add("icon-auto");
                }
            }
        }

        /* 初始化：优先读取 Cookie → 保证跨站同步 */
        document.addEventListener("DOMContentLoaded", function () {
            const cookieTheme = getCookie("theme");
            const savedTheme = cookieTheme || localStorage.getItem("theme") || "auto";
            setTheme(savedTheme);
        });

        /* 系统主题变化时（仅 auto 模式生效） */
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
            if (localStorage.getItem("theme") === "auto") {
                const newTheme = e.matches ? "dark" : "light";
                applyThemeAttribute(newTheme);
                updateIcon("auto");
            }
        });
    </script>

    <script>
        window.THEME_URL = "<?php $this->options->themeUrl(); ?>";
    </script>

    <script>
        (function () {
            var root = document.documentElement;
            root.classList.add("js-scroll-reveal");
            window.__scrollRevealFailSafe = window.setTimeout(function () {
                root.classList.remove("js-scroll-reveal");
            }, 2500);
        })();
    </script>

    <!-- Style CSS -->
    <link rel="stylesheet" href="<?= $this->options->themeUrl('css/fontello.css'); ?>">
    <link rel="stylesheet" href="<?= $this->options->themeUrl('css/PureSuck_Style.css'); ?>">
    <!-- 主题样式微调 -->
    <!-- 标题线条 -->
    <?php if ($this->options->postTitleAfter == 'off'): ?>
        <style>
            .post-title::after {
                content: none !important;
                display: none !important;
            }

            .post-title {
                margin: 0;
            }
        </style>
    <?php else: ?>
        <style>
            .post-title::after {
                bottom:
                    <?= $this->options->postTitleAfter == 'wavyLine' ? '-5px' : '5px'; ?>
                ;
                left: 0;
                <?php if ($this->options->postTitleAfter == 'boldLine'): ?>
                    width: 58px;
                    height: 13px;
                <?php elseif ($this->options->postTitleAfter == 'wavyLine'): ?>
                    width: 80px;
                    height: 12px;
                    mask:
                        <?= "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"10\" viewBox=\"0 0 40 10\" preserveAspectRatio=\"none\"><path d=\"M0 5 Q 10 0, 20 5 T 40 5\" stroke=\"black\" stroke-width=\"2\" fill=\"transparent\"/></svg>') repeat-x"; ?>
                    ;
                    mask-size: 40px 12px;
                <?php elseif ($this->options->postTitleAfter == 'handDrawn'): ?>
                    /* handDrawn... */
                <?php endif; ?>
            }
        </style>
    <?php endif; ?>
    <!-- ICON Setting -->
    <link rel="icon"
        href="<?= isset($this->options->logoUrl) && $this->options->logoUrl ? $this->options->logoUrl : $this->options->themeUrl . '/images/avatar.ico'; ?>"
        type="image/x-icon">
    <!-- CSS引入 -->
    <link href="<?php $this->options->themeUrl('/css/code-reading.css'); ?>" rel="stylesheet">
    <link href="<?php $this->options->themeUrl('/css/PureSuck_Module.css'); ?>" rel="stylesheet">
    <link defer href="<?php $this->options->themeUrl('/css/MoxDesign.css'); ?>" rel="stylesheet">
    <!-- JS引入 -->
    <script defer src="<?php getStaticURL(path: 'medium-zoom.min.js'); ?>"></script>
    <script defer src="<?php getStaticURL(path: 'highlight.min.js'); ?>"></script>
    <script defer src="<?php $this->options->themeUrl('/js/PureSuck_Module.js'); ?>"></script>
    <script defer src="<?php $this->options->themeUrl('/js/PureSuck_ScrollReveal.js'); ?>"></script>
    <script defer src="<?php $this->options->themeUrl('/js/OwO.min.js'); ?>"></script>
    <script defer src="<?php $this->options->themeUrl('/js/MoxDesign.js'); ?>"></script>
    <!-- Pjax -->
    <?php if ($this->options->enablepjax == '1'): ?>
        <script defer src="<?php getStaticURL('pjax.min.js'); ?>"></script>
        <script type="text/javascript">
            document.addEventListener('DOMContentLoaded', function () {
                var pjax = new Pjax({
                    history: true,
                    scrollRestoration: true,
                    cacheBust: false,
                    timeout: 6500,
                    elements: 'a[href^="<?php Helper::options()->siteUrl() ?>"]:not(a[target="_blank"], a[no-pjax]), form[action]:not([no-pjax])',
                    selectors: [
                        "pjax",
                        "script[data-pjax]",
                        "title",
                        ".nav.header-item.header-nav",
                        ".main",
                        ".right-sidebar"
                    ]
                });
            });

            // Pjax 加载超时时跳转，不然它不给你跳转的！！！
            document.addEventListener('pjax:error', function (e) {
                console.error(e);
                console.log('pjax error: \n' + JSON.stringify(e));
                window.location.href = e.triggerElement.href;
            });

            // Pjax 完成后 JS 重载
            document.addEventListener("pjax:success", function (event) {

                // 短代码及模块部分
                runShortcodes();

                // TOC吸附
                initializeStickyTOC();

                // 确保代码块高亮
                <?php $codeBlockSettings = Typecho_Widget::widget('Widget_Options')->codeBlockSettings; ?>
                document.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                    <?php if (is_array($codeBlockSettings) && in_array('ShowLineNumbers', $codeBlockSettings)): ?>
                        addLineNumber(block);
                    <?php endif; ?>
                });
                <?php if (is_array($codeBlockSettings) && in_array('ShowCopyButton', $codeBlockSettings)): ?>
                    addCopyButtons();
                <?php endif; ?>

                <?php if ($this->options->PjaxScript): ?>
                    <?= $this->options->PjaxScript; ?>
                <?php endif; ?>

                // 评论区部分重载
                if (document.querySelector('.OwO-textarea')) {
                    initializeCommentsOwO();
                }

                Comments_Submit();
            });
        </script>
        <script defer src="<?php getStaticURL('pace.min.js'); ?>"></script>
        <link rel="stylesheet" href="<?php getStaticURL('pace-theme-default.min.css'); ?>">
    <?php else: ?>
        <!-- 是不是 Pjax 有 bug，哈哈哈 --kissablecho -->
        <!-- 没错我差点死在自己留的鬼判定了--MoXi -->
        <!-- 写这段 Pjax 代码的人猝死掉了，哈哈哈 --kissablecho -->
    <?php endif; ?>
</head>

<body>
    <div class="wrapper">
        <header class="header" data-js="header">
            <div class="wrapper header-wrapper header-title">
                <a href="<?= $this->options->logoIndexUrl ?: $this->options->siteUrl; ?>" class="avatar-link"
                    aria-label="博主名字">
                    <span class="el-avatar el-avatar--circle avatar-hover-effect">
                        <img src="<?= $this->options->logoIndex; ?>" style="object-fit:cover;" alt="博主头像" width="120"
                            height="120" data-name="博主名字" draggable="false">
                    </span>
                </a>
                <div class="header-title">
                    <?= $this->options->titleIndex(); ?>
                </div>
                <p itemprop="description" class="header-item header-about">
                    <?= $this->options->customDescription ?: 'ワクワク'; ?>
                </p>
                <div class="nav header-item left-side-custom-code">
                    <?= $this->options->leftSideCustomCode ?: ''; ?>
                </div>
                <div class="nav header-item header-credit">
                    Powered by Typecho
                    <br>
                    <a href="https://github.com/MoXiaoXi233/PureSuck-theme" target="_blank">Theme PureSuck</a>
                </div>
                <nav class="nav header-item header-nav">
                    <span class="nav-item<?= $this->is('index') ? ' nav-item-current' : ''; ?>">
                        <a href="<?= $this->options->siteUrl(); ?>" title="首页">
                            <span itemprop="name">首页</span>
                        </a>
                    </span>
                    <!--循环显示页面-->
                    <?php $this->widget('Widget_Contents_Page_List')->to($pages); ?>
                    <?php while ($pages->next()): ?>
                        <span class="nav-item<?= $this->is('page', $pages->slug) ? ' nav-item-current' : ''; ?>">
                            <a href="<?= $pages->permalink(); ?>" title="<?= $pages->title(); ?>">
                                <span><?= $pages->title(); ?></span>
                            </a>
                        </span>
                    <?php endwhile; ?>
                    <!--结束显示页面-->
                </nav>
                <div class="theme-toggle-container">
                    <button class="theme-toggle" onclick="toggleTheme()" aria-label="日夜切换">
                        <span id="theme-icon"></span>
                    </button>
                </div>
            </div>
        </header>
        <main class="main">
