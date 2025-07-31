<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>
<?php $this->footer(); ?>

<!-- 回到顶端 -->

<div class="go-top" id="go-top">
  <a href="#" class="go icon-up-open" aria-label="返回顶部"></a>
</div>

<!-- AOS -->
<script>
  document.addEventListener('DOMContentLoaded', function() {
    AOS.init({
      duration: 600,
      delay: 0,
    });
  });
</script>

<!-- Highlight -->
<?php
// 获取代码块设置
$codeBlockSettings = Typecho_Widget::widget('Widget_Options')->codeBlockSettings;
?>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    // 确保代码块高亮
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);

      // 显示行号
      <?php if (is_array($codeBlockSettings) && in_array('ShowLineNumbers', $codeBlockSettings)): ?>
        addLineNumber(block);
      <?php endif; ?>
    });

    // 显示复制按钮
    <?php if (is_array($codeBlockSettings) && in_array('ShowCopyButton', $codeBlockSettings)): ?>
      addCopyButtons();
    <?php endif; ?>
  });

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
    document.querySelectorAll('pre code').forEach((codeBlock) => {
      const button = document.createElement('button');
      button.className = 'copy-button';
      button.innerText = 'Copy';
      codeBlock.parentElement.appendChild(button);
    });

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
      alert('复制文本失败，请重试。');
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