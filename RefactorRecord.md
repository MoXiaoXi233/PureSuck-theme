# 重构记录（Refactor Record）

更新时间：2026-02-10
对照基准：`DevPlan.md`

## 1. 本轮目标
- 搭建可持续重构底座（可回滚、可降级、可维护）。
- 先完成 Phase 0/2 的核心基础：运行时模块生命周期 + Swup 协调器重构。
- 保持 SSR 主路径不变，前端增强可关闭。

## 2. 本轮已修改文件
- `DevRule.md`
- `js/PureSuck_Core.js`（新增）
- `js/PureSuck_Swup.js`（重写）
- `header.php`
- `functions/common.php`
- `functions/render.php`
- `functions/article.php`

## 3. 对照 DevPlan 的完成情况

### 3.1 Phase 0：盘点与可安全回滚
- 已完成：为前端增强建立总配置入口 `window.PS_CONFIG`。
- 已完成：Swup 可通过主题设置关闭（回退原生跳转）。
- 已完成：VT 可通过主题设置关闭，并在不支持时自动降级。
- 已完成：统一生命周期 `destroy/init`，降低模块失败影响范围。

### 3.2 Phase 1：模板结构与 HTML 规范
- 已完成：`#swup` 页面类型标记进一步统一（含 `archives` 归入 `page` 类型）。
- 部分完成：模板重复结构（卡片、meta、pager）尚未抽离到 `partials/`。

### 3.3 Phase 2：JS 组织方式（替代 Islands 强规范）
- 已完成：新增运行时核心 `window.PS`，支持模块注册与生命周期调度。
- 已完成：Swup 流程改为“协调器 + 模块生命周期调用”。
- 已完成：初始化与销毁从“分散调用”收敛到统一入口。

### 3.4 Phase 3：性能与体验（基于真实瓶颈）
- 已完成：`PureSuck_Swup.js` 从超大单体重写为精简协调器，降低耦合。
- 部分完成：动画策略已保留降级链路，但性能埋点体系尚未正式接入。
- 未开始：LCP/CLS 专项优化与系统化性能基线采集。

## 4. 关键技术变更摘要
- 新增运行时内核：`PS.registerModule / PS.initModules / PS.destroyModules`。
- Swup 切换流程：
  - `visit:start`：统一销毁模块 + 退出态处理。
  - `content:replace`：进入态处理 + 懒加载/共享元素同步。
  - `page:view`：统一模块初始化。
- 主题设置新增开关：
  - `enableSwup`
  - `enableViewTransition`
  - `enableSwupPreload`
  - `enablePerfDebug`
- 渲染管线增强：
  - 引入 `psRenderContentPipeline()` 明确步骤。
  - 缓存键升级到 `v2`，包含版本 + 内容哈希 + 配置指纹。
- 幂等修复：`wrapTables()` 避免重复包裹 `.table-scroll`。

## 5. 兼容与风险说明
- 兼容：原 `renderPostContent($content)` 调用方式未变，模板无需迁移。
- 兼容：短代码与主要功能路径保持可用。
- 风险：Swup 协调器重写范围较大，仍需进行真实页面流回归（列表→文章→返回、评论分页/提交、加密文章解锁）。

## 6. 已完成校验
- PHP 语法检查通过：
  - `header.php`
  - `functions/common.php`
  - `functions/render.php`
  - `functions/article.php`
- JS 语法检查通过：
  - `js/PureSuck_Core.js`
  - `js/PureSuck_Swup.js`

## 7. 下一阶段建议（按 DevPlan）
1. 进入 Phase 1：抽离 `partials/`（post-meta、pager、footer-info、author-block），消除模板重复。
2. 继续 Phase 2：将 `PureSuck_Module.js` 逐步拆分为 `js/modules/*` 并接入 `PS.registerModule`。
3. 开始 Phase 3：补充性能观测（导航阶段耗时、长任务来源、懒加载命中率）。

---

## 8. 第二轮：动画完整重构（2026-02-09）

### 8.1 目标
- 按 DevPlan 第 6 节重构动画体系，淘汰旧的分散/冲突实现。
- 建立统一的 A/B 转场决策机制：
  - 形态 A：共享元素 VT（主卡片 morph）
  - 形态 B：普通卡片转场（默认兜底）
- 保证可中断、可降级、可回滚。

### 8.2 本轮过程（执行步骤）
1. 复核现有 `js/PureSuck_Swup.js` 与 `css/animations/*` 的状态耦合点、重复逻辑与冲突点。  
2. 重建 Swup 转场状态机：统一进入/退出阶段、模式判定、共享元素标记、超时清理。  
3. 删除旧动画样式中的历史分支，重写动画样式为统一变量 + A/B 模式选择器。  
4. 追加规则：将动画实现逻辑写入 `DevRule.md`，并将三文档协同流程写入规则与计划。  

### 8.3 本轮修改文件
- `js/PureSuck_Swup.js`（动画内核重写，保留评论/解锁/搜索提交链路）
- `css/animations/transitions.css`（变量、状态、预载、reduced-motion）
- `css/animations/enter.css`（统一进入动画，区分 A/B）
- `css/animations/exit.css`（统一退出动画，区分 A/B）
- `css/animations/vt.css`（共享元素 VT 动画层）
- `DevRule.md`（新增动画实现规范 + 文档同步机制）
- `DevPlan.md`（新增三文档协同约束）

### 8.4 对照 DevPlan 的完成项
- 已完成：6.2 两种转场形态并行存在，A 优先、B 兜底。  
- 已完成：6.5 冲突优先级，A 模式下非共享元素轻量动画，避免共享主体双重缩放。  
- 已完成：6.6 降级与无障碍，`prefers-reduced-motion` 与 VT 不支持时回退。  
- 已完成：可中断清理机制（定时器 + 状态类统一回收）。  
- 部分完成：性能观测埋点（阶段耗时统计）仍待补充。  

### 8.5 风险与回滚
- 风险：转场核心切换较大，需重点人工回归“列表→文章→返回列表”以及评论流程。  
- 回滚：可通过主题设置关闭 `enableSwup` 或 `enableViewTransition`，快速降级到原生导航/普通转场。  

## 9. 第三轮：列表首屏渐入修复（2026-02-09）

### 9.1 目标
- 修复列表卡片“首屏直接出现、缺少渐入”的问题。
- 将该需求写入计划与规则，纳入后续统一执行基线。

### 9.2 本轮过程
1. 复核现有动画链路，定位首屏渐入依赖 `ps-preload-list-enter` 的触发前提。  
2. 调整首屏预置逻辑：列表页首屏渐入不再依赖 Swup 开关。  
3. 在 JS 中增加首屏进入幂等保护，避免重复触发。  
4. 同步更新 `DevPlan.md`（新增 6.8）与 `DevRule.md`（新增第 13 节）。  

### 9.3 本轮修改文件
- `header.php`（列表首屏预置 class 逻辑改为独立于 Swup）
- `js/PureSuck_Swup.js`（首屏进入幂等与列表兜底触发）
- `DevPlan.md`（新增 6.8 列表首屏渐入）
- `DevRule.md`（新增 13. 列表首屏渐入规范）

### 9.4 对照 DevPlan 完成项
- 已完成：6.8 列表首屏渐入规范落地（含 reduced-motion 降级）。
- 已完成：文档协同要求，计划/规则/记录三文档同步更新。

## 10. 第四轮：列表渐入触发收敛（2026-02-09）

### 10.1 目标
- 修正“列表渐入总是触发”的过度动画问题。
- 消除 VT 回退后的二次叠层渐入。

### 10.2 本轮过程
1. 复核进入阶段触发链路，确认列表进入动画在分页与 VT 回退场景都会被统一触发。  
2. 在 `PureSuck_Swup.js` 新增进入阶段判定函数，按 `fromType/toType/mode` 收敛列表进入动画。  
3. 保留首屏一次性渐入（force），避免把首屏体验也误伤。  
4. 同步更新 `DevPlan.md` 与 `DevRule.md` 的收敛规则。  

### 10.3 本轮修改文件
- `js/PureSuck_Swup.js`（新增 `shouldSkipEnterTransition`，并在进入阶段按场景跳过）
- `DevPlan.md`（6.8 增加分页与 VT 回退收敛条款）
- `DevRule.md`（13 节增加触发收敛硬规则）

### 10.4 对照 DevPlan 完成项
- 已完成：6.8 的触发收敛补充，避免分页重复渐入与 VT 叠层渐入。

## 11. 第五轮：列表渐入层次重定义（2026-02-09）

### 11.1 目标
- 按最新需求将列表进入改为“多数场景可感知 `fadeInUp`”。
- 在 VT 返回列表场景建立严格分层：先 morph，后其余卡片渐入。

### 11.2 需求修正说明
- 本轮明确覆盖第 10 轮的“列表分页不再渐入”策略。
- 新基线：分页等常规列表进入也允许渐入；VT 场景通过“延迟 reveal”解决叠层冲突，而不是直接关闭进入动画。

### 11.3 本轮过程
1. 重构 `startEnterTransition`：移除列表进入跳过逻辑，改为统一进入调度。  
2. 新增 VT 列表分层状态：`ps-vt-list-hold` / `ps-vt-list-reveal`，通过定时器在 VT 结束后释放非共享卡片进入。  
3. 增强列表进入视觉：提高 `fadeInUp` 位移/时长，形成更可感知的进入效果。  
4. 同步更新 `DevPlan.md` 6.8 与 `DevRule.md` 13 节，固化“先 VT 主体、后列表补入”的规则。  

### 11.4 本轮修改文件
- `js/PureSuck_Swup.js`（进入调度重构、VT 分层 reveal 机制）
- `css/animations/enter.css`（VT 期间隐藏非共享元素，VT 后触发列表 `fadeInUp`）
- `css/animations/transitions.css`（列表进入强度参数上调）
- `DevPlan.md`（6.8 改为“列表渐入层次”）
- `DevRule.md`（13 节改为“列表渐入与 VT 分层规范”）

### 11.5 对照 DevPlan 完成项
- 已完成：6.8 “多数场景可感知渐入”规则落地。
- 已完成：6.8 “VT 结束后再介入列表渐入”的分层规则落地。

## 12. 第六轮：页面模板动画语义统一（2026-02-09）

### 12.1 目标
- 将 `archives.php` 与 `page.php` 彻底统一为同一种 `page` 动画语义。
- 消除“同为页面模板但观感不一致”的隐性分叉。

### 12.2 本轮过程
1. 在 `DevPlan.md` 增加 6.9，明确页面模板动画一致性要求。  
2. 在 `DevRule.md` 增加第 14 节，固化“统一标记 + 统一 pageType + 统一阶段命中”的硬规则。  
3. 模板层给 `page.php` 与 `archives.php` 增加统一结构标记 `data-ps-page-shell`。  
4. 动画层把 `ps-enter-page` / `ps-exit-page` / 页面预载选择器统一切到 `data-ps-page-shell`。  
5. 运行时去掉 `archives` 特判，按 `is('page')` 单一路径归类，避免语义分叉。  

### 12.3 本轮修改文件
- `DevPlan.md`
- `DevRule.md`
- `RefactorRecord.md`
- `header.php`
- `functions/common.php`
- `page.php`
- `archives.php`
- `css/animations/transitions.css`
- `css/animations/enter.css`
- `css/animations/exit.css`
- `css/lib/pace-theme-default.min.css`（删除，历史残留）
- `css/PureSuck_Style.css`（删除 `.pace .pace-progress` 残留样式）

### 12.4 追加修正：长页面缩放感一致化
- 现象：`archives.php`（时间线较长）与 `page.php` 在相同动画语义下仍有观感差异，归档页更像“纯平移上移”。
- 原因：统一 scale 参数在长页面上感知弱化，视觉上被位移主导。
- 处理：对统一 `page shell` 引入固定 `transform-origin` 与 page 专属 scale 参数（进入/退出/预载三阶段同步）。
- 结论：不区分模板，继续保持同一 `page` 语义，只修正长页面观感一致性。

## 14. 第八轮：移除过度设计的动画分段（2026-02-10）

### 14.1 目标
- 删除文章内容分段渐入/退出动画（`.post-content`、`.post-comments`、`.license-info-card` 不应单独做动画）。
- 删除列表卡片 stagger 延迟（12 个 `nth-of-type` 规则），改为统一进入。

### 14.2 问题描述
- **问题 1**：VT 模式下文章页内容被拆分成多个区块分段渐入（140ms 延迟），造成"卡片整体已加载但内容分段飘入"的观感。
- **问题 2**：列表卡片使用 stagger（最大延迟 312ms），属于过度设计，不符合 DevPlan 0.2 "保持务实"的原则。

### 14.3 本轮修改文件
- `css/animations/enter.css`
  - 删除 VT 模式下 `.post-content/.post-comments/.license-info-card` 的分段渐入动画
  - 清理 `--ps-item-delay` 引用，改为固定值
- `css/animations/exit.css`
  - 删除 VT 模式下文章内容的分段退出动画
  - 清理 `--ps-item-delay` 引用
- `css/animations/transitions.css`
  - 删除 12 个 `nth-of-type` stagger 规则

### 14.4 对照 DevPlan 完成项
- 已完成：0.2 "需要降级的过度设计点" — 移除不必要的复杂动画。
- 已完成：6.3 "非共享元素仅允许轻量淡出/淡入" — 文章内容不再单独做动画。
- 已完成：6.4 "stagger 必须克制" — 移除列表卡片 stagger。

### 14.5 校验
- 列表页：所有卡片统一进入，无延迟差异
- 文章页：内容跟随卡片整体进入/退出
- VT 模式：共享元素 morph 正常，非共享元素轻量淡入

### 14.6 动画状态机简化（追加）
- 移除 `ps-pre-enter`（无 CSS 使用，属于冗余状态类）
- 合并 `ps-vt-list-hold` 和 `ps-vt-list-reveal` 为 `ps-vt-reveal`
- 状态类从 14 个减少到 12 个
- 修改文件：`js/PureSuck_Swup.js`、`css/animations/enter.css`

### 14.7 后续任务（已完成）
以下任务已在 Phase 2.5（第九轮）完成，详见第 15 节。

## 13. 第七轮：右栏三栏语义重构（2026-02-09）

### 13.1 目标
- 修复右栏“寄生式伪三栏”结构，改为标准布局列。
- 彻底解决 Swup 切换时右栏被替换/丢失问题。

### 13.2 本轮过程
1. 调整骨架：新增 `content-layout/content-main` 容器，限制 `#swup` 只包裹正文列。  
2. 统一输出：移除各模板对 `sidebar.php` 的重复插入，改为 `footer.php` 统一输出右栏。  
3. 样式重构：右栏从 `fixed + inline` 改为桌面 `grid 列 + sticky`；移除 body 右侧大偏移伪布局。  
4. TOC 适配：TOC sticky 改为栏内粘性，同时移除 JS 对右栏定位的运行时强改写。  
5. 同步文档：新增 `DevPlan 6.10` 与 `DevRule 15`，把右栏规范写入强约束。  

### 13.3 本轮修改文件
- `header.php`
- `footer.php`
- `index.php`
- `archive.php`
- `post.php`
- `page.php`
- `archives.php`
- `sidebar.php`
- `css/PureSuck_Style.css`
- `css/PureSuck_Module.css`
- `js/PureSuck_Module.js`
- `DevPlan.md`
- `DevRule.md`
- `RefactorRecord.md`

### 13.4 追加修正：三栏视觉回归调优
- 反馈：结构正确后，桌面端像素、间距与旧版存在明显偏差。
- 处理：在不回退结构重构的前提下，回调桌面断点列宽到旧节奏（1183: `299px`，1400: `365px`），并统一右栏盒模型为 `border-box`。
- 处理：右栏与 TOC sticky 顶部基线回调为 `top: 0`，降低与旧版视感差异。
- 结果：保持"sidebar 在 swup 外 + 统一骨架输出"的规范，同时尽量贴近旧版视觉参数。

## 15. 第九轮：Phase 2.5 过度设计清理（2026-02-10）

### 15.1 目标
- 完成 DevPlan Phase 2.5 定义的过度设计清理任务。
- 收敛全局命名空间、简化缓存结构、保持向后兼容。

### 15.2 本轮完成项

#### 15.2.1 全局命名空间收敛（window.* → PS.*）
- **问题**：20+ 全局变量直接挂载在 `window` 下，污染全局命名空间。
- **方案**：将所有主题相关全局对象收敛到 `window.PS` 下，保留向后兼容别名。
- **修改文件**：
  - `js/PureSuck_Core.js`：预置命名空间占位（`PS.swup`、`PS.zoom`、`PS.lazy`、`PS.theme`、`PS.nav`）
  - `js/PureSuck_Swup.js`：使用 `PS.swup` 作为主引用，保留 `window.swupInstance`
  - `js/PureSuck_Module.js`：
    - `mediumZoomInstance` → `PS.zoom`（保留 `window.mediumZoomInstance`）
    - `setTheme/toggleTheme` → `PS.theme.set/toggle`（保留 `window.setTheme/toggleTheme`）
    - `NavIndicator` → `PS.nav`（保留 `window.NavIndicator`）
  - `js/PureSuck_LazyLoad.js`：使用 `PS.lazy` 作为主引用，保留 `window.LazyLoadManager`

#### 15.2.2 TOC 缓存系统简化（6→5 Map/Set）
- **问题**：TOC 模块使用 6 个 Map/Set 缓存数据，`itemById` 可通过 `link.closest('li')` 动态获取。
- **方案**：移除 `itemById` Map，改用 DOM 查询。
- **修改文件**：`js/PureSuck_Module.js`
- **精简结果**：
  - 移除 `itemById: new Map()`
  - 移除 `state.itemById.set(id, item)` 缓存写入
  - `setActive()` 改用 `link.closest('li')` 获取父 li

#### 15.2.3 PHP 缓存配置指纹简化
- **问题**：`psGetRenderOptionFingerprint()` 包含 4 项配置，部分已不再影响渲染输出。
- **方案**：精简为仅包含真正影响渲染的配置（版本号 + TOC 开关）。
- **修改文件**：`functions/render.php`
- **精简结果**：
  ```php
  // 只包含真正影响渲染输出的配置
  $fingerprint = [
      'v' => defined('PS_THEME_VERSION') ? PS_THEME_VERSION : '0',
      'toc' => (string)($options->showTOC ?? '1')
  ];
  ```

### 15.3 对照 DevPlan 完成项
- 已完成：Phase 2.5 全局命名空间收敛（≤5 顶级入口）
- 已完成：Phase 2.5 TOC 缓存结构约束（≤5 Map/Set）
- 已完成：Phase 2.5 PHP 缓存配置精简

### 15.4 向后兼容说明
- 所有旧的全局变量（`window.swupInstance`、`window.mediumZoomInstance`、`window.setTheme`、`window.toggleTheme`、`window.NavIndicator`、`window.LazyLoadManager`）仍然可用。
- 新代码应优先使用 `PS.*` 命名空间。
- 外部脚本（如 `pjaxCustomCallback`）无需修改即可继续工作。

### 15.5 校验
- 全局命名空间：所有功能通过 `PS.*` 可访问，旧别名同时可用
- TOC：标题高亮、侧边栏滑块定位正常
- 缓存：文章渲染缓存命中正常，配置变更后缓存正确失效

## 17. 第十七轮：Swup 性能专项（2026-02-10）

### 17.1 目标
- 修复 `.perf` trace 窗口偶发 `enter-shell=0ms` 与任务空表问题。
- 针对“首页 -> /index.php/archives/281/”路径继续压缩掉帧。
- 以 DevPlan/DevRule 的性能阶段要求做可量化验证。

### 17.2 本轮修改文件
- `.perf/scripts/perf/swup-trace-runner.mjs`
- `.perf/scripts/perf/swup-metrics-runner.mjs`
- `js/PureSuck_Module.js`
- `js/PureSuck_Swup.js`
- `css/animations/enter.css`
- `css/animations/exit.css`

### 17.3 关键改动
- trace runner：
  - 窗口解析改为多源优先级（trace-metric-mark > trace-probe-mark > trace-mark > probe/metrics fallback）。
  - 结果输出增加 `window.source/hasProbeWindow/hasMetricWindow/analysisStartUs/analysisEndUs`。
  - 当窗口摘要为空时增加 padded + trace tail 兜底，避免空报表。
  - 在采样阶段将 metrics/probe 时间戳注入为 trace mark，降低跨时钟域偏差。
- metrics runner：
  - 新增 `--target-url` 参数，支持定向场景回归（如固定 `/archives/281/`）。
- 模块初始化与交互：
  - TOC 观察器改为低分配路径（移除 `Math.min(...Set)` 热路径、简化状态结构）。
  - Tabs 支持“近视口初始化 + observer 延迟绑定”。
  - `runShortcodes` cleanup 增加 tabs observer/resize observer 回收。
  - `page:view` 对 post/page 增加模块初始化延后，避开 enter-shell 关键窗口。
- 动画减负：
  - post 主卡进入/退出去掉 scale，减少大容器动画栅格化压力。

### 17.4 验证与结果
- 语法检查：
  - `node --check js/PureSuck_Core.js` 通过
  - `node --check js/PureSuck_Swup.js` 通过
  - `node --check js/PureSuck_Module.js` 通过
  - `node --check .perf/scripts/perf/swup-trace-runner.mjs` 通过
  - `node --check .perf/scripts/perf/swup-metrics-runner.mjs` 通过

- Trace（修复后）：
  - 命令：`npm run perf:trace:enter-shell -- --base-url http://localhost/ --build-ref 570280e --variant perf-fix-round2f-final --annotation-tag homepage-to-archives281`
  - 产物：
    - `.perf/artifacts/perf/trace/enter-shell/swup-trace-2026-02-10T21-22-32-360Z.json`
    - `.perf/artifacts/perf/trace/enter-shell/swup-trace-2026-02-10T21-22-32-360Z.md`
  - 结果：`enter-shell ms = 139.4 (source=trace-metric-mark)`，不再出现 0ms/空窗口。

- Metrics（定向路径：`首页 -> /index.php/archives/281/`，20 runs）：
  - 命令：`npm run perf:metrics:baseline -- --base-url http://localhost/ --target-url http://localhost/index.php/archives/281/ --runs 20 --build-ref 570280e --variant perf-fix-round2f-final --annotation-tag homepage-to-archives281`
  - 产物：
    - `.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T21-22-00-911Z.json`
    - `.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T21-22-00-911Z.md`
  - 指标：
    - `frameTime p95/p99 = 8.9 / 33.3 ms`
    - `1% low FPS = 30.03`
    - `slow >16.67ms = 2.07%`
    - `long tasks = 1`
  - 判定：按 `.perf/performance.md` 阈值为 `WATCH`（已从此前 FAIL 边缘改善，但仍未达到 PASS）。

- Metrics（默认路径：首页首篇文章，20 runs）：
  - 命令：`npm run perf:metrics:baseline -- --base-url http://localhost/ --runs 20 --build-ref 570280e --variant perf-fix-round2f-final-general --annotation-tag homepage-default-firstpost`
  - 产物：
    - `.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T21-24-25-588Z.json`
    - `.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T21-24-25-588Z.md`
  - 指标：
    - `frameTime p95/p99 = 8.7 / 17.0 ms`
    - `1% low FPS = 58.82`
    - `slow >16.67ms = 1.25%`
    - `long tasks = 0`
  - 判定：`PASS`。

### 17.5 风险与回滚点
- post/page 模块初始化延后会导致少量增强功能晚于首帧出现（内容可读性不受影响）。
- 动画去 scale 会让转场观感更克制；可通过 CSS keyframes 回滚。
- `.perf` 脚本新增参数/窗口逻辑仅影响本地测试工具链，不影响线上主题功能。

## 18. 第十八轮：281 路径瓶颈定位与修复（2026-02-10）

### 18.1 用户要求
- 按性能目标继续优化。
- 不做转场降级，必须定位真实瓶颈。

### 18.2 瓶颈定位结论
- 使用定向 trace（`--target-url /index.php/archives/281/`）定位到 enter-shell 主瓶颈不是动画本身，而是大规模布局：
  - `Layout total=191.06ms, max=174.89ms`
  - 最大 RunTask 链路中可见 `Swup scroll-plugin` 调用点（伴随大 layout）。
- 进一步验证后确认：核心问题是“重内容页进入时的同步布局成本过高”，尤其在 `/archives/281/` 这种长文页面。

### 18.3 本轮改动
- `.perf/scripts/perf/swup-trace-runner.mjs`
  - 新增 `--target-url` 支持，trace 可精准命中指定页面。
- `js/PureSuck_Swup.js`
  - `SwupScrollPlugin` 改为受特性开关控制，默认不启用（`swupScrollPlugin=false`）。
  - `runShortcodes` 调用传入 `isSwup` 上下文。
- `js/PureSuck_Module.js`
  - 新增 `optimizeContentImages()`：内容页图片在运行时按首图/非首图设置 `loading`、`decoding`、`fetchpriority`，并在 idle 小批量 `decode()`。
  - `runShortcodes()` 增加 `isSwup` 参数并接入图片优化 cleanup。
- `css/PureSuck_Style.css`
  - 将正文性能策略从 `.post-content` 根节点改为“块级 content-visibility”：
    - `.post-content > :not(h1..h6)` 按需布局
    - 对 `figure/pre/table/pic-grid` 设更合理 `contain-intrinsic-size`

### 18.4 验证结果
- Trace（定向 281，修复后）
  - 命令：`npm run perf:trace:enter-shell -- --base-url http://localhost/ --target-url http://localhost/index.php/archives/281/ --build-ref 570280e --variant perf-bottleneck-281-block-cv --annotation-tag homepage-to-archives281`
  - 产物：`.perf/artifacts/perf/trace/enter-shell/swup-trace-2026-02-10T21-37-17-261Z.json`
  - 指标变化（对比定位时）：
    - `enter-shell`: `232.8ms -> 134.4ms`
    - `Layout total`: `191.06ms -> 40.34ms`
    - `Layout max`: `174.89ms -> 21.58ms`

- Metrics（定向 281，20 runs）
  - 命令：`npm run perf:metrics:baseline -- --base-url http://localhost/ --target-url http://localhost/index.php/archives/281/ --runs 20 --build-ref 570280e --variant perf-bottleneck-281-block-cv --annotation-tag homepage-to-archives281`
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T21-38-15-819Z.json`
  - 结果：
    - `frameTime p95/p99 = 8.8 / 24.9 ms`
    - `1% low FPS = 40.16`
    - `slow >16.67ms = 1.62%`
    - `long tasks = 0`
  - 判定：`PASS`。

- Metrics（默认路径，20 runs）
  - 命令：`npm run perf:metrics:baseline -- --base-url http://localhost/ --runs 20 --build-ref 570280e --variant perf-bottleneck-281-block-cv-general --annotation-tag homepage-default-firstpost`
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T21-39-06-620Z.json`
  - 结果：`p95/p99=8.8/16.8`, `1% low=59.52`, `slow>16.67=1.08%`, `longTasks=0`（持续 PASS）。

### 18.5 风险与说明
- 默认关闭 `SwupScrollPlugin` 可能改变历史滚动恢复与同页锚点细节行为；当前主题已有基础滚动逻辑兜底。
- 块级 `content-visibility` 为性能优先策略，对极端场景下的首屏外内容测量行为会有影响（但本轮未观察到功能回归）。

## 19. 第十九轮：持续迭代（定位 -> 优化 -> 回归，2026-02-10）

### 19.1 目标
- 回应“不要可选开关绕过问题”，改为稳定实现。
- 持续迭代 `/archives/281/` 路径，进一步拉高性能余量。

### 19.2 本轮关键调整
- `js/PureSuck_Swup.js`
  - 移除 `SwupScrollPlugin` 依赖路径，改为内置轻量滚动管理：
    - `getHashTarget()` + `restoreNavigationScroll(toType)`
    - 在 `page:view` 统一处理 hash 锚点与 post/page 顶部恢复
- `header.php`
  - 移除 `js/lib/Swup/scroll-plugin.js` 的脚本加载。
- `css/PureSuck_Style.css`
  - 正文性能策略继续收敛：`.post-content > *` 全子块按需布局（content-visibility）。
- `css/animations/transitions.css`
  - 去掉动画阶段全局 `will-change`，避免大面积层提升。
- `js/PureSuck_Module.js`
  - 新增 `optimizeContentEmbeds()`：
    - post/page 中 iframe 延后激活（近视口延后、远视口 IO 触发）
    - cleanup 不再在离开页面前强制恢复 deferred iframe 的 `src`，避免导航临界区尖峰。

### 19.3 迭代结果（定向 281）
- 最终命令：
  - `npm run perf:metrics:baseline -- --base-url http://localhost/ --target-url http://localhost/index.php/archives/281/ --runs 20 --build-ref 570280e --variant perf-bottleneck-281-embed-cleanup-no-restore --annotation-tag homepage-to-archives281`
- 产物：
  - `.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T21-55-48-258Z.json`
  - `.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T21-55-48-258Z.md`
- 指标（对比前一轮 `p99=24.9 / 1%low=40.16 / slow=1.62%`）：
  - `frameTime p95/p99 = 8.7 / 17.06 ms`
  - `1% low FPS = 58.62`
  - `slow >16.67ms = 1.41%`
  - `long tasks = 0`
- 判定：`PASS`，且余量明显提升。

### 19.4 默认路径回归
- 命令：
  - `npm run perf:metrics:baseline -- --base-url http://localhost/ --runs 20 --build-ref 570280e --variant perf-bottleneck-281-embed-cleanup-no-restore-general --annotation-tag homepage-default-firstpost`
- 产物：
  - `.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T21-56-39-070Z.json`
- 结果：`p95/p99=8.8/16.76`, `1%low=59.68`, `slow>16.67=1.08%`, `longTasks=0`（持续 PASS）。

## 20. 第二十轮：恢复 ScrollPlugin 并继续压测（2026-02-10）

### 20.1 目标
- 按用户要求继续使用 `SwupScrollPlugin`，不走自写滚动方案。
- 在不降级体验的前提下，继续压 `home -> /index.php/archives/281/` 路径帧稳定性。

### 20.2 本轮修改文件
- `header.php`
- `js/PureSuck_Swup.js`
- `.perf/record.md`
- `RefactorRecord.md`

### 20.3 关键改动
- `header.php`
  - 恢复 `js/lib/Swup/scroll-plugin.js` 脚本加载。
- `js/PureSuck_Swup.js`
  - 恢复 `SwupScrollPlugin` 挂载为默认滚动路径（非“可选关闭”）。
  - 新增 `scrollFunction` 高性能执行策略：
    - 当处于 `ps-phase-enter + ps-content-shell` 且尚未 `ps-content-reveal` 时，延后执行滚动。
    - 通过 `MutationObserver + timeout` 双兜底释放，避免卡死。
  - `animateScroll` 调整为：
    - `betweenPages: false`
    - `samePageWithHash: true`
    - `samePage: false`
  - 保留仅在插件缺失时启用的 fallback（`restoreNavigationScrollFallback`），避免脚本缺失时滚动失效。
- 试验并回滚：
  - `moduleInitDelay` 曾从 `170ms` 调整到 `220ms`，回归后轻微退化，已回滚到 `170ms`。

### 20.4 验证与结果
- 语法检查：
  - `node --check js/PureSuck_Swup.js` 通过。
- Trace（定向 281）：
  - 命令：`npm run perf:trace:enter-shell -- --base-url http://localhost/ --target-url http://localhost/index.php/archives/281/ --build-ref local --variant perf-scroll-plugin-return-final --annotation-tag swup-scroll-plugin`
  - 产物：`.perf/artifacts/perf/trace/enter-shell/swup-trace-2026-02-10T22-09-49-514Z.json`
  - 结果：`enter-shell=137.4ms`，`Layout total=40.02ms`。
- Metrics（定向 281，20 runs）：
  - 命令：`npm run perf:metrics:baseline -- --base-url http://localhost/ --target-url http://localhost/index.php/archives/281/ --runs 20 --build-ref local --variant perf-scroll-plugin-return-final --annotation-tag swup-scroll-plugin`
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-09-38-644Z.json`
  - 结果：
    - `frameTime p95/p99 = 8.4 / 16.6 ms`
    - `1% low FPS = 60.24`
    - `slow >16.67ms = 0.87%`
    - `long tasks = 0`
- Metrics（默认路径，20 runs）：
  - 命令：`npm run perf:metrics:baseline -- --base-url http://localhost/ --runs 20 --build-ref local --variant perf-scroll-plugin-return-final-general --annotation-tag swup-scroll-plugin`
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-09-38-360Z.json`
  - 结果：`p95/p99=8.4/16.51`, `1%low=60.57`, `slow>16.67=0.73%`, `longTasks=0`。

### 20.5 对照上一轮变化
- 对比第 19 轮定向 281（`p99=17.06`, `1%low=58.62`, `slow=1.41%`）：
  - 本轮提升到 `p99=16.6`, `1%low=60.24`, `slow=0.87%`。
- 结论：在保留 `SwupScrollPlugin` 前提下，性能仍可继续提升，且当前版本优于上一轮。

## 21. 第二十一轮：VT 抽搐轨迹修复（2026-02-10）

### 21.1 目标
- 修复“共享元素 VT 到最高处再回弹”的抽搐动画。
- 保留早期版本更稳定的 morph 观感，不降低导航性能。

### 21.2 本轮修改文件
- `css/animations/vt.css`
- `.perf/record.md`
- `RefactorRecord.md`

### 21.3 关键改动
- 原因定位：
  - 共享元素 VT 已有浏览器原生几何 morph；
  - 同时在 `::view-transition-old/new(*)` 额外叠加了 `translateY + scale`，导致轨迹叠加打架，出现“冲顶后回拉”。
- 修复策略：
  - 在 `css/animations/vt.css` 中移除共享元素 keyframes 的 `transform` 位移/缩放；
  - 保留轻微透明度过渡，改为“纯 morph + 软淡变”。

### 21.4 验证与结果
- Metrics（定向 281，20 runs）：
  - 命令：`npm run perf:metrics:baseline -- --base-url http://localhost/ --target-url http://localhost/index.php/archives/281/ --runs 20 --build-ref local --variant vt-no-translate-final --annotation-tag vt-jitter-fix`
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-15-58-941Z.json`
  - 结果：`p95/p99=8.4/16.6`, `1%low=60.24`, `slow>16.67=0.98%`, `longTasks=0`。
- Metrics（默认路径，20 runs）：
  - 命令：`npm run perf:metrics:baseline -- --base-url http://localhost/ --runs 20 --build-ref local --variant vt-no-translate-final-general --annotation-tag vt-jitter-fix`
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-16-45-428Z.json`
  - 结果：`p95/p99=8.4/8.7`, `1%low=114.94`, `slow>16.67=0.61%`, `longTasks=0`。

### 21.5 结论
- VT 共享元素“回弹抽搐”问题由叠加 transform 导致，已消除。
- 性能未出现回退，可继续在该基线上迭代门槛。

## 22. 第二十二轮：VT 抽搐二次修复（2026-02-10）

### 22.1 目标
- 继续处理“仍有抽搐”的反馈，去除所有潜在二次轨迹来源。

### 22.2 本轮修改文件
- `js/PureSuck_Swup.js`
- `css/animations/vt.css`
- `.perf/record.md`
- `RefactorRecord.md`

### 22.3 关键改动
- 滚动时序修复（`js/PureSuck_Swup.js`）：
  - 在 `createDeferredScrollFunction()` 中区分 VT 与非 VT：
    - VT 模式：滚动恢复等待 `ps-phase-enter` 结束后再执行；
    - 非 VT 模式：保持“内容 reveal 后尽快执行”。
  - 目的：避免转场中途视口跳动导致共享元素轨迹被拉扯。
- 共享元素动画彻底收敛（`css/animations/vt.css`）：
  - 移除 `::view-transition-old/new(*)` 自定义 keyframes；
  - 设为 `animation: none`，仅保留浏览器原生 morph（纯轨迹）。

### 22.4 验证与结果
- 延后 VT 滚动版本（定向 281）：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-20-10-585Z.json`
  - 结果：`p95/p99=8.4/8.6`, `1%low=116.28`, `slow>16.67=0.87%`, `longTasks=0`。
- 纯 morph 版本（定向 281）：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-22-02-018Z.json`
  - 结果：`p95/p99=8.4/16.7`, `1%low=59.88`, `slow>16.67=1.08%`, `longTasks=0`。
- 纯 morph 版本（默认路径）：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-22-01-813Z.json`
  - 结果：`p95/p99=8.4/16.6`, `1%low=60.24`, `slow>16.67=0.78%`, `longTasks=0`。

### 22.5 结论
- 本轮已将“共享元素二次动画 + 转场中滚动干扰”两条干扰链路全部收敛。
- 当前实现为“ScrollPlugin + VT 纯 morph + 延后滚动恢复”，满足不降级前提。

## 23. 第二十三轮：回滚 Scroll 定制逻辑（2026-02-10）

### 23.1 目标
- 按反馈“尽量去除 scroll 相关修改”，移除自定义滚动时序与执行逻辑。
- 保留 `SwupScrollPlugin`，回到插件近原生行为。

### 23.2 本轮修改文件
- `js/PureSuck_Swup.js`
- `.perf/record.md`
- `RefactorRecord.md`

### 23.3 关键改动
- 删除自定义滚动执行链路：
  - 移除 `isRootScrollTarget` / `scrollTargetTo` / `performManagedScroll` / `createDeferredScrollFunction`。
- `createScrollPluginOptions()` 回退为基础配置：
  - `doScrollingRightAway: true`
  - `animateScroll: { betweenPages: false, samePageWithHash: true, samePage: true }`
  - 不再注入自定义 `scrollFunction`。

### 23.4 验证与结果
- 语法检查：
  - `node --check js/PureSuck_Swup.js` 通过。
- Metrics（定向 281，20 runs）：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-24-28-325Z.json`
  - 结果：`p95/p99=8.4/16.62`, `1%low=60.18`, `slow>16.67=1.0%`, `longTasks=0`。
- Metrics（默认路径，20 runs）：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-25-13-363Z.json`
  - 结果：`p95/p99=8.4/8.69`, `1%low=115.02`, `slow>16.67=0.59%`, `longTasks=0`。

### 23.5 结论
- Scroll 相关定制逻辑已大幅收敛，当前以插件默认行为为主。
- 性能保持稳定，无回退。

## 24. 第二十四轮：Scroll 继续回退到插件默认（2026-02-10）

### 24.1 目标
- 按反馈“这一块还是有问题，继续回”，进一步去除 scroll 相关改动。

### 24.2 本轮修改文件
- `js/PureSuck_Swup.js`
- `.perf/record.md`
- `RefactorRecord.md`

### 24.3 关键改动
- `js/PureSuck_Swup.js`：
  - 删除 `hasScrollPlugin` 状态字段。
  - 删除 fallback 滚动函数：
    - `getHashTargetFromCurrentLocation`
    - `restoreNavigationScrollFallback`
  - 删除 `createScrollPluginOptions` 配置函数。
  - `SwupScrollPlugin` 改为无参数初始化：`new window.SwupScrollPlugin()`。
  - 移除 `page:view` 中的插件缺失分支滚动逻辑。

### 24.4 验证与结果
- 语法检查：
  - `node --check js/PureSuck_Swup.js` 通过。
- Metrics（定向 281，20 runs）：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-28-04-103Z.json`
  - 结果：`p95/p99=8.7/25.0`, `1%low=40.0`, `slow>16.67=1.52%`, `longTasks=0`。
- Metrics（默认路径，20 runs）：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-28-03-715Z.json`
  - 结果：`p95/p99=8.6/16.7`, `1%low=59.88`, `slow>16.67=1.07%`, `longTasks=0`。

### 24.5 结论
- Scroll 已回退到最接近插件原生默认行为的状态。
- 目标路径性能回退到 PASS 边缘，但满足“继续回”的回退方向。

## 25. 第二十五轮：卡片转场回退到早期基线（2026-02-10）

### 25.1 目标
- 按“卡片效果不如最初，尽量回去”的反馈，优先恢复早期视觉观感。

### 25.2 本轮处理
- 将 `js/PureSuck_Swup.js` 回退到早期稳定基线（`3647e72` 对应版本），恢复当时的卡片转场状态机与节奏。
- 动画文件（`enter/exit/transitions/vt`）保持在同一早期基线风格下。

### 25.3 验证结果
- Metrics（定向 281，20 runs）：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-32-36-863Z.json`
  - 结果：`p95/p99=8.7/24.9`, `1%low=40.16`, `slow>16.67=1.70%`, `longTasks=2`。
- Metrics（默认路径，20 runs）：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-32-36-326Z.json`
  - 结果：`p95/p99=8.7/24.9`, `1%low=40.16`, `slow>16.67=1.31%`, `longTasks=0`。

### 25.4 结论
- 视觉回退方向已落实（更接近早期卡片观感）。
- 性能较前一轮“优化态”明显回落，属于“以视觉优先换性能余量”的回退结果。

## 26. 第二十六轮：不改效果的根因优化（2026-02-10）

### 26.1 目标
- 按“找根因，但不要急着砍”执行优化。
- 保持当前卡片实现与视觉不变，仅优化初始化时序与替换范围。

### 26.2 根因定位
- 在 `home -> /archives/281/` 导航窗口（mark window）中，热点集中在：
  - `Layout`
  - `UpdateLayoutTree`
  - `IntersectionObserverController::computeIntersections`
- 说明瓶颈主要来自转场窗口内的布局/观察器计算叠加，而非单一动效参数。

### 26.3 本轮修改文件
- `js/PureSuck_Swup.js`
- `.perf/record.md`
- `RefactorRecord.md`

### 26.4 改动内容（不影响实现）
- `Swup` 替换容器收敛为主内容：
  - `containers: ['#swup']`（不再替换 `#right-sidebar`）。
- `runShortcodes` 在 Swup 场景启用现有延迟机制（模块已有能力）：
  - `deferHeavy: true`（仅 Swup）
  - 传入 `pageType/isSwup` 上下文
  - 保存并执行 cleanup，避免 observer/timer 残留。

### 26.5 验证结果
- Metrics（定向 281，20 runs）：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-40-32-292Z.json`
  - 指标：`p95/p99=8.5/20.04`, `1%low=51.78`, `slow>16.67=1.12%`, `longTasks=0`。
- Metrics（默认路径，20 runs）：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-40-31-964Z.json`
  - 指标：`p95/p99=8.5/16.6`, `1%low=60.24`, `slow>16.67=0.96%`, `longTasks=0`。
- Trace（定向 281，对比优化前）：
  - `Layout total: 86.87ms -> 64.45ms`
  - `IntersectionObserver::computeIntersections total: 40.24ms -> 35.88ms`

### 26.6 结论
- 在保持卡片风格不变前提下，性能显著回升（尤其 `p99` 与长任务）。
- 优化属于“逻辑与时序”层，不是降级或砍功能。

## 27. 第二十七轮：Swup 下 TOC 修复并持续优化（2026-02-10）

### 27.1 目标
- 修复“Swup 导航后 TOC 不显示”。
- 继续遵循“优化逻辑与时序，不砍功能、不改卡片效果”。

### 27.2 根因
- 当前架构中 `#right-sidebar` 不参与 Swup 内容替换，服务端输出的 TOC 区块不会随页面切换更新。
- `runShortcodes` 仅在已有 `#toc-section` 时初始化 TOC，导致部分 Swup 场景没有可初始化目标。

### 27.3 本轮修改文件
- `functions/common.php`
- `js/PureSuck_Core.js`
- `js/PureSuck_Module.js`
- `.perf/record.md`
- `RefactorRecord.md`

### 27.4 修复与优化内容
- 运行时配置补充：
  - `functions/common.php` 增加 `features.showTOC`。
  - `js/PureSuck_Core.js` 增加 `defaultFeatures.showTOC`。
- TOC 运行时同步（`js/PureSuck_Module.js`）：
  - 新增 `ensureRuntimeTocSection(scope, pageType)`：
    - 在 `post/page` 且有标题时自动确保 `#toc-section` 存在；
    - 动态生成 `.toc-a` 链接结构；
    - 非内容页自动隐藏 TOC，避免残留。
  - 增加 TOC 签名缓存（`data-ps-toc-sig`），仅在内容变化时重建 TOC DOM。
- 时序优化（不影响实现）：
  - Swup 场景下图片 `decode()` 延后并减小批次（降低导航窗口内 `ImageDecodeTask` 冲击）。
  - `initializeStickyTOC()` 改为“首次滚动或兜底定时”触发，减少转场关键窗口的观察器压力。

### 27.5 功能验证
- 自动化检查（Swup 跳转到 `/archives/281/`）：
  - `hasSection=true`
  - `tocLinks=26`
  - `display=block`
  - `sticky` 逻辑可激活（sentinel 可创建）

### 27.6 性能结果（20 runs）
- Targeted 281：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-49-24-104Z.json`
  - 指标：`p95/p99=8.9/17.02`, `1%low=58.75`, `slow>16.67=1.18%`, `longTasks=1`
- General：
  - 产物：`.perf/artifacts/perf/metrics/desktop-baseline/swup-metrics-2026-02-10T22-49-23-693Z.json`
  - 指标：`p95/p99=8.81/16.66`, `1%low=60.01`, `slow>16.67=1.01%`, `longTasks=0`

### 27.7 结论
- TOC 在 Swup 场景恢复可用。
- 在不改变卡片实现前提下，性能保持在可接受区间并较前序回退态明显改善。

## 28. 第二十八轮：TOC 布局回归与关键路径错峰优化（2026-02-10）

### 28.1 目标
- 修复 Swup 下 TOC 布局不一致（PHP 原始结构与 JS 运行时结构对齐）。
- 在不降级实现前提下继续压 `home -> /archives/281/` 的进入阶段尖峰。

### 28.2 根因
- JS 运行时 TOC 生成曾使用 `li.h{level}`，但 PHP/CSS 约定为 `li.li.li-{level}`。
- 类名不一致导致层级缩进与样式规则无法命中，表现为目录布局错误。

### 28.3 本轮修改文件
- `js/PureSuck_Module.js`
- `.perf/record.md`
- `RefactorRecord.md`

### 28.4 修复与优化
- TOC 结构对齐：
  - 运行时 TOC 项 class 改为 `li li-{level}`，与 `functions/article.php` 输出一致。
- 关键路径错峰（不砍功能）：
  - 将 `ensureRuntimeTocSection(scope, pageType)` 从 `runShortcodes` 同步入口移到 `initTOCEnhance()` 中执行；
  - 保持 TOC 功能完整，仅调整执行时机，减少 Swup 进入关键窗口同步 DOM 构建负担。

### 28.5 功能验证
- Playwright 自动化（首页经 Swup 进入 `/index.php/archives/281/`）：
  - `hasSection=true`, `display=block`
  - `items=26`
  - `withLi=26`, `withLevel=26`, `bad=0`

### 28.6 性能验证（20 runs）
- 说明：并行执行两组基线会引入资源争用，出现假回退；本轮采用串行结果作为决策依据。
- 串行基线（修复后）
  - Targeted 281：`p95/p99=8.5/16.74`, `1%low=59.73`, `slow>16.67=1.06%`, `longTasks=1`
  - General：`p95/p99=8.6/16.6`, `1%low=60.24`, `slow>16.67=0.87%`, `longTasks=0`
- 错峰优化后
  - Targeted 281：`p95/p99=8.6/16.6`, `1%low=60.24`, `slow>16.67=0.99%`, `longTasks=0`
  - General：`p95/p99=8.7/16.6`, `1%low=60.24`, `slow>16.67=0.96%`, `longTasks=0`

### 28.7 结论
- TOC 布局与 PHP 结构已一致，Swup 场景可正常显示。
- 性能保持 PASS 且 `281` 路径长任务归零，符合“优化逻辑与时序、不降级实现”的要求。

## 29. 第二十九轮：图片加载策略收敛到 PHP 输出（2026-02-10）

### 29.1 目标
- 按需求移除 Swup/JS 对图片加载的运行时处理，避免累赘逻辑。
- 将图片加载策略固定在 PHP 渲染输出层，保持实现简洁可控。

### 29.2 本轮修改文件
- `js/PureSuck_Module.js`
- `functions/article.php`
- `functions/render.php`
- `.perf/record.md`
- `RefactorRecord.md`

### 29.3 具体修改
- JS 侧（`js/PureSuck_Module.js`）
  - `runShortcodes` 中移除 `optimizeContentImages` 调用与 cleanup。
  - 删除未再使用的 `optimizeContentImages` 函数整段。
  - 保留图片缩放（medium-zoom）能力，不再承担加载时序调度。
- PHP 侧（`functions/article.php`）
  - `addZoomableToImages()` 统一输出策略：
    - 首张正文图默认 `loading="eager"` + `fetchpriority="auto"`
    - 其余正文图默认 `loading="lazy"` + `fetchpriority="low"`
    - 补齐 `decoding="async"`
    - 继续保留 `data-zoomable` 与排除列表（如头像卡片）。
- 缓存失效（`functions/render.php`）
  - 渲染缓存键 `render_post_content:v2` -> `v3`，确保新输出立即生效。

### 29.4 验证
- 页面检查（`/index.php/archives/281/`）：
  - 首图：`loading=eager`, `decoding=async`, `fetchpriority=auto`
  - 后续正文图：`loading=lazy`, `decoding=async`, `fetchpriority=low`
  - 排除图片（friends avatar）不受影响。

### 29.5 性能（20 runs）
- Targeted 281：`p95/p99=8.5/16.7`, `1%low=59.88`, `slow>16.67=1.12%`, `longTasks=1`
- General：`p95/p99=8.5/16.6`, `1%low=60.24`, `slow>16.67=0.89%`, `longTasks=0`

### 29.6 结论
- 图片加载策略已完全收敛到 PHP 输出，Swup/JS 图片调度已移除。
- 代码复杂度下降，性能保持稳定，符合“别做多余运行时处理”的要求。
