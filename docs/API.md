# MD Editor API 文档

Base URL: `http://localhost:8000/api`

认证方式：除注册接口外，所有接口均需携带 JWT Token。
```
Authorization: Bearer <token>
```

---

## 认证接口 `/auth`

### 注册用户
- **POST** `/auth/register`
- **Body:**
```json
{
  "username": "string",
  "email": "user@example.com",
  "password": "string"
}
```
- **Response (201):**
```json
{
  "id": 1,
  "username": "string",
  "email": "user@example.com",
  "created_at": "2026-07-28T09:56:08.941425"
}
```

### 用户登录
- **POST** `/auth/login`
- **Content-Type:** `application/x-www-form-urlencoded`
- **Body:**
```
username=string&password=string
```
- **Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### 获取当前用户信息
- **GET** `/auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
{
  "id": 1,
  "username": "string",
  "email": "user@example.com",
  "created_at": "2026-07-28T09:56:08.941425"
}
```

---

## 文件管理接口 `/files`

### 获取文件树
- **GET** `/files/tree`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
[
  {
    "id": 1,
    "name": "文件夹",
    "is_folder": true,
    "parent_id": null,
    "children": [
      {
        "id": 2,
        "name": "文档.md",
        "is_folder": false,
        "parent_id": 1,
        "children": []
      }
    ]
  }
]
```

### 获取文件列表
- **GET** `/files?parent_id=1`
- **Headers:** `Authorization: Bearer <token>`
- **Query:** `parent_id` (可选，父文件夹ID)
- **Response (200):**
```json
[
  {
    "id": 1,
    "name": "文件夹",
    "path": "文件夹",
    "content": "",
    "parent_id": null,
    "is_folder": true,
    "owner_id": 1,
    "created_at": "2026-07-28T09:56:08.941425",
    "updated_at": "2026-07-28T09:56:08.941425"
  }
]
```

### 获取单个文件
- **GET** `/files/{file_id}`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
{
  "id": 1,
  "name": "文档.md",
  "path": "文档.md",
  "content": "# 标题\n\n内容...",
  "parent_id": null,
  "is_folder": false,
  "owner_id": 1,
  "created_at": "2026-07-28T09:56:08.941425",
  "updated_at": "2026-07-28T09:56:08.941425"
}
```

### 创建文件/文件夹
- **POST** `/files`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "name": "新文档.md",
  "content": "# 新文档\n\n内容...",
  "parent_id": null,
  "is_folder": false
}
```
- **Response (201):** 返回创建的文件对象

### 更新文件
- **PUT** `/files/{file_id}`
- **Headers:** `Authorization: Bearer <token>`
- **Body (可选字段):**
```json
{
  "name": "新名称.md",
  "content": "新内容",
  "parent_id": 1
}
```
- **Response (200):** 返回更新后的文件对象

### 删除文件
- **DELETE** `/files/{file_id}`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
{
  "message": "删除成功"
}
```

### 搜索文件
- **GET** `/files/search/?q=关键字`
- **Headers:** `Authorization: Bearer <token>`
- **Query:** `q` (搜索关键字，最少1字符)
- **Response (200):** 返回匹配的文件列表

---

## 版本控制接口 `/files/{file_id}/versions`

### 获取版本列表
- **GET** `/files/{file_id}/versions`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
[
  {
    "id": 1,
    "file_id": 1,
    "content": "版本内容...",
    "comment": "保存版本",
    "version_num": 1,
    "created_at": "2026-07-28T09:56:08.941425"
  }
]
```

### 创建版本快照
- **POST** `/files/{file_id}/versions`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "comment": "版本说明（可选）"
}
```
- **Response (201):** 返回创建的版本对象

### 获取指定版本
- **GET** `/files/{file_id}/versions/{version_id}`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):** 返回指定版本对象

### 恢复版本
- **POST** `/files/{file_id}/versions/{version_id}/restore`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):** 返回恢复后的文件对象

---

## 插件管理接口 `/plugins`

### 获取插件列表
- **GET** `/plugins`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
[
  {
    "id": 1,
    "name": "插件名称",
    "version": "1.0.0",
    "description": "插件描述",
    "author": "作者",
    "enabled": true,
    "installed_at": "2026-07-28T09:56:08.941425"
  }
]
```

### 获取单个插件
- **GET** `/plugins/{plugin_id}`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):** 返回插件对象

### 创建插件
- **POST** `/plugins`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "name": "新插件",
  "version": "1.0.0",
  "description": "插件描述",
  "author": "作者",
  "manifest": {}
}
```
- **Response (201):** 返回创建的插件对象

### 更新插件
- **PUT** `/plugins/{plugin_id}`
- **Headers:** `Authorization: Bearer <token>`
- **Body (可选字段):**
```json
{
  "enabled": true,
  "config": {}
}
```
- **Response (200):** 返回更新后的插件对象

### 删除插件
- **DELETE** `/plugins/{plugin_id}`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
{
  "message": "删除成功"
}
```

---

## 协作接口 `/collaboration`

### 获取文件协作者
- **GET** `/collaboration/files/{file_id}/collaborators`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
[
  {
    "id": 1,
    "user_id": 2,
    "username": "协作者",
    "permission": "edit"
  }
]
```

### 添加协作者
- **POST** `/collaboration/files/{file_id}/collaborators`
- **Headers:** `Authorization: Bearer <token>`
- **Query:** `user_id` (用户ID), `permission` (权限，默认"edit")
- **Response (200):**
```json
{
  "message": "添加成功"
}
```

### 移除协作者
- **DELETE** `/collaboration/files/{file_id}/collaborators/{collab_user_id}`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
{
  "message": "移除成功"
}
```

---

## WebSocket 实时协作 `/ws/collab/{file_id}`

连接地址: `ws://localhost:8000/ws/collab/{file_id}?token={access_token}`

### 消息类型

**服务端推送:**
- `user_joined` - 用户加入
```json
{
  "type": "user_joined",
  "user_id": 1,
  "username": "用户名"
}
```
- `user_left` - 用户离开
```json
{
  "type": "user_left",
  "user_id": 1,
  "username": "用户名"
}
```
- `cursor_update` - 光标位置更新
```json
{
  "type": "cursor_update",
  "user_id": 1,
  "username": "用户名",
  "position": {"line": 1, "column": 5}
}
```
- `content_change` - 内容变更
```json
{
  "type": "content_change",
  "user_id": 1,
  "content": "新内容",
  "cursor_position": {"line": 1, "column": 5}
}
```

**客户端发送:**
- `cursor_update` - 发送光标位置
```json
{
  "type": "cursor_update",
  "position": {"line": 1, "column": 5}
}
```
- `content_change` - 发送内容变更
```json
{
  "type": "content_change",
  "content": "新内容",
  "cursor_position": {"line": 1, "column": 5}
}
```
- `save` - 保存文件
```json
{
  "type": "save",
  "content": "完整内容"
}
```

---

## 错误响应

所有接口的错误响应格式:

```json
{
  "detail": "错误信息"
}
```

常见状态码:
- `400` - 请求参数错误
- `401` - 未认证 / 认证失败
- `403` - 无权限访问
- `404` - 资源不存在
- `500` - 服务器内部错误
