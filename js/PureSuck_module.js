document.addEventListener('DOMContentLoaded', function () {
    function parseAlerts() {
        let elements = document.querySelectorAll('[ALERT-TYPE]');

        elements.forEach(element => {
            let type = element.getAttribute('ALERT-TYPE');
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
            <div data-aos="fade-up" data-aos-anchor-placement="center-bottom">
                <div role="alert" class="alert-box ${type}">
                    <i class="${iconClass}"></i>
                    <p class="text-xs font-semibold">${content}</p>
                </div>
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
                case 'pink':
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

    // Call the function to apply the changes
    parseAlerts();
    parseWindows();
});

