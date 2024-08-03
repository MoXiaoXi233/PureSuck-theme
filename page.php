<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>
<?php $this->need('header.php'); ?>

<div class="wrapper">

    <?php
    $fields = unserialize($this->___fields());
    $hasImg = isset($fields['img']);
    ?>
    <article class="post <?= $hasImg ? 'post--photo post--cover' : 'post--text'; ?> post--index main-item" data-aos="fade-up" data-aos-anchor-placement="top-bottom">
        <div class="post-inner">
            <header class="post-item post-header <?= $hasImg ? 'no-bg' : ''; ?>">
                <div class="wrapper post-wrapper">
                    <div class="avatar post-author">
                    <img src="<?php echo $this->options->authorAvatar ? $this->options->authorAvatar : $this->options->themeUrl('images/avatar.png'); ?>" alt="作者头像" class="avatar-item avatar-img">
                        <span class="avatar-item">
                            <?php $this->author(); ?>
                        </span>
                    </div>
                </div>
            </header>

            <!-- 大图样式 -->
            <?php if ($hasImg): ?>
                <figure class="post-media <?= $this->is('post') ? 'single' : ''; ?>">
                    <img itemprop="image" src="<?php $this->fields->img(); ?>" alt="头图" loading="lazy" alt="头图" width="2000" height="800">
                </figure>
            <?php endif; ?>

            <section class="post-item post-body">
                <div class="wrapper post-wrapper">
                    <h2 class="post-title">
                        <a href="<?php $this->permalink() ?>" title="<?php $this->title() ?>">
                            <?php $this->title() ?>
                        </a>
                    </h2>
                    <div class="wrapper post-wrapper">
                    <div class="meta post-meta">
                        <a itemprop="datePublished" href="<?php $this->permalink() ?>"
                            class="icon-ui icon-ui-date meta-item meta-date">
                            <span class="meta-count">
                                <?php $this->date(); ?>
                            </span>
                        </a>
                        <a href="<?php $this->permalink() ?>#comments"
                            class="icon-ui icon-ui-comment meta-item meta-comment">
                            <?php $this->commentsNum('暂无评论', '1 条评论', '%d 条评论'); ?>
                        </a>
                    </div>
                    <?php
                    // 获取内容
                    ob_start();
                    $this->content();
                    $content = ob_get_clean();

                    // 使用正则表达式查找所有 img 标签并添加新属性
                    $pattern = '/<img(.*?)>/i';
                    $replacement = '<img\$1 loading="lazy" data-zoomable>';
                    $modifiedContent = preg_replace_callback($pattern, function ($matches) {
                        // 获取 img 标签内容
                        $imgTag = $matches[0];

                        // 添加 loading="lazy" 属性
                        if (strpos($imgTag, 'loading=') === false) {
                        $imgTag = str_replace('<img', '<img loading="lazy" width="3000" height="2000"', $imgTag);
                        }

                        // 添加 data-zoomable 属性
                        if (strpos($imgTag, 'data-zoomable') === false) {
                            $imgTag = str_replace('<img', '<img data-zoomable', $imgTag);
                        }

                        return $imgTag;
                    }, $content);

                    // 输出修改后的内容
                    echo $modifiedContent;
                    ?>
                    
                </div>
            </section>

            <section class="post-item post-comments">
                <div class="wrapper post-wrapper">
                    <?php $this->need('comments.php'); ?>
                </div>
            </section>
        </div>
    </article>

</div>

<nav class="nav main-pager" role="navigation" aria-label="Pagination" data-js="pager">
    <div class="nav main-lastinfo">
        <span class="nav-item-alt">
            Theme PureSuck 
        </span>
    </div>
</nav>


<?php $this->need('sidebar.php'); ?>
<?php $this->need('footer.php'); ?>