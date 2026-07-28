# MD Editor · 架构文档（ARCH）

> 本文档描述系统的技术形态、模块划分、数据流、部署链路。任何架构级调整需先修改本文件，再回到 [`project_state.md`](./project_state.md) 登记。

---

## 1. 技术栈速览

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | React 18 + TypeScript + Vite + TailwindCSS | 详见 `frontend/package.json` |
| 状态管理 | Zustand（带 `persist` 中间件） | 用户认证、文件树、编辑器本地状态 |
| 数据请求 | TanStack Query（`@tanstack/react-query`） | 版本列表、文件元数据缓存与失效 |
| 编辑器 | Monaco Editor（`@monaco-editor/react`） | 代码高亮、IME、查找面板 |
| Markdown 渲染 | `react-markdown` + `remark-gfm` + `rehype-highlight` + `react-syntax-highlighter` | 预览栏 |
| 后端 | Python 3.11+ / FastAPI / Uvicorn | 详见 `backend/requirements.txt` |
| ORM | SQLAlchemy 2.x + aiosqlite | 默认 SQLite，便于本地零依赖启动 |
| 鉴权 | python-jose (JWT) + passlib[bcrypt] | 详见 [`../docs/API.md` § 认证](../API.md) |
| 实时协作 | WebSocket（Socket.IO） | 已挂载在 `/ws`，前端用 `socket.io-client` |
| 日志 | 后端 `logging` 模块 + 前端 Vite 文件日志插件 | 后端日志必须打印（见 [`project-bootstrap.md` § 2.4](./project-bootstrap.md)） |

---

## 2. 仓库与目录结构

```
md_editor/
├── backend/
│   ├── app/
│   │   ├── api/            # 路由：auth, files, versions, plugins, collaboration, export, websocket
│   │   ├── models/         # ORM 模型
│   │   ├── schemas/        # Pydantic 契约
│   │   ├── utils/          # security, dependencies
│   │   ├── config.py       # 全局配置（pydantic-settings）
│   │   ├── database.py     # 异步 DB 初始化
│   │   └── main.py         # FastAPI 入口 + 全局异常处理
│   ├── test/               # 手工 / E2E / 单元测试，按主题归档
│   ├── logs/               # 后端日志（.gitignore 已排除）
│   ├── workspace/          # 服务端文件工作目录（.gitignore 已排除）
│   ├── start.bat / stop.bat / restart.bat / status.bat
│   ├── run.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/          # LoginPage / DashboardPage / EditorPage / SettingsPage
│   │   ├── components/     # VersionPanel / CompareOverlay / FileTree 等
│   │   ├── store/          # zustand stores
│   │   ├── services/       # axios 实例 + authApi 等
│   │   └── App.tsx
│   ├── logs/               # Vite 启动 / 错误日志（.gitignore 已排除）
│   ├── vite.config.ts      # 含 /api 与 /ws 代理 + 文件日志插件
│   └── package.json
├── docs/
│   ├── API.md              # 后端接口契约
│   ├── MAINTENANCE.md      # 历史故障与修复
│   ├── TESTS.md            # 手工测试脚本索引
│   └── project/            # 启动期规划与规范
│       ├── project-bootstrap.md
│       ├── prd.md
│       ├── arch.md
│       ├── project_state.md
│       ├── test.md
│       └── git-usage.md
└── README.md
```

---

## 3. 模块划分（前后端）

### 3.1 后端模块

| 模块 | 路径 | 职责 | 输入 / 输出 |
|---|---|---|---|
| `auth` | `app/api/auth.py` + `app/utils/security.py` | 注册、登录、JWT 签发、`/auth/me` | 输入：用户凭据；输出：`access_token`、用户信息 |
| `files` | `app/api/files.py` | 文件树、CRUD、重命名、导出 | 依赖 `current_user` 鉴权；落库 + 工作区文件 |
| `versions` | `app/api/versions.py` | 创建快照、列表、查看单版本、回滚 | 绑定 `file_id`；快照内容独立表 |
| `export` | `app/api/export.py` | `.md` / `.html` 导出，中文文件名按 RFC 5987 | 依赖 `files` 模块的元数据 |
| `collaboration` | `app/api/collaboration.py` | 协作元信息 | 通过 WebSocket 联动 |
| `websocket` | `app/api/websocket.py` | 实时编辑广播（光标、内容 diff 广播） | 与前端 `socket.io-client` |
| `plugins` | `app/api/plugins.py` | 插件市场元数据 | 本地静态 + 远端占位 |
| `models` | `app/models/*.py` | User / File / Version / Plugin | SQLAlchemy ORM |
| `schemas` | `app/schemas/*.py` | Pydantic 契约 | 与 `docs/API.md` 对齐 |

### 3.2 前端模块

| 模块 | 路径 | 职责 |
|---|---|---|
| 路由壳 | `App.tsx` | 等待 `useAuthStore.persist` 水合后渲染路由；显式 `Navigate` 守卫 |
| 状态 | `store/authStore.ts` 等 | 用户态、UI 态；持久化用 `persist` |
| 网络 | `services/api.ts` | axios 实例；拦截器从 zustand 取 token；401 → 清 store + 跳登录 |
| 页面 | `pages/*` | Login / Dashboard / Editor / Settings |
| 编辑器 | `components/Editor*` | Monaco 绑定、IME、查找面板 |
| 版本 | `components/VersionPanel`, `components/CompareOverlay` | 列表、对比、回滚 |
| 文件树 | `components/FileTree` | dnd-kit 拖拽 + CRUD |

---

## 4. 数据流（关键路径）

### 4.1 登录

```
LoginPage (form)
  → authApi.login() POST /auth/login
  → setToken(jwt)
  → navigate('/', { replace: true })
App.tsx
  → 等 useAuthStore.persist.hasHydrated()
  → 渲染 Routes；守卫按 isAuthenticated 决定渲染/重定向
```

### 4.2 编辑 → 保存版本

```
EditorPage
  → onChange (节流 1s) PUT /files/{id}
  → 用户点"保存版本" POST /files/{id}/versions (comment 可选)
  → 成功后 invalidateQueries(['versions', Number(id)])  → VersionPanel 刷新
```

### 4.3 版本对比 → 回滚

```
VersionPanel 选择 vA、vB
  → GET /files/{id}/versions/{num} × 2
  → CompareOverlay 计算行级 diff，整列染色
  → 点击"恢复 vA" POST /files/{id}/versions/{num}/restore
  → 服务端把 vA 内容写回主文件，并产生新快照
```

### 4.4 协作

```
EditorPage onChange
  → socket.emit('doc:update', { fileId, content, cursor })
  → 服务端按 fileId 广播给同房间其他客户端
  → 远端 EditorPage 收到后合并（基础 last-write-wins，CRDT 后续迭代）
```

---

## 5. 安全

- **JWT**：HS256，过期时间由 `app/config.py` 控制；401 一律清 store + 跳登录。
- **授权**：每个写入接口经 `Depends(current_user)` 与对象级权限校验（`owner_id` 匹配）；越权返回 403。
- **CORS**：开发期 `allow_origins=["*"]`；上线前必须收敛到具体域名。
- **密钥**：JWT secret 通过环境变量读取；**API Key / 数据库密码不进仓库**（见 `git-usage.md`）。
- **日志**：不得打印 token、密码、邮箱原文；如必须调试，请 mask（`***`）。

---

## 6. 启动与部署链路

### 6.1 本地

- 后端：`backend/start.bat` → `python run.py`（Uvicorn，`:8000`）。
- 前端：`cd frontend && npm run dev`（Vite，`:5173` 启动后自动跳转 `:5174`）。
- 代理：所有 `/api/*` 与 `/ws/*` 走 Vite 代理到 `localhost:8000`。

### 6.2 启停

- `backend/start.bat`：先后端再前端，写入日志到 `backend/logs/` 与 `frontend/logs/`。
- `backend/stop.bat`：通过 `Get-NetTCPConnection -LocalPort` 查 PID 后 `taskkill /F /T /PID`，**禁止**按进程名批量杀（避免误杀 Cursor / 其他 python/node）。详见 `docs/MAINTENANCE.md` § 13。

### 6.3 上线

- 后端建议：Gunicorn + Uvicorn workers（`uvicorn[standard]` 已装）+ 反向代理（Nginx）。
- 前端：`npm run build`，产物放在 Nginx 静态目录；`/api` `/ws` 反代到后端。
- 数据库：默认 SQLite 自用；上线建议 Postgres + Alembic 迁移。

---

## 7. 可观测性

- **后端**：所有 API 路由需打印 INFO（含 method/path/status/duration），错误路径 ERROR + `traceback.format_exc()`（见 `app/main.py` 全局处理器）。
- **前端**：Vite 启动日志 + `console.error` 写入 `frontend/logs/vite.log`（见 `vite.config.ts` 文件日志插件）。
- **健康检查**：`GET /health` → `{"status":"healthy"}`。

---

## 8. 已知架构债（登记在 [`project_state.md`](./project_state.md)）

- 协作仅做广播，无 CRDT/OT，复杂并发可能产生内容抖动。
- 插件系统 UI 已完成，运行时未完全打通。
- CORS 当前为 `*`，上线前需收敛。
- `allow_credentials=True` + `*` 同时开启在浏览器侧将被拒绝，需在收敛 CORS 时一并处理。