<?php if (!defined('__TYPECHO_ROOT_DIR__'))
    exit; ?>
<?php $this->need('header.php'); ?>

<div class="wrapper">

    <?php
    $hasImg = $this->fields->img ? true : false;
    ?>
    <article class="post <?= $hasImg ? 'post--photo post--cover' : 'post--text'; ?> post--index post--single main-item" data-ps-post-key="<?= $this->cid; ?>">
        <div class="post-inner">
            <header class="post-item post-header  <?= $hasImg ? 'no-bg' : ''; ?>">
                <div class="wrapper post-wrapper">
                    <div class="avatar post-author">
                        <img src="<?= $this->options->authorAvatar ?: $this->options->themeUrl('images/avatar.webp'); ?>"
                            alt="作者头像"
                            class="avatar-item avatar-img"
                            loading="lazy"
                            decoding="async"
                            fetchpriority="low">
                        <span class="avatar-item"><?php $this->author(); ?></span>
                    </div>
                </div>
            </header>

            <!-- 大图样式 -->
            <?php if ($hasImg): ?>
                <figure class="post-media <?= $this->is('post') ? 'single' : ''; ?>">
                    <img itemprop="image"
                        src="<?php $this->fields->img(); ?>"
                        alt="头图"
                        loading="lazy"
                        decoding="async"
                        fetchpriority="high">
                </figure>
            <?php endif; ?>

            <section class="post-item post-body">
                <div class="wrapper post-wrapper">
                    <h1 class="post-title">
                        <a href="<?php $this->permalink() ?>" title="<?php $this->title() ?>">
                            <?php $this->title() ?>
                        </a>
                    </h1>
                    <div class="inner-post-wrapper">
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

                        <?php if (!$this->hidden && $this->options->showWordCount == '1'): ?>
                            <?php
                            $wordCount = getMarkdownCharacters($this->text);
                            $readingTime = ceil($wordCount / 300); //假设每分钟300字
                            ?>
                            <div class="meta post-meta">
                                <div class="icon-record-outline">
                                    全文共&nbsp;<?= $wordCount ?>&nbsp;字，
                                    阅读约&nbsp;<?= $readingTime ?>&nbsp;分钟
                                </div>
                            </div>
                        <?php endif; ?>

                        <!-- 解析正文以及短代码，顺便做了加密文章的处理 -->
                        <?php if ($this->hidden): ?>
                            <section class="protected-block v3">
                                <header class="protected-head">
                                    <span class="protected-dot"></span>
                                    <div class="protected-texts">
                                        <div class="protected-title">抱歉，这段内容被锁住了</div>
                                        <div class="protected-sub">输入密码后将继续显示正文</div>
                                    </div>
                                </header>
                                <div class="protected-divider"></div>
                                <form method="post"
                                    action="<?php echo Typecho_Widget::widget('Widget_Security')->getTokenUrl($this->permalink); ?>"
                                    class="protected-form">

                                    <div class="search-container protected-search">
                                        <input type="password" name="protectPassword" class="protected-input"
                                            placeholder="输入密码" required>

                                        <input type="hidden" name="protectCID" value="<?php $this->cid(); ?>">

                                        <button type="submit" class="protected-btn">解锁</button>
                                    </div>
                                </form>

                                <div class="protected-ghost" aria-hidden="true">
                                    <span></span><span></span><span></span><span></span>
                                </div>
                            </section>
                        <?php else: ?>
                            <div class="post-content">
                                <?= renderPostContent($this->content); ?>
                            </div>
                        <?php endif; ?>

                        <!-- 判断并显示版权信息 -->
                        <?php if (!$this->hidden && $this->options->showCopyright == '1'): ?>
                            <div class="license-info-card">
                                <div class="license-info-title"><?php $this->title(); ?></div>
                                <a class="license-info-link" href="#"><?php $this->permalink(); ?></a>
                                <div class="license-info-meta">
                                    <div>
                                        <span>本文作者</span>
                                        <span><?php $this->author(); ?></span>
                                    </div>
                                    <div>
                                        <span>发布时间</span>
                                        <span><?php $this->date('Y-m-d'); ?></span>
                                    </div>
                                    <div>
                                        <span>许可协议</span>
                                        <a href="<?php echo get_cc_link(); ?>">CC
                                            <?php echo strtoupper($this->options->ccLicense); ?> 4.0</a>
                                    </div>
                                </div>
                                <span class="cc-icon"></span>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </section>

            <section class="post-item post-comments">
                <div class="wrapper post-wrapper">
                    <?php if ($this->hidden): ?>
                        <h3><?php _e('评论区已隐藏'); ?></h3>
                    <?php else: ?>
                        <?php $this->need('comments.php'); ?>
                    <?php endif ?>
                </div>
            </section>
        </div>
    </article>

</div>

<nav class="nav main-pager" role="navigation" aria-label="Pagination" data-js="pager">
    <div class="nav main-lastinfo">
        <span class="nav-item-alt">
            <?php
            $options = Typecho_Widget::widget('Widget_Options');
            echo $options->footerInfo;
            ?>
        </span>
    </div>
</nav>
</main>

<?php $this->need('sidebar.php'); ?>
<?php $this->need('footer.php'); ?>
