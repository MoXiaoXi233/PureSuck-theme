<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>
<?php
/**
 * 归档页面
 *
 * @package custom
 */
$this->need('header.php');
?>

<div class="wrapper">

    <?php
    $hasImg = $this->fields->img ? true : false;
    ?>
    <article class="post <?= $hasImg ? 'post--photo post--cover' : 'post--text'; ?> post--index main-item" data-aos="fade-up" data-aos-anchor-placement="top-bottom">
        <div class="post-inner">
            <header class="post-item post-header  <?= $hasImg ? 'no-bg' : ''; ?>">
                <div class="wrapper post-wrapper">
                    <div class="avatar post-author">
                        <img src="<?= $this->options->authorAvatar ?: $this->options->themeUrl('images/avatar.png'); ?>" alt="作者头像" class="avatar-item avatar-img">
                        <span class="avatar-item">
                            <?php $this->author(); ?>
                        </span>
                    </div>
                </div>
            </header>

            <!-- 大图样式 -->
            <?php if ($hasImg): ?>
                <figure class="post-media <?= $this->is('post') ? 'single' : ''; ?>">
                    <img data-aos="zoom-out" itemprop="image" src="<?php $this->fields->img(); ?>" alt="头图" width="2000" height="800">
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
                            这里会归档一切文章<br>
                            共创作了 <?php echo  getTotalPostsCount(); ?> 篇文章，合 <?php echo allOfCharacters(); ?> 字
                        </div>

                        <?php
                        // 获取所有文章
                        $this->widget('Widget_Contents_Post_Recent', 'pageSize=100')->to($posts);
                        $archives = [];

                        // 按年份和月份分组文章
                        while ($posts->next()) {
                            $date = $posts->date; // 获取文章日期
                            $year = $date->format('Y'); // 获取年份
                            $monthDay = $date->format('m-d'); // 获取月份和日期
                            $archives[$year][$monthDay][] = clone $posts; // 将文章添加到对应的年份和月份
                        }

                        // 输出归档
                        foreach ($archives as $year => $items) {
                            echo '<h2 class="timeline-year">' . $year . '</h2>'; // 输出年份
                            echo '<div id="timeline">'; // 开始时间线
                            foreach ($items as $monthDay => $posts) {
                                foreach ($posts as $item) {
                                    echo '<div class="timeline-item">';
                                    echo '<div class="timeline-dot"></div>';
                                    echo '<div class="timeline-content">';
                                    echo '<div class="timeline-date">' . $monthDay . '</div>'; // 只显示月和日
                                    echo '<div class="timeline-title"><a href="' . $item->permalink . '">' . $item->title . '</a></div>';
                                    echo '</div>'; // timeline-content
                                    echo '</div>'; // timeline-item
                                }
                            }
                            echo '</div>'; // 结束时间线
                        }
                        ?>
                    </div>
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
            if (!empty($options->footerInfo)) {
                echo $options->footerInfo;
            }
            ?>
        </span>
    </div>
</nav>
</main>

<?php $this->need('sidebar.php'); ?>
<?php $this->need('footer.php'); ?>