# MD Editor - 维护文档

本文档记录项目开发过程中发现的问题、原因和解决方案，便于后续维护参考。

---

## 目录

1. [登录后无法跳转问题（根本修复）](#1-登录后无法跳转问题根本修复)
2. [登录相关问题（第一次修复，未根本解决）](#2-登录相关问题第一次修复未根本解决)
3. [启停脚本问题](#3-启停脚本问题)
4. [已添加的功能](#4-已添加的功能)
5. [已知问题和限制](#5-已知问题和限制)
6. [文件清单](#6-文件清单)

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

使用 `backend/test_login_flow.py` 进行了 8 项 API 测试，全部通过：

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

## 4. 已添加的功能

### 4.1 状态检查脚本（status.bat）
新增 `backend/status.bat`，提供：
- 后端服务状态、PID、进程名
- 前端服务状态、PID、进程名
- WebSocket 可用性
- HTTP 健康检查（/health 端点）
- 总体状态汇总

### 4.2 后端登录测试脚本（test_login_flow.py）
新增 `backend/test_login_flow.py`，提供 8 项端到端登录测试：
- 注册、登录（成功/失败）、token 验证、用户信息获取、错误处理

---

## 5. 已知问题和限制

### 5.1 主题切换 UI 不生效
`SettingsPage.tsx` 中的主题按钮只对 `light` 有 `active` 样式，其他状态无视觉反馈。

### 5.2 CORS 配置
后端 CORS 设置为 `"*"`，生产环境不安全，需要配置允许的 origins。

### 5.3 脚本中的 PowerShell 调用
所有脚本都使用 `powershell -NoProfile -Command`，在某些 shell 包装环境中可能会有警告信息（如 "ERROR: Input redirection is not supported"），但功能正常。在真实 cmd 窗口中运行没有此问题。

### 5.4 其他 TypeScript 警告
项目中有一些未使用变量（`useState`, `Save`, `Clock` 等）的 `TS6133` 警告，与登录跳转无关，属于历史遗留代码。

---

## 6. 文件清单

### 修改的前端文件（frontend/src/）
- `store/authStore.ts` — 用 Zustand `persist` 中间件替换手动 localStorage 初始化
- `App.tsx` — 添加 `useAuthStore.persist.hasHydrated()` 等待水合；每个路由独立守卫
- `pages/LoginPage.tsx` — `navigate('/', { replace: true })`
- `services/api.ts` — 拦截器从 store 读取 token

### 修改的后端文件（backend/）
- `app/api/websocket.py` — user_id 类型转换（整数）

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
