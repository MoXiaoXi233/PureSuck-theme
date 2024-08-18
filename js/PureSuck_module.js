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
    
                    // 替换第一个节点为新的 friendsBoardList，并移除其余节点
                    group[0].parentNode.replaceChild(friendsBoardList, group[0]);
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
        let elements = document.querySelectorAll('[COLLAPSIBLE-PANEL]');
    
        elements.forEach(element => {
            let title = element.getAttribute('TITLE');
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

    function createTabs() {
        const tabsContainer = document.querySelector('[tabs]');
        tabsContainer.removeAttribute('tabs'); // 移除 TABS 属性
        tabsContainer.classList.add('tabs');
    
        const tabHeader = document.createElement('div');
        tabHeader.classList.add('tab-header');
    
        const tabContent = document.createElement('div');
        tabContent.classList.add('tab-content');
    
        const tabElements = tabsContainer.querySelectorAll('[tab-title]');
    
        tabElements.forEach((tab, index) => {
            const tabTitle = tab.getAttribute('tab-title');
            const tabContentText = tab.innerHTML;
    
            const tabLink = document.createElement('div');
            tabLink.classList.add('tab-link');
            if (index === 0) tabLink.classList.add('active');
            tabLink.setAttribute('data-tab', `tab${index + 1}`);
            tabLink.textContent = tabTitle;
    
            const tabPane = document.createElement('div');
            tabPane.classList.add('tab-pane');
            if (index === 0) tabPane.classList.add('active');
            tabPane.id = `tab${index + 1}`;
            tabPane.innerHTML = tabContentText;
    
            tabHeader.appendChild(tabLink);
            tabContent.appendChild(tabPane);
    
            // 移除原始的 TAB-TITLE 属性
            tab.removeAttribute('tab-title');
            // 移除原始的 div 元素
            tab.remove();
        });
    
        tabsContainer.appendChild(tabHeader);
        tabsContainer.appendChild(tabContent);
    
        // 添加点击事件监听器
        const tabLinks = document.querySelectorAll('.tab-link');
        const tabPanes = document.querySelectorAll('.tab-pane');
    
        tabLinks.forEach(link => {
            link.addEventListener('click', function() {
                const target = this.getAttribute('data-tab');
    
                tabLinks.forEach(link => link.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));
    
                this.classList.add('active');
                document.getElementById(target).classList.add('active');
            });
        });
    }

    // 调用所有函数
    parseAlerts();
    parseWindows();
    parseFriendCards();
    parseCollapsiblePanels();
    parseTimeline();
    createTabs();
});
