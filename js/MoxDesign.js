// script.js
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
    // 默认参数
    const defaults = {
        title: "Notification Title",
        message: "This is a notification message",
        duration: 4500,
        position: "bottom-right", // 可以是 "top-left", "top-right", "bottom-left", "bottom-right"
        backgroundColor: "var(--card2-color)",
        textColor: "var(--text-color)",
        borderColor: "var(--border-color)", // 使用CSS变量或默认值
        icon: null, // 可以是图片URL或图标类名
    };

    // 合并用户参数和默认参数
    const settings = { ...defaults, ...options };

    // 检查并移除旧的Notification元素
    const oldNotification = document.getElementById("mox-notification");
    if (oldNotification && document.body.contains(oldNotification)) {
        oldNotification.className = "hide";
        setTimeout(function () {
            if (document.body.contains(oldNotification)) {
                document.body.removeChild(oldNotification);
            }
        }, 500); // 等待动画完成后再移除
    }

    // 创建一个新的div元素
    const notification = document.createElement("div");
    notification.id = "mox-notification";
    notification.style.backgroundColor = settings.backgroundColor;
    notification.style.color = settings.textColor;
    notification.style.borderColor = settings.borderColor;
    notification.classList.add(settings.position);

    // 创建图标元素
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

    // 创建内容元素
    const content = document.createElement("div");
    content.className = "content";

    // 创建标题元素
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = settings.title;
    content.appendChild(title);

    // 创建消息元素
    const message = document.createElement("div");
    message.className = "message";
    message.textContent = settings.message;
    content.appendChild(message);

    // 将内容元素插入到notification中
    notification.appendChild(content);

    // 将Notification元素插入到body中
    document.body.appendChild(notification);

    // 显示Notification
    notification.className = `${settings.position} show`;

    // 设置定时器以移除Notification元素
    setTimeout(function () {
        notification.className = `${settings.position} hide`;
        setTimeout(function () {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 500); // 等待动画完成后再移除
    }, settings.duration);
}

// 示例用法：
//MoxNotification({
//    title: "欢迎通知",
//    message: "欢迎来到我们的网站！",
//    duration: 5000,
//    position: "bottom-left",
//    backgroundColor: "#4CAF50",
//    textColor: "#FFFFFF",
//    borderColor: "#388E3C",
//    icon: "https://example.com/icon.png" // 可以是图片URL或图标类名
//});