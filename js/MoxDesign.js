// MoxDesign 1.0
function MoxToast(options) {
    // 默认参数
    const defaults = {
        message: "This is a toast message",
        duration: 3000,
        position: "bottom", // 可以是 "top" 或 "bottom"
        backgroundColor: "var(--card2-color)",
        textColor: "var(--text-color)",
        borderColor: "var(--border-color)", // 使用CSS变量或默认值
    };

    // 合并用户参数和默认参数
    const settings = { ...defaults, ...options };

    // 检查并移除旧的Toast元素
    const oldToast = document.getElementById("mox-toast");
    if (oldToast && document.body.contains(oldToast)) {
        oldToast.className = "hide";
        setTimeout(function () {
            if (document.body.contains(oldToast)) {
                document.body.removeChild(oldToast);
            }
        }, 500); // 等待动画完成后再移除
    }

    // 创建一个新的div元素
    const toast = document.createElement("div");
    toast.id = "mox-toast";
    toast.textContent = settings.message;
    toast.style.backgroundColor = settings.backgroundColor;
    toast.style.color = settings.textColor;
    toast.style.borderColor = settings.borderColor;
    toast.style.bottom = settings.position === "bottom" ? `45px` : "auto";
    toast.style.top = settings.position === "top" ? `45px` : "auto";
    toast.classList.add(settings.position);

    // 将Toast元素插入到body中
    document.body.appendChild(toast);

    // 显示Toast
    toast.className = `${settings.position} show`;

    // 设置定时器以移除Toast元素
    setTimeout(function () {
        toast.className = `${settings.position} hide`;
        setTimeout(function () {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 500); // 等待动画完成后再移除
    }, settings.duration);
}

function MoxNotification(options) {
    const defaults = {
        title: "Notification Title",
        message: "This is a notification message",
        duration: 4500,
        position: "bottom-right",
        backgroundColor: "var(--card2-color)",
        textColor: "var(--text-color)",
        borderColor: "var(--border-color)",
        icon: null,
    };

    const settings = { ...defaults, ...options };

    let container = document.querySelector('.mox-notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'mox-notification-container';
        document.body.appendChild(container);
    }

    const notification = document.createElement("div");
    notification.className = "mox-notification";
    notification.style.backgroundColor = settings.backgroundColor;
    notification.style.color = settings.textColor;
    notification.style.borderColor = settings.borderColor;

    if (settings.icon) {
        const icon = document.createElement("div");
        icon.className = "icon";
        if (settings.icon.startsWith("http")) {
            const img = document.createElement("img");
            img.src = settings.icon;
            img.alt = "Notification Icon";
            icon.appendChild(img);
        } else {
            icon.className += ` ${settings.icon}`;
        }
        notification.appendChild(icon);
    }

    const content = document.createElement("div");
    content.className = "mox-content";

    const title = document.createElement("div");
    title.className = "mox-title";
    title.textContent = settings.title;
    content.appendChild(title);

    const message = document.createElement("div");
    message.className = "mox-message";
    message.textContent = settings.message;
    content.appendChild(message);

    notification.appendChild(content);

    const closeButton = document.createElement("div");
    closeButton.className = "mox-close-btn";
    closeButton.textContent = "×";
    closeButton.onclick = function () {
        hideNotification(notification);
    };
    notification.appendChild(closeButton);

    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    if (settings.duration > 0) {
        setTimeout(() => {
            hideNotification(notification);
        }, settings.duration);
    }
}

function hideNotification(notification) {
    notification.classList.remove('show');
    notification.classList.add('hide');
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 300);
}

/**
    MoxNotification({
    title: "Persistent Notification",
    message: "This notification won't auto-close.",
    duration: 0, //timer set to 0 to disable auto-close
    icon: "https://example.com/icon.png"
    });
 **/

function MoxWindows(options) {
    const defaults = {
        header: "窗口标题",
        content: "这是窗口内容",
        backgroundColor: "var(--card2-color)",
        textColor: "var(--text-color)",
        borderColor: "var(--border-color)"
    };

    const settings = { ...defaults, ...options };

    // 移除旧的窗口和遮罩
    const oldWindow = document.querySelector('.mox-window');
    const oldOverlay = document.querySelector('.mox-overlay');
    if (oldWindow && document.body.contains(oldWindow)) {
        document.body.removeChild(oldWindow);
    }
    if (oldOverlay && document.body.contains(oldOverlay)) {
        document.body.removeChild(oldOverlay);
    }

    // 创建遮罩
    const overlay = document.createElement("div");
    overlay.className = "mox-overlay";
    overlay.onclick = function () {
        hideWindow(window, overlay);
    };

    // 创建窗口
    const window = document.createElement("div");
    window.className = "mox-window";
    window.style.backgroundColor = settings.backgroundColor;
    window.style.color = settings.textColor;
    window.style.borderColor = settings.borderColor;

    const header = document.createElement("div");
    header.className = "mox-window-header";
    header.textContent = settings.header;
    window.appendChild(header);

    const content = document.createElement("div");
    content.className = "mox-window-content";
    content.textContent = settings.content;
    window.appendChild(content);

    const closeButton = document.createElement("div");
    closeButton.className = "mox-window-close-btn";
    closeButton.textContent = "×";
    closeButton.onclick = function () {
        hideWindow(window, overlay);
    };
    window.appendChild(closeButton);

    document.body.appendChild(overlay);
    document.body.appendChild(window);

    setTimeout(() => {
        overlay.classList.add('show');
        window.classList.add('show');
    }, 10);
}

function hideWindow(window, overlay) {
    window.classList.remove('show');
    overlay.classList.remove('show');
    setTimeout(() => {
        if (document.body.contains(window)) {
            document.body.removeChild(window);
        }
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    }, 300);
}

/**
    MoxWindows({
    header: "模态窗口标题",
    content: "这是模态窗口的内容。"
    });
 **/
