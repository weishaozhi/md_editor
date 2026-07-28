# MD Editor · 项目状态（Project State）

> 本文档回答“当前在哪一步 / 已知问题是什么 / 下一步做什么”。
> 每条 **已知问题** 必须包含 **现象 / 根因 / 证据 / 解决方式** 四段（参见 [`project-bootstrap.md` § 3](./project-bootstrap.md)）。

---

## 1. 当前阶段

- **阶段**：核心功能内测；插件、协作等仍在补齐。
- **最近的交付**（来自 `git log`）：
  - `c46ff89` feat(file+version)：可重命名 / 导出文件 / 版本快照评论
  - `46e72d0` refactor(test)：7 个测试脚本按主题归档
  - `20e4c61` fix(editor)：Monaco 中文输入法按空格选词后内容跳末尾 + 拼音残留
  - `7aaa71e` fix(compare)+feat(editor)：diff 整列染色 + 同步滚动开关
  - `b28bc9c` fix(compare)：版本对比 overlay 代码栏消失
  - `d43aa49` fix(version)：版本时间显示错位 + overlay 滚动失效
  - `5767943` fix(version)：版本面板 X 按钮无响应 + 全屏分屏对比
  - `c486668` fix(editor)：Monaco Find Widget Esc 关闭失效

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