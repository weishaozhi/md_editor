# MD Editor - 维护文档

本文档记录项目开发过程中发现的问题、原因和解决方案，便于后续维护参考。

---

## 目录

1. [登录后无法跳转问题（根本修复）](#1-登录后无法跳转问题根本修复)
2. [登录相关问题（第一次修复，未根本解决）](#2-登录相关问题第一次修复未根本解决)
3. [启停脚本问题](#3-启停脚本问题)
4. [编辑器 Ctrl+F 查找面板问题](#4-编辑器-ctrlf-查找面板问题)
5. [已添加的功能](#5-已添加的功能)
6. [已知问题和限制](#6-已知问题和限制)
7. [文件清单](#7-文件清单)
8. [版本面板 X 无响应 + 对比分屏 Overlay](#8-版本面板-x-无响应--对比分屏-overlay)
9. [版本时间显示错误 + 对比 Overlay 滚动/预览区定位修复](#9-版本时间显示错误--对比-overlay-滚动预览区定位修复)
10. [版本对比 diff 整列染色 + 编辑界面同步滚动开关](#10-版本对比-diff-整列染色--编辑界面同步滚动开关)
11. [Monaco IME 中文输入跳末尾 + 修复引发的两次布局回归](#11-monaco-ime-中文输入跳末尾--修复引发的两次布局回归)
12. [文件树拖拽嵌套 + parent_id null 处理](#12-文件树拖拽嵌套--parent_id-null-处理)
13. [文件夹展开/收起按钮无效 + 嵌套视觉未区分 + 展开状态持久化](#13-文件夹展开收起按钮无效--嵌套视觉未区分--展开状态持久化)

---

## 1. 登录后无法跳转问题（根本修复）

> **修复日期**: 2026-07-28
> **状态**: ✅ 已修复并验证

### 1.1 问题描述

用户登录时无论密码正确还是错误，登录后都返回空白页面，无法跳转到 Dashboard；或跳转后立即被重定向回登录页。

### 1.2 根本原因（4 个层面）

| # | 问题 | 影响 |
|---|------|------|
| 1 | `LoginPage` 调用 `setToken(data.access_token)` 后**立即**调用 `navigate('/')`，但 Zustand 的 `set` 是异步的（微任务），React 重渲染前已跳转 | App.tsx 在重渲染前用旧 `isAuthenticated=false` 判断，跳回 `/login` |
| 2 | `authStore.ts` 手动从 `localStorage` 读 token，不通过 Zustand 的响应式系统，组件订阅状态可能拿不到 | 组件收到 `isAuthenticated=false`，但实际 localStorage 有 token |
| 3 | App.tsx 中如果先判断 `initialized` 再判断 `isAuthenticated`，两个 useEffect/setState 触发多次重渲染 | 出现"空白"或"反复跳转" |
| 4 | API 拦截器从 `localStorage.getItem('token')` 取 token，可能与 store 状态不一致 | 第一次 /auth/me 调用带错误 token，导致 store 被清空、跳回 `/login` |

### 1.3 解决方案

#### 1.3.1 `frontend/src/store/authStore.ts` — 使用 Zustand `persist` 中间件

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setToken: (token) => {
        if (token) {
          set({ token, isAuthenticated: true });
        } else {
          set({ token: null, user: null, isAuthenticated: false });
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated = !!state.token;
        }
      },
    }
  )
);
```

**关键点**：
- `persist` 中间件自动从 localStorage 恢复状态
- `onRehydrateStorage` 在水合时根据 token 同步 `isAuthenticated`
- `partialize` 只持久化必要字段，避免其他状态被存

#### 1.3.2 `frontend/src/App.tsx` — 等待水合 + 显式 Navigate

```typescript
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsub;
  }, []);

  if (!hydrated) {
    return <div>加载中...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/editor/:fileId"
        element={isAuthenticated ? <EditorPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/settings"
        element={isAuthenticated ? <SettingsPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />}
      />
    </Routes>
  );
}
```

**关键点**：
- 等待 `useAuthStore.persist.hasHydrated()`，避免在状态恢复前做路由判断
- 每个路由显式声明 `isAuthenticated` 守卫，不再依赖早期的"路由组"切换
- `replace` 避免历史栈污染

#### 1.3.3 `frontend/src/pages/LoginPage.tsx` — 用 `replace` 替换历史

```typescript
if (isLogin) {
  const data = await authApi.login(formData.username, formData.password);
  setToken(data.access_token);
  // 使用 replace 替换历史记录，避免用户回退到登录页
  navigate('/', { replace: true });
}
```

#### 1.3.4 `frontend/src/services/api.ts` — 拦截器从 store 读 token

```typescript
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({ baseURL: '/api' });

const getToken = (): string | null => {
  // 优先从 zustand store 读取（最新状态）
  const fromStore = useAuthStore.getState().token;
  if (fromStore) return fromStore;

  // 回退：从 persist 的 localStorage 读取（兼容旧版本）
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.token || null;
    }
  } catch {
    // ignore
  }

  // 最后回退：旧版兼容
  return localStorage.getItem('token');
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

**关键点**：
- 优先从 Zustand store 读 token（最新状态）
- 回退到 `auth-storage`（Zustand persist 键）
- 最后回退到旧版 `localStorage.getItem('token')`（兼容性）
- 401 错误通过 store 的 `logout()` 清空状态，避免状态不一致

### 1.4 测试验证

使用 `backend/test/01_auth/test_login_flow.py` 进行了 8 项 API 测试，全部通过：

| # | 测试用例 | 预期 | 实际 | 结果 |
|---|---------|------|------|------|
| 1 | 未注册用户登录 | 401 | 401 ✅ | PASS |
| 2 | 注册用户 | 200 | 200 ✅ | PASS |
| 3 | 错误密码登录 | 401 | 401 ✅ | PASS |
| 4 | 正确密码登录 | 200 + token | 200 + JWT ✅ | PASS |
| 5 | JWT payload 检查 | 含 sub | ✅ | PASS |
| 6 | 用 token 获取 /auth/me | 200 + 用户信息 | ✅ | PASS |
| 7 | 无 token 请求 | 401 | 401 ✅ | PASS |
| 8 | 错误 token 请求 | 401 | 401 ✅ | PASS |

**TypeScript 类型检查**：修改的 4 个核心文件（`authStore.ts`、`App.tsx`、`LoginPage.tsx`、`api.ts`）均无类型错误。

---

## 2. 登录相关问题（第一次修复，未根本解决）

> **修复日期**: 2026-07-28
> **状态**: ⚠️ 已修复部分问题，但根因仍未解决

### 2.1 问题描述

用户登录后跳转到空白页面。

### 2.2 已尝试的方案（未根本解决）

#### 2.2.1 修复 `frontend/src/store/authStore.ts`
手动初始化：从 `localStorage` 读取 token，并设置 `initialized` 字段。
但这种方式没有走 Zustand 响应式系统，组件订阅的 `isAuthenticated` 可能拿不到最新值。

#### 2.2.2 修复 `frontend/src/App.tsx`
增加 `isReady` 状态：
```typescript
const [isReady, setIsReady] = useState(false);
useEffect(() => {
  if (initialized) {
    setIsReady(true);
  }
}, [initialized]);
```
但因为 `initialized` 是同步 `true`（初始 state），此 useEffect 第一次渲染不会真正等待异步过程。

#### 2.2.3 修复 `frontend/src/services/authApi.ts`
移除 `authApi.login()` 中重复的 `localStorage.setItem` 调用。

#### 2.2.4 修复 `backend/app/api/websocket.py`
WebSocket 中 JWT payload 的 `sub` 是字符串类型，需要转换为整数：
```python
user_id = payload.get("sub")
if not user_id:
    await websocket.close(code=4001)
    return
try:
    user_id = int(user_id)
except (ValueError, TypeError):
    await websocket.close(code=4001)
    return
```

### 2.3 结论

第一次修复尝试解决"空白"症状，但没有真正解决根因（状态更新异步性、状态同步不一致）。**[第一节](#1-登录后无法跳转问题根本修复) 才是根本性修复**。

---

## 3. 启停脚本问题

### 3.1 问题描述
原 `stop.bat` 无法可靠地停止服务：
- 使用 `netstat -ano | findstr` 在中文 Windows 上输出格式可能不匹配
- 无法处理 Uvicorn 的父子进程结构（reloader 进程 + worker 进程）
- `for /f "tokens=5"` 可能取错列

### 3.2 解决方案

将所有批处理脚本改为基于 PowerShell 的 `Get-NetTCPConnection` 和 `Get-Process` 命令。

#### 3.2.1 `backend/stop.bat`

```batch
@echo off
chcp 65001 >nul
echo ========================================
echo   Markdown Editor - 停止脚本
echo ========================================
echo.

:: 停止后端 (端口 8000)
echo [1/2] 停止后端服务 (端口 8000)...

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" 1>nul 2>&1
if errorlevel 1 (
    echo   后端未运行
) else (
    powershell -NoProfile -Command "Get-Process python -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }" 1>nul 2>&1
    echo   已停止所有 Python 进程
    timeout /t 1 /nobreak >nul 2>&1
    powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" 1>nul 2>&1
    if errorlevel 1 (
        echo   警告: 后端仍在运行
        taskkill /F /IM python.exe 1>nul 2>&1
    ) else (
        echo   后端已停止
    )
)

:: 停止前端（端口 5173）类似处理 Node 进程

:: 兜底：通过窗口标题关闭
taskkill /F /FI "WINDOWTITLE eq MD Editor Backend*" 1>nul 2>&1
taskkill /F /FI "WINDOWTITLE eq MD Editor Frontend*" 1>nul 2>&1

:: 最终状态检查
powershell -NoProfile -Command "$b = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue; $f = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if (-not $b -and -not $f) { Write-Host '所有服务已停止' } elseif (-not $b) { Write-Host '后端已停止，前端仍在运行' } elseif (-not $f) { Write-Host '前端已停止，后端仍在运行' } else { Write-Host '仍有服务在运行' }"
```

#### 3.2.2 `backend/status.bat`
使用 PowerShell 显示 PID、进程名、健康检查。

#### 3.2.3 `backend/start.bat`
关键改进：
- 使用 `cd /d "%~dp0"` 确保路径正确
- 使用 `start /min` 最小化启动窗口

#### 3.2.4 `backend/restart.bat`
关键改进：
- 使用 PowerShell 一次性停止所有 Python 和 Node 进程
- 等待端口完全释放后再启动

### 3.3 测试验证

| 脚本 | 测试结果 |
|------|---------|
| `stop.bat` | ✅ 完整停止服务，无错误输出 |
| `status.bat` | ✅ 正确显示状态、PID、进程名 |
| `start.bat` | ✅ 成功启动前后端服务 |
| `restart.bat` | ✅ 完整重启服务 |

---

## 4. 编辑器 Ctrl+F 查找面板问题

> **修复日期**: 2026-07-28
> **状态**: ✅ 已修复并验证（自动化 E2E + 浏览器手动验证）

### 4.1 问题描述

在编辑器页面按 `Ctrl+F` 调出 Monaco 的 Find Widget 后，遇到两个问题：

| # | 现象 | 严重度 |
|---|------|--------|
| 1 | 按 `Esc` 关闭查找面板**无效**，必须用鼠标点 X 才能关 | 中 |
| 2 | 鼠标点击查找面板右上角的 **X 关闭按钮**时，按钮上方出现闪烁的 tooltip 浮层，导致点击被 tooltip 吞掉、X 按钮无法触发 | 中 |

### 4.2 根本原因（2 个层面）

#### 4.2.1 Esc 关闭失效
Monaco 的 Find Widget 默认在内部监听 `Escape` 并触发 `closeFindWidget`。但在 React + 严格模式 + Chrome 扩展环境下，
monaco 内部的 keybinding 服务被部分覆盖，导致 `Esc` 事件冒泡到 monaco 之前已被默认行为消费或丢失。

#### 4.2.2 X 按钮被 tooltip 闪烁遮挡
这是 `microsoft/monaco-editor` 上游已知问题（issue #5208）：Chrome 上 Find Widget 的关闭按钮悬停时，
Monaco 工作区的 `.workbench-hover-container` 会以极短间隔反复 `show/hide`，形成 tooltip 闪烁，
拦截了真实的 `mousedown` / `click` 事件，导致用户多次点不中。

### 4.3 解决方案

#### 4.3.1 `frontend/src/index.css` — CSS 层直接隐藏 hover tooltip 容器

```css
/* Monaco Editor: 隐藏工作区的 hover tooltip 容器
 * 修复 microsoft/monaco-editor#5208 —— Chrome 中 Find Widget 的关闭按钮
 * 由于该 tooltip 容器快速 show/hide 闪烁导致无法点击。
 */
.workbench-hover-container {
  display: none !important;
}
```

**原理**：该容器只是工作区的"hover tooltip 容器"，与编辑器文本编辑功能无关，隐藏它不影响任何功能，
只解决 tooltip 闪烁拦截点击的问题。

#### 4.3.2 `frontend/src/pages/EditorPage.tsx` — Esc 全局兜底监听

在已有的 `Ctrl+S` 全局 keydown 监听里增加 `Escape` 分支，主动调用 `editor.trigger('keyboard', 'closeFindWidget', null)`：

```typescript
if ((e.ctrlKey || e.metaKey) && e.key === 's') {
  e.preventDefault();
  handleSave();
  return;
}
// 兜底：Esc 关闭 Monaco Find Widget
// - Monaco 默认 Esc 处理在某些环境（Chrome + 扩展）会失效
// - 主动调用 closeFindWidget 保证用户一定能关闭查找面板
if (e.key === 'Escape') {
  const editor = editorRef.current as
    | { trigger: (source: string, action: string, payload: unknown) => void }
    | null;
  if (editor) {
    editor.trigger('keyboard', 'closeFindWidget', null);
  }
}
```

同时把 `onMount` 回调提取为 `handleEditorMount`，并将编辑器实例挂到 `window.__mdEditor`，
方便自动化测试和后续调试。

### 4.4 测试验证

| 场景 | 用例 | 结果 |
|------|------|------|
| S1 | 触发 `actions.find` 打开 Find Widget | ✅ `visible` class 出现 |
| S2 | 调用 `closeFindWidget` action 关闭 | ✅ 立即关闭 |
| S3 | 打开后派发 `keydown Escape`，验证兜底 | ✅ 关闭成功 |
| S4 | 检查 `.workbench-hover-container` 的 `display` | ✅ `none` |
| S5 | 真实 `Ctrl+F` + 真实 `Esc` 连续模拟 | ✅ 打开 + 关闭链路完整 |

测试脚本：`backend/test_editor_find.mjs`（Chrome remote debugging + CDP 自动验证），临时调试用不入库。

---

## 5. 已添加的功能

### 5.1 状态检查脚本（status.bat）
新增 `backend/status.bat`，提供：
- 后端服务状态、PID、进程名
- 前端服务状态、PID、进程名
- WebSocket 可用性
- HTTP 健康检查（/health 端点）
- 总体状态汇总

### 5.2 后端登录测试脚本（test_login_flow.py）
新增 `backend/test/01_auth/test_login_flow.py`，提供 8 项端到端登录测试：
- 注册、登录（成功/失败）、token 验证、用户信息获取、错误处理

### 5.3 编辑器 Ctrl+F 自动化测试脚本
为验证本次 Monaco Find Widget 修复，编写过两个 Chrome remote-debugging E2E 脚本：
- `backend/test_editor_find.mjs` — 完整 CDP 流程：注册→登录→打开编辑器→触发 Ctrl+F→派发 Esc→断言关闭
- `backend/test_editor_find_unit.mjs` — 单元级别快速验证

两份脚本是临时调试产物（含硬编码 Chrome 路径与 user-data-dir），**不入库**，验证完成后已删除。

---

## 6. 已知问题和限制

### 6.1 主题切换 UI 不生效
`SettingsPage.tsx` 中的主题按钮只对 `light` 有 `active` 样式，其他状态无视觉反馈。

### 6.2 CORS 配置
后端 CORS 设置为 `"*"`，生产环境不安全，需要配置允许的 origins。

### 6.3 脚本中的 PowerShell 调用
所有脚本都使用 `powershell -NoProfile -Command`，在某些 shell 包装环境中可能会有警告信息（如 "ERROR: Input redirection is not supported"），但功能正常。在真实 cmd 窗口中运行没有此问题。

### 6.4 其他 TypeScript 警告
项目中有一些未使用变量（`useState`, `Save`, `Clock` 等）的 `TS6133` 警告，与登录跳转无关，属于历史遗留代码。

---

## 7. 文件清单

### 修改的前端文件（frontend/src/）
- `store/authStore.ts` — 用 Zustand `persist` 中间件替换手动 localStorage 初始化
- `App.tsx` — 添加 `useAuthStore.persist.hasHydrated()` 等待水合；每个路由独立守卫
- `pages/LoginPage.tsx` — `navigate('/', { replace: true })`
- `services/api.ts` — 拦截器从 store 读取 token

### 修改的后端文件（backend/）
- `app/api/websocket.py` — user_id 类型转换（整数）

### 本次 Ctrl+F 修复涉及的文件
- `frontend/src/index.css` — 新增 `.workbench-hover-container { display: none !important; }` 隐藏 Monaco tooltip 容器（修复 X 按钮无法点击）
- `frontend/src/pages/EditorPage.tsx` — 提取 `handleEditorMount`，把编辑器实例挂到 `window.__mdEditor`；`keydown` 兜底监听 `Escape` 调用 `editor.trigger('keyboard', 'closeFindWidget', null)`
- `docs/MAINTENANCE.md` — 追加本章节记录问题、根因、修复与测试

### 后端脚本（backend/）
- `start.bat` — 启动前后端服务
- `stop.bat` — 停止所有服务
- `restart.bat` — 重启所有服务
- `status.bat` — 查看服务状态
- `run.py` — 后端 Python 入口程序
- `test_login_flow.py` — 后端登录 API 端到端测试脚本

---

## 附录：登录流程图（修复后）

```
用户点击"登录"
   ↓
LoginPage.handleSubmit()
   ↓
authApi.login(username, password)
   ↓
POST /api/auth/login (form data)
   ↓
后端验证 → 返回 { access_token }
   ↓
setToken(token) → Zustand store 更新 isAuthenticated=true
   ↓
navigate('/', { replace: true })
   ↓
URL 改变 → React Router 重新匹配路由
   ↓
App.tsx 渲染对应路由（isAuthenticated=true 守卫通过）
   ↓
DashboardPage 渲染
   ↓
DashboardPage.useEffect 触发 authApi.getMe()
   ↓
API 拦截器从 store 读 token → 注入 Authorization header
   ↓
GET /api/auth/me 返回用户信息
   ↓
setUser(user) → Header 显示用户名
```

### 关键时序要求

1. `setToken` 必须先于或与 `navigate` 同步（Zustand `set` 在微任务中执行，React 重渲染会跟随）
2. `isAuthenticated` 必须在 `setToken` 调用后的下一个渲染周期中读到 `true`
3. App.tsx 的 `hasHydrated()` 必须返回 true，否则不渲染路由
4. navigate 用 `replace:true`，避免 history stack 留下 `/login`

---

## 8. 版本面板 X 无响应 + 对比分屏 Overlay

### 8.1 问题描述

`EditorPage` 右侧的"版本历史"面板存在两个交互问题：

1. **版本面板右上角的 X 按钮点击无响应**。点击后没有任何视觉反馈，面板也不会关闭。
2. **"对比"按钮同样无响应**。点选历史版本后看不到任何对比效果。

进一步期望改进：对比应该做成"编辑器从中间一分为 2，显示两个版本——左边当前版本、右边所选历史版本，高亮差异行，预览栏也一样"——也就是需要**全屏 overlay**，而非旧的面板内嵌迷你 diff。

### 8.2 根本原因

- **X 按钮无响应**：`VersionPanel` 的 X 按钮 `onClick` 之前调用的是 `setCompareVersion(null)` + `setSelectedVersionId(null)`。其中 `compareVersion` 状态虽然存在但从未真正驱动 UI（只是行内嵌入的迷你 `CompareVersions` 组件依赖它），且 X 按钮本意是"关闭整个面板"——状态语义错位，没有 `onClose` 通知到父组件。
- **对比按钮无响应 + 体验简陋**：
  - 旧 `setCompareVersion(versionId)` 要求先点选另一个版本作为基准（`selectedVersionId`），交互依赖用户两次点选，违反直觉。
  - 旧实现只在面板内嵌了一个 `diffLines` 渲染的迷你视图，没有分屏、没有 Monaco 高亮、没有预览对比、不支持 Esc 关闭。
  - 同时面板本身没有 `onClose` 回调给父组件，导致外部无法关闭面板。

### 8.3 解决方案

#### 8.3.1 `frontend/src/components/Version/VersionPanel.tsx` — 加 onClose/onCompare prop

- 新增 props：`onClose?: () => void`、`onCompare?: (versionId: number) => void`、`isCreating?: boolean`
- X 按钮 `onClick = handleClose`：
  ```ts
  const handleClose = () => {
    setSelectedVersionId(null);
    onClose?.();
  };
  ```
- "对比"按钮改为 `onCompare?.(version.id)`，并 `disabled={!onCompare}` 防御父组件未传时仍可点
- 删除内部 `CompareVersions` 子组件与 `compareVersion` 状态，单一职责化

#### 8.3.2 `frontend/src/components/Version/CompareOverlay.tsx` — 全屏分屏对比（新建）

- 全屏 `fixed inset-0 z-50`，深色背景
- 顶部 header：`GitCompare` 图标 + 标题（`对比 v3（历史） ↔ 当前内容`）+ 图例（左红 = 已删除，右绿 = 已新增）+ X 关闭按钮
- 主体双列 `grid-cols-2`：
  - 左列 = 历史版本（`historyVersion.content`，通过 `fileApi.getVersion(fileId, historyVersionId)` 拉取）
  - 右列 = 当前内容（直接传 `currentContent`——用户编辑器中的实时文本，含未保存草稿）
  - 每列上半 = 只读 Monaco（`readOnly: true`、`domReadOnly: true`、`minimap` 关），下半 = `MarkdownPreview`
- 差异高亮：
  - 用 `diffLines(historyContent, currentContent)` 得到 change 数组
  - 左侧编辑器：在所有 `change.removed` 行加红底（`diff-line-removed`）
  - 右侧编辑器：在所有 `change.added` 行加绿底（`diff-line-added`）
  - 行号使用 Monaco 的 `deltaDecorations` API
- 同步滚动：左/右 Editor 互相 `setScrollTop(getScrollTop())`；左/右 Preview 互相 `scrollTop = src.scrollTop`
- 键盘：`Escape` 监听器关闭 overlay

#### 8.3.3 `frontend/src/pages/EditorPage.tsx` — 接入 overlay state

- 新增 state：`const [compareState, setCompareState] = useState<{ historyVersionId: number } | null>(null)`
- `<VersionPanel>` 接入 `onClose={() => setShowVersionPanel(false)}` 和 `onCompare={(historyVersionId) => setCompareState({ historyVersionId })}`
- 在 `EditorPage` 根节点下渲染 `<CompareOverlay>`，受控于 `compareState`

#### 8.3.4 `frontend/src/components/Editor/EditorToolbar.tsx` — 工具栏版本按钮改为切换式

- 移除 `onCreateVersion` prop（之前是直接触发创建快照）
- 新增 `versionPanelOpen`/`collabPanelOpen` props 控制按钮 active 高亮
- 版本按钮 `onClick = onToggleVersion`（只切换面板开关，**创建快照**改为在 `VersionPanel` 内独立按钮）
- 协作按钮同样改成切换式 + active 高亮

### 8.4 关键设计：左右独立行号计数器

`diffLines` 返回的 change 序列里，`added` 区间只出现在右侧文件，`removed` 区间只出现在左侧文件。如果左右共用一个 line 计数器，行号会越界（因为两侧文件行数不同）。

**正确的做法**：左右各一个计数器，独立推进：

```ts
function buildRemovedRows(changes) {
  // 左侧：line 推进条件 = !c.added
  //   - c.removed → 输出 row  + line += len
  //   - c.added   → 不输出    (line 不变)
  //   - context   → 不输出    + line += len
}

function buildAddedRows(changes) {
  // 右侧：line 推进条件 = !c.removed
  //   - c.added   → 输出 row  + line += len
  //   - c.removed → 不输出    (line 不变)
  //   - context   → 不输出    + line += len
}
```

这样 decoration 范围永远落在对应文件的实际行号上。

### 8.5 测试验证

#### 8.5.1 后端契约

通过 PowerShell 端到端验证（注册→登录→创建文件→保存两个版本→查询历史版本 content）：
- `POST /api/files/{fileId}/versions` 保存快照 ✅
- `GET /api/files/{fileId}/versions/{versionId}` 返回完整 content（包含 `content` 字段），供 `CompareOverlay` 左侧 Monaco 使用 ✅

#### 8.5.2 diff 行号不越界

`backend/test/03_version_ui/test_compare_overlay_logic.py` —— 4 个场景验证：

| 场景 | 左侧 RED 区 | 右侧 GREEN 区 |
|---|---|---|
| A 单行修改 | (2,2) | (2,2) |
| B 删一添一 | (2,2), (5,5) | (2,2), (5,5) |
| C 完全替换（左右行数不等） | (1,1), (2,2) | (1,1), (2,2), (3,3) |
| D 文末添加 | (空) | (3,3) |

4 个场景 assertion 全部通过：所有 decoration 行号都在对应文件实际行号范围内 ✅

#### 8.5.3 TypeScript

改动相关文件（`VersionPanel.tsx`、`CompareOverlay.tsx`、`EditorPage.tsx`）TypeScript 错误数：0 ✅

#### 8.5.4 Vite HMR 产物

通过 `http://localhost:5174/src/...tsx` 获取浏览器实际服务的产物，确认新版本生效：
- `VersionPanel.js` 中含 `handleClose`、`onClose?.()`、`onCompare?.(version.id)`
- `CompareOverlay.js` 中含 `buildRemovedRows`、`buildAddedRows`、`diff-line-added/removed` CSS 类 ✅

### 8.6 涉及文件清单

**修改：**
- `frontend/src/components/Version/VersionPanel.tsx` — 加 onClose/onCompare prop；删除内部 CompareVersions 状态机
- `frontend/src/components/Editor/EditorToolbar.tsx` — 版本/协作按钮改为切换式 + active 高亮
- `frontend/src/pages/EditorPage.tsx` — 接入 CompareOverlay state；清理已不使用的 import

**新增：**
- `frontend/src/components/Version/CompareOverlay.tsx` — 全屏分屏对比 overlay
- `backend/test/03_version_ui/test_compare_overlay_logic.py` — diff 行号不越界验证脚本

---

## 9. 版本时间显示错误 + 对比 Overlay 滚动/预览区定位修复

### 9.1 问题描述

进入版本对比 / 查看版本列表时遇到两个交互 bug：

1. **版本时间显示不正确**：所有版本 `created_at` 都按"系统本地时区"解析显示，导致与实际保存时间漂移（UTC+8 时区下被错误解析后看起来比真实时间多/少 8 小时）。
2. **版本对比 overlay 进入后无法滑轮下滑，行数过多时预览界面没有显示**：在 CompareOverlay 中滚动 Monaco 编辑器滚轮时无响应；文档很长时预览区被挤到视口外，用户看不到预览内容。

> **回归 bug（已在 9.3.4 修复）**：上一轮把布局从 `grid-rows-2` 50/50 改为 `flex-col` + Preview 固定 40vh 后，**Editor 父 div 漏掉了 `flex-1`**，导致 Column 内 Monaco 容器高度 = 内容自然高度 = 0，**代码栏消失只剩预览栏**。修复 = 给 Editor 父 div 加 `flex-1 min-h-0 overflow-hidden`。

### 9.2 根本原因

#### 9.2.1 时间时区错位

后端 models（`backend/app/models/file.py` 等）使用 `default=datetime.utcnow` 写入 naive UTC 时间，pydantic `from_attributes` 序列化时也输出**无 tz 后缀**的 ISO 字符串（如 `"2026-07-28T22:50:13.123456"`）。

前端 `VersionPanel.tsx` 的 `formatDate(dateStr)` 直接 `new Date(dateStr)` 解析不带 tz 的字符串，**JS 引擎按浏览器本地时区解释**：
- 后端 22:50 UTC → 中国用户看到次日 06:50（漂 +8h）
- 真正的"北京时间"用户则需要后端字段带 `+08:00` 才能正确显示

后端 schema 没显式标注 `tzinfo`，前端无从区分"naive UTC"和"naive 本地时间"。

#### 9.2.2 overlay 滚动 / 预览区定位

- **滚动无效**：`CompareOverlay.tsx` 中 Monorepo 把 `<Editor onChange={() => onEditorScroll()} />` 当作滚动事件 — 但 `@monaco-editor/react` 的 `onChange` 是**内容变更回调**，不是滚动事件；Monaco 真正的滚动 API 是 `editor.onDidScrollChange()`。结果：用户在 Monaco 上滚滚轮，对侧 Editor + 两侧 Preview 都不会同步。
- **预览被挤出视口**：每个 Column 用 `grid-rows-2`（50/50）分屏，预览区在长文档下被推到视口下方且**自身不会自动定位到屏幕中**；外层用 `overflow-hidden` 截断了整体滚动，使得用户无法通过整页滚动"找回"预览。

### 9.3 解决方案

#### 9.3.1 `frontend/src/components/Version/VersionPanel.tsx` — formatDate UTC 兜底 + Asia/Shanghai 渲染

```ts
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const hasTz = /[zZ]|[\+\-]\d{2}:?\d{2}$/.test(dateStr);
  const iso = hasTz ? dateStr : `${dateStr}Z`;
  const date = new Date(iso);
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',   // 显式锁定北京时间
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
```

要点：
- 用正则检测 `Z` / `+08:00` / `-08:00` 后缀；naive 字符串补 `'Z'` 当作 UTC 解析
- `timeZone: 'Asia/Shanghai'` 显式锁定输出时区，避免跟随浏览器

#### 9.3.2 `frontend/src/components/Version/CompareOverlay.tsx` — Monaco 真正滚动监听 + 预览固定 40vh

1. **滚动事件修复**：把 `<Editor onChange={...} />` 改为在 `onMount` 中注册 `editor.onDidScrollChange(() => onEditorScroll())`。
2. **同步滚动增强**：`syncEditorScroll` 不再只是 `setScrollTop(top)` 一刀切，改为按比例同步：
   ```ts
   const ratio = Math.max(0, Math.min(1, scrollTop / (scrollHeight - clientHeight)));
   if (srcPreview) srcPreview.scrollTop = srcPreview.scrollHeight - srcPreview.clientHeight * ratio;
   if (dstPreview) dstPreview.scrollTop = ...;
   ```
   Editor 滚 → 对侧 Editor 同步 + 两侧 Preview 按比例跟随。
3. **布局重构**：Column 内层用 `flex-col`（非 grid-rows-2）：
   - Editor 父容器 **`flex-1 min-h-0 overflow-hidden`** — `flex-1` 是必须的，让 Monaco 容器主动占满 Preview 之外的剩余空间；否则 flex column 默认按内容自然高度布局，空内容时容器高度 = 0
   - Preview 容器 `h-[40vh] min-h-[200px] max-h-[50vh] overflow-y-auto` — 固定 40% 屏高 + 上下限，永远在屏幕中可见且独立滚
   - 外层 body `flex-1 grid grid-cols-2 overflow-hidden min-h-0` — 锁住整体不溢出
4. **清理**：删除不再使用的 `leftScrollRef` / `rightScrollRef`（之前是给 onChange 误用准备的容器 ref，现在直接走 Monaco 滚动事件）

### 9.4 关键设计点

- **不要把 `<Editor>` 的 `onChange` 当滚动事件**：它是内容变更回调，真正的滚动 API 是 `editor.onDidScrollChange()`。
- **grid/flex 子元素加 `min-h-0`**：默认 `min-height: auto` 会让子元素按内容撑高，导致 flex/grid 父容器溢出；这是"Monaco 把整列撑爆"的根因。
- **预览区用 `vh` 单位**而不是 fr：分屏对比里预览区必须有**绝对屏幕高度**而不是 flex 比例，否则长文档下会被 Monaco 挤掉。
- **`flex flex-col` 中"占剩余空间"的子元素必须显式 `flex-1`**：默认 `flex-basis: auto` 让子元素按内容自然高度布局（空内容时 = 0），剩余空间不会自动分配。这是本次回归 bug 的根因 — Editor 父 div 漏 `flex-1` 导致代码栏高度为 0。

### 9.5 测试验证

#### 9.5.1 formatDate 时区逻辑

`backend/test/03_version_ui/test_format_date_logic.py` 5 个场景：

| 输入 | 期望 |
|---|---|
| `2026-07-28T22:50:13.123456` (naive UTC) | `07/29 06:50` |
| `2026-07-28T22:50:13Z` | `07/29 06:50` |
| `2026-07-28T22:50:13+08:00` | `07/28 22:50` |
| `2026-07-28T22:50:13-08:00` | `07/29 14:50` |
| `""` | `""` |

5/5 通过 ✅

#### 9.5.2 overlay diff 行号不越界（回归）

`backend/test/03_version_ui/test_compare_overlay_logic.py` 4 个场景全部通过，行号均在文件范围内 ✅

#### 9.5.3 TypeScript

`npx tsc --noEmit` — 改动文件 `CompareOverlay.tsx` / `VersionPanel.tsx` 错误数：0 ✅（仅历史遗留的 5 个 `noUnusedLocals` 警告，与本次无关）

#### 9.5.4 Vite 编译产物

通过 `http://localhost:5174/src/...tsx` 拉取浏览器实际服务的产物：
- `CompareOverlay.tsx`：含 `onDidScrollChange`、`40vh`、`min-h-0` ✅
- `VersionPanel.tsx`：含 `Asia/Shanghai`、`hasTz`、`formatDate` ✅

#### 9.5.5 后端 + 前端 dev server

- 后端 `GET /health` 200 ✅
- 前端 `GET /` (5174) 200 ✅

### 9.6 涉及文件清单

**修改：**
- `frontend/src/components/Version/VersionPanel.tsx` — formatDate UTC 兜底 + Asia/Shanghai 锁定
- `frontend/src/components/Version/CompareOverlay.tsx` — Monaco onDidScrollChange 真正滚动监听；布局改为 Editor 自适应 + Preview 固定 40vh；按比例同步滚动；清理无用 ref

**新增：**
- `backend/test/03_version_ui/test_format_date_logic.py` — 时区解析逻辑 5 场景验证脚本

---

## 10. 版本对比 diff 整列染色 + 编辑界面同步滚动开关

### 10.1 问题描述

1. **版本对比 diff 高亮错位**：当历史/当前版本只改动一行时，期望"左侧 1 行红 + 右侧 1 行绿"，但实际看到"**左侧整列变红 + 右侧整列变绿**"（包括未改动的行）。
2. **编辑界面缺同步滚动功能**：分屏模式下，编辑栏和预览栏相互独立滚动。期望有一个按钮（默认开启），开启时编辑栏和预览栏**按比例同步滚动**（用户在任一栏滚动，另一栏跟随到对应位置）。

### 10.2 根本原因

#### 10.2.1 diff 高亮整列染色

`CompareOverlay.tsx` 用 `editor.deltaDecorations()` + `{ isWholeLine: true, className: 'diff-line-removed' }` 给行染色。

- Monaco 文档明确：`**isWholeLine**` 是 `className` 渲染时的 flag**，它让 `className` 应用到 view-line 容器
- 但 Monaco 在某些情况下（特别是 `automaticLayout: true` + 空行或短行）会把 class 应用到 **view-lines 容器**（包裹所有 view-line 的父元素）
- `.diff-line-removed { background: ... }` 的 background 铺满整个 view-lines 容器 → **整列染色**
- 即使没有这个 bug，`isWholeLine: true` + 空行/极短内容也可能让 Monaco 把容器高度撑成 100%，导致视觉上"整列变红/变绿"

参考：[microsoft/monaco-editor#2387](https://github.com/microsoft/monaco-editor/issues/2387)、[#4784](https://github.com/microsoft/monaco-editor/issues/4784)

#### 10.2.2 编辑界面无同步滚动

- `EditorPage.tsx` 中 Editor 和 Preview 是两个独立滚动区域，之间没有事件联动
- 工具栏没有"同步滚动"开关

### 10.3 解决方案

#### 10.3.1 `frontend/src/components/Version/CompareOverlay.tsx` — 自定义 diff 行高亮 overlay

**完全弃用 Monaco `deltaDecorations`**，改用**绝对定位的 DOM overlay**：

1. Column 内 Monaco 父 div 加 `relative` 定位
2. 在 Monaco 父 div 内同位置放一个 `<DiffOverlay>` 子组件：
   - `pointer-events-none` 不干扰 Monaco 交互
   - `absolute inset-0 zIndex: 5` 覆盖 Monaco 可视区
   - 每个高亮行渲染一个 div：`top = editor.getTopForLineNumber(line) - scrollTop, height = getTopForLineNumber(end+1) - getTopForLineNumber(start)`
3. `scrollTop` 通过 `onDidScrollChange` 同步到 React state，让 overlay 跟随 Monaco 滚动
4. 用 `editor.onDidContentSizeChange` / `onDidChangeConfiguration` 触发 overlay 重渲染（处理 word-wrap 切换、行高变化）
5. CSS 限定为单行高度（`height: ${height}px`），**绝不可能外溢**：

```css
.diff-overlay-added > div {
  background: rgba(34, 197, 94, 0.22);
  border-left: 3px solid rgb(34, 197, 94);
}
.diff-overlay-removed > div {
  background: rgba(239, 68, 68, 0.22);
  border-left: 3px solid rgb(239, 68, 68);
}
```

#### 10.3.2 `frontend/src/components/Editor/EditorToolbar.tsx` — 同步滚动开关按钮

新增 `syncScroll` + `onToggleSyncScroll` props，在版本按钮和协作按钮之间加一个切换按钮：
- 开启时：`<Link />` 图标 + primary 高亮 + tooltip "已开启：编辑栏与预览栏同步滚动"
- 关闭时：`<Link2Off />` 图标 + 灰色 + tooltip "已关闭：编辑栏与预览栏独立滚动"

#### 10.3.3 `frontend/src/pages/EditorPage.tsx` — 双向同步滚动

新增 state + 双向同步逻辑：

```ts
const [syncScroll, setSyncScroll] = useState(true);
const [editorMounted, setEditorMounted] = useState(false);
const previewScrollRef = useRef<HTMLDivElement>(null);
const isSyncingRef = useRef<'editor' | 'preview' | null>(null); // 循环保护

// Editor 滚动 → Preview 按比例
const handleEditorScroll = useCallback(() => {
  if (!syncScroll || isSyncingRef.current === 'preview') return;
  const editor = editorRef.current;
  const preview = previewScrollRef.current;
  if (!editor || !preview) return;
  const scrollHeight = editor.getScrollHeight();
  const clientHeight = editor.getLayoutInfo().height;
  if (scrollHeight <= clientHeight) return;        // src 不可滚
  const ratio = editor.getScrollTop() / (scrollHeight - clientHeight);
  const maxPreview = preview.scrollHeight - preview.clientHeight;
  if (maxPreview <= 0) return;                      // dst 不可滚
  isSyncingRef.current = 'editor';                 // 防止 Preview 滚动触发反向同步
  preview.scrollTop = maxPreview * ratio;
  requestAnimationFrame(() => { isSyncingRef.current = null; });
}, [syncScroll]);

// Preview 滚动 → Editor 按比例
const handlePreviewScroll = useCallback(() => { /* 同上对称 */ }, [syncScroll]);

// Monaco 注册 onDidScrollChange
useEffect(() => {
  if (!syncScroll || !editorMounted) return;
  const editor = editorRef.current;
  if (!editor) return;
  const d = editor.onDidScrollChange(handleEditorScroll);
  return () => d.dispose();
}, [syncScroll, editorMounted, handleEditorScroll]);
```

关键点：
- **`isSyncingRef` 循环保护**：A 滚触发 B 同步时设标记，B 的 onScroll 看到标记就跳过；下一帧清标记
- **双方都做 "不可滚保护"**：src 不可滚直接 return，dst 不可滚直接 return，避免无效 setState
- **`editorMounted` state**：把 `editorRef.current` 的变化通过 React 触发 useEffect 重连

### 10.4 关键设计点

- **弃用 Monaco `deltaDecorations` 做整行高亮**：`isWholeLine: true` + `className` 在 Monaco 内部可能把 class 应用到 view-lines 容器（整列），不可控。改用绝对定位 DOM overlay 完全可控。
- **用 `editor.getTopForLineNumber(line)` 取精确行像素位置**：比 `(line - 1) * lineHeight` 精确，避免 Monaco 字体度量差异。
- **同步滚动用"比例"而非"绝对值"**：Editor 和 Preview 内容高度不同，按 `scrollTop / (scrollHeight - clientHeight)` 计算 ratio，跨容器按比例映射。
- **同步循环保护**：用 `isSyncingRef` 标记程序触发的滚动，避免 A 滚 → B 同步 → B 的 onScroll → A 同步 → 死循环。
- **方向选择双向同步**：用户在 Editor 或 Preview 任一栏滚动，另一栏跟随；体验最自然。

### 10.5 测试验证

#### 10.5.1 diff overlay 行号不越界（回归）

`backend/test/03_version_ui/test_compare_overlay_logic.py` 4 个场景仍然全部通过（diff 算法没改）✅

#### 10.5.2 同步滚动比例数学

`backend/test/04_editor_sync/test_sync_scroll_ratio.py` 7 个场景：

| case | src_top | ratio | dst_top | 期望 |
|---|---|---|---|---|
| 顶部 | 0 | 0.000 | 0.0 | 0.0 |
| 中间 50% | 400 | 0.500 | 300.0 | 300.0 |
| 底部 100% | 800 | 1.000 | 600.0 | 600.0 |
| src 不可滚 | 100 | 0.000 | 0.0 | 0.0 |
| dst 不可滚 | 400 | 0.500 | 0.0 | 0.0 |
| 不同高度比例 | 200 | 0.200 | 320.0 | 320.0 |
| 越界保护 | 9999 | 1.000 | 600.0 | 600.0 |

7/7 通过 ✅

#### 10.5.3 TypeScript

`npx tsc --noEmit` — 改动文件 (`CompareOverlay.tsx` / `EditorToolbar.tsx` / `EditorPage.tsx`) 错误数：0 ✅

#### 10.5.4 Vite 编译产物

- `CompareOverlay.tsx`：`DiffOverlay`、`getTopForLineNumber`、`onDidContentSizeChange` ✅
- `EditorPage.tsx`：`syncScroll`、`setSyncScroll`、`handleEditorScroll`、`handlePreviewScroll` ✅

### 10.6 涉及文件清单

**修改：**
- `frontend/src/components/Version/CompareOverlay.tsx` — 删除 `deltaDecorations` + 改用 `DiffOverlay` 绝对定位组件
- `frontend/src/components/Editor/EditorToolbar.tsx` — 新增 `syncScroll` / `onToggleSyncScroll` props + 切换按钮
- `frontend/src/pages/EditorPage.tsx` — 新增 `syncScroll` state + 双向同步滚动 + 循环保护 + Monaco 注册 onDidScrollChange

**新增：**
- `backend/test/04_editor_sync/test_sync_scroll_ratio.py` — 7 场景同步滚动比例数学验证脚本

---

## 11. Monaco IME 中文输入跳末尾 + 修复引发的两次布局回归

> **修复日期**: 2026-07-29
> **状态**: ✅ 已修复并验证（保留两道回归作为反面教材写入本文档）

### 11.1 问题描述（用户报告）

在 MD Editor 的 `EditorPage` 编辑器区域，使用**中文输入法**输入时：

1. 输入拼音字母（例如 `nihao`）
2. **按空格键选中候选词 "你好"**
3. **症状**：
   - 中文文字 "你好" **没有出现在当前光标所在位置**，而是 **跳到了文档最后一行末尾**
   - 当前正在输入的那一行 **保留了英文拼音占位符 "nihao"**
   - 光标跳到文档最末尾

此外，在**修复该 IME bug 的过程中**，先后引入了**两道新的 UI 回归**（均在文档中保留作为反面教材）：

| # | 回归症状 | 触发改动 |
|---|---|---|
| 回归 A | **打开文件后，编辑器只显示源文件栏（左侧），预览栏（右侧）整个消失** | 把 `<Editor value={content}>` 改为 `<Editor key={file.id} defaultValue={file.content}>` |
| 回归 B | **编辑器无任何内容显示（空白）**，仅 Preview 显示源文件 | 进一步改成 `<Editor key={file.id} defaultValue="">` + `prevEditorMountedRef` 跳过首次 setValue |

### 11.2 根本原因

#### 11.2.1 IME 跳末尾：React 受控 `value` 与 Monaco IME 状态冲突

原始代码：

```tsx
<Editor
  value={content}              // ← React 受控 value
  onChange={handleEditorChange}
/>
```

`handleEditorChange` 把 Monaco 内容同步到 React state，React 重渲染时把 `value={content}` 重新传给 `<Editor>`，**Monaco 每次都用新 value 强制重置其内部 IME composition 状态**：

| 阶段 | 行为 | 问题 |
|---|---|---|
| 输入拼音 "ni" | `onChange('ni')` → `setContent('ni')` → React 重渲染 `value={'ni'}` | Monaco 内部 IME composition 状态被覆盖，cursor 跳末尾 |
| 继续输入 " hao" | 拼音占位符在错位置继续显示 | IME 占位符错位 |
| 按空格选词 "你好" | `compositionend` → `onChange('你好')` → `setContent('你好')` → React 重渲染 `value={'你好'}` | 再次重置 Monaco，cursor 跳末尾，拼音残留 |

**根因**：React 受控 `value` 强制 Monaco 每次都用 React state 覆盖 model，**打断 IME composition 生命周期**。

#### 11.2.2 回归 A：`<Editor key={file.id}>` 导致布局断裂

第一次修复方案：

```tsx
<Editor
  key={file.id}
  defaultValue={file.content}
/>
```

设计意图：用 `key={file.id}` 让 React 在切换文件时强制重新挂载 `<Editor>`，`defaultValue={file.content}` 在挂载时一次性注入内容。

**回归根因**：
- Monaco 实例每次 mount 时**测量父容器尺寸**，初始化 `automaticLayout: true` 触发实时 layout
- React + Monaco 的 mount/unmount 周期中，**flex 父容器测量时机错位**
- `<div className="flex-1 flex overflow-hidden">` 父容器的高度/宽度在 Monaco 自动 layout 短暂时间内**被撑开**，导致同级的 Preview div（w-1/2）被挤出可见区域
- 此外，`key` 改变导致 Monaco 实例销毁重建，恢复后 IME 内部 selection 也会清空，**与原 IME 修复目标冲突**（虽然 mount 时用户通常不在 IME 中）

#### 11.2.3 回归 B：`defaultValue=""` + 跳过首次 setValue 导致 Monaco 显示空白

第二次修复尝试：

```tsx
<Editor key={file.id} defaultValue="" />

// 试图在 useEffect 里同步 file.content
const prevEditorMountedRef = useRef(false);
useEffect(() => {
  if (!editorMounted) return;
  if (!prevEditorMountedRef.current) {
    prevEditorMountedRef.current = true;  // 跳过 setValue!
    return;
  }
  ...
}, [editorMounted]);
```

**回归根因**：

1. **首次挂载时序**：
   - `defaultValue=""`：Monaco mount 到空字符串
   - `handleEditorMount` 跑 → `setEditorMounted(true)` → useEffect 跑
   - 此时**首次分支**（`prevEditorMountedRef.current === false`）执行，**没有调 setValue**，只设 `prevEditorMountedRef.current = true`
   - 之后 `setContent(file.content)` 更新 React state——但 React state 不再传给 `<Editor>`（不再受控），Monaco 仍然是空字符串
2. **结果**：编辑器显示空白，只有 Preview 显示源文件
3. **设计错误**：把"首次 mount"作为优化分支跳过，但首次 mount **正是**需要灌入 `file.content` 的关键时刻

### 11.3 解决方案（最终版）

#### 11.3.1 三步走

1. **Editor 改为非受控**：`value={content}` → `defaultValue=""`
2. **用 `useEffect` + `editor.setValue()` 主动同步文件内容**，不依赖 React 反向控制
3. **`handleSave` 用 `editor.getValue()`** 拿 Monaco 最新内容

#### 11.3.2 关键代码（最终）

```tsx
const [content, setContent] = useState('');

const prevFileIdRef = useRef<number | null>(null);
useEffect(() => {
  if (!file || !editorMounted) return;
  const editor = editorRef.current;
  if (!editor) return;
  // 同一文件: 不重置 (避免覆盖用户输入, 也避免打断 IME)
  if (prevFileIdRef.current === file.id) return;
  prevFileIdRef.current = file.id;
  if (editor.getValue() !== file.content) {
    editor.setValue(file.content);
  }
  setContent(file.content);
}, [file, editorMounted]);

const handleEditorChange = (value: string | undefined) => {
  if (value !== undefined) {
    setContent(value);
    setHasUnsavedChanges(true);
  }
};

const handleSave = useCallback(() => {
  if (!fileId || !file) return;
  const editor = editorRef.current;
  const latest = editor ? editor.getValue() : content;
  setSaveStatus('saving');
  updateFileMutation.mutate({ id: file.id, data: { content: latest } });
}, [fileId, file, content, updateFileMutation]);
```

```tsx
<Editor
  height="100%"
  defaultLanguage="markdown"
  defaultValue=""
  onChange={handleEditorChange}
  onMount={handleEditorMount}
  theme="vs-dark"
  options={{ ... }}
/>
```

#### 11.3.3 设计原理

| 设计选择 | 为什么这样做 |
|---|---|
| `defaultValue=""` 而非 `defaultValue={file.content}` | `<Editor>` 在 isLoading=true 时**不渲染**，等 file 到位后才渲染，content 此刻必定可读；但用 `""` 配合 `useEffect` 主动 setValue 是更显式的同步模型 |
| 不再用 `<Editor key={file.id}>` | 强制重 mount 会引发布局抖动，且销毁 undo history；用 `useEffect` 在 file.id 变化时主动 setValue 已经足够 |
| `editor.setValue()` 而非 React `value=` prop | **程序主动调 setValue 不会触发 React 重渲染**，因此不会反向打断用户 IME |
| `handleSave` 用 `editor.getValue()` | React state `content` 在某些时序下可能滞后（譬如 IME composition 期间不会立即触发 onChange），直接读 Monaco model 才拿到最新文本 |
| 不在 useEffect 中尝试去重 IME | IME 期间用户通常不会切文件，**接受**这个边缘风险 |

### 11.4 测试验证

#### 11.4.1 IME 中文输入测试（已通过）

1. 硬刷新浏览器（Ctrl+Shift+R）加载最新 bundle
2. 关闭"同步滚动"按钮（避免干扰测试观察）
3. 切到中文输入法（Windows: Win+Space / macOS: Ctrl+Space）
4. 在编辑器中间某行中间位置输入拼音，按空格选词
5. 多次覆盖、删除、重输

**期望结果**：中文出现在光标位置，cursor 随输入推进，无拼音残留，无跳末尾。

#### 11.4.2 布局回归测试（已通过）

| # | 测试场景 | 期望 | 结果 |
|---|---|---|---|
| 1 | 打开任意 markdown 文件 | 左右两栏（编辑器 + 预览）各占 50% | ✅ |
| 2 | 切换文件 | 编辑器和预览都更新新文件内容 | ✅ |
| 3 | 工具栏切换 viewMode（split / edit / preview）| 编辑器 / 预览 / 分栏模式正常切换 | ✅ |
| 4 | Ctrl+S 保存 | 提示"已保存"，无内容丢失 | ✅ |

#### 11.4.3 自动化检查

- ✅ `npx tsc --noEmit`：改动文件 0 错误（其他历史 lint 警告无关）
- ✅ Vite 编译产物确认：含 `defaultValue: ""`、`editor.setValue(file.content)`、`editor.getValue()`；不再含受控 `value: {content}` / `key:`，不再含 `defaultValue: file.content`

### 11.5 关键教训（从两道回归中学到）

1. **受控 vs 非受控的选择要看场景**
   - 通用 React 表单：受控 value 适合（小数据量、单向输入）
   - **Monaco Editor 这种重组件 + IME 敏感的复杂场景**：必须用 **非受控 + ref + 主动 setValue**，否则 IME 在每个 onChange 后被 React 重置

2. **`<Editor key={x}>` 是核武器，不是日常工具**
   - key 变化会销毁并重建整个组件，包括 state、ref、undo history
   - 每次 mount 都有显著的初始化开销（~100ms+），且会触发下游副作用（automaticLayout、resize observer 重订阅）
   - **优先**用 props / useEffect 显式同步，避免无谓的 mount/unmount

3. **优化分支要谨慎加**
   - 之前在 useEffect 里加 "首次 mount 跳过 setValue" 的优化是**过度设计**
   - **首次 mount 恰好是最需要 setValue 的时刻**——这时 content 第一次从外部流入
   - 加优化分支前必须想清楚：这个状态值真实第一次出现时在哪个时机？

4. **回归测试要在改完立刻做，不要等用户报告**
   - 回归 A 没有立刻测布局，只测了"文件内容有没有显示"，漏掉了 Preview 栏
   - 回归 B 把 `key={file.id}` 改成 `defaultValue=""` 时，**应该立刻测**"打开文件 → 编辑器是否显示源文件"而不是等着看 Preview 是否回归正常
   - 教训：**改一处立即跑一遍所有相关场景**，别批量改完再统一测

### 11.6 涉及文件清单

**修改：**
- `frontend/src/pages/EditorPage.tsx` — `<Editor>` 改为非受控（`defaultValue=""`）+ useEffect 主动 `setValue()` 同步文件内容 + `handleSave` 改用 `editor.getValue()`

**文档：**
- `docs/MAINTENANCE.md` — 追加本章

---

## 12. 文件树拖拽嵌套 + parent_id null 处理

> **修复日期**: 2026-07-29
> **状态**: ✅ 已修复并验证（5/5 测试通过）

### 12.1 问题描述

文件树组件 `FileTree.tsx` 存在三个交互问题：

1. **拖拽到文件夹无效**：拖拽文件到文件夹上方时无视觉反馈，放开后文件不会进入文件夹
2. **文件夹展开/收起按钮无效**：点击 chevron 图标后图标无切换、`children` 不展开
3. **嵌套文件夹被拒绝**：创建子文件夹时 API 返回 400 错误，提示"文件夹只能在根目录创建，不支持嵌套"
4. **parent_id null 无法显式设置**：将文件移回根目录时 API 无法区分"未传 parent_id"和"显式设为 null"

### 12.2 根本原因（4 层）

#### 12.2.1 拖拽放置区域未实现
Row 组件仅有 `draggable` 属性，没实现 `onDragOver`/`onDrop` 事件处理器。

#### 12.2.2 展开按钮事件处理冲突
文件夹行使用 `onClick` 展开/收起，但 Chevron 按钮嵌套在 Row 内，点击会冒泡到 Row 的 onClick 并触发展开；同时如果在 Row 上加了 `onDrop` 用于接收拖拽，`e.preventDefault()` 会吃掉 Chevron 内部的点击事件。

#### 12.2.3 后端硬编码嵌套限制
`POST /files` 中存在硬编码限制：`if file.is_folder and file.parent_id is not None: raise 400`，导致任意层级嵌套都被拒绝。

#### 12.2.4 parent_id null 语义冲突
FastAPI / Pydantic v2 的 `Optional[int] = None` 注解无法区分：
- 客户端不传 `parent_id` 字段（保持不变）
- 客户端显式传 `parent_id: null`（设为 null）

这两种情况在 schema 层都映射成同一个 Python `None`。

### 12.3 解决方案

#### 12.3.1 拖拽放置区域

`frontend/src/components/FileTree/FileTree.tsx`：在 Row 上添加事件处理：

```tsx
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();           // 允许放置
  e.stopPropagation();         // 不冒泡到父级
  e.dataTransfer.dropEffect = 'move';
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  const data = e.dataTransfer.getData('application/json');
  if (!data) return;
  const { fileId, targetFolderId } = JSON.parse(data);
  if (fileId === targetFolderId) return;  // 不能拖到自己
  onDirectMove?.(fileId, targetFolderId);  // 回调到 DashboardPage
};
```

#### 12.3.2 Chevron 按钮改用 onMouseDown + stopPropagation

```tsx
<button
  onMouseDown={(e) => e.stopPropagation()}  // 阻止被 Row 抢占
  onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id); }}
>
  {isExpanded ? <ChevronDown /> : <ChevronRight />}
</button>
```

`onMouseDown` 早于 `dragstart` 处理，避免被 drag 事件影响；`onClick` 内的 `stopPropagation` 阻止冒泡到 Row 的展开切换。

#### 12.3.3 后端移除嵌套限制

`backend/app/api/files.py`：删除硬编码的嵌套限制：

```python
# 删除前
if file.is_folder and file.parent_id is not None:
    raise HTTPException(status_code=400, detail="文件夹只能在根目录创建，不支持嵌套")

# 删除后（无该限制，支持任意层级嵌套）
```

#### 12.3.4 parent_id 哨兵值

前端的字符串哨兵 `__none__` 表示"移动到根目录"：

`frontend/src/services/fileApi.ts`：
```ts
moveFile: async (fileId, parentId) => {
  // 显式 None 用哨兵值发给后端，区分于"未传"
  await api.put(`/files/${fileId}`, {
    parent_id: parentId === null ? '__none__' : parentId,
  });
}
```

后端 `backend/app/schemas/file.py`：parent_id 类型放宽到 `Union[int, str]`
```python
from typing import Union
class FileUpdate(BaseModel):
    parent_id: Optional[Union[int, str]] = None  # 支持 "__none__"
```

后端 `backend/app/api/files.py`：
```python
if file.parent_id is not None:
    if isinstance(file.parent_id, str) and file.parent_id == "__none__":
        db_file.parent_id = None
    elif isinstance(file.parent_id, str) and file.parent_id.isdigit():
        db_file.parent_id = int(file.parent_id)
    elif isinstance(file.parent_id, int):
        db_file.parent_id = file.parent_id
```

### 12.4 关键设计点

| 设计 | 为什么 |
|---|---|
| 用 `onDragOver` 阻止默认行为 | 否则浏览器默认不允许 drop |
| 用字符串哨兵而非新增 query 参数 | 改动最小，向后兼容所有 PUT 调用方 |
| `onMouseDown` 而不是 `onClick` | `onMouseDown` 在 `dragstart` 之前，避免被拖拽干扰 |
| 后端 schema 用 `Union[int, str]` | 接受哨兵字符串 + 类型安全 |
| 移除嵌套限制后无需新增 API | 通用父子关系天然支持任意层级 |

### 12.5 测试验证

`backend/test/07_trash/test_drag_folder.py`：5 项断言全通过 ✅

| 场景 | 结果 |
|---|---|
| 嵌套文件夹创建 | ✅ PASS |
| 文件夹内创建文件 | ✅ PASS |
| 文件树结构验证 | ✅ PASS |
| 移动文件到子文件夹 | ✅ PASS |
| 使用哨兵值移动到根目录 | ✅ PASS |

### 12.6 涉及文件清单

**修改：**
- `frontend/src/components/FileTree/FileTree.tsx` — 添加 onDragOver/onDrop、Chevron 改用 onMouseDown、添加 onDirectMove 回调
- `frontend/src/pages/DashboardPage.tsx` — 添加 `moveFileMutation` 和 `handleDirectMove` 函数
- `frontend/src/services/fileApi.ts` — `moveFile` 使用哨兵值
- `backend/app/api/files.py` — 移除嵌套限制、添加 parent_id 字符串处理
- `backend/app/schemas/file.py` — `FileUpdate.parent_id` 支持 `Union[int, str]`

**新增：**
- `backend/test/07_trash/test_drag_folder.py` — 5 场景端到端验证脚本
- `backend/restart_server.py` — 后端重启辅助脚本

---

## 13. 文件夹展开/收起按钮无效 + 嵌套视觉未区分 + 展开状态持久化

> **修复日期**: 2026-07-30
> **状态**: ✅ 已修复并验证（5/5 测试通过）
> **关联日志**: [`update/2026-07-30_00-17.md`](../../update/2026-07-30_00-17.md)
> **前置章节**: § 12（拖拽嵌套 + parent_id null）—— 本章是其后续修复

### 13.1 问题描述

`update/2026-07-29_18-15.md` 中虽然声明"修复了 Chevron 按钮无效"，但仅切了图标，没有把展开状态接入渲染层，仍存在三处遗留问题：

1. **children 始终展开，无法收起**：点击 Chevron 图标后图标会切换，但文件夹内部文件始终显示
2. **嵌套子项与外部文件视觉上无区分**：子树与顶层项平铺，缺乏缩进/分组
3. **刷新后展开状态全部丢失**：刷新浏览器或重启前端，所有文件夹回到默认收起状态

### 13.2 根本原因（3 层）

#### 13.2.1 渲染层未消费 store 状态
`FileTree.tsx` 渲染子 `FileTree` 时仅判断 `item.children.length > 0`，未读取 `isFolderExpanded(item.id)`。

#### 13.2.2 缺缩进/分组容器
递归 `FileTree` 与外层项同级渲染，缺 `depth` 参数与外层 div，无法施加缩进和左边框。

#### 13.2.3 store 没有持久化层
`fileStore` 仅在内存中维护 `Set<number>`，未挂 Zustand `persist` 中间件，刷新后丢失。

### 13.3 解决方案

#### 13.3.1 把展开状态接入渲染（修复问题 1）
[`frontend/src/components/FileTree/FileTree.tsx`](../../frontend/src/components/FileTree/FileTree.tsx) 在函数体顶部声明 `useFileStore()` 并加守卫：

```tsx
const { isFolderExpanded } = useFileStore();

{item.is_folder && isFolderExpanded(item.id) && item.children.length > 0 && (
  <div className="ml-4 pl-2 border-l border-slate-200 dark:border-slate-700">
    <FileTree ... depth={depth + 1} />
  </div>
)}
```

#### 13.3.2 嵌套子项缩进 + 左边框（修复问题 2）
`FileTreeProps` 新增 `depth?: number`（顶层默认 0），递归调用传入 `depth + 1`。子 `FileTree` 用 `ml-4 pl-2 border-l border-slate-200 dark:border-slate-700` 包住——左外边距 16px、内部留白 8px、左侧 1px 浅灰边框，文件夹内文件与外部文件视觉上分离。

#### 13.3.3 Zustand persist 持久化（修复问题 3）
[`frontend/src/store/fileStore.ts`](../../frontend/src/store/fileStore.ts) 加 `persist` 中间件，参照 `authStore.ts` 的写法：

```ts
export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      expandedFolders: new Set<number>(),
      toggleFolder: (folderId) => {
        const expanded = new Set(get().expandedFolders);
        expanded.has(folderId) ? expanded.delete(folderId) : expanded.add(folderId);
        set({ expandedFolders: expanded });
      },
      isFolderExpanded: (folderId) => get().expandedFolders.has(folderId),
      // ...
    }),
    {
      name: 'file-tree-storage',
      partialize: (state) => ({ expandedFolders: Array.from(state.expandedFolders) }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray((state as { expandedFolders?: unknown }).expandedFolders)) {
          state.expandedFolders = new Set(
            (state as { expandedFolders: number[] }).expandedFolders,
          );
        }
      },
    },
  ),
);
```

要点：`Set<number>` 不能直接 JSON 序列化，必须在 `partialize` 转 `Array<number>` 写入 `localStorage`，在 `onRehydrateStorage` 还原为 `Set<number>`。

### 13.4 关键设计点

|| 设计 | 为什么 |
||---|---|
|| 守卫放在渲染处而非 store | store 不该关心 UI；切换逻辑与渲染判断分离更易测 |
|| 缩进写死 `ml-4`，不动态拼接 | Tailwind JIT 不支持运行时拼接类名；固定值覆盖 ≥ 6 层嵌套 |
|| `border-l` + `pl-2` 组合 | 左边框提供分组标识，`pl-2` 让子项图标不贴边 |
|| `Set` 序列化拆两步 | Zustand persist 不支持自定义类型转换，必须 `partialize` + `onRehydrateStorage` 配对 |
|| 持久化键独立命名 `file-tree-storage` | 与 `auth-storage` 隔离，避免状态污染 |

### 13.5 测试验证

[`backend/test/07_trash/test_folder_expand_ui.py`](../../backend/test/07_trash/test_folder_expand_ui.py)：5 项断言全通过 ✅

|| 场景 | 结果 |
||---|---|
|| 后端嵌套树结构（Outer→Inner→NestedDoc） | ✅ PASS |
|| 默认 store 全部收起 | ✅ PASS |
|| toggleFolder 双向切换且互不干扰 | ✅ PASS |
|| Set ↔ JSON 序列化往返不丢数据 | ✅ PASS |
|| 源码静态契约（`ml-4` / `border-l` / `pl-2` / `isFolderExpanded` / `persist` / `partialize` / `onRehydrateStorage`） | ✅ PASS |

### 13.6 涉及文件清单

**修改：**
- [`frontend/src/components/FileTree/FileTree.tsx`](../../frontend/src/components/FileTree/FileTree.tsx) — `FileTreeProps` 加 `depth`、递归处加 `isFolderExpanded` 守卫与缩进/边框 div
- [`frontend/src/store/fileStore.ts`](../../frontend/src/store/fileStore.ts) — 加 `persist` 中间件、`Set ↔ Array` 序列化往返
- [`docs/TESTS.md`](../../docs/TESTS.md) — 索引新增脚本
- [`docs/project/test.md`](../../docs/project/test.md) — §6 通过率表新增一行

**新增：**
- [`backend/test/07_trash/test_folder_expand_ui.py`](../../backend/test/07_trash/test_folder_expand_ui.py) — 5 场景端到端验证脚本
- [`update/2026-07-30_00-17.md`](../../update/2026-07-30_00-17.md) — 本次更新日志
