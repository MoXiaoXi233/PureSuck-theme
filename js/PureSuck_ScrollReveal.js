(() => {
  const root = document.documentElement;
  const selector = ".post-inner";
  const revealedClass = "is-revealed";

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
    for (const card of elements) {
      const wrapper = card.querySelector(".inner-post-wrapper");
      if (wrapper) {
        let index = 0;
        const children = Array.from(wrapper.children);
        for (const child of children) {
          if (child.classList && child.classList.contains("post-meta")) continue;
          child.style.setProperty("--content-index", String(index));
          index += 1;
        }
      }

      const content = card.querySelector(".post-content");
      if (content) {
        const blocks = Array.from(content.children);
        const maxBlocks = 28;
        for (let index = 0; index < blocks.length; index += 1) {
          if (index >= maxBlocks) break;
          blocks[index].style.setProperty("--content-child-index", String(index));
        }
      }
    }
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
})();
