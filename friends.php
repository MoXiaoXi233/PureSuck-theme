<?php
/**
 * 友情链接
 *
 * @package custom
 */
if (!defined('__TYPECHO_ROOT_DIR__')) exit;
$this->need('header.php');
?>
<link rel="stylesheet" href="<?php $this->options->themeUrl('css/FriendCard.css'); ?>">

<div class="wrapper">
	<?php if (array_key_exists('img', unserialize($this->___fields()))): ?>
	<article class="post post--photo post--cover post--index main-item main-post">
		<?php else: ?>
		<article class="post post--text post--index main-item main-post">
			<?php endif; ?>
			<div class="post-inner">
				<header class="post-item post-header">
					<div class="wrapper post-wrapper">
						<div class="avatar post-author">
						<img src="<?php echo $this->options->authorAvatar ? $this->options->authorAvatar : $this->options->themeUrl('images/avatar.png'); ?>" alt="头像" class="avatar-item avatar-img">
						<span class="avatar-item">
								<?php $this->author(); ?>
							</span>
						</div>
					</div>
				</header>
				<?php if (array_key_exists('img', unserialize($this->___fields()))): ?>
				<figure class="post-media">
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
        echo '<div class="friendsboard-thumb" style="background-image:url(' . htmlspecialchars($link['pic'], ENT_QUOTES, 'UTF-8') . ')"></div>';
        echo '<div class="friendsboard-title">' . htmlspecialchars($link['title'], ENT_QUOTES, 'UTF-8') . '</div>';
        echo '</a>';
    }
    echo '</div>';
}

// 显示未匹配的原始内容
if (!empty($original_content)) {
    echo '<div class="original-content">';
    echo $original_content;
    echo '</div>';
}
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
