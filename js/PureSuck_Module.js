/** 这个JS包含了各种需要处理的的内容 **/
/** 回到顶部按钮，TOC目录，内部卡片部分内容解析都在这里 **/

function handleGoTopButton() {
    const goTopBtn = document.getElementById('go-top');
    const goTopAnchor = document.querySelector('#go-top .go');

    let ticking = false;

    function updateButtonPosition() {
        const mainContainer = document.getElementById('main-container');
        if (!mainContainer) return; // 检查 mainContainer 是否存在

        const w = window.innerWidth;
        const mw = mainContainer.offsetWidth;
        if ((w - mw) / 2 > 70) {
            goTopBtn.style.left = 'unset';
            goTopBtn.style.right = `calc((100% - ${mw}px) / 2 - 80px)`;
        } else {
            goTopBtn.style.left = 'unset';
            goTopBtn.style.right = '10px';
        }
    }

    window.addEventListener('scroll', function () {
        if (!ticking) {
            window.requestAnimationFrame(function () {
                const st = document.documentElement.scrollTop || document.body.scrollTop;
                if (st > 0) {
                    updateButtonPosition();
                    goTopBtn.style.display = 'block';
                } else {
                    goTopBtn.style.display = 'none';
                }
                ticking = false;
            });
            ticking = true;
        }
    });

    window.addEventListener('resize', updateButtonPosition);

    goTopAnchor.addEventListener('click', function (e) {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

function generateTOC() {
    const tocSection = document.getElementById("toc-section");
    const toc = document.querySelector(".toc");
    const postWrapper = document.querySelector(".inner-post-wrapper");

    if (!toc || !postWrapper) return;

    const elements = postWrapper.querySelectorAll("h1, h2, h3, h4, h5, h6");
    if (!elements.length) return;

    const fragment = document.createDocumentFragment();
    const ul = document.createElement('ul');
    ul.id = 'toc';

    elements.forEach((v, index) => {
        if (!v.id) {
            v.id = `heading-${index}`;
        }
        const li = document.createElement('li');
        li.className = `li li-${v.tagName[1]}`;
        li.innerHTML = `<a href="#${v.id}" id="link-${v.id}" class="toc-a">${v.textContent}</a>`;
        ul.appendChild(li);
    });

    const dirDiv = document.createElement('div');
    dirDiv.className = 'dir';
    dirDiv.appendChild(ul);
    dirDiv.innerHTML += `<div class="sider"><span class="siderbar"></span></div>`;
    fragment.appendChild(dirDiv);
    toc.appendChild(fragment);

    toc.addEventListener("click", event => {
        if (event.target.matches('.toc-a')) {
            event.preventDefault();
            const targetId = event.target.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                const targetTop = getElementTop(targetElement);
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

    handleScroll(elements);

    if (tocSection) {
        tocSection.style.display = "block";
        const rightSidebar = document.querySelector(".right-sidebar");
        if (rightSidebar) {
            rightSidebar.style.position = "absolute";
            rightSidebar.style.top = "0";
        }
    }

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
    elements.forEach(v => {
        const anchor = document.querySelector(`#link-${v.id}`);
        if (anchor) {
            anchor.classList.remove("li-active");
        }
    });
}

function handleScroll(elements) {
    let ticking = false;
    window.addEventListener("scroll", () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const currentPosition = window.scrollY;
                let activeElement = null;

                elements.forEach((element, index) => {
                    const targetTop = getElementTop(element);
                    const nextElement = elements[index + 1];
                    const nextTargetTop = nextElement ? getElementTop(nextElement) : Number.MAX_SAFE_INTEGER;

                    if (currentPosition >= targetTop && currentPosition < nextTargetTop) {
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

                        const tocItems = document.querySelectorAll(".toc li");
                        const index = Array.from(elements).indexOf(activeElement);
                        let sidebarTop = tocItems[index].getBoundingClientRect().top + window.scrollY;
                        sidebarTop -= toc.getBoundingClientRect().top + window.scrollY;

                        const fontSize = parseFloat(getComputedStyle(tocItems[index]).fontSize);
                        const offset = fontSize / 2;
                        sidebarTop += offset - 3;

                        document.querySelector(".siderbar").style.transform = `translateY(${sidebarTop}px)`;
                    }
                }

                ticking = false;
            });
            ticking = true;
        }
    });
}

function parseFriendCards() {
    const container = document.body;
    const fragment = document.createDocumentFragment();

    function identifyGroups(node) {
        const groups = [];
        let currentGroup = null;

        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('friend-name')) {
                if (!currentGroup) {
                    currentGroup = [];
                    groups.push(currentGroup);
                }
                currentGroup.push(node);
            } else if (node.nodeType === Node.ELEMENT_NODE ||
                (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '')) {
                currentGroup = null;
            }

            if (node.firstChild) {
                groups.push(...identifyGroups(node.firstChild));
            }

            node = node.nextSibling;
        }
        return groups;
    }

    function replaceGroups(groups) {
        groups.forEach(group => {
            if (group.length > 0) {
                const friendsBoardList = document.createElement('div');
                friendsBoardList.classList.add('friendsboard-list');

                group.forEach(node => {
                    const friendName = node.getAttribute('friend-name');
                    const avatarUrl = node.getAttribute('ico');
                    const url = node.getAttribute('url');

                    const newContent = document.createElement('a');
                    newContent.href = url;
                    newContent.classList.add('friendsboard-item');
                    newContent.target = "_blank";
                    newContent.innerHTML = `
                        <div class="friends-card-header">
                            <span class="friends-card-username">${friendName}</span>
                            <span class="friends-card-dot"></span>
                        </div>
                        <div class="friends-card-body">
                            <div class="friends-card-text">
                                ${node.innerHTML}
                            </div>
                            <div class="friends-card-avatar-container">
                                <img src="${avatarUrl}" alt="Avatar" class="friends-card-avatar">
                            </div>
                        </div>
                    `;

                    friendsBoardList.appendChild(newContent);
                });

                const firstNode = group[0];
                firstNode.innerHTML = '';
                firstNode.appendChild(friendsBoardList);

                for (let i = 1; i < group.length; i++) {
                    group[i].remove();
                }
            }
        });
    }

    const groups = identifyGroups(container.firstChild);
    replaceGroups(groups);

    container.appendChild(fragment);
}


function parseCollapsiblePanels() {
    const elements = document.querySelectorAll('[collapsible-panel]');
    const fragment = document.createDocumentFragment();
    const headers = [];

    elements.forEach(element => {
        const title = element.getAttribute('title');
        const content = element.innerHTML;

        const newContent = `<div class="collapsible-panel">
            <button class="collapsible-header">
                ${title}
                <span class="icon icon-down-open"></span>
            </button>
            <div class="collapsible-content" style="max-height: 0; overflow: hidden; transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1);">
                <div class="collapsible-details">${content}</div>
            </div>
        </div>`;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newContent;
        const newPanel = tempDiv.firstChild;
        fragment.appendChild(newPanel);
        headers.push(newPanel.querySelector('.collapsible-header'));
    });

    if (elements[0] && elements[0].parentNode) {
        elements[0].parentNode.replaceChild(fragment, elements[0]);
    }

    headers.forEach(button => {
        const content = button.nextElementSibling;
        const icon = button.querySelector('.icon');

        button.addEventListener('click', function () {
            this.classList.toggle('active');

            if (content && content.style) {
                if (content.style.maxHeight && content.style.maxHeight !== '0px') {
                    content.style.maxHeight = '0px';
                    icon.classList.remove('icon-up-open');
                    icon.classList.add('icon-down-open');
                } else {
                    content.style.maxHeight = content.scrollHeight + "px";
                    icon.classList.remove('icon-down-open');
                    icon.classList.add('icon-up-open');
                }
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", parseTabs);

function parseTabs() {
    const tabContainers = document.querySelectorAll('[tabs]');

    tabContainers.forEach((container, containerIndex) => {
        const tabElements = Array.from(container.children);
        const tabTitles = [];
        const tabContents = [];

        tabElements.forEach((child) => {
            const title = child.getAttribute('tab-title');
            if (title) {
                tabTitles.push(title);
                tabContents.push(child.cloneNode(true));
            }
        });

        if (tabTitles.length === 0) return;

        const tabHeaderHTML = tabTitles.map((title, index) => `
            <div class="tab-link ${index === 0 ? 'active' : ''}" 
                 data-tab="tab${containerIndex + 1}-${index + 1}" 
                 role="tab" 
                 aria-controls="tab${containerIndex + 1}-${index + 1}" 
                 tabindex="${index === 0 ? '0' : '-1'}">
                ${title}
            </div>
        `).join('');

        const tabContentHTML = tabContents.map((content, index) => {
            const tabPane = document.createElement('div');
            tabPane.className = `tab-pane ${index === 0 ? 'active' : ''}`;
            tabPane.id = `tab${containerIndex + 1}-${index + 1}`;
            tabPane.setAttribute('role', 'tabpanel');
            tabPane.setAttribute('aria-labelledby', `tab${containerIndex + 1}-${index + 1}`);
            tabPane.appendChild(content);
            return tabPane.outerHTML;
        }).join('');

        const tabContainer = document.createElement('div');
        tabContainer.className = 'tab-container';
        tabContainer.innerHTML = `
            <div class="tab-header-wrapper">
                <button class="scroll-button left" aria-label="向左">←</button>
                <div class="tab-header" role="tablist">
                    ${tabHeaderHTML}
                    <div class="tab-indicator"></div>
                </div>
                <button class="scroll-button right" aria-label="向右">→</button>
            </div>
            <div class="tab-content">
                ${tabContentHTML}
            </div>
        `;

        container.innerHTML = '';
        container.appendChild(tabContainer);

        const tabHeaderElement = tabContainer.querySelector('.tab-header');
        const tabLinks = tabHeaderElement.querySelectorAll('.tab-link');
        const tabPanes = tabContainer.querySelectorAll('.tab-pane');
        const indicator = tabContainer.querySelector('.tab-indicator');
        const leftButton = tabContainer.querySelector('.scroll-button.left');
        const rightButton = tabContainer.querySelector('.scroll-button.right');

        const updateIndicator = (activeLink) => {
            indicator.style.width = `${activeLink.offsetWidth * 0.75}px`;
            indicator.style.left = `${activeLink.offsetLeft + (activeLink.offsetWidth * 0.125)}px`;
        };

        const checkScrollButtons = () => {
            const totalWidth = Array.from(tabHeaderElement.children)
                .reduce((acc, child) => acc + child.offsetWidth, 0);
            const containerWidth = tabHeaderElement.offsetWidth;

            leftButton.style.display = totalWidth <= containerWidth ? 'none' : 'block';
            rightButton.style.display = totalWidth <= containerWidth ? 'none' : 'block';
        };

        checkScrollButtons();
        window.addEventListener('resize', checkScrollButtons);

        leftButton.addEventListener('click', () => {
            tabHeaderElement.scrollBy({ left: -100, behavior: 'smooth' });
        });

        rightButton.addEventListener('click', () => {
            tabHeaderElement.scrollBy({ left: 100, behavior: 'smooth' });
        });

        let isDown = false;
        let startX;
        let scrollLeft;

        tabHeaderElement.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - tabHeaderElement.offsetLeft;
            scrollLeft = tabHeaderElement.scrollLeft;
        });

        tabHeaderElement.addEventListener('mouseleave', () => {
            isDown = false;
        });

        tabHeaderElement.addEventListener('mouseup', () => {
            isDown = false;
        });

        tabHeaderElement.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - tabHeaderElement.offsetLeft;
            const walk = (x - startX) * 2;
            tabHeaderElement.scrollLeft = scrollLeft - walk;
        });

        tabHeaderElement.addEventListener('touchstart', (e) => {
            isDown = true;
            startX = e.touches[0].pageX - tabHeaderElement.offsetLeft;
            scrollLeft = tabHeaderElement.scrollLeft;
        }, { passive: true });

        tabHeaderElement.addEventListener('touchend', () => {
            isDown = false;
        });

        tabHeaderElement.addEventListener('touchmove', (e) => {
            if (!isDown) return;
            const x = e.touches[0].pageX - tabHeaderElement.offsetLeft;
            const walk = (x - startX) * 2;
            tabHeaderElement.scrollLeft = scrollLeft - walk;
        }, { passive: true });

        tabHeaderElement.addEventListener('click', (event) => {
            if (event.target.classList.contains('tab-link')) {
                const currentIndex = Array.from(tabLinks).indexOf(event.target);
                const previousIndex = Array.from(tabLinks).findIndex(link => link.classList.contains('active'));

                tabLinks.forEach(link => link.classList.remove('active'));
                tabPanes.forEach(pane => {
                    pane.classList.remove('active');
                    pane.removeAttribute('data-aos');
                    pane.classList.remove('aos-animate');
                });

                event.target.classList.add('active');
                const activePane = document.getElementById(event.target.getAttribute('data-tab'));
                activePane.classList.add('active');

                if (currentIndex > previousIndex) {
                    activePane.setAttribute('data-aos', 'fade-left');
                } else {
                    activePane.setAttribute('data-aos', 'fade-right');
                }

                updateIndicator(event.target);

                setTimeout(() => {
                    activePane.classList.add('aos-animate');
                }, 0);

                if (typeof AOS !== 'undefined') {
                    AOS.refresh();
                }

                tabLinks.forEach(link => link.setAttribute('tabindex', '-1'));
                event.target.setAttribute('tabindex', '0');
                event.target.focus();

                const tabHeaderRect = tabHeaderElement.getBoundingClientRect();
                const targetRect = event.target.getBoundingClientRect();
                if (targetRect.left < tabHeaderRect.left) {
                    tabHeaderElement.scrollBy({ left: targetRect.left - tabHeaderRect.left, behavior: 'smooth' });
                } else if (targetRect.right > tabHeaderRect.right) {
                    tabHeaderElement.scrollBy({ left: targetRect.right - tabHeaderRect.right, behavior: 'smooth' });
                }
            }
        });

        updateIndicator(tabLinks[0]);
    });
}


function initializeStickyTOC() {
    var tocSection = document.getElementById('toc-section');
    if (!tocSection) return;

    var buffer = 50;
    var tocAboveElements = document.querySelectorAll('.right-sidebar > *:not(#toc-section)');
    var tocAboveHeight = Array.from(tocAboveElements).reduce((total, element) => total + element.offsetHeight, 0);

    let ticking = false;

    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(function () {
                if (window.scrollY >= tocAboveHeight + buffer) {
                    tocSection.classList.add('sticky');
                } else {
                    tocSection.classList.remove('sticky');
                }
                ticking = false;
            });
            ticking = true;
        }
    }

    window.addEventListener('scroll', onScroll);
}

function runShortcodes() {
    history.scrollRestoration = 'auto'; // 不知道为什么总会回到顶端
    parseFriendCards();
    parseCollapsiblePanels();
    parseTabs();
    handleGoTopButton();
    generateTOC();
    mediumZoom('[data-zoomable]', {
        background: 'var(--card-color)'
    });
}

document.addEventListener('DOMContentLoaded', function () {
    runShortcodes()
});