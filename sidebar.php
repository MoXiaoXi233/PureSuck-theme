<div class="right-sidebar">

    <!-- 搜索功能 -->
    <?php if ($this->options->showSearch == '1'): ?>
        <div class="search-section">
            <header class="section-header">
                <span class="icon-search"></span>
                <span class="title">搜索</span>
            </header>
            <section class="section-body">
                <form method="get" action="<?php $this->options->siteUrl(); ?>" class="search-container">
                    <input type="text" name="s" class="search-input" placeholder="输入关键字搜索">
                    <button type="submit" class="search-button" aria-label="搜索">
                        <span class="icon-search"></span>
                    </button>
                </form>
            </section>
        </div>
    <?php endif; ?>

    <!-- 分类模块 -->
    <?php if ($this->options->showCategory == '1'): ?>
        <div class="category-section">
            <header class="section-header">
                <span class="icon-emo-wink"></span>
                <span class="title">分类</span>
            </header>
            <section class="section-body">
                <div class="category-cloud">
                    <?php $this->widget('Widget_Metas_Category_List')->to($categories); ?>
                    <?php if ($categories->have()): ?>
                        <?php while ($categories->next()): ?>
                            <a href="<?php $categories->permalink(); ?>" class="category"><?php $categories->name(); ?></a>
                        <?php endwhile; ?>
                    <?php else: ?>
                        <p><?php _e('没有任何分类'); ?></p>
                    <?php endif; ?>
                </div>
            </section>
        </div>
    <?php endif; ?>

    <!-- 标签模块 -->
    <?php if ($this->options->showTag == '1'): ?>
        <div class="tag-section">
            <header class="section-header">
                <span class="icon-hashtag"></span>
                <span class="title">标签</span>
            </header>
            <section class="section-body">
                <div class="tag-cloud">
                    <?php $this->widget('Widget_Metas_Tag_Cloud')->to($tags); ?>
                    <?php if ($tags->have()): ?>
                        <?php while ($tags->next()): ?>
                            <a href="<?php $tags->permalink(); ?>" class="tag"><?php $tags->name(); ?></a>
                        <?php endwhile; ?>
                    <?php else: ?>
                        <p><?php _e('没有任何标签'); ?></p>
                    <?php endif; ?>
                </div>
            </section>
        </div>
    <?php endif; ?>

    <!-- TOC -->
    <?php if ($this->options->showTOC == '1' && ($this->is('post') || $this->is('page'))): ?>
        <div class="toc-section" id="toc-section" style="display: none;">
            <header class="section-header">
                <span class="icon-article"></span>
                <span class="title">文章目录</span>
            </header>
            <section class="section-body">
                <div class="toc"></div>
            </section>
        </div>
        <script>
            const sections = ['.right-sidebar'];
            sections.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.style.position = 'absolute';
                });
            });
            
            document.addEventListener('DOMContentLoaded', function() {
                var tocSection = document.getElementById('toc-section');
                var tocOffsetTop = tocSection.offsetTop;
                var buffer = 50; // 当TOC离顶部还有50px时开始吸顶

                // 获取TOC上面的所有内容的高度
                var tocAboveElements = document.querySelectorAll('.right-sidebar > *:not(#toc-section)');
                var tocAboveHeight = 0;
                tocAboveElements.forEach(function(element) {
                    tocAboveHeight += element.offsetHeight;
                });

                window.addEventListener('scroll', function() {
                    if (window.pageYOffset >= tocAboveHeight + buffer) {
                        tocSection.classList.add('sticky');
                    } else {
                        tocSection.classList.remove('sticky');
                    }
                });
            });
        </script>
    <?php endif; ?>

</div>