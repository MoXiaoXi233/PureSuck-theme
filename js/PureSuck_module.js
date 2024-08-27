document.addEventListener('DOMContentLoaded', function () {
    
    function enhanceContent() {
        // 处理 img 标签
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (!img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }
            if (!img.hasAttribute('data-zoomable')) {
                img.setAttribute('data-zoomable', 'true');
            }
        });

        // 处理标题标签
        const headers = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        headers.forEach(header => {
            const elements = document.querySelectorAll(header);
            elements.forEach((element, index) => {
                const headerText = element.textContent;
                let text = headerText.trim().toLowerCase().replace(/\W+/g, '-');
                text = text.substring(0, 50); // 限制 ID 长度，避免过长
                const id = `heading-${header}-${index + 1}-${text}`;
                if (!element.hasAttribute('id')) {
                    element.setAttribute('id', id);
                }
            });
        });
    }

    function parseShortcodes() {
        // 获取包含短代码的特定容器
        let elements = document.querySelectorAll('.inner-post-wrapper');
        
        elements.forEach(element => {
            // 获取元素的内容
            let content = element.innerHTML;
    
            // 移除每个短代码后面的 <br> 标签
            content = content.replace(/\[\/(alert|window|friend-card|collapsible-panel|timeline|tabs)\](<br\s*\/?>)?/g, '[/$1]');
            content = content.replace(/\[\/timeline-event\](<br\s*\/?>)?/g, '[/timeline-event]');
            content = content.replace(/\[\/tab\](<br\s*\/?>)?/g, '[/tab]');
    
            // 使用正则表达式匹配 [alert] 短代码
            let alertRegex = /\[alert type="([^"]*)"\](.*?)\[\/alert\]/g;
            content = content.replace(alertRegex, (match, type, text) => {
                return `<div ALERT-TYPE="${type}">${text}</div>`;
            });
    
            // 使用正则表达式匹配 [window] 短代码
            let windowRegex = /\[window type="([^"]*)" title="([^"]*)"\](.*?)\[\/window\]/g;
            content = content.replace(windowRegex, (match, type, title, text) => {
                return `<div WINDOW-TYPE="${type}" TITLE="${title}">${text}</div>`;
            });
    
            // 使用正则表达式匹配 [friend-card] 短代码
            let friendCardRegex = /\[friend-card name="([^"]*)" ico="([^"]*)" url="([^"]*)"\](.*?)\[\/friend-card\]/g;
            content = content.replace(friendCardRegex, (match, name, ico, url, description) => {
                return `<div FRIEND-NAME="${name}" ICO="${ico}" URL="${url}">${description}</div>`;
            });
    
            // 使用正则表达式匹配 [collapsible-panel] 短代码
            let collapsiblePanelRegex = /\[collapsible-panel title="([^"]*)"\](.*?)\[\/collapsible-panel\]/g;
            content = content.replace(collapsiblePanelRegex, (match, title, text) => {
                return `<div collapsible-panel title="${title}">${text}</div>`;
            });
    
            // 使用正则表达式匹配 [timeline] 短代码
            let timelineRegex = /\[timeline\](.*?)\[\/timeline\]/gs;
            content = content.replace(timelineRegex, (match, innerContent) => {
                // 使用正则表达式匹配 [timeline-event] 短代码
                let timelineEventRegex = /\[timeline-event date="([^"]*)" title="([^"]*)"\](.*?)\[\/timeline-event\]/gs;
                let eventsContent = innerContent.replace(timelineEventRegex, (eventMatch, date, title, eventText) => {
                    return `<div timeline-event date="${date}" title="${title}">${eventText}</div>`;
                });
                return `<div id="timeline">${eventsContent}</div>`;
            });
    
            // 使用正则表达式匹配 [tabs] 短代码
            let tabsRegex = /\[tabs\](.*?)\[\/tabs\]/gs;
            content = content.replace(tabsRegex, (match, innerContent) => {
                // 使用正则表达式匹配 [tab] 短代码
                let tabRegex = /\[tab title="([^"]*)"\](.*?)\[\/tab\]/gs;
                let tabsContent = innerContent.replace(tabRegex, (tabMatch, title, tabContent) => {
                    return `<div tab-title="${title}">${tabContent}</div>`;
                });
                return `<div tabs>${tabsContent}</div>`;
            });
    
            // 更新元素的内容
            element.innerHTML = content;
        });
    } 
    function parseAlerts() {
        let elements = document.querySelectorAll('[alert-type]');

        elements.forEach(element => {
            let type = element.getAttribute('alert-type');
            let content = element.innerHTML;

            let iconClass;
            switch (type) {
                case 'green':
                    iconClass = 'icon-ok-circle';
                    break;
                case 'blue':
                    iconClass = 'icon-info-circled';
                    break;
                case 'yellow':
                    iconClass = 'icon-attention';
                    break;
                case 'red':
                    iconClass = 'icon-cancel-circle';
                    break;
                default:
                    iconClass = 'icon-info-circled';
            }

            let newContent = `
                <div role="alert" class="alert-box ${type}">
                    <i class="${iconClass}"></i>
                    <p class="text-xs font-semibold">${content}</p>
                </div>
            `;

            element.outerHTML = newContent;
        });
    }

    function parseWindows() {
        let elements = document.querySelectorAll('[window-type]');

        elements.forEach(element => {
            let type = element.getAttribute('window-type');
            let title = element.getAttribute('title');
            let content = element.innerHTML;

            let newContent = `
            <div class="notifications-container">
                <div class="window ${type}">
                    <div class="flex">
                        <div class="window-prompt-wrap">
                            <p class="window-prompt-heading">${title}</p>
                            <div class="window-prompt-prompt">
                                <p>${content}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            `;

            element.outerHTML = newContent;
        });
    }

    function parseFriendCards() {
        const container = document.body;

        function identifyGroups(node, groups = [], currentGroup = null) {
            while (node) {
                if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('FRIEND-NAME')) {
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
                    identifyGroups(node.firstChild, groups, currentGroup);
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
                        const friendName = node.getAttribute('FRIEND-NAME');
                        const avatarUrl = node.getAttribute('ICO');
                        const url = node.getAttribute('URL');

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

                    group[0].innerHTML = '';
                    group[0].appendChild(friendsBoardList);

                    for (let i = 1; i < group.length; i++) {
                        group[i].parentNode.removeChild(group[i]);
                    }
                }
            });
        }

        const groups = identifyGroups(container.firstChild);
        replaceGroups(groups);
    }

    function parseCollapsiblePanels() {
        let elements = document.querySelectorAll('[collapsible-panel]');

        elements.forEach(element => {
            let title = element.getAttribute('title');
            let content = element.innerHTML;

            let newContent = `
                <div class="collapsible-panel">
                    <button class="collapsible-header">
                        ${title}
                        <span class="icon icon-down-open"></span>
                    </button>
                    <div class="collapsible-content">
                        <div class="collapsible-details">${content}</div>
                    </div>
                </div>
            `;

            element.outerHTML = newContent;
        });

        document.querySelectorAll('.collapsible-header').forEach(button => {
            button.addEventListener('click', function () {
                this.classList.toggle('active');
                let content = this.nextElementSibling;
                let icon = this.querySelector('.icon');
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                    icon.classList.remove('icon-up-open');
                    icon.classList.add('icon-down-open');
                } else {
                    content.style.maxHeight = content.scrollHeight + "px";
                    icon.classList.remove('icon-down-open');
                    icon.classList.add('icon-up-open');
                }
            });
        });
    }

    function parseTimeline() {
        const timelineEvents = document.querySelectorAll('[TIMELINE-EVENT]');

        timelineEvents.forEach(event => {
            const date = event.getAttribute('DATE');
            const title = event.getAttribute('TITLE');
            const content = event.innerHTML;

            const timelineItem = document.createElement('div');
            timelineItem.classList.add('timeline-item');

            timelineItem.innerHTML = `
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-date">${date}</div>
                    <p class="timeline-title">${title}</p>
                    <p class="timeline-description">${content}</p>
                </div>
            `;

            event.replaceWith(timelineItem);
        });
    }

    function parseTabs() {
        const tabContainers = document.querySelectorAll('[tabs]');

        tabContainers.forEach((container, containerIndex) => {
            const tabElements = Array.from(container.children);
            const tabTitles = [];
            const tabContents = [];

            tabElements.forEach((child, index) => {
                const title = child.getAttribute('tab-title');
                if (title) {
                    tabTitles.push(title);
                    tabContents.push(child.cloneNode(true));
                }
            });

            if (tabTitles.length === 0) return;

            const tabHeader = tabTitles.map((title, index) => `
                <div class="tab-link ${index === 0 ? 'active' : ''}" data-tab="tab${containerIndex + 1}-${index + 1}" role="tab" aria-controls="tab${containerIndex + 1}-${index + 1}" tabindex="${index === 0 ? '0' : '-1'}">
                    ${title}
                </div>
            `).join('');

            const tabContent = tabContents.map((content, index) => {
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
                <div class="tab-header">
                    ${tabHeader}
                    <div class="tab-indicator"></div>
                </div>
                <div class="tab-content">
                    ${tabContent}
                </div>
            `;

            const fragment = document.createDocumentFragment();
            fragment.appendChild(tabContainer);

            container.innerHTML = '';
            container.appendChild(fragment);

            const activeLink = tabContainer.querySelector('.tab-link.active');
            const indicator = tabContainer.querySelector('.tab-indicator');
            if (activeLink && indicator) {
                indicator.style.width = `${activeLink.offsetWidth * 0.75}px`;
                indicator.style.left = `${activeLink.offsetLeft + (activeLink.offsetWidth * 0.125)}px`;
            }

            container.querySelector('.tab-header').addEventListener('click', function (event) {
                if (event.target.classList.contains('tab-link')) {
                    const tabLinks = this.querySelectorAll('.tab-link');
                    const tabPanes = this.nextElementSibling.querySelectorAll('.tab-pane');
                    const indicator = this.querySelector('.tab-indicator');

                    let currentIndex = Array.from(tabLinks).indexOf(event.target);
                    let previousIndex = Array.from(tabLinks).findIndex(link => link.classList.contains('active'));

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

                    indicator.style.width = `${event.target.offsetWidth * 0.75}px`;
                    indicator.style.left = `${event.target.offsetLeft + (event.target.offsetWidth * 0.125)}px`;

                    setTimeout(() => {
                        activePane.classList.add('aos-animate');
                    }, 0);

                    tabLinks.forEach(link => link.setAttribute('tabindex', '-1'));
                    event.target.setAttribute('tabindex', '0');
                    event.target.focus();
                }
            });

            container.querySelectorAll('.tab-link').forEach(link => {
                link.addEventListener('keydown', function (event) {
                    const tabLinks = Array.from(this.parentElement.querySelectorAll('.tab-link'));
                    const currentIndex = tabLinks.indexOf(this);
                    let newIndex = currentIndex;

                    if (event.key === 'ArrowRight') {
                        newIndex = (currentIndex + 1) % tabLinks.length;
                    } else if (event.key === 'ArrowLeft') {
                        newIndex = (currentIndex - 1 + tabLinks.length) % tabLinks.length;
                    }

                    tabLinks[newIndex].click();
                });
            });
        });
    }

    // 调用短代码解析函数
    parseShortcodes();
    // 调用内容增强函数
    enhanceContent();
    // 调用其他解析函数
    parseAlerts();
    parseWindows();
    parseFriendCards();
    parseCollapsiblePanels();
    parseTimeline();
    parseTabs();
    // 外部js调用
    mediumZoom('[data-zoomable]');
});
