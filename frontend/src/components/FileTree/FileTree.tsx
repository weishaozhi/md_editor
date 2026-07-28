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
} from 'lucide-react';
import clsx from 'clsx';

interface FileTreeProps {
  items: FileTreeItem[];
  onFileClick: (file: { id: number; is_folder: boolean }) => void;
  onRename?: (id: number, newName: string) => void;
  searchQuery?: string;
  level?: number;
}

interface RowProps {
  item: FileTreeItem;
  level: number;
  isEditing: boolean;
  isHovered: boolean;
  editValue: string;
  onFileClick: (file: { id: number; is_folder: boolean }) => void;
  onRename?: (id: number, newName: string) => void;
  onStartEdit: (id: number, currentName: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onChangeValue: (v: string) => void;
  onContextMenu?: (e: React.MouseEvent, item: FileTreeItem) => void;
}

function Row({
  item,
  level,
  isEditing,
  isHovered,
  editValue,
  onFileClick,
  onRename,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onChangeValue,
  onContextMenu,
}: RowProps) {
  const { toggleFolder, isFolderExpanded } = useFileStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      className={clsx(
        'group flex items-center space-x-2 px-2 py-1.5 rounded-lg transition-colors',
        isHovered && !isEditing ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700',
        level > 0 && 'ml-4'
      )}
      onContextMenu={(e) => onContextMenu?.(e, item)}
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
          title="右键或点击右侧铅笔图标重命名"
        >
          {item.name}
        </span>
      )}

      {/* Hover 铅笔按钮 (非 folder, 非 editing) */}
      {!item.is_folder && !isEditing && onRename && (
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

export default function FileTree({
  items,
  onFileClick,
  onRename,
  searchQuery = '',
  level = 0,
}: FileTreeProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FileTreeItem;
  } | null>(null);

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

  const handleContextMenu = (e: React.MouseEvent, item: FileTreeItem) => {
    if (item.is_folder) return; // 只给文件加重命名（文件夹本版本不重命名）
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  // 点击其他位置关闭右键菜单
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
            level={level}
            isEditing={editingId === item.id}
            isHovered={hoveredId === item.id}
            editValue={editValue}
            onFileClick={onFileClick}
            onRename={onRename}
            onStartEdit={startEdit}
            onCommitEdit={commitEdit}
            onCancelEdit={cancelEdit}
            onChangeValue={setEditValue}
            onContextMenu={handleContextMenu}
          />

          {item.is_folder && item.children.length > 0 && (
            <FileTree
              items={item.children}
              onFileClick={onFileClick}
              onRename={onRename}
              searchQuery={searchQuery}
              level={level + 1}
            />
          )}
        </div>
      ))}

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                     rounded-lg shadow-lg py-1 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => startEdit(contextMenu.item.id, contextMenu.item.name)}
            disabled={!onRename}
            className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm
                       text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>重命名</span>
          </button>
        </div>
      )}
    </div>
  );
}