/** 主题前端模块：集中处理通用交互逻辑。 **/
/** 包括返回顶部、TOC、短代码组件、评论表单和主题切换。 **/

/**
 * TOC 高亮与定位。
 * 使用 IntersectionObserver 跟踪当前标题。
 */
const TOC_VISIBLE_CLASS = 'is-visible';
const TOC_REVEAL_ENTER_CLASS = 'reveal-enter';
const TOC_REVEAL_LEAVE_CLASS = 'reveal-leave';
const TOC_REVEAL_TIMER_KEY = '__psTocRevealTimer';
const TOC_HIDE_TIMER_KEY = '__psTocHideTimer';
const TOC_HIDE_HANDLER_KEY = '__psTocHideHandler';

function resetTocStickySidebar(sidebar) {
    const target = sidebar && sidebar.classList ? sidebar : document.querySelector('.right-sidebar');
    if (!target) return;

    target.classList.remove('ps-has-toc');
}

function clearTocPinnedStyle(section) {
    if (!section) return;
    section.style.left = '';
    section.style.width = '';
}

function clearTocHideTask(section) {
    if (!section) return;
    if (section[TOC_HIDE_TIMER_KEY]) {
        clearTimeout(section[TOC_HIDE_TIMER_KEY]);
        section[TOC_HIDE_TIMER_KEY] = 0;
    }
    if (section[TOC_HIDE_HANDLER_KEY]) {
        section.removeEventListener('transitionend', section[TOC_HIDE_HANDLER_KEY]);
        section[TOC_HIDE_HANDLER_KEY] = null;
    }
}

function finalizeHideTocSection(section) {
    if (!section) return;
    clearTocHideTask(section);
    section.classList.remove(
        TOC_VISIBLE_CLASS,
        TOC_REVEAL_ENTER_CLASS,
        TOC_REVEAL_LEAVE_CLASS,
        'sticky',
        'sticky-preparing'
    );
    section.style.transform = '';
    section.style.display = 'none';
    clearTocPinnedStyle(section);
    resetTocStickySidebar(section.closest('.right-sidebar'));
}

function hideTocSection(section, options) {
    if (!section) return;
    const cfg = Object.assign({ immediate: false }, options || {});

    if (section[TOC_REVEAL_TIMER_KEY]) {
        window.cancelAnimationFrame(section[TOC_REVEAL_TIMER_KEY]);
        section[TOC_REVEAL_TIMER_KEY] = 0;
    }

    clearTocHideTask(section);

    if (cfg.immediate || section.style.display === 'none') {
        finalizeHideTocSection(section);
        return;
    }

    section.classList.remove('sticky', 'sticky-preparing', TOC_REVEAL_ENTER_CLASS, TOC_VISIBLE_CLASS);
    section.classList.add(TOC_REVEAL_LEAVE_CLASS);
    clearTocPinnedStyle(section);

    const onEnd = function (event) {
        if (event && event.target !== section) return;
        if (event && event.propertyName && event.propertyName !== 'opacity' && event.propertyName !== 'transform') return;
        finalizeHideTocSection(section);
    };

    section[TOC_HIDE_HANDLER_KEY] = onEnd;
    section.addEventListener('transitionend', onEnd);
    section[TOC_HIDE_TIMER_KEY] = window.setTimeout(() => {
        finalizeHideTocSection(section);
    }, 360);
}

function showTocSection(section) {
    if (!section) return;
    if (section.classList.contains(TOC_VISIBLE_CLASS) && section.style.display !== 'none') return;

    section.style.display = 'block';
    section.classList.add(TOC_REVEAL_ENTER_CLASS);
    section.classList.remove(TOC_VISIBLE_CLASS, TOC_REVEAL_LEAVE_CLASS);

    if (section[TOC_REVEAL_TIMER_KEY]) {
        window.cancelAnimationFrame(section[TOC_REVEAL_TIMER_KEY]);
        section[TOC_REVEAL_TIMER_KEY] = 0;
    }
    clearTocHideTask(section);

    section[TOC_REVEAL_TIMER_KEY] = window.requestAnimationFrame(() => {
        section[TOC_REVEAL_TIMER_KEY] = window.requestAnimationFrame(() => {
            section.classList.add(TOC_VISIBLE_CLASS);
            section.classList.remove(TOC_REVEAL_ENTER_CLASS, TOC_REVEAL_LEAVE_CLASS);
            section[TOC_REVEAL_TIMER_KEY] = 0;
        });
    });
}

const initializeTOC = (() => {
    let state = null;
    let hashTimer = 0;
    let isClickScrolling = false;

    function findNextVisibleIndex(visible, start) {
        for (let i = start; i < visible.length; i += 1) {
            if (visible[i] === 1) return i;
        }
        return -1;
    }

    function destroy() {
        if (!state) return;

        clearTimeout(hashTimer);
        hashTimer = 0;
        isClickScrolling = false;

        if (state.observer) {
            state.observer.disconnect();
        }

        if (state.activeLink) {
            state.activeLink.classList.remove('li-active');
        }

        if (state.headings && state.headings.length) {
            state.headings.forEach((heading) => {
                if (!heading || !heading.dataset) return;
                delete heading.dataset.psTocIndex;
            });
        }

        state = null;
    }

    function setActive(index, options) {
        if (!state || index < 0 || index >= state.headings.length) return;
        if (state.activeIndex === index) return;

        const cfg = Object.assign({ scrollBehavior: 'auto' }, options || {});

        if (state.activeLink) {
            state.activeLink.classList.remove('li-active');
        }

        const item = state.items[index];
        const link = item && item.link ? item.link : null;
        if (!link) return;

        link.classList.add('li-active');
        state.activeLink = link;
        state.activeIndex = index;

        const li = item && item.li ? item.li : null;
        if (state.indicator && li) {
            state.indicator.style.transform = `translateY(${li.offsetTop}px)`;
        }

        if (state.tocSection && li) {
            const containerRect = state.tocSection.getBoundingClientRect();
            const itemRect = li.getBoundingClientRect();

            if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
                state.tocSection.scrollBy({
                    top: itemRect.top - containerRect.top - containerRect.height / 2 + itemRect.height / 2,
                    behavior: cfg.scrollBehavior
                });
            }
        }
    }

    function handleIntersect(entries) {
        if (!state || isClickScrolling) return;

        let changed = false;
        entries.forEach((entry) => {
            const index = Number(entry.target && entry.target.dataset ? entry.target.dataset.psTocIndex : -1);
            if (!Number.isInteger(index) || index < 0 || index >= state.headings.length) return;

            const nextVisible = entry.isIntersecting ? 1 : 0;
            if (state.visible[index] === nextVisible) return;
            state.visible[index] = nextVisible;
            changed = true;

            if (nextVisible === 1) {
                if (state.firstVisible === -1 || index < state.firstVisible) {
                    state.firstVisible = index;
                }
                return;
            }

            if (index === state.firstVisible) {
                const nextAfter = findNextVisibleIndex(state.visible, index + 1);
                state.firstVisible = nextAfter !== -1 ? nextAfter : findNextVisibleIndex(state.visible, 0);
            }
        });

        if (changed && state.firstVisible >= 0) {
            setActive(state.firstVisible);
        }
    }

    function handleClick(e) {
        const link = e.target.closest('.toc-a');
        if (!link || !state) return;

        const href = link.getAttribute('href');
        if (!href || href[0] !== '#') return;

        e.preventDefault();
        e.stopPropagation();

        const targetId = href.slice(1);
        const target = document.getElementById(targetId);
        if (!target) return;

        const index = Object.prototype.hasOwnProperty.call(state.idToIndex, targetId)
            ? state.idToIndex[targetId]
            : -1;
        if (index >= 0) setActive(index, { scrollBehavior: 'smooth' });

        isClickScrolling = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        clearTimeout(hashTimer);
        hashTimer = setTimeout(() => {
            history.replaceState(null, '', href);
            isClickScrolling = false;
        }, 600);
    }

    return function initializeTOC() {
        destroy();

        const tocSection = document.getElementById('toc-section');
        const toc = document.querySelector('.toc');
        const content = document.querySelector('.inner-post-wrapper');

        if (!toc || !content) {
            hideTocSection(tocSection);
            return;
        }

        const headings = Array.from(content.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'));
        if (!headings.length) {
            hideTocSection(tocSection);
            return;
        }

        const indicator = document.querySelector('.siderbar');
        const idToIndex = Object.create(null);
        const items = new Array(headings.length);

        headings.forEach((heading, index) => {
            heading.dataset.psTocIndex = String(index);
            idToIndex[heading.id] = index;

            const escapedId = CSS.escape(heading.id);
            const link = toc.querySelector(`.toc-a[href="#${escapedId}"]`);
            let li = null;

            if (link) {
                link.setAttribute('no-pjax', '');
                link.classList.remove('li-active');
                li = link.closest('li');
            }

            items[index] = { heading, link, li };
        });

        state = {
            headings,
            items,
            idToIndex,
            indicator,
            tocSection,
            visible: new Uint8Array(headings.length),
            firstVisible: -1,
            activeIndex: -1,
            activeLink: null,
            observer: null
        };

        showTocSection(tocSection);
        if (indicator) indicator.style.transition = 'transform 0.25s ease-out';

        if (!toc.dataset.tocBound) {
            toc.addEventListener('click', handleClick, true);
            toc.dataset.tocBound = '1';
        }

        state.observer = new IntersectionObserver(handleIntersect, {
            rootMargin: '-100px 0px -66% 0px',
            threshold: 0
        });

        headings.forEach((heading) => state.observer.observe(heading));

        requestAnimationFrame(() => {
            if (!state) return;
            let initialIndex = 0;
            for (let i = 0; i < headings.length; i += 1) {
                if (headings[i].getBoundingClientRect().top <= 120) {
                    initialIndex = i;
                }
            }
            setActive(initialIndex);
        });
    };
})();

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureRuntimeTocSection(scope, pageType) {
    const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
    const tocEnabled = PS && typeof PS.isFeatureEnabled === 'function'
        ? PS.isFeatureEnabled('showTOC', true)
        : true;

    const rightSidebar = document.querySelector('.right-sidebar');
    let tocSection = document.getElementById('toc-section');
    if (!rightSidebar || !tocEnabled) {
        hideTocSection(tocSection);
        resetTocStickySidebar(rightSidebar);
        return false;
    }

    if (pageType !== 'post' && pageType !== 'page') {
        hideTocSection(tocSection);
        resetTocStickySidebar(rightSidebar);
        return false;
    }

    const contentRoot = (scope && scope.querySelector ? scope : document).querySelector('.inner-post-wrapper');
    if (!contentRoot) {
        hideTocSection(tocSection);
        resetTocStickySidebar(rightSidebar);
        return false;
    }

    const headings = Array.from(contentRoot.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'));
    if (!headings.length) {
        hideTocSection(tocSection);
        resetTocStickySidebar(rightSidebar);
        return false;
    }

    const tocSignature = headings.map((heading) => {
        const tag = (heading.tagName || '').toUpperCase();
        const id = heading.id || '';
        const text = (heading.textContent || '').trim();
        return tag + ':' + id + ':' + text.length;
    }).join('|');

    const buildTocHtml = function () {
        const lines = [];
        lines.push('<div class="dir"><ul id="toc">');
        headings.forEach((heading) => {
            const levelMatch = /^H([1-6])$/i.exec(heading.tagName || '');
            const level = levelMatch ? levelMatch[1] : '2';
            const text = escapeHtml((heading.textContent || '').trim() || heading.id);
            const id = escapeHtml(heading.id);
            lines.push(
                '<li class="li li-' + level + '">'
                + '<a href="#' + id + '" id="link-' + id + '" class="toc-a">' + text + '</a>'
                + '</li>'
            );
        });
        lines.push('</ul><div class="sider"><span class="siderbar"></span></div></div>');
        return lines.join('');
    };

    if (!tocSection) {
        tocSection = document.createElement('div');
        tocSection.className = 'toc-section';
        tocSection.id = 'toc-section';
        tocSection.dataset.psRuntimeToc = '1';
        tocSection.innerHTML = [
            '<header class="section-header">',
            '  <span class="icon-article"></span>',
            '  <span class="title">文章目录</span>',
            '</header>',
            '<section class="section-body">',
            '  <div class="toc"></div>',
            '</section>'
        ].join('');
        rightSidebar.appendChild(tocSection);
    }

    const toc = tocSection.querySelector('.toc');
    if (!toc) {
        hideTocSection(tocSection);
        resetTocStickySidebar(rightSidebar);
        return false;
    }

    const existingLinks = toc.querySelectorAll('.toc-a').length;
    const shouldRebuild = tocSection.dataset.psTocSig !== tocSignature
        || existingLinks !== headings.length;

    if (shouldRebuild) {
        toc.innerHTML = buildTocHtml();
        tocSection.dataset.psTocSig = tocSignature;
    }

    showTocSection(tocSection);
    rightSidebar.classList.add('ps-has-toc');
    return true;
}

const GoTopButton = (() => {
    let bound = false;
    let button = null;
    let anchor = null;
    let sentinel = null;
    let observer = null;

    function sync(root) {
        const scope = root && root.querySelector ? root : document;
        button = scope.querySelector('#go-top') || document.querySelector('#go-top');
        anchor = button ? button.querySelector('.go') : null;
    }

    // 用 IntersectionObserver 替代滚动监听，减少重排开销。
    function createSentinel() {
        if (sentinel) return sentinel;

        sentinel = document.createElement('div');
        sentinel.id = 'go-top-sentinel';
        sentinel.setAttribute('aria-hidden', 'true');
        sentinel.style.cssText = 'position:absolute;top:100px;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden;';
        document.body.appendChild(sentinel);
        return sentinel;
    }

    function handleIntersect(entries) {
        if (!button) return;
        const [entry] = entries;
        // sentinel 不可见时（滚动超过 100px）显示按钮。
        if (entry.isIntersecting) {
            button.classList.remove('visible');
        } else {
            button.classList.add('visible');
        }
    }

    function initObserver() {
        if (observer) {
            observer.disconnect();
        }

        const sentinelEl = createSentinel();
        observer = new IntersectionObserver(handleIntersect, {
            root: null,
            threshold: 0,
            rootMargin: '0px'
        });
        observer.observe(sentinelEl);
    }

    function onClick(event) {
        const target = event.target instanceof Element
            ? event.target.closest('#go-top .go')
            : null;
        if (!target) return;

        event.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        setTimeout(() => {
            const current = document.querySelector('#go-top');
            if (current) current.classList.remove('visible');
        }, 400);
    }

    return function init(root) {
        sync(root);
        if (!button || !anchor) return;

        if (!bound) {
            bound = true;
            document.addEventListener('click', onClick, true);
        }

        // 每次初始化都重建 observer，兼容 Swup 切页。
        initObserver();
    };
})();

function handleGoTopButton(root) {
    GoTopButton(root);
}

function bindCollapsiblePanels(root) {
    const scope = root && root.querySelector ? root : document;
    const panels = scope.querySelectorAll('.collapsible-panel');

    panels.forEach(panel => {
        if (panel.dataset.binded === "1") return;
        panel.dataset.binded = "1";

        const button = panel.querySelector('.collapsible-header');
        const contentDiv = panel.querySelector('.collapsible-content');
        const icon = button ? button.querySelector('.icon') : null;

        if (!button || !contentDiv) return;

        // 预缓存 scrollHeight，减少点击时的同步布局读取。
        let cachedScrollHeight = 0;

        const updateCache = () => {
            cachedScrollHeight = contentDiv.scrollHeight;
        };

        // 空闲时预计算高度缓存。
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(updateCache, { timeout: 500 });
        } else {
            setTimeout(updateCache, 100);
        }

        // 内容尺寸变化时更新缓存。
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                // 仅在展开状态下更新缓存。
                if (contentDiv.style.maxHeight && contentDiv.style.maxHeight !== '0px') {
                    cachedScrollHeight = contentDiv.scrollHeight;
                }
            });
            resizeObserver.observe(contentDiv);
        }

        button.addEventListener('click', function () {
            this.classList.toggle('active');

            if (contentDiv.style.maxHeight && contentDiv.style.maxHeight !== '0px') {
                contentDiv.style.maxHeight = '0px';
                if (icon) {
                    icon.classList.remove('icon-up-open');
                    icon.classList.add('icon-down-open');
                }
            } else {
                // 优先使用缓存高度，缺失时回退实时读取。
                const height = cachedScrollHeight || contentDiv.scrollHeight;
                contentDiv.style.maxHeight = height + "px";
                // 写回缓存，供下次展开复用。
                if (!cachedScrollHeight) {
                    cachedScrollHeight = height;
                }
                if (icon) {
                    icon.classList.remove('icon-down-open');
                    icon.classList.add('icon-up-open');
                }
            }
        });
    });
}

let tabInitObserver = null;

function isElementNearViewport(el, margin) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return true;
    const rect = el.getBoundingClientRect();
    const pad = Number.isFinite(margin) ? margin : 0;
    return rect.top <= window.innerHeight + pad && rect.bottom >= -pad;
}

function initTabContainer(container) {
    if (!container || container.dataset.binded === "1") return;

    const tabHeader = container.querySelector('.tab-header');
    if (!tabHeader) return;

    const tabLinks = Array.from(tabHeader.querySelectorAll('.tab-link'));
    const tabPanes = Array.from(container.querySelectorAll('.tab-pane'));
    const indicator = tabHeader.querySelector('.tab-indicator');
    if (!tabLinks.length || !indicator) return;

    container.dataset.binded = "1";
    delete container.dataset.tabObserved;

    tabLinks.forEach((link, index) => {
        link.dataset.psTabIndex = String(index);
    });

    const cachedWidths = new Array(tabLinks.length).fill(0);
    const cachedOffsets = new Array(tabLinks.length).fill(0);
    let activeIndex = tabLinks.findIndex(l => l.classList.contains('active'));
    if (activeIndex < 0) activeIndex = 0;
    let resizeObserver = null;

    const updateCache = () => {
        for (let i = 0; i < tabLinks.length; i += 1) {
            const link = tabLinks[i];
            cachedWidths[i] = link.offsetWidth;
            cachedOffsets[i] = link.offsetLeft;
        }
    };

    const updateIndicator = index => {
        if (index < 0 || index >= tabLinks.length) return;
        requestAnimationFrame(() => {
            const width = cachedWidths[index] || tabLinks[index].offsetWidth;
            const offset = cachedOffsets[index] || tabLinks[index].offsetLeft;
            const x = offset + width * 0.125;
            indicator.style.width = `${width * 0.75}px`;
            indicator.style.transform = `translateX(${x}px)`;
        });
    };

    const applyActiveState = (nextIndex, shouldFocus) => {
        if (nextIndex < 0 || nextIndex >= tabLinks.length) return;
        if (activeIndex === nextIndex) return;

        tabHeader.classList.remove('dir-left', 'dir-right');
        tabHeader.classList.add(nextIndex > activeIndex ? 'dir-right' : 'dir-left');

        tabLinks.forEach((link, index) => {
            const isActive = index === nextIndex;
            link.classList.toggle('active', isActive);
            link.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        tabPanes.forEach((pane, index) => {
            pane.classList.toggle('active', index === nextIndex);
        });

        activeIndex = nextIndex;
        if (shouldFocus && typeof tabLinks[nextIndex].focus === 'function') {
            tabLinks[nextIndex].focus();
        }
        updateIndicator(nextIndex);
    };

    const updateLayout = () => {
        updateCache();
        updateIndicator(activeIndex);
    };

    if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(updateLayout);
        resizeObserver.observe(tabHeader);
    }

    tabHeader.addEventListener('click', e => {
        const target = e.target.closest('.tab-link');
        if (!target) return;
        const newIndex = Number(target.dataset.psTabIndex || -1);
        if (newIndex < 0 || newIndex >= tabLinks.length) return;
        applyActiveState(newIndex, true);
    });

    if (!tabLinks[activeIndex].classList.contains('active')) {
        applyActiveState(activeIndex, false);
    } else {
        tabLinks[activeIndex].setAttribute('tabindex', '0');
    }
    updateLayout();

    container.__psTabCleanup = function cleanupTabContainer() {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
    };
}

function getTabInitObserver() {
    if (tabInitObserver || !window.IntersectionObserver) return tabInitObserver;
    tabInitObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const container = entry.target;
            tabInitObserver.unobserve(container);
            initTabContainer(container);
        });
    }, {
        root: null,
        rootMargin: '240px 0px',
        threshold: 0
    });
    return tabInitObserver;
}

function bindTabs(root) {
    const scope = root && root.querySelector ? root : document;
    const tabContainers = scope.querySelectorAll('.tab-container');

    tabContainers.forEach(container => {
        if (container.dataset.binded === "1") return;
        if (container.dataset.tabObserved === "1") return;

        if (isElementNearViewport(container, 220) || !window.IntersectionObserver) {
            initTabContainer(container);
            return;
        }

        const observer = getTabInitObserver();
        if (!observer) {
            initTabContainer(container);
            return;
        }

        container.dataset.tabObserved = "1";
        observer.observe(container);
    });
}

function cleanupTabs(root) {
    const scope = root && root.querySelector ? root : document;
    const tabContainers = scope.querySelectorAll('.tab-container');

    tabContainers.forEach(container => {
        if (tabInitObserver && container.dataset.tabObserved === "1") {
            tabInitObserver.unobserve(container);
        }
        if (typeof container.__psTabCleanup === 'function') {
            container.__psTabCleanup();
            delete container.__psTabCleanup;
        }
        delete container.dataset.tabObserved;
    });
}

/**
 * TOC Sticky 控制器（性能优化版）。
 */
const initializeStickyTOC = (() => {
    let bound = false;
    let section = null;
    let startY = 0;
    let topOffset = 8;
    let ticking = false;

    function pinSection(target) {
        if (!target) return;
        const rect = target.getBoundingClientRect();
        target.style.left = Math.round(rect.left) + 'px';
        target.style.width = Math.round(rect.width) + 'px';
    }

    function getDesiredTopOffset(sidebar) {
        if (!sidebar || !window.getComputedStyle) return 8;
        const paddingTop = parseFloat(window.getComputedStyle(sidebar).paddingTop) || 0;
        return Math.max(0, Math.round(paddingTop || 8));
    }

    function measureStartY(target, offset) {
        if (!target) return 0;

        const wasSticky = target.classList.contains('sticky');
        if (wasSticky) target.classList.remove('sticky');
        clearTocPinnedStyle(target);

        const top = target.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
        return Math.max(0, Math.round(top - offset));
    }

    function syncStickyState() {
        if (!section) return;
        const shouldStick = (window.scrollY || window.pageYOffset || 0) >= startY;
        const isSticky = section.classList.contains('sticky');

        if (shouldStick && !isSticky) {
            pinSection(section);
            section.classList.add('sticky');
            return;
        }

        if (!shouldStick && isSticky) {
            section.classList.remove('sticky');
            clearTocPinnedStyle(section);
            return;
        }

        if (shouldStick && isSticky) {
            pinSection(section);
        }
    }

    function onScroll() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
            ticking = false;
            syncStickyState();
        });
    }

    function refresh() {
        const tocSection = document.getElementById('toc-section');
        const rightSidebar = document.querySelector('.right-sidebar');
        if (!rightSidebar) return;

        if (!tocSection || tocSection.style.display === 'none') {
            rightSidebar.classList.remove('ps-has-toc');
            if (section) {
                section.classList.remove('sticky');
                clearTocPinnedStyle(section);
            }
            section = null;
            return;
        }

        rightSidebar.classList.add('ps-has-toc');
        section = tocSection;
        topOffset = getDesiredTopOffset(rightSidebar);
        startY = measureStartY(section, topOffset);
        section.style.setProperty('--ps-toc-top-offset', topOffset + 'px');
        syncStickyState();
    }

    return function initializeStickyTOC() {
        refresh();

        if (bound) return;
        bound = true;

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', refresh, { passive: true });
        window.addEventListener('orientationchange', refresh, { passive: true });
        window.addEventListener('hashchange', () => {
            window.setTimeout(refresh, 100);
        }, { passive: true });
        window.addEventListener('load', refresh, { once: true });
    };
})();


let commentResetBound = false;

function resetCommentForm(form) {
    if (!form) return;
    const submitButton = form.querySelector("#submit");
    if (!submitButton) return;
    const originalText = form.dataset.psSubmitText || submitButton.textContent;

    submitButton.disabled = false;
    submitButton.textContent = originalText;
    form.dataset.psSubmitting = "0";
}

function bindCommentReset() {
    if (commentResetBound) return;
    commentResetBound = true;

    window.addEventListener("pageshow", function () {
        const form = document.getElementById("cf");
        if (!form || form.dataset.psSubmitting !== "1") return;
        resetCommentForm(form);
    });
}

function Comments_Submit() {
    const form = document.getElementById("cf");
    if (!form) return;

    // 防止 Swup/PJAX 重复绑定。
    if (form.dataset.binded === "1") return;
    form.dataset.binded = "1";

    const submitButton = form.querySelector("#submit");
    const textarea = form.querySelector("#textarea");

    if (!submitButton || !textarea) return;

    if (!form.dataset.psSubmitText) {
        form.dataset.psSubmitText = submitButton.textContent;
    }
    form.dataset.psSubmitting = "0";
    bindCommentReset();

    // 只监听 submit 事件。
    form.addEventListener("submit", function (e) {
        // 防止重复提交。
        if (form.dataset.psSubmitting === "1") {
            e.preventDefault();
            return;
        }

        // 内容为空时交给浏览器或 Typecho 原生校验。
        if (textarea.value.trim() === "") {
            return;
        }

        form.dataset.psSubmitting = "1";

        submitButton.disabled = true;
        submitButton.textContent = "提交中...";
    });

    // HTML5 校验失败时恢复按钮状态。
    form.addEventListener(
        "invalid",
        function () {
            resetCommentForm(form);
        },
        true
    );
}

function runWhenIdle(task, options) {
    const cfg = Object.assign({ timeout: 1200, delay: 0 }, options || {});
    let canceled = false;
    let timerId = 0;
    let idleId = 0;

    const runner = function () {
        if (canceled) return;
        if (typeof window.requestIdleCallback === 'function') {
            idleId = window.requestIdleCallback(function () {
                if (canceled) return;
                task();
            }, { timeout: cfg.timeout });
            return;
        }
        timerId = window.setTimeout(function () {
            if (canceled) return;
            task();
        }, 0);
    };

    if (cfg.delay > 0) {
        timerId = window.setTimeout(runner, cfg.delay);
    } else {
        runner();
    }

    return function cancelIdleTask() {
        canceled = true;
        if (timerId) {
            clearTimeout(timerId);
            timerId = 0;
        }
        if (idleId && typeof window.cancelIdleCallback === 'function') {
            window.cancelIdleCallback(idleId);
            idleId = 0;
        }
    };
}

function optimizeContentEmbeds(root, options) {
    const cfg = Object.assign(
        {
            pageType: '',
            isSwup: false
        },
        options || {}
    );

    const scope = root && root.querySelector ? root : document;
    const swupRoot = document.getElementById('swup');
    const pageType = cfg.pageType || (swupRoot && swupRoot.dataset ? swupRoot.dataset.psPageType || '' : '');
    if (pageType !== 'post' && pageType !== 'page') {
        return function noopEmbedCleanup() {};
    }

    const contentScope = scope.querySelector('.post-content') || scope;
    const embeds = Array.from(contentScope.querySelectorAll('iframe[src]'));
    if (!embeds.length) {
        return function noopEmbedCleanup() {};
    }

    const deferred = [];
    const revealTimers = [];
    let observer = null;

    function deferEmbed(iframe) {
        const src = iframe.getAttribute('src');
        if (!src || src === 'about:blank') return;
        iframe.dataset.psDeferredSrc = src;
        iframe.setAttribute('src', 'about:blank');
        deferred.push(iframe);
    }

    function activateEmbed(iframe) {
        const src = iframe && iframe.dataset ? iframe.dataset.psDeferredSrc : '';
        if (!src) return;
        iframe.setAttribute('src', src);
        delete iframe.dataset.psDeferredSrc;
        if (observer) {
            observer.unobserve(iframe);
        }
    }

    embeds.forEach((iframe) => {
        if (!(iframe instanceof HTMLIFrameElement)) return;

        if (!iframe.hasAttribute('loading')) {
            iframe.setAttribute('loading', 'lazy');
        }
        if (!iframe.hasAttribute('fetchpriority')) {
            iframe.setAttribute('fetchpriority', 'low');
        }

        const rect = iframe.getBoundingClientRect();
        const nearViewport = rect.top <= window.innerHeight * 1.1 && rect.bottom >= -140;

        if (!cfg.isSwup && nearViewport) {
            return;
        }

        deferEmbed(iframe);

        if (cfg.isSwup && nearViewport) {
            const timer = window.setTimeout(() => {
                activateEmbed(iframe);
            }, 340);
            revealTimers.push(timer);
        }
    });

    const needObserve = deferred.filter((iframe) => {
        const rect = iframe.getBoundingClientRect();
        return !(cfg.isSwup && rect.top <= window.innerHeight * 1.1 && rect.bottom >= -140);
    });

    if (needObserve.length && window.IntersectionObserver) {
        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                activateEmbed(entry.target);
            });
        }, {
            root: null,
            rootMargin: '360px 0px',
            threshold: 0
        });
        needObserve.forEach((iframe) => observer.observe(iframe));
    } else {
        needObserve.forEach((iframe) => activateEmbed(iframe));
    }

    return function cleanupEmbedOptimization() {
        revealTimers.forEach((timer) => {
            clearTimeout(timer);
        });
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        deferred.forEach((iframe) => {
            if (!iframe || !iframe.dataset) return;
            delete iframe.dataset.psDeferredSrc;
        });
    };
}

function runShortcodes(root, options) {
    const cfg = Object.assign(
        {
            deferHeavy: false,
            pageType: '',
            isSwup: false,
            deferDelay: 280,
            idleTimeout: 1200
        },
        options || {}
    );

    const scope = root && root.querySelector ? root : document;
    const swupRoot = document.getElementById('swup');
    const pageType = cfg.pageType || (swupRoot && swupRoot.dataset ? swupRoot.dataset.psPageType || '' : '');
    const isContentPage = pageType === 'post' || pageType === 'page';
    const hasCollapsible = Boolean(scope.querySelector('.collapsible-panel'));
    const hasTabs = Boolean(scope.querySelector('.tab-container'));
    const images = scope.querySelectorAll('[data-zoomable]');

    history.scrollRestoration = 'auto';
    handleGoTopButton(root);
    Comments_Submit();
    const embedCleanup = optimizeContentEmbeds(root, {
        pageType,
        isSwup: Boolean(cfg.isSwup)
    });

    const cleanupWidgets = function () {
        cleanupTabs(root);
        if (typeof embedCleanup === 'function') {
            embedCleanup();
        }
    };

    const initContentEnhance = function () {
        const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
        if (PS && !PS.zoom) {
            PS.zoom = mediumZoom({
                background: 'rgba(0, 0, 0, 0.85)',
                margin: 24
            });
        }
        if (PS && PS.zoom && images.length > 0) {
            PS.zoom.attach(images);
        }
    };

    const initTOCEnhance = function () {
        const hasTocSection = ensureRuntimeTocSection(scope, pageType);
        if (!hasTocSection) return;
        initializeTOC();
        initializeStickyTOC();
    };

    const initHeavyWidgets = function () {
        if (hasCollapsible) {
            bindCollapsiblePanels(root);
        }
        if (hasTabs) {
            bindTabs(root);
        }
    };

    if (!cfg.deferHeavy) {
        initTOCEnhance();
        initContentEnhance();
        initHeavyWidgets();
        return function cleanupShortcodesImmediate() {
            cleanupWidgets();
        };
    }

    const cancels = [];
    const tocDeferDelay = cfg.isSwup && isContentPage ? (cfg.deferDelay + 360) : cfg.deferDelay;
    cancels.push(
        runWhenIdle(initTOCEnhance, {
            timeout: Math.max(cfg.idleTimeout, 1800),
            delay: tocDeferDelay
        })
    );
    cancels.push(
        runWhenIdle(initContentEnhance, {
            timeout: cfg.idleTimeout,
            delay: cfg.deferDelay
        })
    );
    cancels.push(
        runWhenIdle(initHeavyWidgets, {
            timeout: Math.max(cfg.idleTimeout, 1500),
            delay: cfg.deferDelay + 420
        })
    );

    return function cleanupDeferredTasks() {
        cancels.forEach(function (cancel) {
            if (typeof cancel === 'function') cancel();
        });
        cleanupWidgets();
    };
}

document.addEventListener('DOMContentLoaded', function () {
    const root = document.getElementById('swup') || document;
    const pageType = root && root.dataset ? root.dataset.psPageType || '' : '';
    runShortcodes(root, {
        deferHeavy: pageType === 'post' || pageType === 'page',
        pageType,
        isSwup: false
    });
});

/**
 * 主题切换：控制浅色、深色和跟随系统。
 */

(function() {
    'use strict';

    function supportsViewTransition() {
        return typeof document.startViewTransition === 'function';
    }

    function prefersReducedMotion() {
        return typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function runThemeViewTransition(update) {
        if (!supportsViewTransition() || prefersReducedMotion()) {
            update();
            return;
        }

        const root = document.documentElement;
        root.classList.add('ps-theme-vt');

        let transition;
        try {
            transition = document.startViewTransition(() => {
                update();
            });
        } catch (e) {
            root.classList.remove('ps-theme-vt');
            update();
            return;
        }

        if (transition && transition.finished) {
            transition.finished.finally(() => {
                root.classList.remove('ps-theme-vt');
            });
        } else {
            setTimeout(() => {
                root.classList.remove('ps-theme-vt');
            }, 380);  // 与 VT 动画时长保持一致。
        }
    }

    /**
     * 获取根域名（用于跨子域 Cookie）。
     * @returns {string} 根域名，例如 .example.com
     */
    function getRootDomain() {
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length <= 2) return host; // localhost 或 example.com
        return '.' + parts.slice(-2).join('.');
    }

    /**
     * 写入跨子域 Cookie。
     * @param {string} theme - 主题值
     */
    function setThemeCookie(theme) {
        const rootDomain = getRootDomain();
        document.cookie = `theme=${theme}; path=/; domain=${rootDomain}; SameSite=Lax; max-age=31536000`;
    }

    /**
     * 读取 Cookie。
     * @param {string} name - Cookie 名
     * @returns {string|null} Cookie 值
     */
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    /**
     * 应用主题属性。
     * @param {string} themeValue - 主题值
     */
    function applyThemeAttribute(themeValue) {
        const root = document.documentElement;
        if (root.getAttribute('data-theme') === themeValue) {
            return;
        }
        root.setAttribute('data-theme', themeValue);
    }

    function getEffectiveTheme(theme) {
        if (theme === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return theme;
    }

    /**
     * 更新主题图标。
     * @param {string} theme - 主题值
     */
    function updateIcon(theme) {
        const iconElement = document.getElementById('theme-icon');
        if (!iconElement) return;

        iconElement.classList.remove('icon-sun-inv', 'icon-moon-inv', 'icon-auto');

        if (theme === 'light') {
            iconElement.classList.add('icon-sun-inv');
        } else if (theme === 'dark') {
            iconElement.classList.add('icon-moon-inv');
        } else {
            iconElement.classList.add('icon-auto');
        }
    }

    /**
     * 设置主题。
     * @param {string} theme - 主题值 ('light' | 'dark' | 'auto')
     */
    function applyTheme(theme) {
        if (theme === 'auto') {
            // 自动模式：跟随系统。
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            applyThemeAttribute(systemTheme);
            localStorage.setItem('theme', 'auto');
            setThemeCookie('auto');
        } else {
            // 固定浅色或深色。
            applyThemeAttribute(theme);
            localStorage.setItem('theme', theme);
            setThemeCookie(theme);
        }

        updateIcon(theme);
    }

    function setTheme(theme) {
        const root = document.documentElement;
        const currentApplied = root.getAttribute('data-theme');
        const nextApplied = getEffectiveTheme(theme);

        if (currentApplied === nextApplied) {
            applyTheme(theme);
            return;
        }

        runThemeViewTransition(() => {
            applyTheme(theme);
        });
    }

    /**
     * 切换主题。
     */
    function toggleTheme() {
        const currentTheme = localStorage.getItem('theme') || 'auto';
        let newTheme;

        if (currentTheme === 'light') {
            newTheme = 'dark';
            if (typeof MoxToast === 'function') {
                MoxToast({ message: '已切换至深色模式' });
            }
        } else if (currentTheme === 'dark') {
            newTheme = 'auto';
            if (typeof MoxToast === 'function') {
                MoxToast({ message: '模式将跟随系统' });
            }
        } else {
            newTheme = 'light';
            if (typeof MoxToast === 'function') {
                MoxToast({ message: '已切换至浅色模式' });
            }
        }

        setTheme(newTheme);
    }

    /**
     * 初始化主题系统。
     */
    function initTheme() {
        // 优先读取 Cookie（跨站点同步）。
        const cookieTheme = getCookie('theme');
        const savedTheme = cookieTheme || localStorage.getItem('theme') || 'auto';
        applyTheme(savedTheme);
    }

    /**
     * 监听系统主题变化。
     */
    function watchSystemTheme() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
            if (localStorage.getItem('theme') === 'auto') {
                const newTheme = e.matches ? 'dark' : 'light';
                applyThemeAttribute(newTheme);
                updateIcon('auto');
            }
        });
    }

    // 导出到 PS 命名空间，同时保留全局别名以兼容旧代码。
    const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
    if (PS && PS.theme) {
        PS.theme.set = setTheme;
        PS.theme.toggle = toggleTheme;
    }
    window.setTheme = setTheme;
    window.toggleTheme = toggleTheme;

    // 自动初始化。
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initTheme();
            watchSystemTheme();
        });
    } else {
        initTheme();
        watchSystemTheme();
    }
})();

/**
 * 导航指示器：根据当前页面高亮导航项。
 */
const NavIndicator = (() => {
    let indicator = null;
    let navContainer = null;
    let navItems = [];
    // 导航项位置缓存。
    let metricsCache = new Map();

    /**
     * 创建指示器元素。
     */
    function createIndicator() {
        const el = document.createElement('div');
        el.className = 'nav-indicator';
        return el;
    }

    /**
     * 批量缓存导航项位置（读操作）。
     */
    function cacheAllMetrics() {
        if (!navContainer) return;

        metricsCache.clear();
        const containerRect = navContainer.getBoundingClientRect();

        // 批量读取所有导航项位置。
        navItems.forEach(item => {
            const rect = item.getBoundingClientRect();
            metricsCache.set(item, {
                width: rect.width,
                height: rect.height,
                left: rect.left - containerRect.left,
                top: rect.top - containerRect.top
            });
        });
    }

    /**
     * 更新指示器位置和尺寸（写操作，使用缓存）。
     */
    function updateIndicator(targetItem) {
        if (!indicator || !targetItem) return;

        // 优先使用缓存。
        let metrics = metricsCache.get(targetItem);

        if (!metrics) {
            // 缓存未命中时回退实时读取并写回。
            const containerRect = navContainer.getBoundingClientRect();
            const itemRect = targetItem.getBoundingClientRect();
            metrics = {
                width: itemRect.width,
                height: itemRect.height,
                left: itemRect.left - containerRect.left,
                top: itemRect.top - containerRect.top
            };
            metricsCache.set(targetItem, metrics);
        }

        // 单次 RAF 即可，避免双 RAF 带来的额外延迟。
        requestAnimationFrame(() => {
            indicator.style.width = `${metrics.width}px`;
            indicator.style.height = `${metrics.height}px`;
            indicator.style.transform = `translate(${metrics.left}px, ${metrics.top}px) scale(1)`;
            indicator.classList.add('active');
        });
    }

    /**
     * 隐藏指示器。
     */
    function hideIndicator() {
        if (!indicator) return;
        indicator.classList.remove('active');
    }

    /**
     * 获取当前激活的导航项。
     */
    function getActiveNavItem() {
        const currentPath = window.location.pathname;

        for (const item of navItems) {
            const link = item.querySelector('a');
            if (link) {
                const linkPath = new URL(link.href).pathname;
                if (linkPath === currentPath) {
                    return item;
                }
            }
        }
        return null;
    }

    /**
     * 初始化导航指示器。
     */
    function init() {
        navContainer = document.querySelector('.header-nav');
        if (!navContainer) return;

        // 避免重复创建指示器。
        if (navContainer.querySelector('.nav-indicator')) {
            return;
        }

        // 创建并挂载指示器。
        indicator = createIndicator();
        navContainer.appendChild(indicator);

        // 获取所有导航项。
        navItems = Array.from(navContainer.querySelectorAll('.nav-item'));

        // 初始化时批量缓存位置。
        requestAnimationFrame(() => {
            cacheAllMetrics();

            // 设置初始位置。
            const activeItem = getActiveNavItem();
            if (activeItem) {
                updateIndicator(activeItem);
            }
        });

        // 监听窗口尺寸变化，200ms 防抖后重建缓存。
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                metricsCache.clear();  // 清空缓存。
                cacheAllMetrics();     // 重建缓存。
                const activeItem = getActiveNavItem();
                if (activeItem) {
                    updateIndicator(activeItem);
                }
            }, 200);
        });
    }

    /**
     * 更新指示器（供 Swup 切页后调用）。
     */
    function update() {
        if (!navContainer) {
            init();
            return;
        }

        // 重新获取导航项（Swup 可能替换导航内容）。
        navItems = Array.from(navContainer.querySelectorAll('.nav-item'));

        // Swup 切页后清空并重建缓存。
        metricsCache.clear();

        const activeItem = getActiveNavItem();
        if (activeItem) {
            requestAnimationFrame(() => {
                cacheAllMetrics();  // 重建缓存。
                updateIndicator(activeItem);
            });
        } else {
            hideIndicator();
        }
    }

    // 导出到 PS 命名空间，同时保留全局别名以兼容旧代码。
    const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
    const navApi = {
        init,
        update
    };
    if (PS && PS.nav) {
        PS.nav.init = init;
        PS.nav.update = update;
    }
    window.NavIndicator = navApi;

    // 自动初始化。
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
