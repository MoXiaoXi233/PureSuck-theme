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
    <a href="#" class="go icon-up-open" aria-label="返回顶部"></a>
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

        goTopAnchor.addEventListener('click', function(event) {
            event.preventDefault(); // 阻止默认行为
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
  
<!-- TOC -->
<?php if ($this->is('post') || $this->is('page')): ?>
<script>
//这个部分写了好久好久啊owo
window.addEventListener("load", () => tocList());

const tocList = () => {
  const toc = document.querySelector(".toc");
  const postWrapper = document.querySelector(".inner-post-wrapper");
  if (!postWrapper) {
    console.error("Post wrapper not found.");
    return;
  }
  const elements = postWrapper.querySelectorAll("h1, h2, h3, h4, h5, h6");
  if (!elements.length) {
    console.log("No headers found in the post wrapper.");
    return;
  }

  let str = `<div class="dir">\n<ul id="toc">`;
  elements.forEach(v => {
    str += `<li class="li li-${v.tagName[1]}"><a href="#${v.id}" id="link-${v.id}" class="toc-a">${v.textContent}</a></li>\n`;
});
  str += `</ul>\n<div class="sider"><span class="siderbar"></span></div>\n</div>`;

  toc.insertAdjacentHTML("beforeend", str);

  elements.forEach(v => {
    const btn = document.querySelector(`#link-${v.id}`);
    btn.addEventListener("click", event => {
      event.preventDefault();
      const targetTop = getElementTop(v);
      window.scrollTo({ top: targetTop, behavior: "smooth" });
      history.pushState(null, null, `#${v.id}`);
    });
  });

  // 监听滚动事件
  window.addEventListener("scroll", () => {
    const currentPosition = window.scrollY;
    elements.forEach((element, index) => {
      const targetTop = getElementTop(element);
      const nextElement = elements[index + 1];
      const nextTargetTop = nextElement ? getElementTop(nextElement) : Number.MAX_SAFE_INTEGER;

      if (currentPosition >= targetTop && currentPosition < nextTargetTop) {
        removeClass(elements);
        const anchor = document.querySelector(`#link-${element.id}`);
        anchor.classList.add("li-active");
        
        let sidebarTop = index * 30 + 5;
        if (index === 0) {
          sidebarTop -= 0; //调试用
        } else if (index === elements.length - 1) {
          sidebarTop += 0; //调试用
        }
        
        document.querySelector(".siderbar").style.transform = `translateY(${sidebarTop}px)`;
      }
    });
  });
};

const getElementTop = (element) => {
  let actualTop = element.offsetTop;
  let current = element.offsetParent;

  while (current !== null) {
    actualTop += current.offsetTop;
    current = current.offsetParent;
  }

  return actualTop;
};

const removeClass = (elements) => {
  elements.forEach(v => {
    const anchor = document.querySelector(`#link-${v.id}`);
    anchor.classList.remove("li-active");
  });
};
</script>
<?php endif; ?> 

<!-- JS引入 -->
<script defer src="<?php $this->options->themeUrl('/js/PureSuck_Module.js'); ?>"></script>
<script defer src="<?php $this->options->themeUrl('/js/OwO.min.js'); ?>"></script>

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