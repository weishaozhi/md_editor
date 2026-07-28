import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileApi } from '@/services/fileApi';
import { useFileStore } from '@/store/fileStore';
import Editor, { OnMount } from '@monaco-editor/react';
import MarkdownPreview from '@/components/Preview/MarkdownPreview';
import VersionPanel from '@/components/Version/VersionPanel';
import CompareOverlay from '@/components/Version/CompareOverlay';
import CollaboratorList from '@/components/Collaboration/CollaboratorList';
import EditorToolbar from '@/components/Editor/EditorToolbar';
import {
  ArrowLeft,
  Eye,
  Code,
  RefreshCw,
} from 'lucide-react';

type ViewMode = 'split' | 'edit' | 'preview';

export default function EditorPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setCurrentFile } = useFileStore();

  // ⚠️ Editor 用非受控模式 (defaultValue + ref), 不用受控 value
  // 原因: React 受控 value + Monaco 在 IME 中文输入时会丢失 composition 状态
  //   - 用户输入拼音 → onChange → setContent → 重渲染 → value={拼音} 再次覆盖 Monaco 内部 IME 状态
  //   - 用户按空格选中候选词 → compositionend → onChange('你好') → setContent → 重渲染
  //   - React 用新 value 重置 Monaco, cursor 跳到末尾, IME 占位符(拼音)残留
  // 修复: Editor 用 defaultValue, 内容更新通过 editor.setValue(file.content) 在 useEffect 里做
  // Preview 仍然用 content state 响应变化
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showCollab, setShowCollab] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [compareState, setCompareState] = useState<{ historyVersionId: number } | null>(null);
  const [syncScroll, setSyncScroll] = useState(true);
  const [editorMounted, setEditorMounted] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  // 同步滚动循环保护: 标记当前滚动是程序触发的, 不应再次触发反向同步
  const isSyncingRef = useRef<'editor' | 'preview' | null>(null);

  // 暴露编辑器实例到 window，便于自动化测试和调试
  const handleEditorMount = useCallback((editor: Parameters<OnMount>[0]) => {
    editorRef.current = editor;
    setEditorMounted(true);
    if (typeof window !== 'undefined') {
      (window as unknown as { __mdEditor?: unknown }).__mdEditor = editor;
    }
  }, []);

  // 同步滚动: Editor ↔ Preview
  // - Editor 滚动 → Preview 按比例跟随
  // - Preview 滚动 → Editor 按比例跟随
  // - 用 isSyncingRef 防止 A 滚触发 B 同步, B 同步又触发 A 滚 的死循环
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as unknown as { __mdEditor?: unknown }).__mdEditor;
      }
    };
  }, [handleEditorMount]);

  const handleEditorScroll = useCallback(() => {
    if (!syncScroll || isSyncingRef.current === 'preview') return;
    const editor = editorRef.current;
    const preview = previewScrollRef.current;
    if (!editor || !preview) return;
    const scrollHeight = editor.getScrollHeight();
    const clientHeight = editor.getLayoutInfo().height;
    if (scrollHeight <= clientHeight) return;
    const ratio = editor.getScrollTop() / (scrollHeight - clientHeight);
    const maxPreview = preview.scrollHeight - preview.clientHeight;
    if (maxPreview <= 0) return;
    isSyncingRef.current = 'editor';
    preview.scrollTop = maxPreview * ratio;
    // 下一帧清掉标记 (避免 setState 期间的二次 onScroll 被错误屏蔽)
    requestAnimationFrame(() => {
      isSyncingRef.current = null;
    });
  }, [syncScroll]);

  const handlePreviewScroll = useCallback(() => {
    if (!syncScroll || isSyncingRef.current === 'editor') return;
    const editor = editorRef.current;
    const preview = previewScrollRef.current;
    if (!editor || !preview) return;
    const maxPreview = preview.scrollHeight - preview.clientHeight;
    if (maxPreview <= 0) return;
    const ratio = preview.scrollTop / maxPreview;
    const scrollHeight = editor.getScrollHeight();
    const clientHeight = editor.getLayoutInfo().height;
    if (scrollHeight <= clientHeight) return;
    isSyncingRef.current = 'preview';
    editor.setScrollTop((scrollHeight - clientHeight) * ratio);
    requestAnimationFrame(() => {
      isSyncingRef.current = null;
    });
  }, [syncScroll]);

  // 注册 Monaco 滚动事件 (依赖 editorMounted + syncScroll)
  useEffect(() => {
    if (!syncScroll || !editorMounted) return;
    const editor = editorRef.current;
    if (!editor) return;
    const d = editor.onDidScrollChange(handleEditorScroll);
    return () => d.dispose();
  }, [syncScroll, editorMounted, handleEditorScroll]);

  const { data: file, isLoading } = useQuery({
    queryKey: ['file', Number(fileId)],
    queryFn: () => fileApi.getFile(Number(fileId)),
    enabled: !!fileId,
  });

  const updateFileMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { content: string } }) =>
      fileApi.updateFile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', Number(fileId)] });
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
  });

  useEffect(() => {
    if (file) {
      setCurrentFile(file);
    }
  }, [file, setCurrentFile]);

  // 文件内容从后端到来时, 主动同步到 Monaco
  // - Editor 用 defaultValue="" (空) + 非受控, 避免 React value prop 在 IME 中文输入时打断 composition
  // - 修复 IME 中文输入 composition 状态被 value prop 覆盖导致 cursor 跳末尾的 bug
  // - 用 editor.setValue() 主动同步 file.content (不会触发 React 重渲染, 不打断 IME)
  const prevFileIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!file || !editorMounted) return;
    const editor = editorRef.current;
    if (!editor) return;
    // 同一文件: 不重置 (避免覆盖用户输入, 也避免打断 IME)
    if (prevFileIdRef.current === file.id) return;
    prevFileIdRef.current = file.id;
    if (editor.getValue() !== file.content) {
      editor.setValue(file.content);
    }
    setContent(file.content);
  }, [file, editorMounted]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
      setHasUnsavedChanges(true);
    }
  };

  const handleSave = useCallback(() => {
    if (!fileId || !file) return;
    // 优先从 Monaco 实例读最新内容, 避免 content state 滞后
    const editor = editorRef.current;
    const latest = editor ? editor.getValue() : content;
    setSaveStatus('saving');
    updateFileMutation.mutate({ id: file.id, data: { content: latest } });
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
        const editor = editorRef.current;
        if (editor) {
          editor.trigger('keyboard', 'closeFindWidget', null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const createVersionMutation = useMutation({
    mutationFn: () => fileApi.createVersion(Number(fileId), '手动保存版本'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions', Number(fileId)] });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => {
      setSaveStatus('idle');
    },
  });

  const handleCreateVersion = () => {
    if (!fileId) return;
    createVersionMutation.mutate();
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
                {saveStatus === 'saved'
                  ? '已保存'
                  : saveStatus === 'saving'
                  ? '保存中...'
                  : hasUnsavedChanges
                  ? '有未保存的更改'
                  : '已同步'}
              </p>
            </div>
          </div>

          <EditorToolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onSave={handleSave}
            onToggleVersion={() => setShowVersionPanel(!showVersionPanel)}
            onToggleCollab={() => setShowCollab(!showCollab)}
            saveStatus={saveStatus}
            versionPanelOpen={showVersionPanel}
            collabPanelOpen={showCollab}
            syncScroll={syncScroll}
            onToggleSyncScroll={() => setSyncScroll(!syncScroll)}
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
                    defaultValue=""
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
                <div
                  ref={previewScrollRef}
                  onScroll={handlePreviewScroll}
                  className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900"
                >
                  <MarkdownPreview content={content} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panels */}
        {showVersionPanel && (
          <div className="w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
            <VersionPanel
              fileId={Number(fileId)}
              onCreateVersion={handleCreateVersion}
              onClose={() => setShowVersionPanel(false)}
              onCompare={(historyVersionId) =>
                setCompareState({ historyVersionId })
              }
              isCreating={createVersionMutation.isPending}
            />
          </div>
        )}

        {showCollab && (
          <div className="w-64 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <CollaboratorList fileId={Number(fileId)} />
          </div>
        )}
      </div>

      {compareState && fileId && (
        <CompareOverlay
          fileId={Number(fileId)}
          historyVersionId={compareState.historyVersionId}
          currentVersionId={0}
          currentContent={content}
          onClose={() => setCompareState(null)}
        />
      )}
    </div>
  );
}
