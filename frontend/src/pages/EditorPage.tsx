import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileApi } from '@/services/fileApi';
import { useFileStore } from '@/store/fileStore';
import { useAuthStore } from '@/store/authStore';
import Editor from '@monaco-editor/react';
import MarkdownPreview from '@/components/Preview/MarkdownPreview';
import VersionPanel from '@/components/Version/VersionPanel';
import CollaboratorList from '@/components/Collaboration/CollaboratorList';
import EditorToolbar from '@/components/Editor/EditorToolbar';
import {
  ArrowLeft,
  Save,
  Clock,
  Users,
  SplitSquareHorizontal,
  Eye,
  Code,
  RefreshCw,
  Check,
} from 'lucide-react';

type ViewMode = 'split' | 'edit' | 'preview';

export default function EditorPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const { setCurrentFile } = useFileStore();

  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showCollab, setShowCollab] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const editorRef = useRef<unknown>(null);

  // 暴露编辑器实例到 window，便于自动化测试和调试
  const handleEditorMount = useCallback((editor: unknown) => {
    editorRef.current = editor;
    if (typeof window !== 'undefined') {
      (window as unknown as { __mdEditor?: unknown }).__mdEditor = editor;
    }
  }, []);
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as unknown as { __mdEditor?: unknown }).__mdEditor;
      }
    };
  }, [handleEditorMount]);

  const { data: file, isLoading } = useQuery({
    queryKey: ['file', fileId],
    queryFn: () => fileApi.getFile(Number(fileId)),
    enabled: !!fileId,
  });

  const updateFileMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { content: string } }) =>
      fileApi.updateFile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
  });

  useEffect(() => {
    if (file) {
      setContent(file.content);
      setCurrentFile(file);
    }
  }, [file, setCurrentFile]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
      setHasUnsavedChanges(true);
    }
  };

  const handleSave = useCallback(() => {
    if (!fileId || !file) return;
    setSaveStatus('saving');
    updateFileMutation.mutate({ id: file.id, data: { content } });
  }, [fileId, file, content, updateFileMutation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }
      // 兜底：Esc 关闭 Monaco Find Widget
      // - Monaco 默认 Esc 处理在某些环境（Chrome + 扩展）会失效
      // - 主动调用 closeFindWidget 保证用户一定能关闭查找面板
      if (e.key === 'Escape') {
        const editor = editorRef.current as
          | { trigger: (source: string, action: string, payload: unknown) => void }
          | null;
        if (editor) {
          editor.trigger('keyboard', 'closeFindWidget', null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleCreateVersion = () => {
    if (!fileId) return;
    fileApi.createVersion(Number(fileId), '手动保存版本');
    queryClient.invalidateQueries({ queryKey: ['versions', fileId] });
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-slate-500 mb-4">文件不存在</p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-slate-800 dark:text-white">{file.name}</h1>
              <p className="text-xs text-slate-500">
                {hasUnsavedChanges ? '有未保存的更改' : saveStatus === 'saved' ? '已保存' : '已同步'}
              </p>
            </div>
          </div>

          <EditorToolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onSave={handleSave}
            onCreateVersion={handleCreateVersion}
            onToggleVersion={() => setShowVersionPanel(!showVersionPanel)}
            onToggleCollab={() => setShowCollab(!showCollab)}
            saveStatus={saveStatus}
          />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {(viewMode === 'split' || viewMode === 'edit') && (
              <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col border-r border-slate-200 dark:border-slate-700`}>
                <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center space-x-2">
                  <Code className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">编辑器</span>
                </div>
                <div className="flex-1">
                  <Editor
                    height="100%"
                    defaultLanguage="markdown"
                    value={content}
                    onChange={handleEditorChange}
                    onMount={handleEditorMount}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                </div>
              </div>
            )}

            {(viewMode === 'split' || viewMode === 'preview') && (
              <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col`}>
                <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">预览</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900">
                  <MarkdownPreview content={content} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panels */}
        {showVersionPanel && (
          <div className="w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
            <VersionPanel fileId={Number(fileId)} />
          </div>
        )}

        {showCollab && (
          <div className="w-64 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <CollaboratorList fileId={Number(fileId)} />
          </div>
        )}
      </div>
    </div>
  );
}
