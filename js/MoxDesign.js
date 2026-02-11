// MoxDesign 1.1
(function () {
    "use strict";

    const MOTION_MS = 300;

    function prefersReducedMotion() {
        try {
            return Boolean(
                window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
            );
        } catch (error) {
            return false;
        }
    }

    function getMotionDuration() {
        return prefersReducedMotion() ? 0 : MOTION_MS;
    }

    function nextFrame(callback) {
        if (typeof requestAnimationFrame !== "function") {
            setTimeout(callback, 0);
            return;
        }
        requestAnimationFrame(function () {
            requestAnimationFrame(callback);
        });
    }

    function removeWithTransition(element, motionMs) {
        if (!element) return;

        let removed = false;
        const finish = function () {
            if (removed) return;
            removed = true;
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        };

        if (motionMs <= 0) {
            finish();
            return;
        }

        element.addEventListener("transitionend", finish, { once: true });
        setTimeout(finish, motionMs + 90);
    }

    function normalizeNotificationPosition(position) {
        const normalized = String(position || "").toLowerCase();
        const supported = {
            "top-left": true,
            "top-right": true,
            "bottom-left": true,
            "bottom-right": true,
            "top-center": true,
            "bottom-center": true
        };
        return supported[normalized] ? normalized : "bottom-right";
    }

    function applyNotificationContainerPosition(container, position) {
        container.style.top = "auto";
        container.style.bottom = "auto";
        container.style.left = "auto";
        container.style.right = "auto";
        container.style.transform = "none";
        container.style.alignItems = "flex-end";

        switch (position) {
            case "top-left":
                container.style.top = "20px";
                container.style.left = "20px";
                container.style.alignItems = "flex-start";
                break;
            case "top-right":
                container.style.top = "20px";
                container.style.right = "20px";
                container.style.alignItems = "flex-end";
                break;
            case "bottom-left":
                container.style.bottom = "20px";
                container.style.left = "20px";
                container.style.alignItems = "flex-start";
                break;
            case "top-center":
                container.style.top = "20px";
                container.style.left = "50%";
                container.style.transform = "translateX(-50%)";
                container.style.alignItems = "center";
                break;
            case "bottom-center":
                container.style.bottom = "20px";
                container.style.left = "50%";
                container.style.transform = "translateX(-50%)";
                container.style.alignItems = "center";
                break;
            default:
                container.style.bottom = "20px";
                container.style.right = "20px";
                container.style.alignItems = "flex-end";
                break;
        }
    }

    function closeToast(element) {
        if (!element) return;
        const motionMs = getMotionDuration();
        element.classList.remove("show");
        element.classList.add("hide");
        removeWithTransition(element, motionMs);
    }

    function closeModal(modal, overlay) {
        const motionMs = getMotionDuration();
        if (modal) {
            modal.classList.remove("show");
        }
        if (overlay) {
            overlay.classList.remove("show");
        }

        if (modal && typeof modal.__moxEscHandler === "function") {
            document.removeEventListener("keydown", modal.__moxEscHandler);
            delete modal.__moxEscHandler;
        }

        document.body.classList.remove("mox-modal-open");
        removeWithTransition(modal, motionMs);
        removeWithTransition(overlay, motionMs);
    }

    function closeNotification(notification) {
        if (!notification) return;
        const motionMs = getMotionDuration();
        notification.classList.remove("show");
        notification.classList.add("hide");
        removeWithTransition(notification, motionMs);
    }

    function MoxToast(options) {
        const defaults = {
            message: "This is a toast message",
            duration: 3000,
            position: "bottom",
            backgroundColor: "var(--card2-color)",
            textColor: "var(--text-color)",
            borderColor: "var(--border-color)"
        };

        const settings = Object.assign({}, defaults, options || {});
        const position = settings.position === "top" ? "top" : "bottom";

        const oldToast = document.getElementById("mox-toast");
        if (oldToast && document.body.contains(oldToast)) {
            closeToast(oldToast);
        }

        const toast = document.createElement("div");
        toast.id = "mox-toast";
        toast.classList.add(position);
        toast.textContent = String(settings.message || "");
        toast.style.backgroundColor = settings.backgroundColor;
        toast.style.color = settings.textColor;
        toast.style.borderColor = settings.borderColor;

        nextFrame(function () {
            document.body.appendChild(toast);
            nextFrame(function () {
                toast.classList.add("show");
            });
        });

        const duration = Number(settings.duration);
        if (!Number.isFinite(duration) || duration <= 0) return;

        setTimeout(function () {
            closeToast(toast);
        }, duration);
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
            icon: null
        };

        const settings = Object.assign({}, defaults, options || {});
        const position = normalizeNotificationPosition(settings.position);
        const selector = '.mox-notification-container[data-position="' + position + '"]';

        let container = document.querySelector(selector);
        if (!container) {
            container = document.createElement("div");
            container.className = "mox-notification-container";
            container.dataset.position = position;
            document.body.appendChild(container);
        }
        applyNotificationContainerPosition(container, position);

        const notification = document.createElement("div");
        notification.className = "mox-notification";
        if (position.indexOf("left") > -1) {
            notification.classList.add("from-left");
        }
        notification.style.backgroundColor = settings.backgroundColor;
        notification.style.color = settings.textColor;
        notification.style.borderColor = settings.borderColor;

        if (settings.icon) {
            const icon = document.createElement("div");
            icon.className = "icon";
            if (typeof settings.icon === "string" && settings.icon.indexOf("http") === 0) {
                const img = document.createElement("img");
                img.src = settings.icon;
                img.alt = "Notification Icon";
                icon.appendChild(img);
            } else {
                icon.className += " " + settings.icon;
            }
            notification.appendChild(icon);
        }

        const content = document.createElement("div");
        content.className = "mox-content";

        const title = document.createElement("div");
        title.className = "mox-title";
        title.innerHTML = settings.title;
        content.appendChild(title);

        const message = document.createElement("div");
        message.className = "mox-message";
        message.innerHTML = settings.message;
        content.appendChild(message);

        notification.appendChild(content);

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "mox-close-btn";
        closeButton.textContent = "×";
        closeButton.setAttribute("aria-label", "Close notification");
        closeButton.addEventListener("click", function () {
            closeNotification(notification);
        });
        notification.appendChild(closeButton);

        container.appendChild(notification);
        nextFrame(function () {
            notification.classList.add("show");
        });

        const duration = Number(settings.duration);
        if (!Number.isFinite(duration) || duration <= 0) return;

        setTimeout(function () {
            closeNotification(notification);
        }, duration);
    }

    function MoxWindows(options) {
        const defaults = {
            header: "Window Title",
            content: "This is window content",
            backgroundColor: "var(--card2-color)",
            textColor: "var(--text-color)",
            borderColor: "var(--border-color)"
        };

        const settings = Object.assign({}, defaults, options || {});

        const oldModal = document.querySelector(".mox-window");
        const oldOverlay = document.querySelector(".mox-overlay");
        if (oldModal && oldModal.parentNode) {
            oldModal.parentNode.removeChild(oldModal);
        }
        if (oldOverlay && oldOverlay.parentNode) {
            oldOverlay.parentNode.removeChild(oldOverlay);
        }

        const overlay = document.createElement("div");
        overlay.className = "mox-overlay";

        const modal = document.createElement("div");
        modal.className = "mox-window";
        modal.style.backgroundColor = settings.backgroundColor;
        modal.style.color = settings.textColor;
        modal.style.borderColor = settings.borderColor;

        const header = document.createElement("div");
        header.className = "mox-window-header";
        header.innerHTML = settings.header;
        modal.appendChild(header);

        const content = document.createElement("div");
        content.className = "mox-window-content";
        content.innerHTML = settings.content;
        modal.appendChild(content);

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "mox-window-close-btn";
        closeButton.textContent = "×";
        closeButton.setAttribute("aria-label", "Close window");
        closeButton.addEventListener("click", function () {
            closeModal(modal, overlay);
        });
        modal.appendChild(closeButton);

        overlay.addEventListener("click", function () {
            closeModal(modal, overlay);
        });

        const onEsc = function (event) {
            if (event.key !== "Escape") return;
            closeModal(modal, overlay);
        };
        modal.__moxEscHandler = onEsc;
        document.addEventListener("keydown", onEsc);

        document.body.classList.add("mox-modal-open");
        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        nextFrame(function () {
            overlay.classList.add("show");
            modal.classList.add("show");
        });
    }

    window.MoxToast = MoxToast;
    window.MoxNotification = MoxNotification;
    window.MoxWindows = MoxWindows;
    window.hideNotification = closeNotification;
    window.hideWindow = closeModal;
})();
