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

<!-- Highlight -->
<?php
// 获取代码块设置
$codeBlockSettings = Typecho_Widget::widget('Widget_Options')->codeBlockSettings;
?>
<script>
  document.addEventListener('DOMContentLoaded', (event) => {

    // 确保代码块高亮
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
      addCopyButtons();
    });
  });

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

  window.handleButtonClick = async function handleButtonClick(event) {
    event.stopPropagation();
    event.preventDefault();

    const button = event.currentTarget;
    const codeBlock = button.parentElement.querySelector('code');

    // 获取代码文本
    const code = codeBlock.textContent;

    // 保存当前滚动位置
    const scrollY = window.scrollY;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
        button.innerText = 'Copied!';
      } else {
        // 使用 document.execCommand() 作为后备
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed'; // 避免滚动到页面底部
        textArea.style.top = '0';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          button.innerText = 'Copied!';
        } catch (err) {
          console.error('复制文本失败:', err);
          alert('复制文本失败，请重试。');
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('复制文本失败:', err);
      alert('复制文本失败，请重试。');
    }

    // 恢复滚动位置
    window.scrollTo(0, scrollY);

    setTimeout(() => {
      button.innerText = 'Copy';
    }, 2000);
  }
</script>

<script>
  document.addEventListener('DOMContentLoaded', function() {
    var tocSection = document.getElementById('toc-section');
    var tocOffsetTop = tocSection.offsetTop;
    var buffer = 50; // 当TOC离顶部还有50px时开始吸顶

    // 获取TOC上面的所有内容的高度
    var tocAboveElements = document.querySelectorAll('.right-sidebar > *:not(#toc-section)');
    var tocAboveHeight = 0;
    tocAboveElements.forEach(function(element) {
      tocAboveHeight += element.offsetHeight;
    });

    window.addEventListener('scroll', function() {
      if (window.pageYOffset >= tocAboveHeight + buffer) {
        tocSection.classList.add('sticky');
      } else {
        tocSection.classList.remove('sticky');
      }
    });
  });
</script>

<!-- 后台script标签 -->
<?php if ($this->options->footerScript): ?>
  <?php echo $this->options->footerScript; ?>
<?php endif; ?>