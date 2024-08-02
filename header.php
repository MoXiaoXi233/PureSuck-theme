<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>
<!DOCTYPE HTML>
<html lang="zh-CN">
<head>
    <meta charset="<?= $this->options->charset(); ?>">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="renderer" content="webkit">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <meta name="description" content="<?= empty($this->fields->description) || !$this->is('single') ? ($this->getDescription() ?: '') : $this->fields->description; ?>" />
    <title>
        <?php $this->archiveTitle([
            'category'  =>  _t('分类 %s 下的文章'),
            'search'    =>  _t('包含关键字 %s 的文章'),
            'tag'       =>  _t('标签 %s 下的文章'),
            'author'    =>  _t('%s 发布的文章')
        ], '', ' - '); ?>
        <?= $this->options->title(); ?>
    </title>
    <!-- CSS引入 -->
    <link rel="stylesheet" href="<?= $this->options->themeUrl('css/PureSuck_Style.css'); ?>">
    <link rel="stylesheet" href="<?= $this->options->themeUrl('css/font-awesome.min.css'); ?>">
    <link rel="stylesheet" href="<?= $this->options->themeUrl('css/PureSuck_module.css'); ?>">    
    
    <!-- AOS引入 -->
    <link rel="stylesheet" href="<?= $this->options->themeUrl('css/aos.css'); ?>">
    <script src="<?php $this->options->themeUrl('/js/aos.js'); ?>"></script>

    <!-- 网站icon图标 -->
    <link rel="icon" href="<?= isset($this->options->logoUrl) && $this->options->logoUrl ? $this->options->logoUrl : $this->options->themeUrl . '/images/avatar.png'; ?>" type="image/x-icon">
</head>

<body>
    <div class="wrapper">
        <header role="header" class="header" data-js="header">
            <div class="wrapper header-wrapper header-title">
                <span class="el-avatar el-avatar--circle">
                    <img src="<?= $this->options->logoIndex; ?>" style="object-fit:cover;" alt="博主头像" width="512" height="512">
                </span>

                <div class="header-title">
                    <?= $this->options->titleIndex(); ?>
                </div>

                <p itemprop="description" class="header-item header-about">
                    <?= $this->options->customDescription ?: 'ワクワク'; ?>
                </p>

                <div class="left-side-custom-code">
                    <?= $this->options->leftSideCustomCode ?: ''; ?>
                </div>

                <div class="nav header-item header-credit" style="color: #5c6a70;">
                    Powered by Typecho
                    <br>
                    <a href="https://github.com/MoXiaoXi233/PureSuck-theme" style="color: #5c6a70;">Theme PureSuck</a>
                </div>
				<br>
                <nav class="nav header-item header-nav" role="navigation">
                    <span class="nav-item<?= $this->is('index') ? ' nav-item-current' : ''; ?>">
                        <a href="<?= $this->options->siteUrl(); ?>" title="首页">
                            <span itemprop="name">首页</span>
                        </a>
                    </span>

                    <!--循环显示页面-->
                    <?php $this->widget('Widget_Contents_Page_List')->to($pages); ?>
                    <?php while($pages->next()): ?>
                    <span class="nav-item<?= $this->is('page', $pages->slug) ? ' nav-item-current' : ''; ?>">
                        <a href="<?= $pages->permalink(); ?>" title="<?= $pages->title(); ?>">
                            <span><?= $pages->title(); ?></span>
                        </a>
                    </span>
                    <?php endwhile; ?>
                    <!--结束显示页面-->
                </nav>
            </div>
        </header>

        <main role="main" class="main">
