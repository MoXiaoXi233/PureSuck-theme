<?php

/**
 * 干净，纯洁，淡雅朴素。
 * It's PureSuck For You.
 * 
 * @package PureSuck
 * @author MoXiify
 * @version 1.3.1
 * @link https://www.moxiify.cn
 */
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;
$this->need('header.php');
?>

<div class="wrapper">

    <?php while ($this->next()): ?>
        <?php
        $hasImg = $this->fields->img ? true : false;
        ?>
        <article class="post <?= $hasImg ? 'post--photo post--cover' : 'post--text'; ?> post--index main-item <?= $this->hidden ? 'post-protected' : ''; ?>" data-protected="<?= $this->hidden ? 'true' : 'false'; ?>" data-ps-post-key="<?= $this->cid; ?>">
            <div class="post-inner">
                <?php
                $showCardCategory = isset($this->options->showCardCategory)
                    && $this->options->showCardCategory === '1';

                // 仅在开启时才取分类
                if ($showCardCategory) {
                    $categories = $this->categories;
                    if (!empty($categories)) {
                        $cat = $categories[0];
                    }
                }
                ?>

                <?php if ($showCardCategory && !empty($cat)): ?>
                    <span class="post-cat-vertical">
                        <?= htmlspecialchars($cat['name']); ?>
                    </span>
                <?php endif; ?>


                <header class="post-item post-header  <?= $hasImg ? 'no-bg' : ''; ?>">
                    <div class="wrapper post-wrapper">
                        <div class="avatar post-author">
                            <img src="<?= $this->options->authorAvatar ?: $this->options->themeUrl('images/avatar.webp'); ?>"
                                alt="作者头像" class="avatar-item avatar-img"
                                loading="lazy" decoding="async" fetchpriority="low">
                            <span class="avatar-item"><?php $this->author(); ?></span>
                        </div>
                    </div>
                </header>

                <!-- 大图样式 -->
                <?php if ($hasImg): ?>
                    <figure class="post-media <?= $this->is('post') ? 'single' : ''; ?>">
                        <img itemprop="image"
                            src="<?php $this->fields->img(); ?>" alt="头图"
                            loading="lazy" decoding="async" fetchpriority="auto">
                    </figure>
                <?php endif; ?>

                <!-- 文章作者 -->
                <section class="post-item post-body">
                    <div class="wrapper post-wrapper">
                        <h1 class="post-title">
                            <a href="<?php $this->permalink() ?>">
                                <?php $this->title() ?>
                            </a>
                        </h1>

                        <!-- 摘要 -->
                        <?php if ($this->hidden): ?>
                            <p class="post-excerpt">该文章已加密，请输入密码后查看。</p>
                        <?php else: ?>
                            <p class="post-excerpt">
                                <?php if ($this->fields->desc): ?>
                                    <?= $this->fields->desc; ?>
                                <?php else: ?>
                                    <?php $this->excerpt(200, ''); ?>
                                <?php endif; ?>
                            </p>
                        <?php endif; ?>

                    </div>
                </section>

                <footer class="post-item post-footer">
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
                    </div>
                </footer>
            </div>
        </article>
    <?php endwhile; ?>
</div>

<nav class="nav main-pager" data-js="pager">
    <span class="nav-item-alt">
        第 <?= $this->_currentPage > 1 ? $this->_currentPage : 1; ?> 页 / 共
        <?= ceil($this->getTotal() / $this->parameter->pageSize); ?> 页
    </span>
    <div class="nav nav--pager">
        <?php $this->pageLink('上一页'); ?>
        <i class="icon-record-outline"></i>
        <?php $this->pageLink('下一页', 'next'); ?>
    </div>
</nav>

<div class="nav main-lastinfo">
    <span class="nav-item-alt">
        <?php
        $options = Typecho_Widget::widget('Widget_Options');
        echo $options->footerInfo;
        ?>
    </span>
</div>
</main>
<?php $this->need('sidebar.php'); ?>
<?php $this->need('footer.php'); ?>
