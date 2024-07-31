<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>
    <?php $this->footer(); ?>

    <!-- 后台script标签 -->
    <?php if ($this->options->footerScript): ?>
        <?php echo $this->options->footerScript; ?>
    <?php endif; ?>
    <link href="<?php echo $this->options->themeUrl('css/gotop.css'); ?>" rel="stylesheet">

    <!-- 回到顶端 -->
<body>
    <div class="go-top dn" id="go-top" style="display: none;">
        <a href="javascript:void(0);" class="go fa fa-chevron-up"></a>
    </div>

    <script type="text/javascript">
        document.addEventListener('DOMContentLoaded', function() {
            var goTopBtn = document.getElementById('go-top');
            var goTopAnchor = document.querySelector('#go-top .go');

            window.addEventListener('scroll', function() {
                var st = document.documentElement.scrollTop || document.body.scrollTop;
                if (st > 0) {
                    if (document.getElementById('main-container')) {
                        var w = window.innerWidth;
                        var mw = document.getElementById('main-container').offsetWidth;
                        if ((w - mw) / 2 > 70) {
                            goTopBtn.style.left = (w - mw) / 2 + mw + 20 + 'px';
                        } else {
                            goTopBtn.style.left = 'auto';
                        }
                    }
                    goTopBtn.style.display = 'block';
                    goTopBtn.classList.remove('dn');
                } else {
                    goTopBtn.style.display = 'none';
                    goTopBtn.classList.add('dn');
                }
            });

            goTopAnchor.addEventListener('click', function() {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

        });
    </script>

    <!-- 代码高亮 -->
    <?php $this->header('wlw=&xmlrpc=&rss2=&atom=&rss1=&template=&pingback=&generator'); ?>
    <link href="<?php $this->options->themeUrl('/css/a11y-dark.min.css'); ?>" rel="stylesheet" type="text/css">
    <script src="<?php $this->options->themeUrl('/js/highlight.min.js'); ?>"></script>
    <script>
        document.addEventListener("DOMContentLoaded", function() {
            hljs.highlightAll();
        });
    </script>

    <!-- JS引入 -->
    <script src="<?php $this->options->themeUrl('/js/PureSuck_module.js'); ?>"></script>
    <script src="<?php $this->options->themeUrl('/js/OwO.min.js'); ?>"></script>
  

<!-- TOC目录JS-->
<?php if ($this->is('post') || $this->is('page')): ?>
<script>
document.addEventListener('DOMContentLoaded', function() {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const links = document.querySelectorAll('.directory-tree a');
    const directoryTree = document.querySelector('.directory-tree');
    const offset = window.innerHeight * 0.1; // 偏移量，视口高度的10%
    let lastActiveIndex = -1;

    function updateActiveLink() {
        let lastActiveLink = null;
        let minDistance = Infinity;
        let activeIndex = -1;

        headings.forEach((heading, index) => {
            const rect = heading.getBoundingClientRect();
            const distance = Math.abs(rect.top - offset);

            // 检查标题是否在合理的距离内
            if (rect.top <= offset && rect.bottom > offset) {
                minDistance = distance;
                lastActiveLink = links[index];
                activeIndex = index;
            } else if (rect.top > offset && rect.top < window.innerHeight) {
                if (distance < minDistance) {
                    minDistance = distance;
                    lastActiveLink = links[index];
                    activeIndex = index;
                }
            }
        });

        // 避免频繁切换
        if (activeIndex !== lastActiveIndex) {
            links.forEach(link => link.classList.remove('active'));

            if (lastActiveLink) {
                lastActiveLink.classList.add('active');
                lastActiveIndex = activeIndex;

                // 确保选中的链接在视口内
                const linkRect = lastActiveLink.getBoundingClientRect();
                const treeRect = directoryTree.getBoundingClientRect();
                const scrollTop = directoryTree.scrollTop;
                const linkTop = linkRect.top - treeRect.top + scrollTop;

                if (linkTop < scrollTop || linkTop > scrollTop + directoryTree.clientHeight) {
                    directoryTree.scrollTo({
                        top: linkTop - directoryTree.clientHeight / 2,
                        behavior: 'smooth'
                    });
                }
            } else {
                // 如果没有找到活动链接，默认设置为上一个标题的下一个
                if (lastActiveIndex >= 0 && lastActiveIndex < links.length - 1) {
                    links[lastActiveIndex + 1].classList.add('active');
                    lastActiveIndex++;
                } else {
                    // 如果没有找到活动链接，默认显示第一个或最后一个
                    if (window.scrollY === 0) {
                        links[0].classList.add('active'); // 页面顶部时显示第一个
                        lastActiveIndex = 0;
                    } else {
                        links[links.length - 1].classList.add('active'); // 页面底部时显示最后一个
                        lastActiveIndex = links.length - 1;
                    }
                }
            }
        }
    }

    window.addEventListener('scroll', () => {
        requestAnimationFrame(updateActiveLink);
    });
    updateActiveLink(); // 初始化时调用一次
});

</script>
<?php endif; ?>

</body>
</html>