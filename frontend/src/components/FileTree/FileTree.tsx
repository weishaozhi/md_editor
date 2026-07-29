import { useState, useRef, useEffect } from 'react';
import { FileTreeItem } from '@/types';
import { useFileStore } from '@/store/fileStore';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Pencil,
  Check,
  X as XIcon,
  Trash2,
  FolderInput,
} from 'lucide-react';
import clsx from 'clsx';

interface FileTreeProps {
  items: FileTreeItem[];
  onFileClick: (file: { id: number; is_folder: boolean }) => void;
  onRename?: (id: number, newName: string) => void;
  onDelete?: (id: number) => void;
  onMove?: (id: number, currentParentId: number | null) => void;
  onDragStart?: (id: number, isFolder: boolean) => void;
  onDragEnd?: (id: number) => void;
  draggedItemId?: number | null | undefined;
  searchQuery?: string;
}

interface RowProps {
  item: FileTreeItem;
  level?: number;
  isEditing: boolean;
  isHovered: boolean;
  editValue: string;
  draggedItemId: number | null | undefined;
  onFileClick: (file: { id: number; is_folder: boolean }) => void;
  onRename?: (id: number, newName: string) => void;
  onStartEdit: (id: number, currentName: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onChangeValue: (v: string) => void;
  onContextMenu?: (e: React.MouseEvent, id: number, isFolder: boolean, name: string) => void;
  onDragStart?: (id: number, isFolder: boolean) => void;
  onDragEnd?: (id: number) => void;
  onMove?: (fileId: number, targetFolderId: number) => void;
}

function Row({
  item,
  level,
  isEditing,
  isHovered,
  editValue,
  draggedItemId,
  onFileClick,
  onRename,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onChangeValue,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onMove,
}: RowProps) {
  const { toggleFolder, isFolderExpanded } = useFileStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const isDragging = draggedItemId === item.id;
  const isDragOver = useState(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, isFolder: item.is_folder }));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(item.id, item.is_folder);
  };

  const handleDragEnd = () => {
    onDragEnd?.(item.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (item.is_folder && !isEditing) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.is_folder && onMove) {
      const data = e.dataTransfer.getData('text/plain');
      if (data) {
        try {
          const { id } = JSON.parse(data);
          if (id !== item.id) {
            onMove(id, item.id);
          }
        } catch {
          // ignore
        }
      }
    }
  };

  return (
    <div
      className={clsx(
        'group flex items-center space-x-2 px-2 py-1.5 rounded-lg transition-colors',
        isHovered && !isEditing ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700',
        isDragging && 'opacity-50'
      )}
      onContextMenu={(e) => onContextMenu?.(e, item.id, item.is_folder, item.name)}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Folder chevron OR spacer */}
      {item.is_folder ? (
        <button
          onClick={() => toggleFolder(item.id)}
          className="p-0 m-0 bg-transparent border-0 outline-none flex items-center"
        >
          {isFolderExpanded(item.id) ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>
      ) : (
        <span className="w-4" />
      )}

      {/* Folder / File icon */}
      {item.is_folder ? (
        isFolderExpanded(item.id) ? (
          <FolderOpen className="w-4 h-4 text-primary-500" />
        ) : (
          <Folder className="w-4 h-4 text-primary-500" />
        )
      ) : (
        <FileText className="w-4 h-4 text-slate-400" />
      )}

      {/* Name (or input) */}
      {isEditing ? (
        <div className="flex-1 flex items-center space-x-1 min-w-0">
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => onChangeValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommitEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            onBlur={onCommitEdit}
            className="flex-1 min-w-0 px-1 py-0 text-sm border border-primary-400 rounded
                       bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100
                       focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCommitEdit}
            className="p-0.5 text-green-600 hover:text-green-700"
            title="确认 (Enter)"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCancelEdit}
            className="p-0.5 text-slate-500 hover:text-slate-700"
            title="取消 (Esc)"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <span
          className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-300 truncate cursor-pointer select-none"
          onClick={() => {
            if (item.is_folder) {
              toggleFolder(item.id);
            } else {
              onFileClick({ id: item.id, is_folder: item.is_folder });
            }
          }}
          title="右键或点击铅笔图标重命名"
        >
          {item.name}
        </span>
      )}

      {/* Hover 铅笔按钮 */}
      {!isEditing && onRename && (
        <button
          onClick={() => onStartEdit(item.id, item.name)}
          className={clsx(
            'p-0.5 rounded text-slate-500 hover:text-primary-600 hover:bg-slate-200 dark:hover:bg-slate-600',
            isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
          title="重命名"
          aria-label="重命名"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

interface ContextMenuState {
  x: number;
  y: number;
  id: number;
  isFolder: boolean;
  name: string;
}

export default function FileTree({
  items,
  onFileClick,
  onRename,
  onDelete,
  onMove,
  onDragStart,
  onDragEnd,
  draggedItemId,
  searchQuery = '',
}: FileTreeProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const filteredItems = searchQuery
    ? items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  const startEdit = (id: number, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
    setContextMenu(null);
  };

  const commitEdit = () => {
    if (editingId === null) return;
    const trimmed = editValue.trim();
    const original = items.find((it) => it.id === editingId)?.name ?? '';
    if (trimmed && trimmed !== original) {
      onRename?.(editingId, trimmed);
    }
    setEditingId(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleContextMenu = (e: React.MouseEvent, id: number, isFolder: boolean, name: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, id, isFolder, name });
  };

  const handleInternalDragEnd = (id: number) => {
    onDragEnd?.(id);
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  return (
    <div className="space-y-1">
      {filteredItems.map((item) => (
        <div
          key={item.id}
          onMouseEnter={() => setHoveredId(item.id)}
          onMouseLeave={() => setHoveredId((h) => (h === item.id ? null : h))}
        >
          <Row
            item={item}
            isEditing={editingId === item.id}
            isHovered={hoveredId === item.id}
            editValue={editValue}
            draggedItemId={draggedItemId}
            onFileClick={onFileClick}
            onRename={onRename}
            onStartEdit={startEdit}
            onCommitEdit={commitEdit}
            onCancelEdit={cancelEdit}
            onChangeValue={setEditValue}
            onContextMenu={handleContextMenu}
            onDragStart={onDragStart}
            onDragEnd={handleInternalDragEnd}
          />

          {item.is_folder && item.children.length > 0 && (
            <FileTree
              items={item.children}
              onFileClick={onFileClick}
              onRename={onRename}
              onDelete={onDelete}
              onMove={onMove}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              draggedItemId={draggedItemId}
              searchQuery={searchQuery}
            />
          )}
        </div>
      ))}

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                     rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.isFolder && (
            <button
              onClick={() => {
                if (contextMenu) {
                  onFileClick({ id: contextMenu.id, is_folder: false });
                  setContextMenu(null);
                }
              }}
              className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm
                         text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>打开</span>
            </button>
          )}

          {onRename && (
            <button
              onClick={() => startEdit(contextMenu.id, contextMenu.name)}
              className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm
                         text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>重命名</span>
            </button>
          )}

          {onMove && (
            <button
              onClick={() => {
                const item = findItemById(items, contextMenu.id);
                const parentId = item?.parent_id ?? null;
                onMove(contextMenu.id, parentId);
                setContextMenu(null);
              }}
              className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm
                         text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <FolderInput className="w-3.5 h-3.5" />
              <span>移动到...</span>
            </button>
          )}

          {onDelete && (
            <>
              <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
              <button
                onClick={() => {
                  onDelete(contextMenu.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm
                           text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>删除</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function findItemById(items: FileTreeItem[], id: number): FileTreeItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children.length > 0) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}
