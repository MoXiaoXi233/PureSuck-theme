/** 杩欎釜JS鍖呭惈浜嗗悇绉嶉渶瑕佸鐞嗙殑鐨勫唴瀹?**/
/** 鍥炲埌椤堕儴鎸夐挳锛孴OC鐩綍锛屽唴閮ㄥ崱鐗囬儴鍒嗗唴瀹硅В鏋愰兘鍦ㄨ繖閲?**/

/**
 * TOC 鐩綍楂樹寒 - 绠€鍖栭噸鏋勭増
 * 鏍稿績鍘熷垯锛氱畝鍗曘€佺洿鎺ャ€佸揩閫熷搷搴?
 */
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
            if (tocSection) tocSection.style.display = 'none';
            return;
        }

        const headings = Array.from(content.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'));
        if (!headings.length) {
            if (tocSection) tocSection.style.display = 'none';
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

        if (tocSection) tocSection.style.display = 'block';
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
        if (tocSection) tocSection.style.display = 'none';
        return false;
    }

    if (pageType !== 'post' && pageType !== 'page') {
        if (tocSection) tocSection.style.display = 'none';
        return false;
    }

    const contentRoot = (scope && scope.querySelector ? scope : document).querySelector('.inner-post-wrapper');
    if (!contentRoot) {
        if (tocSection) tocSection.style.display = 'none';
        return false;
    }

    const headings = Array.from(contentRoot.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'));
    if (!headings.length) {
        if (tocSection) tocSection.style.display = 'none';
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
        tocSection.style.display = 'none';
        return false;
    }

    const existingLinks = toc.querySelectorAll('.toc-a').length;
    const shouldRebuild = tocSection.dataset.psTocSig !== tocSignature
        || existingLinks !== headings.length;

    if (shouldRebuild) {
        toc.innerHTML = buildTocHtml();
        tocSection.dataset.psTocSig = tocSignature;
    }

    tocSection.style.display = 'block';
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

    // 鉁?浣跨敤 IntersectionObserver 鏇夸唬婊氬姩鐩戝惉锛屾秷闄ゅ己鍒堕噸鎺?
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
        // sentinel 涓嶅彲瑙佹椂锛堟粴鍔ㄨ秴杩?100px锛夛紝鏄剧ず鎸夐挳
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

        // 鉁?姣忔鍒濆鍖栨椂閲嶆柊璁剧疆 observer锛堟敮鎸?Swup 椤甸潰鍒囨崲锛?
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

        // 鉁?棰勭紦瀛?scrollHeight锛岄伩鍏嶇偣鍑绘椂鍚屾璇诲彇褰卞搷 INP
        let cachedScrollHeight = 0;

        const updateCache = () => {
            cachedScrollHeight = contentDiv.scrollHeight;
        };

        // 浣跨敤 requestIdleCallback 棰勭紦瀛?
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(updateCache, { timeout: 500 });
        } else {
            setTimeout(updateCache, 100);
        }

        // 浣跨敤 ResizeObserver 鐩戝惉鍐呭鍙樺寲鏃舵洿鏂扮紦瀛?
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                // 鍙湪灞曞紑鐘舵€佷笅鏇存柊缂撳瓨
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
                // 鉁?浣跨敤缂撳瓨鍊硷紝濡傛灉缂撳瓨涓虹┖鍒欓檷绾ц鍙?
                const height = cachedScrollHeight || contentDiv.scrollHeight;
                contentDiv.style.maxHeight = height + "px";
                // 鏇存柊缂撳瓨浠ュ涓嬫浣跨敤
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
 * TOC Sticky 鎺у埗鍣?- 鎬ц兘浼樺寲鐗?
 */
const initializeStickyTOC = (() => {
    let state = {
        section: null,
        sidebar: null,
        threshold: 0,
        observer: null,
        sentinel: null,
        bound: false,
        resizeTimer: 0,  // 鉁?闃叉姈瀹氭椂鍣?
        heightCache: new WeakMap()  // 鉁?楂樺害缂撳瓨
    };

    // 鉁?鍚屾璁＄畻闃堝€硷紙浣跨敤缂撳瓨鍑忓皯閲嶆帓锛屼絾涓嶅欢杩燂級
    function updateThreshold() {
        if (!state.section || !state.sidebar) return;

        const children = Array.from(state.sidebar.children);
        let totalHeight = 0;

        children.forEach(el => {
            if (el === state.section) return;

            // 鉁?浼樺厛浣跨敤缂撳瓨鐨勯珮搴?
            let height = state.heightCache.get(el);
            if (height == null) {
                height = el.offsetHeight;
                state.heightCache.set(el, height);
            }
            totalHeight += height;
        });

        state.threshold = totalHeight + 50;
    }

    // 鉁?resize 鏃舵竻闄ょ紦瀛?
    function clearHeightCache() {
        state.heightCache = new WeakMap();
    }

    function handleIntersection(entries) {
        if (!state.section || entries.length === 0) return;

        const [entry] = entries;
        const shouldStick = !entry.isIntersecting;

        // 鉁?鐩存帴鍒囨崲锛屾棤闇€ RAF锛圛ntersectionObserver 宸茬粡鏄紓姝ョ殑锛?
        state.section.classList.toggle("sticky", shouldStick);
    }

    function createOrUpdateSentinel() {
        if (!state.section || !state.sidebar) return;

        if (state.observer) {
            state.observer.disconnect();
        }

        // 鉁?鍚屾璁＄畻闃堝€硷紙浣跨敤缂撳瓨锛屾棤寤惰繜锛?
        updateThreshold();

        if (!state.sentinel) {
            state.sentinel = document.createElement('div');
            state.sentinel.id = 'toc-sticky-sentinel';
            state.sentinel.style.cssText = 'position:absolute;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden';
            document.body.appendChild(state.sentinel);
        }

        state.sentinel.style.top = state.threshold + 'px';

        state.observer = new IntersectionObserver(handleIntersection, {
            root: null,
            threshold: 0,
            rootMargin: '0px'
        });
        state.observer.observe(state.sentinel);
    }

    function syncState() {
        if (!state.section) return;
        const shouldStick = window.scrollY >= state.threshold;
        state.section.classList.toggle("sticky", shouldStick);
    }

    // 鉁?闃叉姈鐨?resize 澶勭悊
    function handleResize() {
        if (state.resizeTimer) {
            clearTimeout(state.resizeTimer);
        }
        state.resizeTimer = setTimeout(() => {
            state.resizeTimer = 0;
            clearHeightCache();  // 鉁?resize 鏃舵竻闄ょ紦瀛?
            createOrUpdateSentinel();
            syncState();
        }, 150);  // 150ms 闃叉姈
    }

    return function initializeStickyTOC() {
        const tocSection = document.getElementById("toc-section");
        const rightSidebar = document.querySelector(".right-sidebar");
        if (!tocSection || !rightSidebar) return;

        state.section = tocSection;
        state.sidebar = rightSidebar;

        // 鉁?PJAX 鍒囨崲鏃跺彧鏇存柊蹇呰鐨勯儴鍒?
        if (state.bound) {
            createOrUpdateSentinel();
            syncState();
            // 鉁?鍙湪 hash 璺宠浆鏃跺欢杩熸鏌?
            if (window.location.hash) {
                setTimeout(syncState, 100);
            }
            return;
        }

        state.bound = true;

        createOrUpdateSentinel();
        syncState();

        window.addEventListener('load', () => {
            syncState();
            if (window.location.hash) {
                setTimeout(syncState, 100);
            }
        }, { once: true });

        window.addEventListener('hashchange', () => {
            setTimeout(syncState, 100);
        }, { passive: true });

        window.addEventListener("resize", handleResize, { passive: true });
        window.addEventListener("orientationchange", handleResize, { passive: true });
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

    // 闃叉 PJAX 閲嶅缁戝畾
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

    // 鍙洃鍚?submit锛堝叧閿級
    form.addEventListener("submit", function (e) {
        // 闃叉閲嶅鎻愪氦
        if (form.dataset.psSubmitting === "1") {
            e.preventDefault();
            return;
        }

        // 鍐呭涓虹┖锛屼氦缁欐祻瑙堝櫒 / Typecho 鎻愮ず
        if (textarea.value.trim() === "") {
            return;
        }

        form.dataset.psSubmitting = "1";

        submitButton.disabled = true;
        submitButton.textContent = "提交中...";
    });

    // HTML5 鏍￠獙澶辫触鏃舵仮澶?
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

function optimizeContentImages(root, options) {
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
        return function noopImageCleanup() {};
    }

    const contentScope = scope.querySelector('.inner-post-wrapper') || scope;
    const allImages = Array.from(contentScope.querySelectorAll('img'));
    if (!allImages.length) {
        return function noopImageCleanup() {};
    }

    const candidates = [];
    allImages.forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        if (img.closest('.friendsboard-item, .github-card, .ps-post-card, .avatar')) return;
        if (img.classList.contains('no-zoom')) return;
        candidates.push(img);
    });

    if (!candidates.length) {
        return function noopImageCleanup() {};
    }

    const first = candidates[0];
    candidates.forEach((img, index) => {
        const isFirst = index === 0;

        if (!img.hasAttribute('decoding')) {
            img.setAttribute('decoding', 'async');
        }
        if (!img.hasAttribute('loading')) {
            img.setAttribute('loading', isFirst ? 'eager' : 'lazy');
        }
        if (!img.hasAttribute('fetchpriority')) {
            img.setAttribute('fetchpriority', isFirst ? 'auto' : 'low');
        }
    });

    const cover = scope.querySelector('.post-media img');
    if (cover instanceof HTMLImageElement) {
        if (!cover.hasAttribute('decoding')) {
            cover.setAttribute('decoding', 'async');
        }
        if (!cover.hasAttribute('fetchpriority') || cfg.isSwup) {
            cover.setAttribute('fetchpriority', 'auto');
        }
    }

    const decodeTargets = candidates.filter((img, index) => {
        if (cfg.isSwup) {
            if (index > 0) return false;
        } else if (index > 2) {
            return false;
        }
        if (img.complete) return false;
        const rect = img.getBoundingClientRect();
        return rect.top < window.innerHeight * 1.25 && rect.bottom > -120;
    });

    if (!decodeTargets.length) {
        return function noopImageCleanup() {};
    }

    const cancelDecode = runWhenIdle(() => {
        decodeTargets.forEach((img) => {
            if (!(img instanceof HTMLImageElement)) return;
            if (typeof img.decode !== 'function') return;
            img.decode().catch(() => {});
        });
    }, {
        timeout: cfg.isSwup ? 2000 : 1400,
        delay: cfg.isSwup ? 820 : 60
    });

    return function cleanupImageOptimization() {
        if (typeof cancelDecode === 'function') {
            cancelDecode();
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
    const imageCleanup = optimizeContentImages(root, {
        pageType,
        isSwup: Boolean(cfg.isSwup)
    });
    const embedCleanup = optimizeContentEmbeds(root, {
        pageType,
        isSwup: Boolean(cfg.isSwup)
    });

    const cleanupWidgets = function () {
        cleanupTabs(root);
        if (typeof imageCleanup === 'function') {
            imageCleanup();
        }
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
        if (!cfg.isSwup) {
            initializeStickyTOC();
            return;
        }

        let started = false;
        let fallbackTimer = 0;
        const startSticky = function () {
            if (started) return;
            started = true;
            window.removeEventListener('scroll', startSticky, listenerOptions);
            window.removeEventListener('wheel', startSticky, listenerOptions);
            window.removeEventListener('touchstart', startSticky, listenerOptions);
            if (fallbackTimer) {
                clearTimeout(fallbackTimer);
                fallbackTimer = 0;
            }
            initializeStickyTOC();
        };
        const listenerOptions = { passive: true, once: true };
        window.addEventListener('scroll', startSticky, listenerOptions);
        window.addEventListener('wheel', startSticky, listenerOptions);
        window.addEventListener('touchstart', startSticky, listenerOptions);
        fallbackTimer = window.setTimeout(startSticky, 1200);
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
 * 涓婚鍒囨崲 - 鎺у埗娣辫壊銆佹祬鑹叉ā寮忥紝甯︿釜璺ㄥ煙鑱斿姩
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
            }, 380);  // 涓?VT 鍔ㄧ敾鏃堕暱淇濇寔涓€鑷?
        }
    }

    /**
     * 鑾峰彇鏍瑰煙鍚嶏紙鐢ㄤ簬璺ㄥ瓙鍩?Cookie锛?
     * @returns {string} 鏍瑰煙鍚嶏紝濡?.xxx.cn
     */
    function getRootDomain() {
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length <= 2) return host; // localhost 鎴?xxx.com
        return '.' + parts.slice(-2).join('.');
    }

    /**
     * 鍐欏叆璺ㄥ瓙鍩?Cookie
     * @param {string} theme - 涓婚鍊?
     */
    function setThemeCookie(theme) {
        const rootDomain = getRootDomain();
        document.cookie = `theme=${theme}; path=/; domain=${rootDomain}; SameSite=Lax; max-age=31536000`;
    }

    /**
     * 璇诲彇 Cookie
     * @param {string} name - Cookie 鍚嶇О
     * @returns {string|null} Cookie 鍊?
     */
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    /**
     * 搴旂敤涓婚灞炴€?
     * @param {string} themeValue - 涓婚鍊?
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
     * 鏇存柊涓婚鍥炬爣
     * @param {string} theme - 涓婚鍊?
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
     * 璁剧疆涓婚
     * @param {string} theme - 涓婚鍊?('light' | 'dark' | 'auto')
     */
    function applyTheme(theme) {
        if (theme === 'auto') {
            // 鑷姩妯″紡锛氳窡闅忕郴缁?
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            applyThemeAttribute(systemTheme);
            localStorage.setItem('theme', 'auto');
            setThemeCookie('auto');
        } else {
            // 鏄庢殫妯″紡
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
     * 鍒囨崲涓婚
     */
    function toggleTheme() {
        const currentTheme = localStorage.getItem('theme') || 'auto';
        let newTheme;

        if (currentTheme === 'light') {
            newTheme = 'dark';
            if (typeof MoxToast === 'function') {
                MoxToast({ message: '宸插垏鎹㈣嚦娣辫壊妯″紡' });
            }
        } else if (currentTheme === 'dark') {
            newTheme = 'auto';
            if (typeof MoxToast === 'function') {
                MoxToast({ message: '模式将跟随系统' });
            }
        } else {
            newTheme = 'light';
            if (typeof MoxToast === 'function') {
                MoxToast({ message: '宸插垏鎹㈣嚦娴呰壊妯″紡' });
            }
        }

        setTheme(newTheme);
    }

    /**
     * 鍒濆鍖栦富棰樼郴缁?
     */
    function initTheme() {
        // 浼樺厛璇诲彇 Cookie锛堣法绔欏悓姝ワ級
        const cookieTheme = getCookie('theme');
        const savedTheme = cookieTheme || localStorage.getItem('theme') || 'auto';
        applyTheme(savedTheme);
    }

    /**
     * 鐩戝惉绯荤粺涓婚鍙樺寲
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

    // 瀵煎嚭鍒?PS 鍛藉悕绌洪棿锛堜繚鐣欏叏灞€鍒悕鐢ㄤ簬鍏煎锛?    const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
    if (PS && PS.theme) {
        PS.theme.set = setTheme;
        PS.theme.toggle = toggleTheme;
    }
    window.setTheme = setTheme;
    window.toggleTheme = toggleTheme;

    // 鍒濆鍖?
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
 * 瀵艰埅鎸囩ず鍣?- 鍔ㄦ€佹帶鍒跺鑸珮浜?
 */
const NavIndicator = (() => {
    let indicator = null;
    let navContainer = null;
    let navItems = [];
    // 鉁?娣诲姞浣嶇疆缂撳瓨
    let metricsCache = new Map();

    /**
     * 鍒涘缓鎸囩ず鍣ㄥ厓绱?
     */
    function createIndicator() {
        const el = document.createElement('div');
        el.className = 'nav-indicator';
        return el;
    }

    /**
     * 鉁?鎵归噺缂撳瓨鎵€鏈夊鑸」浣嶇疆锛堣鎿嶄綔锛?
     */
    function cacheAllMetrics() {
        if (!navContainer) return;

        metricsCache.clear();
        const containerRect = navContainer.getBoundingClientRect();

        // 鎵归噺璇诲彇鎵€鏈夊鑸」鐨勪綅缃?
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
     * 鏇存柊鎸囩ず鍣ㄤ綅缃拰澶у皬锛堝啓鎿嶄綔锛屼娇鐢ㄧ紦瀛橈級
     */
    function updateIndicator(targetItem) {
        if (!indicator || !targetItem) return;

        // 浼樺厛浣跨敤缂撳瓨
        let metrics = metricsCache.get(targetItem);

        if (!metrics) {
            // 缂撳瓨鏈懡涓紝闄嶇骇璇诲彇骞剁紦瀛?
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

        // 鍗曟 RAF 瓒冲锛堝弻閲?RAF 浼氬鑷?2 甯у欢杩燂級
        requestAnimationFrame(() => {
            indicator.style.width = `${metrics.width}px`;
            indicator.style.height = `${metrics.height}px`;
            indicator.style.transform = `translate(${metrics.left}px, ${metrics.top}px) scale(1)`;
            indicator.classList.add('active');
        });
    }

    /**
     * 闅愯棌鎸囩ず鍣?
     */
    function hideIndicator() {
        if (!indicator) return;
        indicator.classList.remove('active');
    }

    /**
     * 鑾峰彇褰撳墠婵€娲荤殑瀵艰埅椤?
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
     * 鍒濆鍖栧鑸寚绀哄櫒
     */
    function init() {
        navContainer = document.querySelector('.header-nav');
        if (!navContainer) return;

        // 妫€鏌ユ槸鍚﹀凡瀛樺湪鎸囩ず鍣?
        if (navContainer.querySelector('.nav-indicator')) {
            return;
        }

        // 鍒涘缓骞舵坊鍔犳寚绀哄櫒
        indicator = createIndicator();
        navContainer.appendChild(indicator);

        // 鑾峰彇鎵€鏈夊鑸」
        navItems = Array.from(navContainer.querySelectorAll('.nav-item'));

        // 鉁?鍒濆鍖栨椂鎵归噺缂撳瓨鎵€鏈変綅缃?
        requestAnimationFrame(() => {
            cacheAllMetrics();

            // 鍒濆瀹氫綅
            const activeItem = getActiveNavItem();
            if (activeItem) {
                updateIndicator(activeItem);
            }
        });

        // 鉁?鐩戝惉绐楀彛澶у皬鍙樺寲 - 浣跨敤 200ms 闃叉姈锛宺esize 鏃舵竻闄ゅ苟閲嶅缓缂撳瓨
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                metricsCache.clear();  // 鉁?娓呴櫎缂撳瓨
                cacheAllMetrics();     // 鉁?閲嶅缓缂撳瓨
                const activeItem = getActiveNavItem();
                if (activeItem) {
                    updateIndicator(activeItem);
                }
            }, 200);
        });
    }

    /**
     * 鏇存柊鎸囩ず鍣紙渚?Swup 璋冪敤锛?
     */
    function update() {
        if (!navContainer) {
            init();
            return;
        }

        // 閲嶆柊鑾峰彇瀵艰埅椤癸紙Swup 鍙兘浼氭浛鎹㈠唴瀹癸級
        navItems = Array.from(navContainer.querySelectorAll('.nav-item'));

        // 鉁?Swup 鍒囨崲鍚庢竻闄ゅ苟閲嶅缓缂撳瓨
        metricsCache.clear();

        const activeItem = getActiveNavItem();
        if (activeItem) {
            requestAnimationFrame(() => {
                cacheAllMetrics();  // 鉁?閲嶅缓缂撳瓨
                updateIndicator(activeItem);
            });
        } else {
            hideIndicator();
        }
    }

    // 瀵煎嚭鍒?PS 鍛藉悕绌洪棿锛堜繚鐣欏叏灞€鍒悕鐢ㄤ簬鍏煎锛?    const PS = window.PS && typeof window.PS === 'object' ? window.PS : null;
    const navApi = {
        init,
        update
    };
    if (PS && PS.nav) {
        PS.nav.init = init;
        PS.nav.update = update;
    }
    window.NavIndicator = navApi;

    // 鑷姩鍒濆鍖?
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
