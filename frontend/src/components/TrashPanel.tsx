import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trashApi } from '@/services/trashApi';
import { useTrashStore } from '@/store/trashStore';
import {
  Trash2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Trash,
  Settings,
  X,
  Folder,
  FileText,
} from 'lucide-react';
import clsx from 'clsx';
import { TrashItem } from '@/types';

function formatDeletedAt(deletedAt: string) {
  const date = new Date(deletedAt);
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TrashDropZoneProps {
  onDrop?: (fileId: number) => void;
  children?: React.ReactNode;
}

export default function TrashDropZone({ onDrop }: TrashDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const queryClient = useQueryClient();
  const { isExpanded, toggleExpanded, setSettings } = useTrashStore();
  const [showSettings, setShowSettings] = useState(false);
  const [retentionHours, setRetentionHours] = useState<string>('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const { data: trashItems = [], isLoading } = useQuery({
    queryKey: ['trash'],
    queryFn: trashApi.getTrash,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['trashSettings'],
    queryFn: trashApi.getSettings,
  });

  const restoreMutation = useMutation({
    mutationFn: trashApi.restoreFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ['fileTree'] });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: trashApi.permanentDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
    },
  });

  const emptyTrashMutation = useMutation({
    mutationFn: trashApi.emptyTrash,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      setConfirmEmpty(false);
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (hours: number | null) =>
      trashApi.updateSettings({ retention_hours: hours }),
    onSuccess: (data) => {
      setSettings(data);
      setShowSettings(false);
    },
  });

  const handleRestore = (fileId: number) => {
    restoreMutation.mutate(fileId);
  };

  const handlePermanentDelete = (fileId: number) => {
    if (window.confirm('确定要永久删除吗？此操作无法恢复。')) {
      permanentDeleteMutation.mutate(fileId);
    }
  };

  const handleEmptyTrash = () => {
    if (confirmEmpty) {
      emptyTrashMutation.mutate();
    } else {
      setConfirmEmpty(true);
      setTimeout(() => setConfirmEmpty(false), 3000);
    }
  };

  const handleSaveSettings = () => {
    const hours = retentionHours.trim() === '' ? null : parseInt(retentionHours, 10);
    if (hours !== null && (isNaN(hours) || hours < 0)) {
      return;
    }
    updateSettingsMutation.mutate(hours);
  };

  const formatRetentionTime = (hours: number | null) => {
    if (hours === null) return '永久保留';
    if (hours < 24) return `${hours} 小时`;
    const days = Math.floor(hours / 24);
    return `${days} 天`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      try {
        const { id } = JSON.parse(data);
        if (typeof id === 'number' && onDrop) {
          onDrop(id);
        }
      } catch {
        // ignore invalid data
      }
    }
  };

  return (
    <div
      className={clsx(
        'border-t transition-colors',
        isDragOver
          ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
          : 'border-slate-200 dark:border-slate-700'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-3">
        <div className="flex items-center justify-between">
          <button
            onClick={toggleExpanded}
            className="flex items-center space-x-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Trash2 className="w-4 h-4" />
            <span>垃圾桶</span>
            {trashItems.length > 0 && (
              <span className="ml-1 text-xs bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded-full">
                {trashItems.length}
              </span>
            )}
          </button>

          <div className="flex items-center space-x-1">
            {settingsData?.retention_hours !== null && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {formatRetentionTime(settingsData?.retention_hours || null)}
              </span>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              title="垃圾桶设置"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isDragOver && (
          <div className="mt-2 text-sm text-red-500 dark:text-red-400 text-center py-2 border-2 border-dashed border-red-300 dark:border-red-700 rounded-lg">
            释放以删除
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="px-2 pb-2 space-y-1 max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="text-center text-sm text-slate-400 py-4">加载中...</div>
          ) : trashItems.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-4">垃圾桶为空</div>
          ) : (
            <>
              {trashItems.map((item) => (
                <TrashItemRow
                  key={item.id}
                  item={item}
                  onRestore={handleRestore}
                  onDelete={handlePermanentDelete}
                  isRestoring={restoreMutation.isPending}
                  isDeleting={permanentDeleteMutation.isPending}
                />
              ))}
              {trashItems.length > 0 && (
                <button
                  onClick={handleEmptyTrash}
                  disabled={emptyTrashMutation.isPending}
                  className={clsx(
                    'w-full flex items-center justify-center space-x-1 py-2 text-sm rounded-lg transition-colors',
                    confirmEmpty
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                  )}
                >
                  <Trash className="w-3.5 h-3.5" />
                  <span>{confirmEmpty ? '再次点击确认清空' : '清空垃圾桶'}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-80 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                垃圾桶设置
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">
                  自动清理保留时间
                </label>
                <input
                  type="number"
                  value={retentionHours}
                  onChange={(e) => setRetentionHours(e.target.value)}
                  placeholder="留空表示永久保留"
                  min="0"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-700 text-slate-800 dark:text-white
                             focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-slate-400">
                  设置文件在垃圾桶中保留的小时数，留空或 0 表示永久保留
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                  className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50
                             text-white py-2 rounded-lg transition-colors"
                >
                  保存
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600
                             text-slate-700 dark:text-slate-200 py-2 rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TrashItemRowProps {
  item: TrashItem;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  isRestoring: boolean;
  isDeleting: boolean;
}

function TrashItemRow({
  item,
  onRestore,
  onDelete,
  isRestoring,
  isDeleting,
}: TrashItemRowProps) {
  const isFolder = item.is_folder;

  return (
    <div className="group flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        {isFolder ? (
          <Folder className="w-4 h-4 text-primary-500 flex-shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-400">
              {formatDeletedAt(item.deleted_at!)}
            </span>
            {isFolder && (
              <span className="text-xs bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 px-1 rounded">
                文件夹
              </span>
            )}
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-200 truncate">
            {item.name}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onRestore(item.id)}
          disabled={isRestoring}
          className="p-1 text-slate-400 hover:text-green-600 dark:hover:text-green-400"
          title="恢复"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          disabled={isDeleting}
          className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
          title="永久删除"
        >
          <Trash className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
