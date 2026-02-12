(function (window, document) {
    'use strict';

const TOC_VISIBLE_CLASS = 'is-visible';
const TOC_REVEAL_ENTER_CLASS = 'reveal-enter';
const TOC_REVEAL_LEAVE_CLASS = 'reveal-leave';
const TOC_REVEAL_TIMER_KEY = '__psTocRevealTimer';
const TOC_HIDE_TIMER_KEY = '__psTocHideTimer';
const TOC_HIDE_HANDLER_KEY = '__psTocHideHandler';
const TOC_SWAP_OUT_CLASS = 'toc-swap-out';
const TOC_SWAP_IN_CLASS = 'toc-swap-in';
const TOC_SWAP_TIMER_KEY = '__psTocSwapTimer';
const TOC_SWAP_HANDLER_KEY = '__psTocSwapHandler';
const TOC_SWAP_FALLBACK_MS = 260;
const TOC_OBSERVER_DELAY_MS = 260;

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

function prefersReducedMotionEnabled() {
    return Boolean(
        typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

function clearTocSwapTask(toc) {
    if (!toc) return;
    if (toc[TOC_SWAP_TIMER_KEY]) {
        clearTimeout(toc[TOC_SWAP_TIMER_KEY]);
        toc[TOC_SWAP_TIMER_KEY] = 0;
    }
    if (toc[TOC_SWAP_HANDLER_KEY]) {
        toc.removeEventListener('transitionend', toc[TOC_SWAP_HANDLER_KEY]);
        toc[TOC_SWAP_HANDLER_KEY] = null;
    }
    toc.classList.remove(TOC_SWAP_OUT_CLASS, TOC_SWAP_IN_CLASS);
}

function swapTocContent(toc, html, done) {
    const onDone = typeof done === 'function' ? done : function () { };
    if (!toc) {
        onDone();
        return;
    }

    clearTocSwapTask(toc);

    const hasExisting = toc.querySelector('.toc-a');
    if (!hasExisting || prefersReducedMotionEnabled()) {
        toc.innerHTML = html;
        onDone();
        return;
    }

    let finished = false;
    const finishSwapOut = function () {
        if (finished) return;
        finished = true;

        clearTocSwapTask(toc);
        toc.innerHTML = html;
        toc.classList.add(TOC_SWAP_IN_CLASS);

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                if (!toc || !toc.isConnected) {
                    onDone();
                    return;
                }
                toc.classList.remove(TOC_SWAP_IN_CLASS);
                onDone();
            });
        });
    };

    const onOutEnd = function (event) {
        if (!event || event.target !== toc) return;
        if (event.propertyName && event.propertyName !== 'opacity' && event.propertyName !== 'transform') return;
        finishSwapOut();
    };

    toc[TOC_SWAP_HANDLER_KEY] = onOutEnd;
    toc.addEventListener('transitionend', onOutEnd);
    toc.classList.add(TOC_SWAP_OUT_CLASS);
    toc[TOC_SWAP_TIMER_KEY] = window.setTimeout(finishSwapOut, TOC_SWAP_FALLBACK_MS);
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
    const toc = section.querySelector('.toc');
    if (toc) clearTocSwapTask(toc);
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
    const toc = section.querySelector('.toc');
    if (toc) clearTocSwapTask(toc);

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
        if (state.applyRaf) {
            window.cancelAnimationFrame(state.applyRaf);
            state.applyRaf = 0;
        }

        if (state.observer) {
            state.observer.disconnect();
        }
        if (state.observerStartTimer) {
            clearTimeout(state.observerStartTimer);
            state.observerStartTimer = 0;
        }
        if (state.observerIdleId) {
            if (typeof window.cancelIdleCallback === 'function') {
                window.cancelIdleCallback(state.observerIdleId);
            } else {
                clearTimeout(state.observerIdleId);
            }
            state.observerIdleId = 0;
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
        let nextIndicatorTop = 0;
        let shouldScroll = false;
        let nextScrollTop = 0;
        if (li) {
            nextIndicatorTop = li.offsetTop;
        }
        if (state.tocSection && li) {
            const viewTop = state.tocSection.scrollTop;
            const viewHeight = state.tocSection.clientHeight;
            const itemTop = li.offsetTop;
            const itemHeight = li.offsetHeight;
            const itemBottom = itemTop + itemHeight;
            const viewBottom = viewTop + viewHeight;
            if (itemTop < viewTop || itemBottom > viewBottom) {
                shouldScroll = true;
                nextScrollTop = Math.max(0, Math.round(itemTop - viewHeight / 2 + itemHeight / 2));
            }
        }

        if (state.applyRaf) {
            window.cancelAnimationFrame(state.applyRaf);
            state.applyRaf = 0;
        }
        state.applyRaf = window.requestAnimationFrame(() => {
            if (!state) return;
            if (state.indicator && li) {
                state.indicator.style.transform = `translateY(${nextIndicatorTop}px)`;
            }
            if (state.tocSection && shouldScroll) {
                state.tocSection.scrollTo({
                    top: nextScrollTop,
                    behavior: cfg.scrollBehavior
                });
            }
            state.applyRaf = 0;
        });
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

    function attachObserverWhenReady() {
        if (!state || !state.observer) return;

        const attach = function () {
            if (!state || !state.observer) return;
            state.headings.forEach((heading) => state.observer.observe(heading));
        };

        const runIdle = function () {
            if (!state) return;
            if (typeof window.requestIdleCallback === 'function') {
                state.observerIdleId = window.requestIdleCallback(() => {
                    if (!state) return;
                    state.observerIdleId = 0;
                    attach();
                }, { timeout: 1200 });
                return;
            }
            attach();
        };

        if (document.documentElement.classList.contains('ps-animating')) {
            state.observerStartTimer = window.setTimeout(() => {
                if (!state) return;
                state.observerStartTimer = 0;
                runIdle();
            }, TOC_OBSERVER_DELAY_MS);
            return;
        }

        runIdle();
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
            observer: null,
            applyRaf: 0,
            observerStartTimer: 0,
            observerIdleId: 0
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
        attachObserverWhenReady();

        requestAnimationFrame(() => {
            if (!state) return;
            if (window.location.hash) {
                const hashId = decodeURIComponent(window.location.hash.slice(1));
                const hashIndex = Object.prototype.hasOwnProperty.call(state.idToIndex, hashId)
                    ? state.idToIndex[hashId]
                    : -1;
                if (typeof hashIndex === 'number' && hashIndex >= 0) {
                    setActive(hashIndex);
                    return;
                }
            }
            setActive(0);
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

function ensureRuntimeTocSection(scope, pageType, onReady) {
    const done = typeof onReady === 'function' ? onReady : function () { };
    const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
    const tocEnabled = PS && PS.features
        ? Boolean(PS.features.showTOC)
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

    const finalizeReady = function () {
        showTocSection(tocSection);
        rightSidebar.classList.add('ps-has-toc');
        done(true);
    };

    if (shouldRebuild) {
        const nextHtml = buildTocHtml();
        tocSection.dataset.psTocSig = tocSignature;
        swapTocContent(toc, nextHtml, finalizeReady);
        return true;
    }

    finalizeReady();
    return true;
}

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

    window.PS_TOC = {
        initializeTOC,
        ensureRuntimeTocSection,
        initializeStickyTOC
    };
})(window, document);

