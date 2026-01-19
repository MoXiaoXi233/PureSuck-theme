<?php if (!defined('__TYPECHO_ROOT_DIR__'))
  exit; ?>
<?php $this->footer(); ?>

</div><!-- 关闭 swup -->

<!-- 回到顶端 -->

<div class="go-top" id="go-top">
  <a href="#" class="go icon-up-open" aria-label="返回顶部"></a>
</div>

<!-- 后台script标签 -->
<?php if ($this->options->footerScript): ?>
  <?= $this->options->footerScript; ?>
<?php endif; ?>
</body>


</html>
