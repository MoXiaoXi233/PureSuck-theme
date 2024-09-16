<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>
<?php $this->footer(); ?>

<script>
        // Function to set the theme based on user preference or system preference
        function setTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        }

        // Function to toggle between light and dark theme
        function toggleTheme() {
            const currentTheme = localStorage.getItem('theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            setTheme(newTheme);
        }

        // Check system preference and set initial theme
        function applyInitialTheme() {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            const savedTheme = localStorage.getItem('theme');
            const initialTheme = savedTheme || systemTheme;
            setTheme(initialTheme);
        }

        // Apply the initial theme when the page loads
        window.addEventListener('DOMContentLoaded', applyInitialTheme);
</script>


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
<script>
  document.addEventListener("DOMContentLoaded", function() {
    // 初始化 highlight.js
    hljs.highlightAll();
  });
</script>

<!-- 后台script标签 -->
<?php if ($this->options->footerScript): ?>
  <?php echo $this->options->footerScript; ?>
<?php endif; ?>