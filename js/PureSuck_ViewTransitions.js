/**
 * PureSuck View Transitions Controller
 * 管理页面过渡动画，支持 View Transitions API 和 FLIP 降级
 */

class NavigationStack {
    constructor(maxSize = 20) {
        this.stack = [];
        this.currentIndex = -1;
        this.maxSize = maxSize;
    }
    
    push(pageInfo) {
        if (this.currentIndex < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.currentIndex + 1);
        }
        
        if (this.currentIndex >= 0 && this.currentIndex < this.stack.length) {
            this.stack[this.currentIndex].scrollY = window.scrollY || 0;
        }
        
        this.stack.push({
            url: pageInfo.url,
            type: pageInfo.type,
            timestamp: Date.now(),
            scrollY: pageInfo.scrollY || 0,
            metadata: pageInfo.metadata || {}
        });
        
        if (this.stack.length > this.maxSize) {
            this.stack.shift();
        } else {
            this.currentIndex++;
        }
    }
    
    pop() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return this.stack[this.currentIndex];
        }
        return null;
    }
    
    forward() {
        if (this.currentIndex < this.stack.length - 1) {
            this.currentIndex++;
            return this.stack[this.currentIndex];
        }
        return null;
    }
    
    getDirection(targetUrl) {
        if (this.currentIndex > 0) {
            const previousPage = this.stack[this.currentIndex - 1];
            if (previousPage?.url === targetUrl) return 'back';
        }
        
        if (this.currentIndex < this.stack.length - 1) {
            const nextPage = this.stack[this.currentIndex + 1];
            if (nextPage?.url === targetUrl) return 'forward';
        }
        
        return 'forward';
    }
    
    getCurrent() {
        return this.stack[this.currentIndex] || null;
    }
    
    getCurrentPage() {
        return this.getCurrent();
    }
    
    getPrevious() {
        return this.currentIndex > 0 ? this.stack[this.currentIndex - 1] : null;
    }
}

class PageTypeDetector {
    static #patterns = new Map([
        ['post', /\/(?:archives\/\d+|\d+)\.html/],
        ['archive', /\/(?:archives|category|tag)\//],
        ['page', /\/[a-zA-Z\-]+\.html$/],
        ['list', /^\/(?:page\/\d+)?$/]
    ]);
    
    static detectFromUrl(url) {
        try {
            const { pathname } = new URL(url);
            
            for (const [type, pattern] of this.#patterns) {
                if (pattern.test(pathname)) {
                    if (type === 'page' && /\/archives\//.test(pathname)) continue;
                    return type;
                }
            }
            
            return 'unknown';
        } catch (e) {
            console.error('URL 解析失败:', e);
            return 'unknown';
        }
    }
    
    static detectFromDOM() {
        if (document.querySelector('.post-content, article.post')) return 'post';
        if (document.querySelectorAll('.post').length > 1) return 'list';
        if (document.querySelector('.archive-title, .category-header')) return 'archive';
        return 'unknown';
    }
    
    static detect(url) {
        const urlType = this.detectFromUrl(url);
        return urlType !== 'unknown' ? urlType : this.detectFromDOM();
    }
}

class ViewTransitionController {
    constructor() {
        this.supportsVT = 'startViewTransition' in document;
        this.transitionData = null;
        this.currentDirection = 'forward';
        this.config = {
            duration: 450,
            reverseDuration: 400,
            timingFunction: 'cubic-bezier(.22, 1, .36, 1)',
            reverseTimingFunction: 'cubic-bezier(.33, 1, .68, 1)',
            scrollRevealDelay: 150
        };
        this.stats = {
            total: 0,
            vtSuccesses: 0,
            flipFallbacks: 0,
            reverseTransitions: 0,
            errors: 0
        };
        this.disabled = false;
        this.isTransitioning = false;
    }

    init() {
        if (this.disabled || this.shouldDisable()) {
            this.disabled = true;
            return;
        }
    }

    shouldDisable() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
        
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        return connection && (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g');
    }

    prepareTransition(clickedCard) {
        if (this.disabled) return;

        this.currentDirection = 'forward';
        const cardInner = clickedCard.querySelector('.post-inner');
        
        if (!cardInner) return;

        const transitionName = `card-${Date.now()}`;
        
        // 获取 .post 的实际位置（包含 margin）
        const postRect = clickedCard.getBoundingClientRect();
        const cardRect = cardInner.getBoundingClientRect();
        
        this.transitionData = {
            transitionName,
            oldCard: cardInner,
            oldCardParent: clickedCard,
            postRect,
            cardRect,
            direction: 'forward',
            startTime: performance.now()
        };

        cardInner.style.viewTransitionName = transitionName;
        cardInner.style.willChange = 'transform, opacity';
        document.documentElement.classList.add('vt-transitioning');
        this.isTransitioning = true;
    }

    prepareListTransition(direction = 'next') {
        const mainContent = document.querySelector('.site-main');
        if (mainContent) {
            mainContent.style.viewTransitionName = 'list-content';
            mainContent.style.willChange = 'transform, opacity';
            document.documentElement.classList.add(`transition-list-${direction}`);
            
            this.transitionData = {
                type: 'list',
                direction,
                transitionName: 'list-content'
            };
        }
    }

    prepareReverseTransition() {
        const mainContent = document.querySelector('.site-main');
        if (mainContent) {
            mainContent.style.viewTransitionName = 'main-content';
            mainContent.style.willChange = 'opacity';
        }
        
        document.documentElement.classList.add('transition-back');
        this.currentDirection = 'back';
        this.transitionData = {
            type: 'fade',
            direction: 'back'
        };
    }

    async executeTransition(updateCallback) {
        if (this.disabled) {
            await updateCallback();
            return Promise.resolve();
        }

        this.stats.total++;

        if (!this.supportsVT) {
            return this.executeFLIPAnimation(updateCallback);
        }

        return this.executeViewTransition(updateCallback);
    }

    async executeViewTransition(updateCallback) {
        return new Promise((resolve) => {
            window.scrollReveal?.pause();

            const transition = document.startViewTransition(async () => {
                await updateCallback();
                this.applyNewPageTransitions();
            });

            transition.finished.then(() => {
                this.stats.vtSuccesses++;
                this.cleanup();
                resolve();
            }).catch((error) => {
                this.stats.errors++;
                console.error('VT 失败:', error);
                this.cleanup();
                resolve();
            });
        });
    }

    async applyNewPageTransitions() {
        if (!this.transitionData) return;

        if (this.transitionData.direction === 'back') {
            const mainContent = document.querySelector('.site-main');
            if (mainContent) {
                mainContent.style.viewTransitionName = 'main-content';
                mainContent.style.willChange = 'opacity';
            }
            this.stats.reverseTransitions++;
            return;
        }
        
        const newCard = document.querySelector('.post-inner');
        if (newCard) {
            newCard.style.viewTransitionName = this.transitionData.transitionName;
            newCard.style.willChange = 'transform, opacity';
        }
    }

    executeFLIPAnimation(updateCallback) {
        this.stats.flipFallbacks++;

        if (!this.transitionData?.oldCard) {
            updateCallback();
            this.cleanup();
            return Promise.resolve();
        }

        const oldCard = this.transitionData.oldCard;
        const oldParent = this.transitionData.oldCardParent;
        
        // 使用保存的rect，如果没有则实时获取
        const first = this.transitionData.cardRect || oldCard.getBoundingClientRect();
        const firstScroll = window.scrollY;

        updateCallback();

        const newCard = document.querySelector('.post-inner');
        if (!newCard) {
            this.cleanup();
            return Promise.resolve();
        }

        const last = newCard.getBoundingClientRect();
        const lastScroll = window.scrollY;

        // 计算偏移时考虑父元素的margin
        // 使用 offsetTop 而不是 getBoundingClientRect 可以更准确地获取位置
        const deltaX = first.left - last.left;
        const deltaY = first.top - last.top + (firstScroll - lastScroll);
        const deltaW = first.width / last.width;
        const deltaH = first.height / last.height;

        newCard.style.transformOrigin = 'top left';
        newCard.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;

        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                newCard.style.transition = `transform ${this.config.duration}ms ${this.config.timingFunction}`;
                newCard.style.transform = 'none';

                setTimeout(() => {
                    newCard.style.transition = '';
                    newCard.style.transformOrigin = '';
                    this.cleanup();
                    resolve();
                }, this.config.duration);
            });
        });
    }

    cleanup() {
        setTimeout(() => {
            document.querySelectorAll('[style*="view-transition-name"]').forEach(el => {
                el.style.viewTransitionName = '';
                el.style.willChange = '';
            });

            document.documentElement.classList.remove(
                'vt-transitioning',
                'transition-back',
                'transition-fallback',
                'transition-list-next',
                'transition-list-prev'
            );
            this.isTransitioning = false;

            window.scrollReveal?.resume();

            if (this.transitionData) {
                this.transitionData = null;
            }
            
            this.currentDirection = 'forward';
        }, this.config.scrollRevealDelay);
    }

    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.total > 0 
                ? Math.round((this.stats.vtSuccesses / this.stats.total) * 100)
                : 0,
            supportsVT: this.supportsVT,
            disabled: this.disabled,
            isTransitioning: this.isTransitioning
        };
    }

    async triggerManualTransition(fromElement, toElement, updateCallback) {
        if (!fromElement || !toElement) return;

        const uniqueId = Date.now();
        this.transitionData = {
            uniqueId,
            names: { manual: `manual-${uniqueId}` },
            elements: { manual: fromElement },
            startTime: performance.now()
        };

        fromElement.style.viewTransitionName = `manual-${uniqueId}`;

        await this.executeTransition(async () => {
            await updateCallback();
            toElement.style.viewTransitionName = `manual-${uniqueId}`;
        });
    }

    destroy() {
        this.cleanup();
    }
}

if (typeof window !== 'undefined') {
    window.navigationStack = new NavigationStack();
    window.vtController = new ViewTransitionController();
    window.pageTypeDetector = PageTypeDetector;
    
    const initVT = () => {
        window.vtController.init();
        window.navigationStack.push({
            url: window.location.href,
            type: PageTypeDetector.detect(window.location.href),
            scrollY: window.scrollY
        });
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVT);
    } else {
        initVT();
    }
}