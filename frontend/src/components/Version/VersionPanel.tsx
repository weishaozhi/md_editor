import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Clock, RotateCcw, GitCompare, X, Plus, MessageSquare, Check } from 'lucide-react';
import { fileApi } from '@/services/fileApi';

interface VersionPanelProps {
  fileId: number;
  onCreateVersion?: (comment: string) => void;
  onClose?: () => void;
  onCompare?: (versionId: number) => void;
  isCreating?: boolean;
}

export default function VersionPanel({
  fileId,
  onCreateVersion,
  onClose,
  onCompare,
  isCreating = false,
}: VersionPanelProps) {
  const queryClient = useQueryClient();
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');

  const { data: versions, isLoading } = useQuery({
    queryKey: ['versions', fileId],
    queryFn: () => fileApi.getVersions(fileId),
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: number) => fileApi.restoreVersion(fileId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
      queryClient.invalidateQueries({ queryKey: ['versions', fileId] });
      setSelectedVersionId(null);
    },
  });

  const openCommentModal = () => {
    setCommentDraft('');
    setShowCommentModal(true);
  };

  const closeCommentModal = () => {
    setShowCommentModal(false);
    setCommentDraft('');
  };

  const submitCommentModal = () => {
    const trimmed = commentDraft.trim();
    setShowCommentModal(false);
    setCommentDraft('');
    if (onCreateVersion) {
      onCreateVersion(trimmed);
    }
  };

  /**
   * 把后端返回的 created_at 渲染成本地时区字符串。
   * 后端存的是 `datetime.utcnow()` (无 tz) → pydantic 序列化不带 Z → 前端
   * `new Date("2026-07-28T22:50:13")` 会按 **浏览器本地时区** 解析，导致显示漂移
   * （例如后端 22:50 UTC，前端 +8 时区看到次日 06:50）。
   * 修复: 把无 tz 的字符串当成 UTC，强制按 'Asia/Shanghai' (GMT+8) 输出。
   */
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const hasTz = /[zZ]|[\+\-]\d{2}:?\d{2}$/.test(dateStr);
    const iso = hasTz ? dateStr : `${dateStr}Z`;
    const date = new Date(iso);
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleClose = () => {
    setSelectedVersionId(null);
    onClose?.();
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-white flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          版本历史
        </h3>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          title="关闭版本面板"
          aria-label="关闭版本面板"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <button
        onClick={openCommentModal}
        disabled={isCreating}
        className="w-full mb-3 flex items-center justify-center space-x-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-1.5 rounded-lg text-sm transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>{isCreating ? '保存中...' : '保存版本快照'}</span>
      </button>

      {isLoading ? (
        <p className="text-sm text-slate-500">加载中...</p>
      ) : versions && versions.length > 0 ? (
        <div className="space-y-2">
          {versions.map((version) => (
            <div
              key={version.id}
              className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                selectedVersionId === version.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-primary-300'
              }`}
              onClick={() => setSelectedVersionId(version.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-slate-800 dark:text-white">
                  v{version.version_num}
                </span>
                <span className="text-xs text-slate-500">
                  {formatDate(version.created_at)}
                </span>
              </div>
              {version.comment && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  {version.comment}
                </p>
              )}
              {selectedVersionId === version.id && (
                <div className="flex space-x-2 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      restoreMutation.mutate(version.id);
                    }}
                    className="flex items-center text-sm text-primary-600 hover:text-primary-700"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    恢复此版本
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCompare?.(version.id);
                    }}
                    disabled={!onCompare}
                    className="flex items-center text-sm text-slate-600 hover:text-slate-700 dark:text-slate-400 disabled:opacity-40"
                  >
                    <GitCompare className="w-3 h-3 mr-1" />
                    对比
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">暂无版本记录</p>
      )}

      {/* 评论输入 Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div
            className="bg-white dark:bg-slate-800 rounded-xl p-5 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center">
                <MessageSquare className="w-4 h-4 mr-2 text-primary-500" />
                保存版本快照
              </h3>
              <button
                onClick={closeCommentModal}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                aria-label="关闭"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              可填写版本说明（最多 500 字符）。留空也可以提交。
            </p>
            <textarea
              value={commentDraft}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setCommentDraft(e.target.value);
                }
              }}
              placeholder="例如：完成第一章草稿 / 修复了 X bug"
              autoFocus
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600
                         rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         dark:bg-slate-900 dark:text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  submitCommentModal();
                }
              }}
            />
            <div className="flex items-center justify-between mt-1 mb-3">
              <span className="text-xs text-slate-400">
                {commentDraft.length} / 500
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={closeCommentModal}
                className="flex-1 px-3 py-2 text-sm rounded-lg
                           bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600
                           text-slate-700 dark:text-slate-200"
              >
                取消
              </button>
              <button
                onClick={submitCommentModal}
                disabled={isCreating}
                className="flex-1 px-3 py-2 text-sm rounded-lg flex items-center justify-center space-x-1
                           bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white"
              >
                <Check className="w-4 h-4" />
                <span>保存版本</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
