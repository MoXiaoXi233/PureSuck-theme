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
        (function() {
            const savedTheme = localStorage.getItem('theme');
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            const initialTheme = savedTheme === 'auto' || !savedTheme ? systemTheme : savedTheme;
            document.documentElement.setAttribute('data-theme', initialTheme);
        })();
    </script>
    <!-- Dark Mode -->
    <script>
        function setTheme(theme) {
            if (theme === 'auto') {
                const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', systemTheme);
                localStorage.setItem('theme', 'auto');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
                localStorage.setItem('theme', theme);
            }
            updateIcon(theme);
        }

        function toggleTheme() {
            const currentTheme = localStorage.getItem('theme') || 'auto';
            let newTheme;

            if (currentTheme === 'light') {
                newTheme = 'dark';
                MoxToast({
                    message: "已切换至深色模式"
                });
            } else if (currentTheme === 'dark') {
                newTheme = 'auto';
                MoxToast({
                    message: "模式将跟随系统 ㆆᴗㆆ"
                });
            } else {
                newTheme = 'light';
                MoxToast({
                    message: "已切换至浅色模式"
                });
            }

            setTheme(newTheme);
        }

        function updateIcon(theme) {
            const iconElement = document.getElementById('theme-icon');
            if (iconElement) {
                iconElement.classList.remove('icon-sun-inv', 'icon-moon-inv', 'icon-auto');
                if (theme === 'light') {
                    iconElement.classList.add('icon-sun-inv');
                } else if (theme === 'dark') {
                    iconElement.classList.add('icon-moon-inv');
                } else {
                    iconElement.classList.add('icon-auto');
                }
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            const savedTheme = localStorage.getItem('theme') || 'auto';
            setTheme(savedTheme);
        });

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
            if (localStorage.getItem('theme') === 'auto') {
                const newTheme = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                updateIcon('auto');
            }
        });
    </script>
    <!-- Style CSS -->
    <link rel="stylesheet" href="<?= $this->options->themeUrl('css/PureSuck_Style.css'); ?>">
    <!-- 主题样式微调 -->
    <!-- 标题线条 -->
    <?php if ($this->options->postTitleAfter != 'off'): ?>
        <style>
            .post-title::after {
                bottom: <?php echo $this->options->postTitleAfter == 'wavyLine' ? '-5px' : '5px'; ?>;
                left: <?php echo '0'; ?>;
                <?php if ($this->options->postTitleAfter == 'boldLine'): ?>width: <?php echo '58px'; ?>;
                height: <?php echo '13px'; ?>;
                <?php elseif ($this->options->postTitleAfter == 'wavyLine'): ?>width: <?php echo '80px'; ?>;
                height: <?php echo '12px'; ?>;
                mask: <?php echo "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"10\" viewBox=\"0 0 40 10\" preserveAspectRatio=\"none\"><path d=\"M0 5 Q 10 0, 20 5 T 40 5\" stroke=\"black\" stroke-width=\"2\" fill=\"transparent\"/></svg>') repeat-x"; ?>;
                mask-size: <?php echo '40px 12px'; ?>;
                <?php elseif ($this->options->postTitleAfter == 'handDrawn'): ?>
                /* 添加手绘风格的样式 */
                /* 这里可以添加具体的手绘风格的样式，不过浪费了两个小时也没写好，放弃了 */
                <?php endif; ?>
            }
        </style>
    <?php endif; ?>
    <!-- AOS -->
    <script defer src="<?php $this->options->themeUrl('/js/aos.js'); ?>"></script>
    <!-- ICON Setting -->
    <link rel="icon" href="<?= isset($this->options->logoUrl) && $this->options->logoUrl ? $this->options->logoUrl : $this->options->themeUrl . '/images/avatar.ico'; ?>" type="image/x-icon">
    <!-- CSS引入 -->
    <link href="<?php $this->options->themeUrl('/css/a11y-dark.min.css'); ?>" rel="stylesheet">
    <link href="<?php $this->options->themeUrl('/css/PureSuck_Module.css'); ?>" rel="stylesheet">
    <link href="<?php $this->options->themeUrl('/css/aos.css'); ?>" rel="stylesheet">
    <link defer href="<?php $this->options->themeUrl('/css/MoxDesign.css'); ?>" rel="stylesheet">
    <!-- JS引入 -->
    <script defer src="<?php $this->options->themeUrl('/js/medium-zoom.min.js'); ?>"></script>
    <script defer src="<?php $this->options->themeUrl('/js/highlight.min.js'); ?>"></script>
    <script defer src="<?php $this->options->themeUrl('/js/PureSuck_Module.js'); ?>"></script>
    <script defer src="<?php $this->options->themeUrl('/js/OwO.min.js'); ?>"></script>
    <script defer src="<?php $this->options->themeUrl('/js/MoxDesign.js'); ?>"></script>
    <!-- Pjax -->
    <?php if ($this->options->enablepjax == '1'): ?>
        <script defer src="<?php $this->options->themeUrl('/js/pjax.min.js'); ?>"></script>
        <script type="text/javascript">
            document.addEventListener('DOMContentLoaded', function() {
                var pjax = new Pjax({
                    history: true,
                    scrollRestoration: true,
                    cacheBust: false,
                    timeout: 6500,
                    elements: 'a[href^="<?php Helper::options()->siteUrl() ?>"]:not(a[target="_blank"], a[no-pjax] ), form[action]',
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
            document.addEventListener('pjax:error', function(e) {
                console.error(e);
                console.log('pjax error: \n' + JSON.stringify(e));
                window.location.href = e.triggerElement.href;
            });

            // Pjax 完成后 JS 重载
            document.addEventListener("pjax:success", function(event) {

                // 短代码及模块部分
                runShortcodes();

                // TOC吸附
                initializeStickyTOC();

                // AOS 动画
                AOS.refresh();

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
                    <?php echo $this->options->PjaxScript; ?>
                <?php endif; ?>

                // 评论区部分重载
                if (document.querySelector('.OwO-textarea')) {
                    initializeCommentsOwO();
                }

                Comments_Submit();
            });
        </script>
        <script defer src="<?php $this->options->themeUrl('/js/pace.min.js'); ?>"></script>
        <link rel="stylesheet" href="<?php $this->options->themeUrl('/css/pace-theme-default.min.css'); ?>">
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
                <span class="el-avatar el-avatar--circle">
                    <img src="<?= $this->options->logoIndex; ?>" style="object-fit:cover;" alt="博主头像" width="120" height="120">
                </span>
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
                    <a href="https://github.com/MoXiaoXi233/PureSuck-theme">Theme PureSuck</a>
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