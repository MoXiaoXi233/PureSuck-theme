<?php
/**
 * 友情链接
 *
 * @package custom
 */if (!defined('__TYPECHO_ROOT_DIR__')) exit;
$this->need('header.php');
?>
<link rel="stylesheet" href="<?php $this->options->themeUrl('css/FriendCard.css'); ?>">

<div class="wrapper">
    <?php 
    $fields = unserialize($this->___fields());
    $hasImg = isset($fields['img']); // 使用 isset 检查是否存在且不为 null
    ?>
    <article class="post <?= $hasImg ? 'post--photo post--cover' : 'post--text'; ?> post--index main-item main-post">
        <div class="post-inner">
            <header class="post-item post-header <?= $hasImg ? 'no-bg' : ''; ?>">
                <div class="wrapper post-wrapper">
                    <div class="avatar post-author">
                        <img src="<?php echo $this->options->authorAvatar ? $this->options->authorAvatar : $this->options->themeUrl('images/avatar.png'); ?>" loading="lazy" alt="头像" class="avatar-item avatar-img">
                        <span class="avatar-item">
                            <?php $this->author(); ?>
                        </span>
                    </div>
                </div>
            </header>
            <?php if ($hasImg): ?>
            <figure class="post-media">
                <img itemprop="image" src="<?php $this->fields->img(); ?>" alt="头图" loading="lazy" width="2000" height="800">
            </figure>
            <?php endif; ?>
            <section class="post-item post-body">
                <div class="wrapper post-wrapper">
                    <h2 class="post-title">
                        <a href="<?php $this->permalink() ?>" title="<?php $this->title() ?>">
                            <?php $this->title() ?>
                        </a>
                    </h2>

                    <?php
                    $content = $this->content;
                    $original_content = $content; // 保留原始内容

                    // 使用正则表达式匹配友情链接信息
                    $pattern = '/<p>Title:(.*?)<br>Link:<a href="(.*?)".*?<br>Pic:<a href="(.*?)".*?<\/p>/s';
                    preg_match_all($pattern, $content, $matches, PREG_SET_ORDER);

                    $links = [];
                    foreach ($matches as $match) {
                        $links[] = [
                            'title' => trim($match[1]),
                            'link' => trim($match[2]),
                            'pic' => trim($match[3])
                        ];
                    }

                    // 从原始内容中移除已匹配的部分
                    foreach ($matches as $match) {
                        $original_content = str_replace($match[0], '', $original_content);
                    }

                    // 显示友情链接
					if (!empty($links)) {
						echo '<div data-status="watched" class="friends-movie-list friendsboard-list">';
						foreach ($links as $link) {
							echo '<a href="' . htmlspecialchars($link['link'], ENT_QUOTES, 'UTF-8') . '" target="_blank" class="friendsboard-item">';
							echo '<div class="friendsboard-thumb" style="background-image:url(' . htmlspecialchars($link['pic'], ENT_QUOTES, 'UTF-8') . ')" loading="lazy" alt="友链头像" width="50" height="50"></div>';
							echo '<div class="friendsboard-title">' . htmlspecialchars($link['title'], ENT_QUOTES, 'UTF-8') . '</div>';
							echo '</a>';
						}
						echo '</div>';
					}

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
                    }, $original_content);

                    // 输出修改后的内容
                    echo $modifiedContent;
                    ?>

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
            <?php $this->need('footer.php'); ?>
        </div>
    </article>
</div>

<div class="nav main-lastinfo">
    <span class="nav-item-alt">
        Theme PureSuck
    </span>
</div>

<?php $this->need('sidebar.php'); ?>
<?php $this->need('footer.php'); ?>
