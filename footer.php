<?php if (!defined('__TYPECHO_ROOT_DIR__'))
  exit; ?>
<?php $this->footer(); ?>

</div><!-- 关闭 swup -->

<!-- 回到顶端 -->

<div class="go-top" id="go-top">
  <a href="#" class="go icon-up-open" aria-label="返回顶部"></a>
</div>

<!-- Highlight -->
<?php
// 获取代码块设置
$codeBlockSettings = Typecho_Widget::widget('Widget_Options')->codeBlockSettings;
?>
<script>
  // 代码高亮初始化函数
  function initCodeHighlight() {
    // 添加标记，避免重复高亮
    document.querySelectorAll('pre code:not([data-highlighted])').forEach((block) => {
      hljs.highlightElement(block);
      block.dataset.highlighted = 'true';

      // 显示行号
      <?php if (is_array($codeBlockSettings) && in_array('ShowLineNumbers', $codeBlockSettings)): ?>
        addLineNumber(block);
      <?php endif; ?>
    });

    // 显示复制按钮
    <?php if (is_array($codeBlockSettings) && in_array('ShowCopyButton', $codeBlockSettings)): ?>
      addCopyButtons();
    <?php endif; ?>
  }

  // 页面初次加载时执行
  document.addEventListener('DOMContentLoaded', () => {
    initCodeHighlight();
  });

  // Swup 完成后重新执行（替代旧的 pjax:success）
  // 注意：实际高亮逻辑已在 PureSuck_Swup.js 的 page:view 钩子中处理
  // 这里保留作为后备兼容

  // 添加行号函数
  function addLineNumber(codeDom) {
    codeDom.classList.add("code-block-extension-code-show-num");
    const lines = codeDom.innerHTML.split("\n").map((line, index) =>
      `<span class="code-block-extension-code-line" data-line-num="${index + 1}">${line}</span>`
    ).join("\n");
    codeDom.innerHTML = lines;
  }

  // 添加复制按钮函数
  function addCopyButtons() {
    // ✅ 检查是否已存在复制按钮，避免重复添加
    document.querySelectorAll('pre code').forEach((codeBlock) => {
      if (codeBlock.parentElement.querySelector('.copy-button')) return;

      const button = document.createElement('button');
      button.className = 'copy-button';
      button.innerText = 'Copy';
      codeBlock.parentElement.appendChild(button);
    });

    // ✅ 避免重复绑定事件
    document.removeEventListener('click', handleButtonClick);
    document.addEventListener('click', handleButtonClick);
  }

  async function handleButtonClick(event) {
    if (!event.target.matches('.copy-button')) return;

    event.preventDefault();
    const button = event.target;
    const codeBlock = button.previousElementSibling;
    const code = codeBlock.textContent;
    const scrollY = window.scrollY;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      button.innerText = 'Copied!';
    } catch (err) {
      console.error('复制文本失败:', err);
      // 使用 MoxToast 显示错误提示
      if (typeof MoxToast === 'function') {
        MoxToast({
          message: '复制文本失败，请重试',
          duration: 3000,
          position: 'bottom',
          backgroundColor: 'rgba(255, 59, 48, 0.9)',
          textColor: '#fff',
          borderColor: 'rgba(255, 59, 48, 0.3)'
        });
      } else {
        alert('复制文本失败，请重试。');
      }
    }

    window.scrollTo(0, scrollY);

    setTimeout(() => {
      button.innerText = 'Copy';
    }, 2000);
  }
</script>

<!-- 后台script标签 -->
<?php if ($this->options->footerScript): ?>
  <?= $this->options->footerScript; ?>
<?php endif; ?>
</body>


</html>
