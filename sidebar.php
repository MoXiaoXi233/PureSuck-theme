<div class="right-sidebar">

<!-- TOC -->
<?php if ($this->options->showTOC == '1' && ($this->is('post') || $this->is('page'))): ?>
    <?php $toc = getJJDirectoryTree($this->content); ?>
    <?php if (!empty($toc)): ?>
        <div class="toc-section">
            <header class="section-header">
                <span class="icon">🌳</span>
                <span class="title">TOC</span>
            </header>
            <section class="section-body">
                <?php echo $toc; ?>
            </section>
        </div>
    <?php endif; ?>
<?php endif; ?>

<!-- 分类模块 -->
<?php if ($this->options->showCategory == '1'): ?>
    <div class="category-section">
        <header class="section-header">
            <span class="icon">#</span>
            <span class="title">CATEGORIES</span>
        </header>
        <section class="section-body">
            <div class="category-cloud">
                <?php $this->widget('Widget_Metas_Category_List')->to($categories); ?>
                <?php if($categories->have()): ?>
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
        <span class="icon">🏷️</span>
        <span class="title">TAGS</span>
    </header>
    <section class="section-body">
        <div class="tag-cloud">
            <?php $this->widget('Widget_Metas_Tag_Cloud')->to($tags); ?>
            <?php if($tags->have()): ?>
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

</div>
