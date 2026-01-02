<div class="right-sidebar" id="right-sidebar">

    <!-- 搜索功能 -->
    <?php if ($this->options->showSearch === '1'): ?>
        <div class="search-section">
            <header class="section-header">
                <span class="icon-search"></span>
                <span class="title">搜索</span>
            </header>
            <section class="section-body">
                <form method="get" action="<?php $this->options->siteUrl(); ?>" class="search-container" role="search">
                    <input type="text" name="s" class="search-input" placeholder="输入关键字搜索" aria-label="输入关键字搜索">
                    <button type="submit" class="search-button" aria-label="搜索">
                        <span class="icon-search"></span>
                    </button>
                </form>
            </section>
        </div>
    <?php endif; ?>

    <!-- 分类模块 -->
    <?php if ($this->options->showCategory === '1'): ?>
        <div class="cloud-section">
            <header class="section-header">
                <span class="icon-emo-wink"></span>
                <span class="title">分类</span>
            </header>
            <section class="section-body">
                <div class="cloud-container">
                    <?php $this->widget('Widget_Metas_Category_List')->to($categories); ?>
                    <?php if ($categories->have()): ?>
                        <?php while ($categories->next()): ?>
                            <a href="<?php $categories->permalink(); ?>" class="cloud-item"><?php $categories->name(); ?></a>
                        <?php endwhile; ?>
                    <?php else: ?>
                        <p>没有任何分类</p>
                    <?php endif; ?>
                </div>
            </section>
        </div>
    <?php endif; ?>

    <!-- 标签模块 -->
    <?php if ($this->options->showTag === '1'): ?>
        <div class="cloud-section">
            <header class="section-header">
                <span class="icon-hashtag"></span>
                <span class="title">标签</span>
            </header>
            <section class="section-body">
                <div class="cloud-container">
                    <?php $this->widget('Widget_Metas_Tag_Cloud')->to($tags); ?>
                    <?php if ($tags->have()): ?>
                        <?php $count = 0; ?>
                        <?php while ($tags->next() && $count < 20): ?>
                            <a href="<?php $tags->permalink(); ?>" class="cloud-item">
                                <?php $tags->name(); ?>
                            </a>
                            <?php $count++; ?>
                        <?php endwhile; ?>

                        <?php
                        // 使用 Widget_Contents_Page_List 获取页面信息
                        $this->widget('Widget_Contents_Page_List')->to($pages);
                        $archivesUrl = '';

                        while ($pages->next()):
                            if ($pages->template == 'archives.php'): // 匹配归档页面
                                $archivesUrl = $pages->permalink;
                                break;
                            endif;
                        endwhile;
                        ?>

                        <?php if ($tags->next() && $archivesUrl): ?>
                            <a href="<?php echo $archivesUrl; ?>" class="cloud-item">...</a>
                        <?php endif; ?>
                    <?php else: ?>
                        <p>没有任何标签</p>
                    <?php endif; ?>
                </div>
            </section>
        </div>
    <?php endif; ?>

    <!-- TOC -->
    <?php
    $tocHtml = $GLOBALS['toc_html'] ?? '';
    ?>
    <?php if ($this->options->showTOC === '1' && $tocHtml && ($this->is('post') || $this->is('page') || $this->is('archives'))): ?>
        <div class="toc-section" id="toc-section">
            <header class="section-header">
                <span class="icon-article"></span>
                <span class="title">文章目录</span>
            </header>
            <section class="section-body">
                <div class="toc"><?= $tocHtml; ?></div>
            </section>
        </div>
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                initializeStickyTOC();
            });
        </script>
    <?php endif; ?>

</div>
