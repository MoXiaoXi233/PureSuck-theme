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

    <!-- 主题防闪烁脚本（立即执行，在 CSS 加载前设置主题） -->
    <script>
        (function () {
            // 1. 优先读取 Cookie（跨站同步）
            const cookieMatch = document.cookie.match(/(?:^|;)\s*theme=([^;]+)/);
            const cookieTheme = cookieMatch ? cookieMatch[1] : null;

            // 2. 读取 localStorage
            const localTheme = localStorage.getItem('theme');

            // 3. 决定初始主题
            let initialTheme = cookieTheme || localTheme || 'auto';

            // 4. auto 模式下，根据系统主题决定
            if (initialTheme === 'auto') {
                initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }

            // 5. 立即设置主题，防止闪烁
            document.documentElement.setAttribute('data-theme', initialTheme);
        })();
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

    <?php if ($this->is('index') || $this->is('archive')): ?>
        <!-- First paint: preload list enter state to avoid "flash then animate" -->
        <script>
            (function () {
                try {
                    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
                    document.documentElement.classList.add('ps-preload-list-enter');
                } catch (e) { }
            })();
        </script>
    <?php endif; ?>

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

    <?php if ($this->options->enablepjax == '1'): ?>

    <?php endif; ?>

    <!-- JS引入：按优先级分组加载 -->

    <!-- 高优先级：核心功能（首屏必需） -->
    <script defer src="<?php getStaticURL(path: 'highlight.min.js'); ?>"></script>
    <script defer src="<?php $this->options->themeUrl('/js/PureSuck_Module.js'); ?>"></script>
    <script defer src="<?php $this->options->themeUrl('/js/MoxDesign.js'); ?>"></script>

    <!-- 低优先级：按需加载（评论区/图片交互） -->
    <script defer src="<?php $this->options->themeUrl('/js/OwO.min.js'); ?>"></script>
    <script defer src="<?php getStaticURL(path: 'medium-zoom.min.js'); ?>"></script>

    <!-- Swup 4：页面过渡动画 -->
    <?php if ($this->options->enablepjax == '1'): ?>
        <script defer src="<?php getStaticURL(path: 'Swup.umd.min.js'); ?>"></script>
        <script defer src="<?php $this->options->themeUrl('/js/lib/Swup/scroll-plugin.js'); ?>"></script>
        <script defer src="<?php $this->options->themeUrl('/js/PureSuck_Swup.js'); ?>"></script>

        <?php if ($this->options->PjaxScript): ?>
            <script defer>
                // 注册用户自定义回调（Swup page:view 后执行）
                window.pjaxCustomCallback = function () {
                    <?= $this->options->PjaxScript; ?>
                };
            </script>
        <?php endif; ?>
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
        <?php
        $psPageType = 'list';
        if ($this->is('post')) {
            $psPageType = 'post';
        } elseif ($this->is('page')) {
            $psPageType = 'page';
        } elseif ($this->is('index') || $this->is('archive')) {
            $psPageType = 'list';
        }
        ?>
        <div id="swup" data-ps-page-type="<?= $psPageType; ?>">
            <main class="main">
