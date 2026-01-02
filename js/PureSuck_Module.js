/** 这个JS包含了各种需要处理的的内容 **/
/** 回到顶部按钮，TOC目录，内部卡片部分内容解析都在这里 **/

function handleGoTopButton() {
    const goTopBtn = document.getElementById('go-top'); // 按钮容器
    const goTopAnchor = document.querySelector('#go-top .go');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            goTopBtn.classList.add('visible'); // 显示按钮
        } else {
            goTopBtn.classList.remove('visible'); // 隐藏按钮
        }
    });

    goTopAnchor.addEventListener('click', function (e) {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        setTimeout(() => {
            goTopBtn.classList.remove('visible'); // 隐藏
        }, 400); // 等待滚动完成
    });
}

function initializeTOC() {
    const tocSection = document.getElementById("toc-section");
    const toc = document.querySelector(".toc");
    const postWrapper = document.querySelector(".inner-post-wrapper");

    if (!toc || !postWrapper) return;

    const elements = Array.from(postWrapper.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    const tocLinks = toc.querySelectorAll(".toc-a");

    if (!elements.length || !tocLinks.length) return;

    if (toc.dataset.binded !== "1") {
        toc.addEventListener("click", event => {
            if (event.target.matches('.toc-a')) {
                event.preventDefault();
                const targetId = event.target.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const targetTop = targetElement.getBoundingClientRect().top + window.scrollY;
                    window.scrollTo({
                        top: targetTop,
                        behavior: "smooth"
                    });
                    setTimeout(() => {
                        window.location.hash = targetId;
                    }, 300);
                }
            }
        });
        toc.dataset.binded = "1";
    }

    if (tocSection) {
        tocSection.style.display = "block";
        const rightSidebar = document.querySelector(".right-sidebar");
        if (rightSidebar) {
            rightSidebar.style.position = "absolute";
            rightSidebar.style.top = "0";
        }
    }

    handleScroll(elements);
    window.dispatchEvent(new Event('scroll'));
}

function getElementTop(element) {
    let actualTop = element.offsetTop;
    let current = element.offsetParent;
    while (current !== null) {
        actualTop += current.offsetTop;
        current = current.offsetParent;
    }
    return actualTop;
}

function removeClass(elements) {
    elements.forEach(element => {
        const anchor = document.querySelector(`#link-${element.id}`);
        if (anchor) {
            anchor.classList.remove("li-active");
        }
    });
}

function handleScroll(elements) {
    let ticking = false;
    const tocItems = document.querySelectorAll(".toc li");
    const siderbar = document.querySelector(".siderbar");

    if (!tocItems.length || !siderbar) return;

    const elementTops = elements.map(element => getElementTop(element));

    window.addEventListener("scroll", () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const currentPosition = window.scrollY;
                let activeElement = null;

                elements.forEach((element, index) => {
                    const targetTop = elementTops[index];
                    const elementHeight = element.offsetHeight;
                    const offset = elementHeight / 2;

                    const nextElement = elements[index + 1];
                    const nextTargetTop = nextElement ? elementTops[index + 1] : Number.MAX_SAFE_INTEGER;

                    if (currentPosition + offset >= targetTop && currentPosition + offset < nextTargetTop) {
                        activeElement = element;
                    }
                });

                if (!activeElement && elements.length > 0) {
                    activeElement = elements[0];
                }

                if (activeElement) {
                    removeClass(elements);
                    const anchor = document.querySelector(`#link-${activeElement.id}`);
                    if (anchor) {
                        anchor.classList.add("li-active");

                        const index = elements.indexOf(activeElement);
                        const sidebarTop = tocItems[index].offsetTop;
                        siderbar.style.transform = `translateY(${sidebarTop + 4}px)`;
                    }
                }

                ticking = false;
            });
            ticking = true;
        }
    });
}

function bindCollapsiblePanels() {
    const panels = document.querySelectorAll('.collapsible-panel');

    panels.forEach(panel => {
        if (panel.dataset.binded === "1") return;
        panel.dataset.binded = "1";

        const button = panel.querySelector('.collapsible-header');
        const contentDiv = panel.querySelector('.collapsible-content');
        const icon = button ? button.querySelector('.icon') : null;

        if (!button || !contentDiv) return;

        button.addEventListener('click', function () {
            this.classList.toggle('active');

            if (contentDiv.style.maxHeight && contentDiv.style.maxHeight !== '0px') {
                contentDiv.style.maxHeight = '0px';
                if (icon) {
                    icon.classList.remove('icon-up-open');
                    icon.classList.add('icon-down-open');
                }
            } else {
                contentDiv.style.maxHeight = contentDiv.scrollHeight + "px";
                if (icon) {
                    icon.classList.remove('icon-down-open');
                    icon.classList.add('icon-up-open');
                }
            }
        });
    });
}

function bindTabs() {
    const tabContainers = document.querySelectorAll('.tab-container');

    tabContainers.forEach(container => {
        if (container.dataset.binded === "1") return;
        container.dataset.binded = "1";

        const tabHeader = container.querySelector('.tab-header');
        if (!tabHeader) return;

        const tabLinks = Array.from(tabHeader.querySelectorAll('.tab-link'));
        const tabPanes = Array.from(container.querySelectorAll('.tab-pane'));
        const indicator = tabHeader.querySelector('.tab-indicator');

        if (!tabLinks.length || !indicator) return;

        let cachedWidths = [];
        let cachedOffsets = [];

        const updateCache = () => {
            cachedWidths = tabLinks.map(l => l.offsetWidth);
            cachedOffsets = tabLinks.map(l => l.offsetLeft);
        };

        const updateIndicator = index => {
            requestAnimationFrame(() => {
                indicator.style.width = `${cachedWidths[index] * 0.75}px`;
                indicator.style.left = `${cachedOffsets[index] + cachedWidths[index] * 0.125}px`;
            });
        };

        const updateLayout = () => {
            updateCache();
            const activeIndex = tabLinks.findIndex(l => l.classList.contains('active'));
            updateIndicator(activeIndex >= 0 ? activeIndex : 0);
        };

        if (window.ResizeObserver) {
            new ResizeObserver(updateLayout).observe(tabHeader);
        }

        tabHeader.addEventListener('click', e => {
            const target = e.target.closest('.tab-link');
            if (!target) return;

            const newIndex = tabLinks.indexOf(target);
            const oldIndex = tabLinks.findIndex(l => l.classList.contains('active'));
            if (newIndex === oldIndex) return;

            tabHeader.classList.remove('dir-left', 'dir-right');
            tabHeader.classList.add(newIndex > oldIndex ? 'dir-right' : 'dir-left');

            tabLinks.forEach(l => {
                l.classList.remove('active');
                l.setAttribute('tabindex', '-1');
            });

            tabPanes.forEach(p => p.classList.remove('active'));

            target.classList.add('active');
            target.setAttribute('tabindex', '0');
            target.focus();

            if (tabPanes[newIndex]) {
                tabPanes[newIndex].classList.add('active');
            }
            updateIndicator(newIndex);
        });

        updateLayout();
    });
}

function initializeStickyTOC() {
    const tocSection = document.getElementById('toc-section');
    if (!tocSection) return;

    const buffer = 50;
    const tocAboveElements = document.querySelectorAll('.right-sidebar > *:not(#toc-section)');
    const initialTocAboveHeight = Array.from(tocAboveElements).reduce((total, element) => total + element.offsetHeight, 0);
    const threshold = initialTocAboveHeight + buffer;

    let isTicking = false;

    function onScroll() {
        if (!isTicking) {
            isTicking = true;
            window.requestAnimationFrame(() => {
                const currentScrollY = window.scrollY;
                const shouldStick = currentScrollY >= threshold;
                if (tocSection.classList.contains('sticky') !== shouldStick) {
                    tocSection.classList.toggle('sticky', shouldStick);
                }
                isTicking = false;
            });
        }
    }

    window.addEventListener('scroll', onScroll);
}


function Comments_Submit() {
    const form = document.getElementById("cf");
    if (!form) return;

    // 防止 PJAX 重复绑定
    if (form.dataset.binded === "1") return;
    form.dataset.binded = "1";

    const submitButton = form.querySelector("#submit");
    const textarea = form.querySelector("#textarea");

    if (!submitButton || !textarea) return;

    let isSubmitting = false;
    const originalText = submitButton.textContent;

    // 只监听 submit（关键）
    form.addEventListener("submit", function (e) {
        // 防止重复提交
        if (isSubmitting) {
            e.preventDefault();
            return;
        }

        // 内容为空，交给浏览器 / Typecho 提示
        if (textarea.value.trim() === "") {
            return;
        }

        isSubmitting = true;

        submitButton.disabled = true;
        submitButton.textContent = "提交中…";
    });

    // HTML5 校验失败时恢复
    form.addEventListener(
        "invalid",
        function () {
            reset();
        },
        true
    );

    // 页面未跳转（例如 Typecho 校验失败）
    window.addEventListener("pageshow", function () {
        reset();
    });

    function reset() {
        isSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

function runShortcodes() {
    history.scrollRestoration = 'auto'; // 不知道为什么总会回到顶端
    bindCollapsiblePanels();
    bindTabs();
    handleGoTopButton();
    initializeTOC();
    mediumZoom('[data-zoomable]', {
        background: 'var(--card-color)'
    });
    Comments_Submit()
}

document.addEventListener('DOMContentLoaded', function () {
    runShortcodes();
});
