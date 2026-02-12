<?php if (!defined('__TYPECHO_ROOT_DIR__'))
  exit; ?>
<?php if ($this->is('index') || $this->is('archive')): ?>
  <nav class="nav main-pager" role="navigation"
    aria-label="<?= $this->is('index') ? '文章列表分页导航' : '归档列表分页导航'; ?>" data-js="pager">
    <span class="nav-item-alt">
      第 <?= $this->_currentPage > 1 ? $this->_currentPage : 1; ?> 页 / 共
      <?= ceil($this->getTotal() / $this->parameter->pageSize); ?> 页
    </span>
    <div class="nav nav--pager">
      <?php $this->pageLink('上一页', 'prev'); ?>
      <i class="icon-record-outline"></i>
      <?php $this->pageLink('下一页', 'next'); ?>
    </div>
  </nav>
  <footer class="nav main-lastinfo" role="contentinfo" aria-label="站点页脚信息">
    <span class="nav-item-alt">
      <?= $this->options->footerInfo; ?>
    </span>
  </footer>
<?php else: ?>
  <div class="nav main-pager" data-js="pager">
    <footer class="nav main-lastinfo" role="contentinfo" aria-label="站点页脚信息">
      <span class="nav-item-alt">
        <?= $this->options->footerInfo; ?>
      </span>
    </footer>
  </div>
<?php endif; ?>

</main>
<?php $this->footer(); ?>

                </div><!-- 关闭 swup -->
            </section><!-- 关闭 content-main -->
            <?php $this->need('sidebar.php'); ?>
        </section><!-- 关闭 content-layout -->
    </div><!-- 关闭 site wrapper -->

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
