import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileApi } from '@/services/fileApi';
import { diffLines } from 'diff';
import { useState } from 'react';
import { Clock, RotateCcw, GitCompare, X } from 'lucide-react';

interface VersionPanelProps {
  fileId: number;
}

export default function VersionPanel({ fileId }: VersionPanelProps) {
  const queryClient = useQueryClient();
  const [compareVersion, setCompareVersion] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-white flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          版本历史
        </h3>
        <button
          onClick={() => {
            setCompareVersion(null);
            setSelectedVersionId(null);
          }}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

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
                      setCompareVersion(version.id);
                    }}
                    className="flex items-center text-sm text-slate-600 hover:text-slate-700 dark:text-slate-400"
                  >
                    <GitCompare className="w-3 h-3 mr-1" />
                    对比
                  </button>
                </div>
              )}
            </div>
          ))}

          {compareVersion && selectedVersionId && compareVersion !== selectedVersionId && (
            <CompareVersions
              fileId={fileId}
              versionId1={compareVersion}
              versionId2={selectedVersionId}
              onClose={() => setCompareVersion(null)}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">暂无版本记录</p>
      )}
    </div>
  );
}

function CompareVersions({
  fileId,
  versionId1,
  versionId2,
  onClose,
}: {
  fileId: number;
  versionId1: number;
  versionId2: number;
  onClose: () => void;
}) {
  const { data: v1 } = useQuery({
    queryKey: ['version', fileId, versionId1],
    queryFn: () => fileApi.getVersion(fileId, versionId1),
    enabled: !!versionId1,
  });

  const { data: v2 } = useQuery({
    queryKey: ['version', fileId, versionId2],
    queryFn: () => fileApi.getVersion(fileId, versionId2),
    enabled: !!versionId2,
  });

  if (!v1 || !v2) return null;

  const diff = diffLines(v1.content, v2.content);

  return (
    <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          对比 v{v1.version_num} 和 v{v2.version_num}
        </span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
      <div className="text-xs font-mono overflow-x-auto">
        {diff.map((part, index) => (
          <div
            key={index}
            className={`px-2 py-0.5 ${
              part.added
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : part.removed
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {part.added ? '+' : part.removed ? '-' : ' '}
            {part.value}
          </div>
        ))}
      </div>
    </div>
  );
}
