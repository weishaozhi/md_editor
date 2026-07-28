import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileApi } from '@/services/fileApi';
import { authApi } from '@/services/authApi';
import { useAuthStore } from '@/store/authStore';
import { useFileStore } from '@/store/fileStore';
import FileTree from '@/components/FileTree/FileTree';
import {
  Plus,
  FolderPlus,
  Search,
  Settings,
  LogOut,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { User } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUser, logout, isAuthenticated } = useAuthStore();
  const { setCurrentFile } = useFileStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  // Fetch user data on mount if authenticated but no user data
  useEffect(() => {
    if (isAuthenticated && !user) {
      authApi.getMe().then(setUser).catch(() => {
        logout();
        navigate('/login');
      });
    }
  }, [isAuthenticated, user, setUser, logout, navigate]);

  const { data: fileTree, isLoading, refetch } = useQuery({
    queryKey: ['fileTree'],
    queryFn: fileApi.getTree,
  });

  const createFileMutation = useMutation({
    mutationFn: fileApi.createFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fileTree'] });
      setShowNewFileModal(false);
      setNewFileName('');
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      fileApi.renameFile(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fileTree'] });
      setRenameError(null);
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? '重命名失败';
      setRenameError(msg);
      setTimeout(() => setRenameError(null), 3000);
    },
  });

  const handleRename = (id: number, newName: string) => {
    renameFileMutation.mutate({ id, name: newName });
  };

  const handleCreateFile = (isFolder: boolean) => {
    if (!newFileName.trim()) return;
    createFileMutation.mutate({
      name: newFileName,
      is_folder: isFolder,
      content: isFolder ? '' : '# 新文档\n\n开始编辑...',
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleFileClick = (file: { id: number; is_folder: boolean }) => {
    if (!file.is_folder) {
      navigate(`/editor/${file.id}`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* 重命名错误提示 */}
      {renameError && (
        <div className="fixed top-4 right-4 z-50 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg shadow-md text-sm">
          {renameError}
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-primary-500 rounded-xl p-2">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold ml-3 text-slate-800 dark:text-white">MD Editor</h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索文件..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg w-64 focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
              />
            </div>

            <button
              onClick={() => refetch()}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              title="刷新"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              title="设置"
            >
              <Settings className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">{user?.username}</span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400"
              title="退出"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setNewFileName('');
                  setShowNewFileModal(true);
                }}
                className="flex-1 flex items-center justify-center space-x-1 bg-primary-500 hover:bg-primary-600 text-white py-2 px-3 rounded-lg text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>文件</span>
              </button>
              <button
                onClick={() => {
                  setNewFileName('');
                  setShowNewFileModal(true);
                }}
                className="flex-1 flex items-center justify-center space-x-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-2 px-3 rounded-lg text-sm transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                <span>文件夹</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : (
              <FileTree
                items={fileTree || []}
                onFileClick={handleFileClick}
                onRename={handleRename}
                searchQuery={searchQuery}
              />
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-full p-6 inline-block mb-4">
              <FileText className="w-12 h-12 text-slate-400" />
            </div>
            <h2 className="text-xl font-medium text-slate-600 dark:text-slate-400 mb-2">
              选择一个文件开始编辑
            </h2>
            <p className="text-slate-500 dark:text-slate-500">
              在左侧文件树中选择一个 Markdown 文件，或创建新文件
            </p>
          </div>
        </main>
      </div>

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
              创建新文件
            </h3>
            <input
              type="text"
              placeholder="输入文件名..."
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const isFolder = (e.target as HTMLElement).dataset.isFolder === 'true';
                  handleCreateFile(false);
                }
              }}
            />
            <div className="flex space-x-3">
              <button
                onClick={() => handleCreateFile(false)}
                disabled={!newFileName.trim()}
                className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-2 rounded-lg transition-colors"
              >
                创建文件
              </button>
              <button
                onClick={() => handleCreateFile(true)}
                disabled={!newFileName.trim()}
                className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-slate-200 py-2 rounded-lg transition-colors"
              >
                创建文件夹
              </button>
            </div>
            <button
              onClick={() => setShowNewFileModal(false)}
              className="w-full mt-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 py-2"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
