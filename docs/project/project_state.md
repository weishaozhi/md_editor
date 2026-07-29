# MD Editor · 项目状态（Project State）

> 本文档回答“当前在哪一步 / 已知问题是什么 / 下一步做什么”。
> 每条 **已知问题** 必须包含 **现象 / 根因 / 证据 / 解决方式** 四段（参见 [`project-bootstrap.md` § 3](./project-bootstrap.md)）。

---

## 1. 当前阶段

- **阶段**：核心功能 + 文件管理增强（垃圾桶、拖拽嵌套）功能完成
- **最近的交付**（来自 `git log`）：
  - `7644afa` feature：文件树拖拽嵌套修复（5/5 测试通过）
  - `4aab6fd` feature(trash)：垃圾桶功能（软删除、恢复、永久删除、自动清理保留时间）
  - `226028b` docs：更新日志
  - `6d6548e` Co-authored：代码协作

> 详细问题与修复过程见 [`../MAINTENANCE.md`](../MAINTENANCE.md)。

---

## 2. 下一步行动（按优先级）

| # | 任务 | 关联文档 | 验收 |
|---|---|---|---|
| 1 | 收口 `editor + version` 一系列修复，跑全量 `01_*` ~ `05_*` 测试 | [`test.md`](./test.md) | 全部退出码 0 |
| 2 | 协作 WebSocket 引入 CRDT/OT（至少保证两人同时编辑不丢字符） | [`arch.md` § 4.4](./arch.md) | 双客户端并发用例通过 |
| 3 | 插件系统运行时打通 | [`arch.md` § 3.1](./arch.md) | 安装/启用一个内置插件 |
| 4 | 收敛 CORS 与 secret 配置为环境变量 | [`arch.md` § 5/6](./arch.md) | `.env.example` + 启动校验 |
| 5 | 建立 CI：PR 触发 lint + 关键测试 | [`git-usage.md`](./git-usage.md) | PR 红→绿可见 |
| 6 | 登录错误限频策略落地 | [`prd.md` § 3.2](./prd.md) | N 次/分钟返回 429 |

---

## 3. 已知问题（含现象 / 根因 / 证据 / 解决方式）

> 命名约定：**状态：🟥 未处理 / 🟨 处理中 / 🟩 已解决**
> 已解决的问题沉淀到 [`../MAINTENANCE.md`](../MAINTENANCE.md) 后，从本节删除，避免双写。

### 3.1 当前未处理

#### ISS-001 🟥 协作并发丢字符
- **现象**：两个客户端同时编辑同一文件，偶发内容覆盖。
- **根因**：当前仅做 WebSocket 广播 + last-write-wins，没有 CRDT/OT 合并。
- **证据**：
  - 最小复现：开两个浏览器登录不同账号进入同一文件，A 在第 5 行连续输入，B 在第 10 行连续输入 → B 的部分字符在 A 端被回滚。
  - 日志：前后端均未打印协作冲突事件。
- **解决方式**：
  1. 短期：服务端为每个 `fileId` 维护 last-write 时间戳 + 内容长度校验，冲突时拒绝并发写入并要求客户端重拉。
  2. 中期：引入 `yjs` / 自研 OT，至少解决字符级合并。
  3. 测试：写一个双 WebSocket 客户端用例，断言最终两端内容一致。

#### ISS-002 🟥 插件运行时未联通
- **现象**：UI 上能看到插件列表，但启用/禁用无实际效果。
- **根因**：`app/api/plugins.py` 仅返回元数据，未注册 hook 或调用入口。
- **证据**：
  - 调用 `POST /api/plugins/{id}/enable` 返回 200，但下次启动状态丢失。
  - 源码 `app/api/plugins.py` 中无 `apply(plugin)` / `register` 逻辑。
- **解决方式**：
  1. 设计插件 manifest 规范（`id`、`entry`、`hooks`）。
  2. 后端在 `app/plugins_runtime/` 下实现 `PluginManager`（注册 → 启动钩子）。
  3. 增加一个最小插件用例，启用 → 钩子触发 → 关闭 → 钩子解绑。

#### ISS-003 🟥 CORS / 安全配置上线不可用
- **现象**：`allow_origins=["*"]` + `allow_credentials=True`，上线后浏览器拒绝请求。
- **根因**：浏览器规范不允许同时开启。
- **证据**：`backend/app/main.py` 当前配置。
- **解决方式**：
  1. 通过环境变量 `CORS_ALLOW_ORIGINS` 注入允许来源。
  2. `.env.example` 列出 `CORS_ALLOW_ORIGINS=https://your.domain`。
  3. `app/config.py` 增加校验：非空才允许 `allow_credentials=True`。

#### ISS-004 🟥 登录错误无频控
- **现象**：同一账号可被脚本无限尝试。
- **根因**：`auth.py` 中 `POST /auth/login` 没有限频。
- **证据**：单元测试或脚本以 100 次/秒请求登录，接口稳定 200/401 切换。
- **解决方式**：
  1. 引入内存限频（`slowapi` 或自实现滑动窗口），按 IP + 用户名双键。
  2. 超过阈值返回 429。
  3. PRD § 3.2 验收项更新。

### 3.2 处理中

#### ISS-005 🟨 同步滚动开关与边界 case
- **现象**：上一轮修复后偶发小窗口同步错位。
- **根因**：比例公式边界（参见 `04_editor_sync/test_sync_scroll_ratio.py` 已覆盖大部分）。
- **证据**：新增的 `04_editor_sync` 测试通过，但浏览器实测仍有偶发抖动。
- **解决方式**：
  1. 浏览器侧加 `requestAnimationFrame` 节流，避免高频 setState。
  2. 增加 200ms 内的 last-write-wins，丢弃中间帧。

### 3.3 已解决（已沉淀到 `MAINTENANCE.md`，此处不重复）

- 登录后无法跳转（根本修复） — 见 `MAINTENANCE.md` § 1
- 版本面板 X 无响应 + 对比 Overlay — § 8
- 版本时间显示错位 + 预览被挤出 — § 9
- diff 整列染色 + 同步滚动开关 — § 10
- Monaco IME 中文输入跳末尾 — § 11
- Find Widget Esc 失效 — `MAINTENANCE.md` 索引
- stop.bat 误杀进程 — `MAINTENANCE.md` § 13 / `06_stop_bat_test/`
- **ISS-TRASH-001 垃圾桶功能数据库列缺失 + 路由顺序错误** — 见 `update/2026-07-29_16-22.md`
- **ISS-TREE-001 文件树拖拽和嵌套功能** — 见 `update/2026-07-29_18-15.md` + `MAINTENANCE.md` § 12

#### ISS-TREE-001 🟩 文件树拖拽 + 嵌套支持
- **问题**：文件树不支持拖拽到文件夹、文件夹展开按钮无效、不支持嵌套、parent_id null 无法显式设置
- **现象**：
  1. 拖拽文件到文件夹不进入文件夹
  2. Chevron 按钮无响应
  3. `POST /files` 创建子文件夹返回 400
  4. 将文件移回根目录时 API 报 parent_id 不能解析
- **根因**：详见 `MAINTENANCE.md` § 12（4 层根因分解）
- **证据**：
  - 最小复现：创建 2 个根文件夹 → 拖拽其中一个到另一个 → 文件未移动
  - 锁定测试：`backend/test/07_trash/test_drag_folder.py`（5/5 通过）
- **解决方式**：
  - 前端 FileTree 添加 onDragOver/onDrop 区域 + Chevron 用 onMouseDown + 哨兵值 `__none__`
  - 后端移除嵌套硬编码限制 + schema parent_id 改 `Union[int, str]`
- **关联文件**：见 `MAINTENANCE.md` § 12.6

#### ISS-TREE-002 🟩 文件夹展开/收起按钮无效 + 嵌套视觉未区分 + 状态不持久化
- **问题**：`update/2026-07-29_18-15.md` 中虽声明"修复 Chevron 按钮无效"，但仅切换图标，未把展开状态接入渲染层，导致 children 始终显示；嵌套子项与外部文件视觉平铺；刷新后展开状态全部丢失
- **现象**：
  1. 点击 Chevron 图标后图标切换，但文件夹内部文件始终显示，无法收起
  2. 嵌套子项与外部文件视觉上无分组、无缩进
  3. 浏览器刷新后所有文件夹回到默认收起状态
- **根因**：详见 `MAINTENANCE.md` § 13（3 层根因分解）
- **证据**：
  - 最小复现：建一个外层文件夹 + 子文件夹 + 子文件 → 点击 Chevron → 子文件未隐藏
  - 锁定测试：`backend/test/07_trash/test_folder_expand_ui.py`（5/5 通过；覆盖后端嵌套树 / 默认收起 / toggle 切换 / Set↔JSON 序列化 / 源码静态契约）
- **解决方式**：
  - `FileTree.tsx` 递归渲染处加 `isFolderExpanded(item.id)` 守卫，子 `FileTree` 用 `ml-4 pl-2 border-l` 包裹
  - `fileStore.ts` 接入 Zustand `persist`：Set↔Array 序列化往返
- **关联文件**：见 `MAINTENANCE.md` § 13.6

---

## 4. 风险与决策记录（ADR-lite）

| 日期 | 决策 | 上下文 | 影响 |
|---|---|---|---|
| 2026-07-29 | 默认数据库保持 SQLite，上线建议 Postgres | 自用为主；减少本地启动成本 | 上线前需迁移脚本 |
| 2026-07-29 | 鉴权使用 JWT（HS256），不引入 OAuth | 单机部署、用户规模小 | 多端 SSO 后续讨论 |
| 2026-07-29 | 协作先采用广播 + last-write-wins | 快速验证产品形态 | 复杂编辑需 CRDT/OT |
| 2026-07-29 | 测试以“按主题归档的 Python 脚本”为主 | 不引入重型框架，便于手工 + 自动化 | CI 阶段补 pytest |

---

## 5. 状态更新约定

- 每周一次：复核“下一步行动”，过期项迁移到“已完成 / 已知问题 / 搁置”。
- 任何 PR 合并：在“已知问题”增加一条（🟩/🟥/🟨），并在 `MAINTENANCE.md` 同步。
- 版本号变更：写一行到表 4 决策记录，并同步 [`git-usage.md` 版本规则](./git-usage.md)。