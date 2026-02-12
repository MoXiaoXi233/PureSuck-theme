<?php if (!defined('__TYPECHO_ROOT_DIR__'))
    exit; ?>
<?php
if (isset($this->response) && method_exists($this->response, 'setStatus')) {
    $this->response->setStatus(404);
}
if (function_exists('http_response_code')) {
    http_response_code(404);
}
header('X-Robots-Tag: noindex, nofollow', true);
?>
<?php $this->need('header.php'); ?>

<div class="wrapper ps-404-layout">
    <h3 class="archive-title">错误</h3>

    <article class="post post--text post--index main-item">
        <div class="post-inner">
            <section class="post-item post-body ps-404-body">
                <div class="wrapper post-wrapper ps-404-card">
                    <p class="ps-404-image-wrap">
                        <img src="<?php $this->options->themeUrl('images/Zai_Cry.png'); ?>" id="ZaiJPG"
                            class="ps-404-image" alt="页面未找到">
                    </p>
                    <p class="ps-404-code">404 Not Found</p>
                    <h1 class="ps-404-title">页面走丢了</h1>
                    <p class="ps-404-desc">你访问的页面不存在、已删除，或链接地址有误。</p>
                    <p class="ps-404-tip">可以回到首页继续探索。</p>
                </div>
            </section>
        </div>
    </article>
</div>

<?php $this->need('footer.php'); ?>