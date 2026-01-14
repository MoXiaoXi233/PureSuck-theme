/**
 * PureSuck ProgressiveRenderer - 渐进式渲染器
 * 三阶段渐进加载策略，基于设备性能自适应，优化DOM查询
 * 
 * @module rendering/ProgressiveRenderer
 */

import { eventBus } from '../core/EventBus.js';
import { visibilityManager } from './VisibilityManager.js';
import { domScheduler } from './DOMScheduler.js';
import { ErrorBoundary, ErrorType, ErrorSeverity } from '../core/ErrorBoundary.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

/**
 * 渲染阶段枚举
 * @readonly
 * @enum {string}
 */
export const RenderPhase = {
    /** Phase 1: 关键内容，立即渲染 */
    PHASE_1: 'phase_1',
    /** Phase 2: 次要内容，延迟16-32ms */
    PHASE_2: 'phase_2',
    /** Phase 3: 延迟内容，延迟100ms+ */
    PHASE_3: 'phase_3'
};

/**
 * 渲染状态枚举
 * @readonly
 * @enum {string}
 */
export const RenderState = {
    /** 空闲 */
    IDLE: 'idle',
    /** 渲染中 */
    RENDERING: 'rendering',
    /** 已暂停 */
    PAUSED: 'paused',
    /** 已取消 */
    CANCELLED: 'cancelled'
};

/**
 * 渲染配置
 * @typedef {Object} RenderOptions
 * @property {number} [chunkSize] - 每批渲染的元素数量
 * @property {number} [chunkDelay] - 批次间延迟(ms)
 * @property {string} [priority] - 优先级: high, normal, low
 * @property {Function} [onProgress] - 进度回调
 * @property {Function} [onComplete] - 完成回调
 * @property {Function} [onPhase] - 阶段回调
 * @property {boolean} [usePhases=true] - 是否使用三阶段策略
 * @property {boolean} [adaptive=true] - 是否启用性能自适应
 */

/**
 * 渲染任务
 * @typedef {Object} RenderTask
 * @property {string} id - 任务ID
 * @property {Element[]} elements - 元素数组
 * @property {RenderOptions} options - 渲染选项
 * @property {RenderState} state - 渲染状态
 * @property {number} currentIndex - 当前索引
 * @property {number} total - 总数
 * @property {number} startTime - 开始时间
 * @property {RenderPhase} currentPhase - 当前阶段
 * @property {Map<RenderPhase, Element[]>} phaseElements - 各阶段元素
 */

/**
 * 渐进式渲染器类
 */
export class ProgressiveRenderer {
    constructor() {
        /** @type {RenderState} - 渲染状态 */
        this.state = RenderState.IDLE;
        
        /** @type {string|null} - 当前渲染ID */
        this.currentRenderId = null;
        
        /** @type {RenderTask|null} - 当前渲染任务 */
        this.currentTask = null;
        
        /** @type {number} - RAF ID */
        this.rafId = null;
        
        /** @type {number} - 超时ID */
        this.timeoutId = null;
        
        /** @type {WeakMap<Element, Object>} - DOM缓存 */
        this.domCache = new WeakMap();
        
        /** @type {Map<string, Element[]>} - 选择器缓存 */
        this.selectorCache = new Map();
        
        /** @type {number} - 缓存过期时间(ms) */
        this.cacheExpiry = 5000;
        
        /** @type {boolean} - 是否启用缓存 */
        this.cacheEnabled = true;
        
        /** @type {Object} - 性能自适应配置 */
        this.performanceConfig = {
            high: {
                chunkSize: 8,
                phase1Delay: 0,
                phase2Delay: 16,
                phase3Delay: 100
            },
            medium: {
                chunkSize: 5,
                phase1Delay: 0,
                phase2Delay: 32,
                phase3Delay: 150
            },
            low: {
                chunkSize: 3,
                phase1Delay: 0,
                phase2Delay: 48,
                phase3Delay: 200
            }
        };
        
        this.setupPerformanceListener();
    }

    /**
     * 设置性能监听器
     */
    setupPerformanceListener() {
        // FPS监控已移除，不再需要动态调整渲染参数
        // 默认使用高性能配置
        console.log('[ProgressiveRenderer] Using high performance configuration');
    }

    /**
     * 获取当前性能配置
     * @returns {Object} 性能配置
     */
    getPerformanceConfig() {
        // 默认使用高性能配置
        return this.performanceConfig.high;
    }

    /**
     * 渐进式渲染元素
     * @param {Element[]|NodeList} elements - 要渲染的元素
     * @param {RenderOptions} options - 配置选项
     * @returns {string|null} 渲染ID
     */
    render(elements, options = {}) {
        const {
            chunkSize,
            chunkDelay,
            priority = 'normal',
            onProgress,
            onComplete,
            onPhase,
            usePhases = true,
            adaptive = true
        } = options;

        // 转换为数组
        const elementArray = Array.from(elements || []);
        
        if (elementArray.length === 0) {
            console.warn('[ProgressiveRenderer] No elements to render');
            return null;
        }

        // 取消当前渲染
        if (this.state !== RenderState.IDLE) {
            this.cancel();
        }

        // 创建渲染任务
        const renderId = `render-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const config = adaptive ? this.getPerformanceConfig() : {};
        
        const task = {
            id: renderId,
            elements: elementArray,
            options: {
                chunkSize: chunkSize || config.chunkSize || 5,
                chunkDelay: chunkDelay || config.phase2Delay || 16,
                priority,
                onProgress,
                onComplete,
                onPhase,
                usePhases,
                adaptive
            },
            state: RenderState.RENDERING,
            currentIndex: 0,
            total: elementArray.length,
            startTime: Date.now(),
            currentPhase: RenderPhase.PHASE_1,
            phaseElements: new Map()
        };

        // 分配元素到各阶段
        if (usePhases) {
            this.assignElementsToPhases(task);
        } else {
            // 不使用阶段，全部作为Phase 1
            task.phaseElements.set(RenderPhase.PHASE_1, elementArray);
        }

        this.currentRenderId = renderId;
        this.currentTask = task;
        this.state = RenderState.RENDERING;

        console.log(
            `[ProgressiveRenderer] Starting render: ${renderId}, ` +
            `${elementArray.length} elements, chunkSize: ${task.options.chunkSize}, ` +
            `usePhases: ${usePhases}`
        );

        // 发布开始事件
        eventBus.emit('render:start', {
            id: renderId,
            total: elementArray.length,
            chunkSize: task.options.chunkSize,
            usePhases
        });

        // 开始渲染
        this.startRenderPhase(task);

        return renderId;
    }

    /**
     * 分配元素到各阶段
     * @param {RenderTask} task - 渲染任务
     */
    assignElementsToPhases(task) {
        const { elements } = task;
        const phase1 = [];
        const phase2 = [];
        const phase3 = [];

        elements.forEach((el, index) => {
            // 前20%为Phase 1（关键内容）
            if (index < Math.ceil(elements.length * 0.2)) {
                phase1.push(el);
            }
            // 中间50%为Phase 2（次要内容）
            else if (index < Math.ceil(elements.length * 0.7)) {
                phase2.push(el);
            }
            // 后30%为Phase 3（延迟内容）
            else {
                phase3.push(el);
            }
        });

        task.phaseElements.set(RenderPhase.PHASE_1, phase1);
        task.phaseElements.set(RenderPhase.PHASE_2, phase2);
        task.phaseElements.set(RenderPhase.PHASE_3, phase3);

        console.log(
            `[ProgressiveRenderer] Phase distribution: ` +
            `Phase 1: ${phase1.length}, Phase 2: ${phase2.length}, Phase 3: ${phase3.length}`
        );
    }

    /**
     * 开始渲染阶段
     * @param {RenderTask} task - 渲染任务
     */
    startRenderPhase(task) {
        const config = task.options.adaptive ? this.getPerformanceConfig() : {};
        const phaseElements = task.phaseElements.get(task.currentPhase);

        if (!phaseElements || phaseElements.length === 0) {
            // 当前阶段没有元素，进入下一阶段
            this.nextPhase(task);
            return;
        }

        // 触发阶段回调
        if (typeof task.options.onPhase === 'function') {
            try {
                task.options.onPhase({
                    phase: task.currentPhase,
                    count: phaseElements.length
                });
            } catch (error) {
                console.error('[ProgressiveRenderer] Error in onPhase callback:', error);
            }
        }

        // 发布阶段事件
        eventBus.emit('render:phase', {
            id: task.id,
            phase: task.currentPhase,
            count: phaseElements.length
        });

        // 计算阶段延迟
        let delay = 0;
        if (task.currentPhase === RenderPhase.PHASE_2) {
            delay = config.phase2Delay || task.options.chunkDelay || 16;
        } else if (task.currentPhase === RenderPhase.PHASE_3) {
            delay = config.phase3Delay || 100;
        }

        // 开始渲染
        if (delay > 0) {
            this.timeoutId = setTimeout(() => {
                this.renderPhaseElements(task, phaseElements);
            }, delay);
        } else {
            this.renderPhaseElements(task, phaseElements);
        }
    }

    /**
     * 渲染阶段元素
     * @param {RenderTask} task - 渲染任务
     * @param {Element[]} elements - 元素数组
     */
    renderPhaseElements(task, elements) {
        const { chunkSize } = task.options;
        let index = 0;

        const renderChunk = () => {
            // 检查是否被取消
            if (this.state === RenderState.CANCELLED) {
                console.log(`[ProgressiveRenderer] Render cancelled: ${task.id}`);
                return;
            }

            // 检查是否被暂停
            if (this.state === RenderState.PAUSED) {
                console.log(`[ProgressiveRenderer] Render paused: ${task.id}`);
                return;
            }

            const chunk = elements.slice(index, index + chunkSize);
            
            if (chunk.length === 0) {
                // 阶段渲染完成
                this.nextPhase(task);
                return;
            }

            try {
                // 渲染块
                this.renderChunk(chunk, task);
            } catch (error) {
                ErrorBoundary.handle(error, {
                    type: ErrorType.RENDERING,
                    severity: ErrorSeverity.MEDIUM,
                    message: '渲染块失败',
                    metadata: { taskId: task.id, phase: task.currentPhase }
                });
            }

            // 更新进度
            index += chunk.length;
            task.currentIndex += chunk.length;

            this.updateProgress(task);

            // 继续下一批
            if (index < elements.length) {
                this.rafId = requestAnimationFrame(renderChunk);
            } else {
                // 阶段完成，进入下一阶段
                this.nextPhase(task);
            }
        };

        // 开始渲染
        this.rafId = requestAnimationFrame(renderChunk);
    }

    /**
     * 渲染块
     * @param {Element[]} chunk - 元素块
     * @param {RenderTask} task - 渲染任务
     */
    renderChunk(chunk, task) {
        // 预设初始状态
        chunk.forEach((el) => {
            el.style.opacity = '0';
            el.style.transform = 'translate3d(0, 20px, 0)';
            el.style.transition = 'none';
        });

        // 强制重绘
        void document.documentElement.offsetHeight;

        // 显示元素
        chunk.forEach((el) => {
            el.style.opacity = '1';
            el.style.transform = 'translate3d(0, 0, 0)';
            el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        });

        // 清理transition
        setTimeout(() => {
            chunk.forEach((el) => {
                el.style.transition = '';
            });
        }, 300);
    }

    /**
     * 进入下一阶段
     * @param {RenderTask} task - 渲染任务
     */
    nextPhase(task) {
        // 检查是否所有阶段都完成
        if (task.currentPhase === RenderPhase.PHASE_3) {
            this.completeRender(task);
            return;
        }

        // 进入下一阶段
        if (task.currentPhase === RenderPhase.PHASE_1) {
            task.currentPhase = RenderPhase.PHASE_2;
        } else if (task.currentPhase === RenderPhase.PHASE_2) {
            task.currentPhase = RenderPhase.PHASE_3;
        }

        // 开始渲染下一阶段
        this.startRenderPhase(task);
    }

    /**
     * 完成渲染
     * @param {RenderTask} task - 渲染任务
     */
    completeRender(task) {
        this.state = RenderState.IDLE;
        this.currentRenderId = null;
        this.currentTask = null;

        const duration = Date.now() - task.startTime;

        console.log(
            `[ProgressiveRenderer] Render completed: ${task.id}, ` +
            `duration: ${duration}ms`
        );

        // 触发完成回调
        if (typeof task.options.onComplete === 'function') {
            try {
                task.options.onComplete({
                    total: task.total,
                    rendered: task.currentIndex,
                    duration
                });
            } catch (error) {
                console.error('[ProgressiveRenderer] Error in onComplete callback:', error);
            }
        }

        // 发布完成事件
        eventBus.emit('render:complete', {
            id: task.id,
            total: task.total,
            rendered: task.currentIndex,
            duration
        });
    }

    /**
     * 更新进度
     * @param {RenderTask} task - 渲染任务
     */
    updateProgress(task) {
        const progress = (task.currentIndex / task.total) * 100;

        // 触发进度回调
        if (typeof task.options.onProgress === 'function') {
            try {
                task.options.onProgress({
                    rendered: task.currentIndex,
                    total: task.total,
                    progress
                });
            } catch (error) {
                console.error('[ProgressiveRenderer] Error in onProgress callback:', error);
            }
        }

        // 发布进度事件
        eventBus.emit('render:progress', {
            id: task.id,
            rendered: task.currentIndex,
            total: task.total,
            progress
        });
    }

    /**
     * 渐进式显示可见元素
     * @param {Element[]|NodeList} elements - 要显示的元素
     * @param {RenderOptions} options - 配置选项
     * @returns {string|null} 渲染ID
     */
    renderVisible(elements, options = {}) {
        const elementArray = Array.from(elements || []);
        
        if (elementArray.length === 0) return null;

        // 使用缓存查询可见元素
        const visibleElements = [];
        const hiddenElements = [];

        elementArray.forEach((el) => {
            if (this.isElementVisible(el)) {
                visibleElements.push(el);
            } else {
                hiddenElements.push(el);
            }
        });

        console.log(
            `[ProgressiveRenderer] Visible: ${visibleElements.length}, ` +
            `Hidden: ${hiddenElements.length}`
        );

        // 先渲染可见元素
        return this.render(visibleElements, {
            ...options,
            onComplete: (result) => {
                // 可见元素渲染完成后，观察隐藏元素
                hiddenElements.forEach((el) => {
                    visibilityManager.observeOnce(el, () => {
                        el.style.opacity = '1';
                        el.style.transform = 'translate3d(0, 0, 0)';
                    });
                });

                if (typeof options.onComplete === 'function') {
                    options.onComplete(result);
                }
            }
        });
    }

    /**
     * 优先级队列渲染
     * @param {Array} queue - 渲染队列: [{ elements, priority }]
     * @param {RenderOptions} options - 配置选项
     */
    renderQueue(queue, options = {}) {
        if (!Array.isArray(queue) || queue.length === 0) {
            console.warn('[ProgressiveRenderer] Invalid render queue');
            return;
        }

        // 按优先级排序
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        queue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        let index = 0;

        const renderNext = () => {
            if (index >= queue.length) return;

            const item = queue[index];
            index++;

            this.render(item.elements, {
                ...options,
                priority: item.priority,
                onComplete: () => {
                    renderNext();
                }
            });
        };

        renderNext();
    }

    /**
     * 检查元素是否可见（使用缓存）
     * @param {Element} element - 元素
     * @returns {boolean} 是否可见
     */
    isElementVisible(element) {
        // 检查缓存
        if (this.cacheEnabled) {
            const cached = this.domCache.get(element);
            if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.visible;
            }
        }

        // 计算可见性
        const rect = element.getBoundingClientRect();
        const visible = (
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
        );

        // 更新缓存
        if (this.cacheEnabled) {
            this.domCache.set(element, {
                visible,
                timestamp: Date.now()
            });
        }

        return visible;
    }

    /**
     * 查询元素（使用缓存）
     * @param {string} selector - 选择器
     * @param {Element} [context=document] - 上下文元素
     * @returns {Element[]} 元素数组
     */
    queryElements(selector, context = document) {
        const cacheKey = `${selector}-${context === document ? 'doc' : 'ctx'}`;
        
        // 检查缓存
        if (this.cacheEnabled) {
            const cached = this.selectorCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.elements;
            }
        }

        // 查询元素
        const elements = Array.from(context.querySelectorAll(selector));

        // 更新缓存
        if (this.cacheEnabled) {
            this.selectorCache.set(cacheKey, {
                elements,
                timestamp: Date.now()
            });
        }

        return elements;
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.domCache = new WeakMap();
        this.selectorCache.clear();
        console.log('[ProgressiveRenderer] Cache cleared');
    }

    /**
     * 取消当前渲染
     */
    cancel() {
        if (this.state === RenderState.IDLE) return;

        const renderId = this.currentRenderId;
        this.state = RenderState.CANCELLED;

        // 取消RAF
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // 取消超时
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        console.log(`[ProgressiveRenderer] Cancelled render: ${renderId}`);

        // 发布取消事件
        eventBus.emit('render:cancel', { id: renderId });
    }

    /**
     * 暂停渲染
     */
    pause() {
        if (this.state !== RenderState.RENDERING) return;

        this.state = RenderState.PAUSED;

        // 取消RAF
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        console.log(`[ProgressiveRenderer] Paused render: ${this.currentRenderId}`);

        // 发布暂停事件
        eventBus.emit('render:pause', { id: this.currentRenderId });
    }

    /**
     * 恢复渲染
     */
    resume() {
        if (this.state !== RenderState.PAUSED) return;

        this.state = RenderState.RENDERING;

        console.log(`[ProgressiveRenderer] Resumed render: ${this.currentRenderId}`);

        // 继续渲染
        if (this.currentTask) {
            const phaseElements = this.currentTask.phaseElements.get(this.currentTask.currentPhase);
            if (phaseElements) {
                this.renderPhaseElements(this.currentTask, phaseElements);
            }
        }

        // 发布恢复事件
        eventBus.emit('render:resume', { id: this.currentRenderId });
    }

    /**
     * 是否正在渲染
     * @returns {boolean}
     */
    isRendering() {
        return this.state === RenderState.RENDERING;
    }

    /**
     * 是否已暂停
     * @returns {boolean}
     */
    isPaused() {
        return this.state === RenderState.PAUSED;
    }

    /**
     * 获取当前渲染ID
     * @returns {string|null}
     */
    getCurrentRenderId() {
        return this.currentRenderId;
    }

    /**
     * 获取当前渲染任务
     * @returns {RenderTask|null}
     */
    getCurrentTask() {
        return this.currentTask;
    }

    /**
     * 获取渲染状态
     * @returns {RenderState}
     */
    getState() {
        return this.state;
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            state: this.state,
            currentRenderId: this.currentRenderId,
            cacheEnabled: this.cacheEnabled,
            cacheSize: this.selectorCache.size,
            performanceConfig: this.getPerformanceConfig()
        };
    }

    /**
     * 启用缓存
     */
    enableCache() {
        this.cacheEnabled = true;
        console.log('[ProgressiveRenderer] Cache enabled');
    }

    /**
     * 禁用缓存
     */
    disableCache() {
        this.cacheEnabled = false;
        this.clearCache();
        console.log('[ProgressiveRenderer] Cache disabled');
    }
}

// 创建全局单例
export const progressiveRenderer = new ProgressiveRenderer();
