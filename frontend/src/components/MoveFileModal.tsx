import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileApi } from '@/services/fileApi';
import { X, Folder, FolderOpen, ChevronRight, ChevronDown, Home } from 'lucide-react';
import clsx from 'clsx';
import { FileItem } from '@/types';

interface MoveFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: number;
  fileName: string;
  currentParentId: number | null;
}

export default function MoveFileModal({
  isOpen,
  onClose,
  fileId,
  fileName,
  currentParentId,
}: MoveFileModalProps) {
  const queryClient = useQueryClient();
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(currentParentId);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: fileApi.getFolders,
    enabled: isOpen,
  });

  const moveMutation = useMutation({
    mutationFn: (parentId: number | null) => fileApi.moveFile(fileId, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fileTree'] });
      onClose();
    },
  });

  const handleMove = () => {
    if (selectedFolderId === currentParentId) {
      onClose();
      return;
    }
    moveMutation.mutate(selectedFolderId);
  };

  const toggleFolder = (folderId: number) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
            移动文件
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          移动 <span className="font-medium">{fileName}</span> 到：
        </p>

        <div className="border border-slate-200 dark:border-slate-700 rounded-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="text-center text-sm text-slate-400 py-8">加载中...</div>
          ) : (
            <div className="py-2">
              <button
                onClick={() => setSelectedFolderId(null)}
                className={clsx(
                  'w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors',
                  selectedFolderId === null
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                )}
              >
                <Home className="w-4 h-4" />
                <span>根目录</span>
              </button>

              {folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  selectedFolderId={selectedFolderId}
                  expandedFolders={expandedFolders}
                  onSelect={setSelectedFolderId}
                  onToggle={toggleFolder}
                  isCurrentLocation={folder.id === currentParentId}
                />
              ))}

              {folders.length === 0 && (
                <div className="text-center text-sm text-slate-400 py-4">
                  暂无文件夹
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex space-x-3 mt-4">
          <button
            onClick={handleMove}
            disabled={moveMutation.isPending}
            className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50
                       text-white py-2 rounded-lg transition-colors"
          >
            移动
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600
                       text-slate-700 dark:text-slate-200 py-2 rounded-lg transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

interface FolderItemProps {
  folder: FileItem;
  selectedFolderId: number | null;
  expandedFolders: Set<number>;
  onSelect: (id: number | null) => void;
  onToggle: (id: number) => void;
  isCurrentLocation: boolean;
}

function FolderItem({
  folder,
  selectedFolderId,
  expandedFolders,
  onSelect,
  onToggle,
  isCurrentLocation,
}: FolderItemProps) {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;

  return (
    <div>
      <button
        onClick={() => onSelect(folder.id)}
        disabled={isCurrentLocation}
        className={clsx(
          'w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors',
          isSelected
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
            : isCurrentLocation
            ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isCurrentLocation) onToggle(folder.id);
          }}
          className="p-0 m-0 bg-transparent border-0"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        {isExpanded ? (
          <FolderOpen className="w-4 h-4 text-primary-500" />
        ) : (
          <Folder className="w-4 h-4 text-primary-500" />
        )}
        <span className="truncate">{folder.name}</span>
        {isCurrentLocation && (
          <span className="ml-auto text-xs text-slate-400">(当前位置)</span>
        )}
      </button>
    </div>
  );
}
