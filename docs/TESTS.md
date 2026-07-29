# MD Editor - 测试脚本索引

本目录列出项目中所有手工测试 / 端到端测试脚本。所有脚本都在 [`backend/test/`](../backend/test/) 下，按主题分子目录组织。

---

## 目录结构

```
backend/test/
├── 01_auth/                       # 登录 / 鉴权
│   └── test_login_flow.py
├── 02_version/                    # 版本控制 API 端到端
│   ├── test_version_flow.py
│   ├── test_userflow.py
│   └── test_frontend_key_consistency.py
├── 03_version_ui/                 # 版本 UI 相关算法验证（纯 Python 模拟前端 TS 逻辑）
│   ├── test_compare_overlay_logic.py
│   └── test_format_date_logic.py
├── 04_editor_sync/                # 编辑器 ↔ 预览同步滚动
│   └── test_sync_scroll_ratio.py
├── 05_export_rename/             # 导出 / 重命名 / 版本评论（3 个新功能 E2E）
│   └── test_rename_export_version_comment.py
├── 06_stop_bat_test/              # stop.bat 终点终止验证（防止误杀）
│   └── test_stop_bat.py
└── 07_trash/                      # 垃圾桶功能测试
    ├── test_trash_api.py
    └── test_report.md
```

---

## 1. `01_auth/` — 登录 / 鉴权

### `test_login_flow.py`

| 项 | 内容 |
|---|---|
| **类型** | 端到端 HTTP 测试（urllib + JSON） |
| **目标接口** | `/api/auth/register`, `/api/auth/login` |
| **前置** | 后端已启动（`http://localhost:8000`） |
| **覆盖场景** | 8 项：注册成功 / 重复注册 / 密码错 / 缺字段 / 正常登录 / 错密码 / 无 token 受保护接口拒绝 / 错 token 受保护接口拒绝 |
| **解决的问题** | 章节 1（登录后无法跳转根本修复） + 章节 2（首次修复未根本解决）—— 验证 auth store / Zustand 持久化 / 401 鉴权链路 |
| **运行** | `python backend/test/01_auth/test_login_flow.py` |
| **退出码** | 0 = 全部通过；非 0 = 有失败用例 |

---

## 2. `02_version/` — 版本控制端到端

### `test_version_flow.py`

| 项 | 内容 |
|---|---|
| **类型** | 端到端 HTTP 测试（注册 → 创建文件 → 多版本 → 列出 → 恢复） |
| **目标接口** | `/api/files/<id>/versions` (GET / POST / 单版本 GET / `restore` POST) |
| **前置** | 后端已启动（`http://localhost:8000`） |
| **覆盖场景** | 3 大场景：未登录 401 拒绝 / 登录后创建多版本+列表+单版本查看 / 恢复到旧版本并验证文件回退 |
| **解决的问题** | 章节 8 / 9 / 10（版本面板 + 对比 Overlay + 同步滚动一系列修复）—— 验证后端 `restore` 接口、`version_num` 递增、DESC 排序 |
| **运行** | `python backend/test/02_version/test_version_flow.py` |
| **退出码** | 0 = PASS；1 = 有 ASSERT 失败；2 = 异常 |

### `test_userflow.py`

| 项 | 内容 |
|---|---|
| **类型** | 端到端模拟"用户编辑→保存版本→面板刷新"完整业务链路 |
| **目标接口** | `/api/files/<id>` (PUT), `/api/files/<id>/versions` (POST / GET) |
| **前置** | 前端 + 后端都启动（`http://localhost:5174/api` —— Vite 代理） |
| **覆盖场景** | 7 步：注册→建文件→初次 GET versions（应空）→PUT 修改→POST 创建版本→GET versions（含新版本）→再次 PUT+POST→GET 应有 2 条（首条 version_num=2，DESC 排序） |
| **解决的问题** | 章节 8 修复"版本面板 X 按钮无响应" + 全栈联调验证 —— 模拟 React Query 的 invalidate 链路，确认后端 API 行为符合前端缓存预期 |
| **运行** | `python backend/test/02_version/test_userflow.py` |
| **注意** | 该脚本**打印详细日志**而非 PASS/FAIL 计数（用户流程断言失败会 raise）；依赖 Vite 代理端口 `5174` |

### `test_frontend_key_consistency.py`

| 项 | 内容 |
|---|---|
| **类型** | 跨层契约验证（React Query key 一致性 + 端到端 HTTP） |
| **目标** | 验证前端 `EditorPage.onSuccess` 的 `invalidateQueries({ queryKey: ['versions', Number(fileId)] })` 与 `VersionPanel.useQuery({ queryKey: ['versions', fileId] })` 的 key 哈希一致 |
| **覆盖场景** | 注册→建文件→PUT v1→createVersion v1→PUT v2→createVersion v2→GET versions→比对 key 哈希（`json.dumps(['versions', int])` 必须完全一致） |
| **解决的问题** | 章节 9 中"版本时间显示错位 + overlay 滚动失效/预览被挤出" —— 根因之一是 React Query key 类型不一致（`number` vs `string`）导致 invalidate 不命中缓存；本测试通过 Python 端 `json.dumps` 模拟 React Query 的 key 哈希函数，断言两侧必须完全相同 |
| **运行** | `python backend/test/02_version/test_frontend_key_consistency.py` |

---

## 3. `03_version_ui/` — 版本 UI 算法验证（纯 Python 模拟前端 TS）

### `test_compare_overlay_logic.py`

| 项 | 内容 |
|---|---|
| **类型** | 纯 Python 单元测试（不依赖后端） |
| **目标函数** | `CompareOverlay.tsx` 中的 `buildRemovedRows` / `buildAddedRows` |
| **覆盖场景** | 4 个：纯新增行 / 纯删除行 / 中段删除 / 头段删除 |
| **解决的问题** | 章节 8 + 10 —— 验证 diff 行号在单侧 / 双侧场景下不越界，新增/删除/上下文三类 change 的行号映射规则正确 |
| **运行** | `python backend/test/03_version_ui/test_compare_overlay_logic.py` |
| **断言形式** | 每场景打印 `[PASS] 标签` 或 `[FAIL] 标签 + 详情`；退出码 0/1 |

### `test_format_date_logic.py`

| 项 | 内容 |
|---|---|
| **类型** | 纯 Python 单元测试（不依赖后端） |
| **目标函数** | `VersionPanel.tsx` 中的 `formatDate` —— UTC 兜底 + Asia/Shanghai 渲染 |
| **覆盖场景** | 5 个：无 tz 后缀 + 22:50 → 22:50 (UTC) / 'Z' 后缀同上 / '+08:00' 后缀转本地 22:50 / 同日多版本排序 / 跨日版本排序 |
| **解决的问题** | 章节 9 中"版本时间显示错位" —— 验证 `formatDate` 解析 ISO 字符串时正确处理 UTC 兜底与本地时区转换，避免排序错乱 |
| **运行** | `python backend/test/03_version_ui/test_format_date_logic.py` |

---

## 4. `04_editor_sync/` — 编辑器 ↔ 预览同步滚动

### `test_sync_scroll_ratio.py`

| 项 | 内容 |
|---|---|
| **类型** | 纯 Python 数学验证（不依赖后端） |
| **目标函数** | `EditorPage.tsx` 中 `handleEditorScroll` / `handlePreviewScroll` 的比例算法 |
| **覆盖场景** | 7 个数学场景：src 顶端→dst 顶端 / src 末端→dst 末端 / src 中点→dst 中点 / src 不可滚动→dst 不变 / 比例 0.3 / 比例 0.7 / 比例边界 0.0 与 1.0 |
| **解决的问题** | 章节 10 —— 验证同步滚动比例公式 `dst.scrollTop = ratio × (dst.scrollHeight − dst.clientHeight)` 在所有边界条件下正确，避免单边滚动超出范围 |
| **运行** | `python backend/test/04_editor_sync/test_sync_scroll_ratio.py` |

---

## 5. `05_export_rename/` — 导出 / 重命名 / 版本评论（3 个新功能 E2E）

### `test_rename_export_version_comment.py`

| 项 | 内容 |
|---|---|
| **类型** | 端到端 HTTP 测试（注册 → 改 → 测响应头 → 测错误路径） |
| **目标接口** | `PUT /files/{id}` (rename) / `GET /files/{id}/export?format=md\|html` (导出) / `POST /files/{id}/versions` (带 comment) |
| **前置** | 后端已启动（`http://localhost:8000`） |
| **覆盖场景** | 3 大块共 36 项断言：<br>**重命名** (6 项) — 普通改名、空串行为、中文改名、未授权 401、他人文件 403、content 保持不变<br>**导出** (21 项) — md / html 两种格式的 Content-Type、Content-Disposition、文件名规则、内联 CSS、列表/代码块渲染、401/403/404/422 错误路径、RFC 5987 中文文件名<br>**版本评论** (9 项) — 中文评论、空评论、无 comment 字段、长评论、版本号递增、列表 DESC 排序 |
| **解决的问题** | 章节 12 —— 验证 3 个新功能：可编辑文件名、导出文件 (.md / .html)、保存版本快照可加评论 |
| **运行** | `python backend/test/05_export_rename/test_rename_export_version_comment.py` |
| **退出码** | 0 = 全部通过；1 = 有失败用例；2 = 异常 |

---

## 6. `06_stop_bat_test/` — stop.bat 端到端 + 源码契约测试

### `test_stop_bat.py`

| 项 | 内容 |
|---|---|
| **类型** | 半自动 E2E（运行 stop.bat 实际杀进程 + 静态源码契约校验） |
| **目标** | 验证修复后的 `stop.bat` 真的能 kill 占用 8000/5173 端口的进程，**且不误杀其他 python/node 进程** |
| **前置** | 前后端均已启动（`start.bat`） |
| **覆盖场景** | 共 17+ 项断言：<br>**Part 1 源码契约** (~7 项) — 必须用 `Get-NetTCPConnection -LocalPort` 查 PID；必须 `taskkill /F /T /PID` 杀进程树；禁止 `Stop-Process -Name python/node`；禁止 `taskkill /F /IM python.exe / node.exe`；必须 `setlocal enabledelayedexpansion`；端口释放 timeout ≥ 2s<br>**Part 2 实际执行** (~9 项) — 前置：8000/5173 监听中；stop 前 `/docs` 200；stop 后两个端口均无 PID；stop 后 `/docs` 不可达；**宿主机 python/node 进程数不被误杀**（python ≤ 1，node ≤ 3）；被杀 PID 恰是占用端口的 PID<br>**Part 3 幂等性** (4 项) — 重复 stop 在无服务环境下 exit=0；输出含"后端未运行/前端未运行/所有服务已停止"提示 |
| **解决的问题** | 章节 13 —— 旧 `stop.bat` 用 `Stop-Process -Name python/node` 批量 kill，会误杀 Cursor 内置 TS/ESLint 节点、用户其他 Python/Node 应用；现改为按端口 PID 精确查询 + `taskkill /F /T /PID` 进程树终止 |
| **运行** | `python backend/test/06_stop_bat_test/test_stop_bat.py` |
| **退出码** | 0 = PASS；1 = 有 FAIL |
| **副作用** | 运行后会真的停止前后端 —— 跑完本测试后请用 `start.bat` 重启 |

---

## 7. `07_trash/` — 垃圾桶功能测试

### `test_trash_api.py`

| 项 | 内容 |
|---|---|
| **类型** | 端到端 HTTP 测试 |
| **目标接口** | `/api/files/{id}` (DELETE 软删除), `/api/trash` (GET), `/api/trash/{id}/restore` (POST), `/api/trash/{id}` (DELETE 永久删除), `/api/trash/empty` (DELETE 清空), `/api/trash/settings` (GET/PUT) |
| **前置** | 后端已启动（`http://localhost:8000`），需重启以加载新路由 |
| **覆盖场景** | 创建文件/文件夹、软删除、获取垃圾桶列表、恢复文件、永久删除、垃圾桶设置、清空垃圾桶 |
| **解决的问题** | 垃圾桶功能实现后的验证测试 |
| **运行** | `python backend/test/07_trash/test_trash_api.py` |
| **退出码** | 0 = 全部通过；1 = 有失败用例 |
| **注意事项** | 后端服务需要重启才能加载 `/trash` 路由 |

---

## 使用约定

### BASE URL

| 测试 | 默认 BASE | 原因 |
|---|---|---|
| `01_auth/*`, `02_version/test_version_flow.py` | `http://localhost:8000/api` | 直连后端 FastAPI |
| `02_version/test_userflow.py`, `02_version/test_frontend_key_consistency.py` | `http://localhost:5174/api` | 走 Vite 代理（与前端同源，模拟真实跨域行为） |
| `03_version_ui/*`, `04_editor_sync/*` | 无 | 纯 Python 单元 / 数学测试，不发 HTTP |

### 启动命令速查

```bash
# 启动后端 (FastAPI)
cd backend
python run.py                    # uvicorn on :8000

# 启动前端 (Vite)
cd frontend
npm run dev                      # Vite on :5174

# 运行所有测试 (按主题顺序)
python backend/test/01_auth/test_login_flow.py
python backend/test/02_version/test_version_flow.py
python backend/test/02_version/test_userflow.py
python backend/test/02_version/test_frontend_key_consistency.py
python backend/test/03_version_ui/test_compare_overlay_logic.py
python backend/test/03_version_ui/test_format_date_logic.py
python backend/test/04_editor_sync/test_sync_scroll_ratio.py
python backend/test/05_export_rename/test_rename_export_version_comment.py
```

### 退出码约定

| 退出码 | 含义 |
|---|---|
| 0 | 全部断言通过 |
| 1 | 至少一个 `[FAIL]`（单元 / 数学测试）或 `AssertionError`（端到端） |
| 2 | 脚本异常（非断言错误） |

---

## 索引：测试 ↔ 问题章节对照

| 测试文件 | 验证的问题 |
|---|---|
| `01_auth/test_login_flow.py` | 章节 1（登录跳转根本修复）、章节 2（首次修复未根本解决） |
| `02_version/test_version_flow.py` | 章节 8（版本面板 + 对比 Overlay）、章节 9（版本时间显示）、章节 10（diff 整列染色 + 同步滚动）的后端 API |
| `02_version/test_userflow.py` | 章节 8 的全栈联调（EditorPage invalidate → VersionPanel useQuery） |
| `02_version/test_frontend_key_consistency.py` | 章节 9 —— React Query key 类型一致性（number vs string） |
| `03_version_ui/test_compare_overlay_logic.py` | 章节 8 + 10 —— diff 行号映射算法 |
| `03_version_ui/test_format_date_logic.py` | 章节 9 —— 时区格式化与排序 |
| `04_editor_sync/test_sync_scroll_ratio.py` | 章节 10 —— 同步滚动比例公式 |
| `05_export_rename/test_rename_export_version_comment.py` | 章节 12 —— 3 个新功能 E2E（重命名 / 导出 / 版本评论） |
| `07_trash/test_trash_api.py` | 垃圾桶功能（软删除、恢复、永久删除、设置） |

完整的问题描述、根因、修复方案见 [`docs/MAINTENANCE.md`](./MAINTENANCE.md)。