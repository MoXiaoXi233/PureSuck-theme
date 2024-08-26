
document.addEventListener('DOMContentLoaded', function () {
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
        const container = document.body; // 或者使用更具体的容器选择器

        // 步骤1：识别和分组
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
    
        // 步骤2：替换
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
    
                    // 替换第一个节点的内容为新的 friendsBoardList，并保留原有的 DOM 结构
                    group[0].innerHTML = '';
                    group[0].appendChild(friendsBoardList);
    
                    // 移除其余节点
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
    
        // 添加事件监听器以实现折叠效果
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
    
            // 获取 tab 标题和内容
            tabElements.forEach((child, index) => {
                const title = child.getAttribute('tab-title');
                if (title) {
                    tabTitles.push(title);
                    tabContents.push(child);
                }
            });
    
            // 如果没有找到任何 tab 标题，就不需要创建 tabs
            if (tabTitles.length === 0) return;
    
            // 创建 tab 结构
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
    
            // 使用 DocumentFragment 替换原始的 tab 容器内容
            const fragment = document.createDocumentFragment();
            fragment.appendChild(tabContainer);
            container.innerHTML = '';
            container.appendChild(fragment);
    
            // 设置初始的 tab-indicator 位置和宽度
            const activeLink = tabContainer.querySelector('.tab-link.active');
            const indicator = tabContainer.querySelector('.tab-indicator');
            if (activeLink && indicator) {
                indicator.style.width = `${activeLink.offsetWidth * 0.75}px`;
                indicator.style.left = `${activeLink.offsetLeft + (activeLink.offsetWidth * 0.125)}px`;
            }
    
            // 使用事件委托处理 Tab 切换效果
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
                        pane.removeAttribute('data-aos'); // 移除AOS属性
                        pane.classList.remove('aos-animate'); // 移除AOS动画类
                    });
    
                    event.target.classList.add('active');
                    const activePane = document.getElementById(event.target.getAttribute('data-tab'));
                    activePane.classList.add('active');
    
                    // 根据Tab切换方向设置AOS动画效果
                    if (currentIndex > previousIndex) {
                        activePane.setAttribute('data-aos', 'fade-left'); // 从右到左
                    } else {
                        activePane.setAttribute('data-aos', 'fade-right'); // 从左到右
                    }
    
                    // 更新tab-indicator的位置和宽度
                    indicator.style.width = `${event.target.offsetWidth * 0.75}px`;
                    indicator.style.left = `${event.target.offsetLeft + (event.target.offsetWidth * 0.125)}px`;
    
                    // 手动触发AOS动画
                    setTimeout(() => {
                        activePane.classList.add('aos-animate');
                    }, 0);
    
                    // 更新 tab 的 tabindex 属性
                    tabLinks.forEach(link => link.setAttribute('tabindex', '-1'));
                    event.target.setAttribute('tabindex', '0');
                    event.target.focus();
                }
            });
    
            // 添加键盘导航支持
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
    

    // 调用所有函数
    parseAlerts();
    parseWindows();
    parseFriendCards();
    parseCollapsiblePanels();
    parseTimeline();
    parseTabs();
    
});
