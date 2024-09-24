<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>
<?php $this->footer(); ?>


<!-- 回到顶端 -->

<body>
  <div class="go-top dn" id="go-top" style="display: none;">
    <a href="#" class="go icon-up-open" aria-label="返回顶部"></a>
  </div>
</body>

<!-- AOS -->
<script>
  document.addEventListener('DOMContentLoaded', function() {
    AOS.init();
  });
</script>

<!-- 代码高亮 -->
<?php
// 获取代码块设置
$codeBlockSettings = Typecho_Widget::widget('Widget_Options')->codeBlockSettings;
?>
<script>
  document.addEventListener('DOMContentLoaded', (event) => {

    // 确保代码块高亮
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);

      <?php if (is_array($codeBlockSettings) && in_array('ShowLineNumbers', $codeBlockSettings)): ?>
        addLineNumber(block);
      <?php endif; ?>
    });

    <?php if (is_array($codeBlockSettings) && in_array('ShowCopyButton', $codeBlockSettings)): ?>
      addCopyButtons();
    <?php endif; ?>
  });

  // 添加行号函数
  function addLineNumber(codeDom) {
    codeDom.classList.add("code-block-extension-code-show-num");
    const codeHtml = codeDom.innerHTML;
    const lines = codeHtml.split("\n").map((line, index) => {
      return `<span class="code-block-extension-code-line" data-line-num="${index + 1}">${line}</span>`;
    }).join("\n");
    codeDom.innerHTML = lines;
  }

  // 添加复制按钮函数
  function addCopyButtons() {
    const codeBlocks = document.querySelectorAll('pre code');

    codeBlocks.forEach((codeBlock, index) => {
      const pre = codeBlock.parentElement;

      // 创建按钮元素
      const button = document.createElement('button');
      button.className = 'copy-button';
      button.innerText = 'Copy';

      // 将按钮添加到 <pre> 元素中
      pre.appendChild(button);

      // 按钮点击事件
      button.setAttribute('onclick', 'handleButtonClick(event)');
    });
  }

  window.handleButtonClick = function handleButtonClick(event) {
    event.stopPropagation();
    event.preventDefault();

    const button = event.currentTarget;
    const codeBlock = button.parentElement.querySelector('code');

    // 获取代码文本
    let code;
    if (codeBlock.querySelectorAll('.code-block-extension-code-line').length > 0) {
      const codeLines = codeBlock.querySelectorAll('.code-block-extension-code-line');
      code = Array.from(codeLines)
        .map(line => line.textContent)
        .join('\n');
    } else {
      code = codeBlock.textContent;
    }

    navigator.clipboard.writeText(code).then(() => {
      button.innerText = 'Copied!';
      setTimeout(() => {
        button.innerText = 'Copy';
      }, 2000);
    }).catch(err => {
      console.error('复制文本失败:', err);
      alert('复制文本失败，请重试。');
    });
  }
</script>

<!-- 后台script标签 -->
<?php if ($this->options->footerScript): ?>
  <?php echo $this->options->footerScript; ?>
<?php endif; ?>