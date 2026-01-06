(() => {
  const root = document.documentElement;
  const selector = ".post-inner";
  const revealedClass = "is-revealed";

  // ✅ VT 过渡期间暂停 ScrollReveal
  let isPaused = false;

  const computedStyles = window.getComputedStyle(root);

  const getCSSNumber = (name, fallback) => {
    const raw = computedStyles.getPropertyValue(name);
    const value = parseFloat(raw);
    return Number.isFinite(value) ? value : fallback;
  };

  const getCSSString = (name, fallback) => {
    const raw = computedStyles.getPropertyValue(name);
    const trimmed = raw ? raw.trim() : "";
    return trimmed || fallback;
  };

  const revealTriggerRatio = getCSSNumber("--scroll-reveal-trigger-ratio", 0.88);
  const revealRootMargin = getCSSString(
    "--scroll-reveal-root-margin",
    "0px 0px -12% 0px"
  );

  if (window.__scrollRevealFailSafe) {
    window.clearTimeout(window.__scrollRevealFailSafe);
    window.__scrollRevealFailSafe = null;
  }

  function applyContentSequencing(elements) {
    // 使用 requestAnimationFrame 批处理 DOM 操作以减少重排
    requestAnimationFrame(() => {
      for (const card of elements) {
        // 跳过已处理的元素（使用 classList 检查）
        if (card.classList.contains('is-sequenced')) continue;
        card.classList.add('is-sequenced');

        const wrapper = card.querySelector(".inner-post-wrapper");
        if (wrapper) {
          const children = Array.from(wrapper.children);
          // 批量设置 CSS 变量，保留每个元素的独立延迟
          children.forEach((child, index) => {
            if (child.classList && child.classList.contains("post-meta")) return;
            child.style.setProperty("--content-index", String(index));
          });
        }

        const content = card.querySelector(".post-content");
        if (content) {
          const blocks = Array.from(content.children);
          const maxBlocks = 28;

          // 不使用分批处理，直接在一个 RAF 中完成
          // 但保留每个元素的独立延迟设置，维持自然的层叠效果
          for (let index = 0; index < blocks.length && index < maxBlocks; index++) {
            blocks[index].style.setProperty("--content-child-index", String(index));
          }
        }
      }
    });
  }

  function revealAll() {
    const elements = Array.from(document.querySelectorAll(selector));
    if (!elements.length) return;
    applyContentSequencing(elements);
    for (const element of elements) element.classList.add(revealedClass);
  }

  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  if (prefersReducedMotion) {
    root.classList.remove("js-scroll-reveal");
    return;
  }

  if (!("IntersectionObserver" in window)) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", revealAll, { once: true });
    } else {
      revealAll();
    }

    document.addEventListener("pjax:success", revealAll);
    return;
  }

  function shouldReveal(entry) {
    if (!entry.isIntersecting) return false;

    const rect = entry.boundingClientRect;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 0;

    if (!viewportHeight) return true;

    return rect.top <= viewportHeight * revealTriggerRatio;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      // ✅ 如果正在 VT 过渡，跳过处理
      if (isPaused) return;
      
      for (const entry of entries) {
        if (!shouldReveal(entry)) continue;
        entry.target.classList.add(revealedClass);
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0, rootMargin: revealRootMargin }
  );

  function bind() {
    observer.disconnect();
    const elements = Array.from(document.querySelectorAll(selector));
    if (!elements.length) return;

    applyContentSequencing(elements);

    for (const element of elements) {
      if (element.classList.contains(revealedClass)) continue;
      observer.observe(element);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }

  document.addEventListener("pjax:success", bind);
  
  // ✅ 暴露暂停/恢复接口给 VT Controller
  window.scrollReveal = {
    pause() {
      isPaused = true;
    },
    resume() {
      isPaused = false;
      // 恢复后立即检查可见元素
      bind();
    }
  };
})();
