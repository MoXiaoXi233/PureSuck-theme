<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>
    <?php $this->footer(); ?>

<link href="<?php echo $this->options->themeUrl('css/PureSuck_Module.css'); ?>" rel="stylesheet">

<!-- AOS -->
<script>
  AOS.init();
</script>

    <!-- 回到顶端 -->
<body>
    <div class="go-top dn" id="go-top" style="display: none;">
        <a href="javascript:void(0);" class="go icon-up-open"></a>
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
    <script defer src="<?php $this->options->themeUrl('/js/highlight.min.js'); ?>"></script>
    <script>
        document.addEventListener("DOMContentLoaded", function() {
            hljs.highlightAll();
        });
    </script>

<!-- JS引入 -->
<script defer src="<?php $this->options->themeUrl('/js/PureSuck_module.js'); ?>"></script>
<script defer src="<?php $this->options->themeUrl('/js/OwO.min.js'); ?>"></script>
  

<!-- TOC目录JS-->
<?php if ($this->is('post') || $this->is('page')): ?>
    <script>
document.addEventListener('DOMContentLoaded', () => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const links = document.querySelectorAll('.directory-tree a');
    const directoryTree = document.querySelector('.directory-tree');
    let activeIndex = -1;
    let isScrolling = false;

    // 平滑滚动到目标元素，并在滚动结束后调用回调函数
    const smoothScrollTo = (element, callback) => {
        isScrolling = true;
        const scrollOptions = {
            behavior: 'smooth',
            block: 'start'
        };
        element.scrollIntoView(scrollOptions);

        // 监听滚动结束事件
        const onScrollEnd = () => {
            if (isScrolling) {
                isScrolling = false;
                window.removeEventListener('scroll', onScrollEnd);
                if (callback) callback();
            }
        };

        // 延迟检测滚动结束
        setTimeout(onScrollEnd, 800);//测试低于800有可能出现检测错误qwq
    };

    // 更新活动链接
    const updateActiveLink = (newIndex) => {
        if (newIndex !== activeIndex) {
            links.forEach(link => link.classList.remove('active'));
            if (newIndex >= 0 && newIndex < links.length) {
                links[newIndex].classList.add('active');
                activeIndex = newIndex;

                // 确保选中的链接在视口内
                const linkRect = links[newIndex].getBoundingClientRect();
                const treeRect = directoryTree.getBoundingClientRect();
                const scrollTop = directoryTree.scrollTop;
                const linkTop = linkRect.top - treeRect.top + scrollTop;

                if (linkTop < scrollTop || linkTop > scrollTop + directoryTree.clientHeight) {
                    directoryTree.scrollTo({
                        top: linkTop - directoryTree.clientHeight / 2,
                        behavior: 'smooth'
                    });
                }
            }
        }
    };

    // 监听链接点击事件
    links.forEach((link, index) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                smoothScrollTo(targetElement, () => {
                    updateActiveLink(index);
                });
            }
        });
    });

    // 使用Intersection Observer API检测标题
    const observer = new IntersectionObserver((entries) => {
        if (isScrolling) return; // 如果正在滚动，则不更新活动链接
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const index = Array.from(headings).indexOf(entry.target);
                updateActiveLink(index);
            }
        });
    }, {
        root: null,
        rootMargin: '0px 0px -80% 0px', // 提前触发，避免滚动到最底部时才触发
        threshold: 0.1 // 目标元素进入视口10%时触发
    });

    // 观察所有标题
    headings.forEach(heading => observer.observe(heading));

    // 初始化时调用一次
    updateActiveLink();
});
</script>


<?php endif; ?>


</body>
</html>


<!-- Medium Zoom -->
<script defer src="<?php $this->options->themeUrl('/js/medium-zoom.min.js'); ?>"></script>
<script>
document.addEventListener('DOMContentLoaded', function () {
    mediumZoom('[data-zoomable]');
});
</script>

    <!-- 后台script标签 -->
    <?php if ($this->options->footerScript): ?>
        <?php echo $this->options->footerScript; ?>
    <?php endif; ?>

</body>
</html>