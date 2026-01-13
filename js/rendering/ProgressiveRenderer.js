/**
 * PureSuck ProgressiveRenderer - 渐进式渲染器
 * 分块渲染元素,渐进式显示,提升性能
 */

import { eventBus } from '../core/EventBus.js';
import { visibilityManager } from './VisibilityManager.js';
import { domScheduler } from './DOMScheduler.js';

export class ProgressiveRenderer {
    constructor() {
        this.rendering = false;
        this.currentRenderId = null;
        this.renderQueue = [];
    }

    /**
     * 渐进式渲染元素
     * @param {Element[]|NodeList} elements - 要渲染的元素
     * @param {Object} options - 配置选项
     * @param {number} options.chunkSize - 每批渲染的元素数量
     * @param {number} options.chunkDelay - 批次间延迟(ms)
     * @param {string} options.priority - 优先级: high, normal, low
     * @param {Function} options.onProgress - 进度回调
     * @param {Function} options.onComplete - 完成回调
     */
    render(elements, options = {}) {
        const {
            chunkSize = 5,
            chunkDelay = 16,
            priority = 'normal',
            onProgress,
            onComplete
        } = options;

        // 转换为数组
        const elementArray = Array.from(elements || []);
        
        if (elementArray.length === 0) {
            console.warn('[ProgressiveRenderer] No elements to render');
            return;
        }

        const renderId = `render-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.currentRenderId = renderId;
        this.rendering = true;

        console.log(
            `[ProgressiveRenderer] Starting render: ${renderId}, ` +
            `${elementArray.length} elements, chunkSize: ${chunkSize}`
        );

        // 发布开始事件
        eventBus.emit('render:start', {
            id: renderId,
            total: elementArray.length,
            chunkSize
        });

        // 分块渲染
        let index = 0;
        const total = elementArray.length;

        const renderChunk = () => {
            // 检查是否被取消
            if (this.currentRenderId !== renderId) {
                console.log(`[ProgressiveRenderer] Render cancelled: ${renderId}`);
                return;
            }

            const chunk = elementArray.slice(index, index + chunkSize);
            
            if (chunk.length === 0) {
                // 渲染完成
                this.rendering = false;
                this.currentRenderId = null;

                console.log(`[ProgressiveRenderer] Render completed: ${renderId}`);

                if (typeof onComplete === 'function') {
                    try {
                        onComplete({ total, rendered: index });
                    } catch (error) {
                        console.error('[ProgressiveRenderer] Error in onComplete:', error);
                    }
                }

                eventBus.emit('render:complete', {
                    id: renderId,
                    total,
                    rendered: index
                });

                return;
            }

            // 预设初始状态
            chunk.forEach((el, i) => {
                el.style.opacity = '0';
                el.style.transform = 'translate3d(0, 20px, 0)';
                el.style.transition = 'none';
            });

            // 强制重绘
            void document.documentElement.offsetHeight;

            // 显示元素
            chunk.forEach((el, i) => {
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

            // 更新进度
            index += chunk.length;
            const progress = (index / total) * 100;

            if (typeof onProgress === 'function') {
                try {
                    onProgress({
                        rendered: index,
                        total,
                        progress
                    });
                } catch (error) {
                    console.error('[ProgressiveRenderer] Error in onProgress:', error);
                }
            }

            eventBus.emit('render:progress', {
                id: renderId,
                rendered: index,
                total,
                progress
            });

            // 继续下一批
            if (index < total) {
                setTimeout(renderChunk, chunkDelay);
            } else {
                // 渲染完成
                this.rendering = false;
                this.currentRenderId = null;

                console.log(`[ProgressiveRenderer] Render completed: ${renderId}`);

                if (typeof onComplete === 'function') {
                    try {
                        onComplete({ total, rendered: index });
                    } catch (error) {
                        console.error('[ProgressiveRenderer] Error in onComplete:', error);
                    }
                }

                eventBus.emit('render:complete', {
                    id: renderId,
                    total,
                    rendered: index
                });
            }
        };

        // 开始渲染
        requestAnimationFrame(renderChunk);
    }

    /**
     * 取消当前渲染
     */
    cancel() {
        if (!this.rendering) return;

        const renderId = this.currentRenderId;
        this.currentRenderId = null;
        this.rendering = false;

        console.log(`[ProgressiveRenderer] Cancelled render: ${renderId}`);

        eventBus.emit('render:cancel', { id: renderId });
    }

    /**
     * 渐进式显示可见元素
     * @param {Element[]|NodeList} elements - 要显示的元素
     * @param {Object} options - 配置选项
     */
    renderVisible(elements, options = {}) {
        const elementArray = Array.from(elements || []);
        
        if (elementArray.length === 0) return;

        // 使用VisibilityManager检测可见元素
        const visibleElements = [];
        const hiddenElements = [];

        elementArray.forEach((el) => {
            if (visibilityManager.isVisible(el)) {
                visibleElements.push(el);
            } else {
                hiddenElements.push(el);
            }
        });

        // 先渲染可见元素
        this.render(visibleElements, {
            ...options,
            onProgress: (progress) => {
                if (typeof options.onProgress === 'function') {
                    options.onProgress(progress);
                }
            },
            onComplete: (result) => {
                // 可见元素渲染完成后,观察隐藏元素
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
     * @param {Object} options - 配置选项
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
     * 是否正在渲染
     */
    isRendering() {
        return this.rendering;
    }

    /**
     * 获取当前渲染ID
     */
    getCurrentRenderId() {
        return this.currentRenderId;
    }
}

// 创建全局单例
export const progressiveRenderer = new ProgressiveRenderer();
