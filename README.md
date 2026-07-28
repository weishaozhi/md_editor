# Markdown Editor

一个功能完整的 Markdown 文件读取与编辑工具，支持版本历史、多人协作和插件扩展。

## 技术栈

- **后端**: Python 3.11+ / FastAPI / SQLAlchemy / SQLite
- **前端**: React 18+ / TypeScript / Vite / TailwindCSS
- **实时协作**: WebSocket (Socket.IO)
- **Markdown解析**: markdown-it

## 快速开始

### 后端启动

```bash
cd backend
pip install -r requirements.txt
python run.py
```

后端服务将在 http://localhost:8000 启动

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 http://localhost:5173 启动

## 功能特性

- 文件管理：树形目录结构、创建、编辑、删除、重命名
- Markdown 编辑器：双栏编辑、实时预览、语法高亮
- 版本控制：历史记录、版本对比、回滚功能
- 多人协作：实时同步、多人光标显示
- 插件系统：插件市场、插件管理

## API 文档

启动服务后访问 http://localhost:8000/docs 查看完整 API 文档，契约详见 [`docs/API.md`](docs/API.md)。

## 项目规划与规范

- 入口与原则：[`docs/project/project-bootstrap.md`](docs/project/project-bootstrap.md)
- 产品需求：[`docs/project/prd.md`](docs/project/prd.md)
- 架构说明：[`docs/project/arch.md`](docs/project/arch.md)
- 项目状态 / 已知问题：[`docs/project/project_state.md`](docs/project/project_state.md)
- 测试规范：[`docs/project/test.md`](docs/project/test.md)
- Git 使用规范：[`docs/project/git-usage.md`](docs/project/git-usage.md)
