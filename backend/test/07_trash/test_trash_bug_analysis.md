# md_editor 垃圾桶功能测试

## 测试目标

1. **垃圾桶拖拽功能**：验证文件/文件夹能否拖拽到垃圾桶区域
2. **垃圾桶显示已删除文件夹**：验证已删除的文件夹是否正确显示

## 发现的问题

### 问题 1：拖拽无法到达垃圾桶

**根因分析**：
- `FileTree` 组件内部使用了 `DndContext`，但 `TrashDropZone` 是独立组件
- dnd-kit 的 `DndContext` 必须在同一组件树中才能工作
- 当前设计导致 `DragOverlay` 和 `useDroppable` 无法通信

**证据**：
- `FileTree.tsx` 内部定义了 `DndContext`
- `TrashDropZone` 使用 `useDroppable`，但不在同一个 `DndContext` 中
- `DashboardPage.tsx` 中 `TrashDropZone` 包裹了 `TrashPanel`

### 问题 2：垃圾桶不显示文件夹图标

**根因分析**：
- `TrashItemRow` 组件只显示文件名，没有根据 `is_folder` 显示不同图标
- API 返回的 `TrashItem` 包含 `is_folder` 字段，但 UI 未使用

**证据**：
- `TrashPanel.tsx` 第 264-300 行 `TrashItemRow` 组件
- `types/index.ts` 第 75-78 行 `TrashItem` 接口包含 `is_folder`

## 修复方案

1. 将 `DndContext` 上移到 `DashboardPage` 层级
2. 让 `FileTree` 暴露 `onDragEnd` 回调，由父组件处理
3. 在 `TrashItemRow` 中添加文件夹图标判断
