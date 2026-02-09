# 重构记录（Refactor Record）

更新时间：2026-02-09
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
- 结果：保持“sidebar 在 swup 外 + 统一骨架输出”的规范，同时尽量贴近旧版视觉参数。
