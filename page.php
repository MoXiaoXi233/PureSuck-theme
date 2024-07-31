<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>
<?php $this->need('header.php'); ?>

<div class="wrapper">

    <?php 
    $fields = unserialize($this->___fields());
    $hasImg = isset($fields['img']);
    ?>
    <article class="post <?= $hasImg ? 'post--photo post--cover' : 'post--text'; ?> post--index main-item main-post">
        <div class="post-inner">
            <header class="post-item post-header <?= $hasImg ? 'no-bg' : ''; ?>">
                <div class="wrapper post-wrapper">
                    <div class="avatar post-author">
                        <img src="<?= $this->options->authorAvatar ? $this->options->authorAvatar : $this->options->themeUrl('images/avatar.png'); ?>" class="avatar-item avatar-img">
                        <span class="avatar-item">
                            <?php $this->author(); ?>
                        </span>
                    </div>
                </div>
            </header>

            <!-- 大图样式 -->
            <?php if ($hasImg): ?>
            <figure class="post-media <?= $this->is('page') ? 'single' : ''; ?>">
                <img itemprop="image" src="<?php $this->fields->img(); ?>">
            </figure>
            <?php endif; ?>

            <section class="post-item post-body">
                <div class="wrapper post-wrapper">
                    <h2 class="post-title">
                        <a href="<?php $this->permalink() ?>" title="<?php $this->title() ?>">
                            <?php $this->title() ?>
                        </a>
                    </h2>
                    <?php $this->content(); ?>
                </div>
            </section>

            <footer class="post-item post-footer">
                <div class="wrapper post-wrapper">
                    <div class="meta post-meta">
                        <a itemprop="datePublished" href="<?php $this->permalink() ?>" class="icon-ui icon-ui-date meta-item meta-date">
                            <span class="meta-count">
                                <?php $this->date(); ?>
                            </span>
                        </a>
                        <a href="<?php $this->permalink() ?>#comments" class="icon-ui icon-ui-comment meta-item meta-comment">
                            <?php $this->commentsNum('暂无评论', '1 条评论', '%d 条评论'); ?>
                        </a>
                    </div>
                </div>
            </footer>

            <section class="post-item post-comments">
                <div class="wrapper post-wrapper">
                    <?php $this->need('comments.php'); ?>
                </div>
            </section>
        </div>
    </article>

</div>

<nav class="nav main-pager" role="pagination" data-js="pager">
    <span class="nav-item-alt">
        
    </span>
    <div class="nav nav--pager">

    </div>
</nav>

<?php $this->need('sidebar.php'); ?>
<?php $this->need('footer.php'); ?>
