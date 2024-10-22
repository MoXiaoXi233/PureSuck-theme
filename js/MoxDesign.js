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
    const settings = {...defaults, ...options};

    // 检查并移除旧的Toast元素
    const oldToast = document.getElementById("toast");
    if (oldToast && document.body.contains(oldToast)) {
        oldToast.className = "hide";
        setTimeout(function(){
            if (document.body.contains(oldToast)) {
                document.body.removeChild(oldToast);
            }
        }, 500); // 等待动画完成后再移除
    }

    // 创建一个新的div元素
    const toast = document.createElement("div");
    toast.id = "toast";
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
    setTimeout(function(){
        toast.className = `${settings.position} hide`;
        setTimeout(function(){
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 500); // 等待动画完成后再移除
    }, settings.duration);
}