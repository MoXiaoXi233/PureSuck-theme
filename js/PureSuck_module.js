document.addEventListener('DOMContentLoaded', function() {
    function parseInfoWindows() {
        let elements = document.querySelectorAll('[INFO-WINDOW]');

        elements.forEach(element => {
            let type = element.getAttribute('INFO-WINDOW');
            let title = element.getAttribute('TITLE');
            let content = element.innerHTML;

            // 创建一个临时容器来解析内容
            let tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;

            // 遍历所有子元素，如果是空的 <p> 元素，则添加 <br>
            Array.from(tempDiv.children).forEach(child => {
                if (child.tagName === 'P' && child.textContent.trim() === '') {
                    child.innerHTML = '<br>';
                }
            });

            // 获取处理后的内容
            let processedContent = tempDiv.innerHTML;

            let newContent = `
                <div class="info-window-box ${type}">
                    <div class="info-window-header ${type}">${title}</div>
                    <div class="info-window-content">
                        ${processedContent}
                    </div>
                </div>
            `;

            element.outerHTML = newContent;
        });
    }


    function parseAlerts() {
        let elements = document.querySelectorAll('[ALERT-TYPE]');

        elements.forEach(element => {
            let type = element.getAttribute('ALERT-TYPE');
            let content = element.innerHTML;

            let iconClass;
            switch(type) {
                case 'green':
                    iconClass = 'fa fa-check-circle';
                    break;
                case 'blue':
                    iconClass = 'fa fa-info-circle';
                    break;
                case 'yellow':
                    iconClass = 'fa fa-exclamation-circle';
                    break;
                case 'red':
                    iconClass = 'fa fa-times-circle';
                    break;
                default:
                    iconClass = 'fa fa-info-circle';
            }

            let newContent = `
                <div role="alert" class="alert-box ${type}">
                    <i class="fas ${iconClass} alert-icon"></i>
                    <p class="text-xs font-semibold">${content}</p>
                </div>
            `;

            element.outerHTML = newContent;
        });
    }

    function parseInfoCards() {
        let elements = [...document.querySelectorAll('[INFO-CARD], br')];
        let rows = [];
        let currentRow = [];

        elements.forEach(element => {
            if (element.tagName === 'BR') {
                if (currentRow.length > 0) {
                    rows.push(currentRow);
                    currentRow = [];
                }
            } else {
                currentRow.push(element);
            }
        });

        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        rows.forEach((row, rowIndex) => {
            let rowDiv = document.createElement('div');
            rowDiv.classList.add('info-card-row');

            row.forEach(element => {
                let styleType = element.getAttribute('INFO-CARD');
                let imgSrc = element.getAttribute('SRC');
                let title = element.getAttribute('TITLE');
                let desc = element.getAttribute('DESC');
                let link = element.getAttribute('LINK');

                let newContent = `
                    <a href="${link}" class="info-card style-${styleType}">
                        <img src="${imgSrc}" alt="${title}">
                        <div class="info-text">
                            <div class="info-title">${title}</div>
                            <div class="info-desc">${desc}</div>
                        </div>
                    </a>
                `;

                let tempDiv = document.createElement('div');
                tempDiv.innerHTML = newContent;
                let cardElement = tempDiv.firstElementChild;

                switch (row.length) {
                    case 1:
                        cardElement.classList.add('one-per-row');
                        break;
                    case 2:
                        cardElement.classList.add('two-per-row');
                        break;
                    case 3:
                        cardElement.classList.add('three-per-row');
                        break;
                    default:
                        cardElement.classList.add('three-per-row'); // 默认处理
                        break;
                }

                rowDiv.appendChild(cardElement);
            });

            let parentElement = row[0].parentNode;
            parentElement.insertBefore(rowDiv, row[0]);
            row.forEach(element => element.remove());
        });
    }

    function removeBrTags() {
        let brElements = document.querySelectorAll('br');
        brElements.forEach(br => br.remove());
    }

    parseInfoWindows();
    parseAlerts();
    parseInfoCards();

    
});

