<?php
/**
 * 友情链接
 *
 * @package custom
 */if (!defined('__TYPECHO_ROOT_DIR__')) exit;
$this->need('header.php');
?>

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

            <section class="post-item post-body" id="post-content">
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
                    <?php
// 获取内容
ob_start();
$this->content();
$content = ob_get_clean();

// 使用正则表达式查找所有 img 标签并添加新属性
$pattern_img = '/<img(.*?)>/i';
$modifiedContent = preg_replace_callback($pattern_img, function ($matches) {
    // 获取 img 标签内容
    $imgTag = $matches[0];

    // 添加 loading="lazy" 属性
    if (strpos($imgTag, 'loading=') === false) {
        $imgTag = str_replace('<img', '<img loading="lazy"', $imgTag);
    }

    // 添加 data-zoomable 属性
    if (strpos($imgTag, 'data-zoomable') === false) {
        $imgTag = str_replace('<img', '<img data-zoomable', $imgTag);
    }

    return $imgTag;
}, $content);

// 使用正则表达式查找所有标题标签并添加唯一 ID
$headers = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
foreach ($headers as $header) {
    $pattern_header = "/<($header)(.*?)>(.*?)<\/$header>/i";
    $modifiedContent = preg_replace_callback($pattern_header, function ($matches) use ($header) {
        static $index = 0;
        $index++;
        
        // 获取标题内容
        $headerTag = $matches[0];
        $headerText = strip_tags($matches[3]);

        // 生成唯一 ID
        $text = preg_replace('/\W+/', '-', strtolower(trim($headerText)));
        $text = substr($text, 0, 50); // 限制 ID 长度，避免过长
        $id = 'heading-' . $header . '-' . $index . '-' . $text;

        // 添加 ID 属性
        if (strpos($headerTag, 'id=') === false) {
            $headerTag = str_replace("<$header", "<$header id=\"$id\"", $headerTag);
        }

        return $headerTag;
    }, $modifiedContent);
}

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
        <?php
$options = Typecho_Widget::widget('Widget_Options');
if (!empty($options->footerInfo)) {
    echo $options->footerInfo;
}
?>        </span>
    </div>
</nav>


<?php $this->need('sidebar.php'); ?>
<?php $this->need('footer.php'); ?>