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
└── 04_editor_sync/                # 编辑器 ↔ 预览同步滚动
    └── test_sync_scroll_ratio.py
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

完整的问题描述、根因、修复方案见 [`docs/MAINTENANCE.md`](./MAINTENANCE.md)。