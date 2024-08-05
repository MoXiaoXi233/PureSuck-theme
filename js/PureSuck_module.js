document.addEventListener('DOMContentLoaded', function () {
    function parseAlerts() {
        let elements = document.querySelectorAll('[ALERT-TYPE]');

        elements.forEach(element => {
            let type = element.getAttribute('ALERT-TYPE');
            let content = element.innerHTML;

            let iconClass;
            switch (type) {
                case 'GREEN':
                    iconClass = 'icon-ok-circle';
                    break;
                case 'BLUE':
                    iconClass = 'icon-info-circled';
                    break;
                case 'YELLOW':
                    iconClass = 'icon-attention';
                    break;
                case 'RED':
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
        let elements = document.querySelectorAll('[WINDOW-TYPE]');

        elements.forEach(element => {
            let type = element.getAttribute('WINDOW-TYPE');
            let title = element.getAttribute('TITLE');
            let content = element.innerHTML;

            let iconClass;
            switch (type) {
                case 'GREEN':
                    iconClass = 'icon-ok-circle';
                    break;
                case 'BLUE':
                    iconClass = 'icon-info-circled';
                    break;
                case 'YELLOW':
                    iconClass = 'icon-attention';
                    break;
                case 'RED':
                    iconClass = 'icon-cancel-circle';
                    break;
                case 'PINK':
                    iconClass = 'icon-heart-circled';
                    break;
                default:
                    iconClass = 'icon-info-circled';
            }

            let newContent = `
            <div class="notifications-container">
                <div class="window ${type}">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <i class="${iconClass} window-icon"></i>
                        </div>
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

    // Call the functions to apply the changes
    parseAlerts();
    parseWindows();
    parseFriendCards();
});
