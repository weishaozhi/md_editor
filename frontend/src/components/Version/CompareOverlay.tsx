import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Editor, { OnMount } from '@monaco-editor/react';
import { diffLines, Change } from 'diff';
import { GitCompare, X } from 'lucide-react';
import { fileApi } from '@/services/fileApi';
import MarkdownPreview from '@/components/Preview/MarkdownPreview';

interface CompareOverlayProps {
  fileId: number;
  historyVersionId: number;
  currentVersionId: number;
  currentContent: string;
  onClose: () => void;
}

interface DecorationRow {
  startLine: number;
  endLine: number;
  kind: 'added' | 'removed';
}

type Monaco = typeof import('monaco-editor');
interface MonacoDecoration {
  range: import('monaco-editor').Range;
  options: {
    isWholeLine: boolean;
    className: string;
    marginClassName: string;
  };
}

/**
 * 对原文本 (历史) 计算 removed 区间对应的行号
 *  - 只关心 change.removed 的部分（左侧独有的行）
 *  - 其他 change（含 added / context）在左侧视为占位，不递增该侧行号
 */
function buildRemovedRows(changes: Change[]): DecorationRow[] {
  const rows: DecorationRow[] = [];
  let line = 1;
  for (const c of changes) {
    const rawLines = c.value.split('\n');
    if (rawLines[rawLines.length - 1] === '') rawLines.pop();
    const len = rawLines.length;
    if (len === 0) continue;
    if (c.removed) {
      rows.push({ startLine: line, endLine: line + len - 1, kind: 'removed' });
    }
    if (!c.added) {
      // context 和 removed 都会出现在左侧文本中
      line += len;
    }
  }
  return rows;
}

/**
 * 对新文本 (当前) 计算 added 区间对应的行号
 *  - 只关心 change.added 的部分（右侧独有的行）
 *  - 其他 change（含 removed / context）在右侧视为占位，不递增该侧行号
 */
function buildAddedRows(changes: Change[]): DecorationRow[] {
  const rows: DecorationRow[] = [];
  let line = 1;
  for (const c of changes) {
    const rawLines = c.value.split('\n');
    if (rawLines[rawLines.length - 1] === '') rawLines.pop();
    const len = rawLines.length;
    if (len === 0) continue;
    if (c.added) {
      rows.push({ startLine: line, endLine: line + len - 1, kind: 'added' });
    }
    if (!c.removed) {
      line += len;
    }
  }
  return rows;
}

export default function CompareOverlay({
  fileId,
  historyVersionId,
  currentVersionId,
  currentContent,
  onClose,
}: CompareOverlayProps) {
  const leftPreviewRef = useRef<HTMLDivElement>(null);
  const rightPreviewRef = useRef<HTMLDivElement>(null);

  const leftEditorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const rightEditorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const leftDecorationsRef = useRef<string[]>([]);
  const rightDecorationsRef = useRef<string[]>([]);

  const [editorReady, setEditorReady] = useState(false);

  // 拉取历史版本
  const { data: historyVersion, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['version', fileId, historyVersionId],
    queryFn: () => fileApi.getVersion(fileId, historyVersionId),
    enabled: !!historyVersionId,
  });

  // 当前版本可以从 fileContent 直接取（不需要拉取）
  const currentVersionMeta = useMemo(() => {
    return { id: currentVersionId, content: currentContent };
  }, [currentVersionId, currentContent]);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 计算左右两边的 diff 信息（基于内容），用来给 Monaco 加 decorations
  const diff = useMemo(() => {
    if (!historyVersion) return null;
    return diffLines(historyVersion.content, currentVersionMeta.content);
  }, [historyVersion, currentVersionMeta.content]);

  const leftRows = useMemo(() => (diff ? buildRemovedRows(diff) : []), [diff]);
  const rightRows = useMemo(() => (diff ? buildAddedRows(diff) : []), [diff]);

  const applyDecorations = () => {
    const monaco: Monaco | undefined = (window as unknown as { monaco?: Monaco }).monaco;
    if (!monaco || !leftEditorRef.current || !rightEditorRef.current) return;

    // 左侧编辑器：显示历史，标 red 是 removed（独有的行）
    const leftDecos: MonacoDecoration[] = [];
    for (const r of leftRows) {
      if (r.kind === 'removed') {
        leftDecos.push({
          range: new monaco.Range(r.startLine, 1, r.endLine, 1),
          options: {
            isWholeLine: true,
            className: 'diff-line-removed',
            marginClassName: 'diff-line-removed-margin',
          },
        });
      }
    }
    leftDecorationsRef.current = leftEditorRef.current.deltaDecorations(
      leftDecorationsRef.current,
      leftDecos,
    );

    // 右侧编辑器：显示当前，标 green 是 added
    const rightDecos: MonacoDecoration[] = [];
    for (const r of rightRows) {
      if (r.kind === 'added') {
        rightDecos.push({
          range: new monaco.Range(r.startLine, 1, r.endLine, 1),
          options: {
            isWholeLine: true,
            className: 'diff-line-added',
            marginClassName: 'diff-line-added-margin',
          },
        });
      }
    }
    rightDecorationsRef.current = rightEditorRef.current.deltaDecorations(
      rightDecorationsRef.current,
      rightDecos,
    );
  };

  useEffect(() => {
    if (editorReady) applyDecorations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorReady, leftRows, rightRows]);

  const handleEditorMount = (side: 'left' | 'right'): OnMount => (editor) => {
    if (side === 'left') leftEditorRef.current = editor;
    else rightEditorRef.current = editor;
    if (leftEditorRef.current && rightEditorRef.current && !editorReady) {
      setEditorReady(true);
    }
  };

  // 同步滚动: Editor 滚动 → 对侧 Editor 同步 + 两侧 Preview 按比例跟随
  // 用户在 Editor 上滚滚轮时, 同/对侧 Preview 都按滚动比例跟随
  const syncEditorScroll = (source: 'left' | 'right') => {
    const srcEditor = source === 'left' ? leftEditorRef.current : rightEditorRef.current;
    const dstEditor = source === 'left' ? rightEditorRef.current : leftEditorRef.current;
    const srcPreview = source === 'left' ? leftPreviewRef.current : rightPreviewRef.current;
    const dstPreview = source === 'left' ? rightPreviewRef.current : leftPreviewRef.current;
    if (!srcEditor) return;
    const scrollTop = srcEditor.getScrollTop();
    const scrollHeight = srcEditor.getScrollHeight();
    const clientHeight = srcEditor.getLayoutInfo().height;
    if (dstEditor) dstEditor.setScrollTop(scrollTop);
    // Editor 滚动比例 → Preview 滚动位置
    if (scrollHeight > clientHeight) {
      const maxSrc = scrollHeight - clientHeight;
      const ratio = Math.max(0, Math.min(1, scrollTop / maxSrc));
      if (srcPreview) {
        const maxSelf = srcPreview.scrollHeight - srcPreview.clientHeight;
        srcPreview.scrollTop = maxSelf * ratio;
      }
      if (dstPreview) {
        const maxDst = dstPreview.scrollHeight - dstPreview.clientHeight;
        dstPreview.scrollTop = maxDst * ratio;
      }
    }
  };

  const syncPreviewScroll = (source: 'left' | 'right') => {
    const src = source === 'left' ? leftPreviewRef.current : rightPreviewRef.current;
    const dst = source === 'left' ? rightPreviewRef.current : leftPreviewRef.current;
    if (src && dst) dst.scrollTop = src.scrollTop;
  };

  if (isHistoryLoading || !historyVersion) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6">
          <p className="text-slate-700 dark:text-slate-300">加载版本对比中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center space-x-3 text-white">
          <GitCompare className="w-5 h-5 text-primary-400" />
          <h2 className="font-semibold">对比 v{historyVersion.version_num}（历史） ↔ 当前内容</h2>
          <span className="text-xs text-slate-400">
            左红=已删除 · 右绿=已新增
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-700 rounded"
          title="关闭对比（Esc）"
          aria-label="关闭对比"
        >
          <X className="w-5 h-5 text-slate-300" />
        </button>
      </header>

      {/* Body: 双列 */}
      <div className="flex-1 grid grid-cols-2 gap-px bg-slate-700 overflow-hidden min-h-0">
        <Column
          title={`v${historyVersion.version_num}（历史）`}
          content={historyVersion.content}
          previewRef={leftPreviewRef}
          onEditorMount={handleEditorMount('left')}
          onEditorScroll={() => syncEditorScroll('left')}
          onPreviewScroll={() => syncPreviewScroll('left')}
        />
        <Column
          title="当前内容"
          content={currentVersionMeta.content}
          previewRef={rightPreviewRef}
          onEditorMount={handleEditorMount('right')}
          onEditorScroll={() => syncEditorScroll('right')}
          onPreviewScroll={() => syncPreviewScroll('right')}
        />
      </div>

      {/* 全局样式：高亮加/减行 */}
      <style>{`
        .diff-line-added {
          background: rgba(34, 197, 94, 0.15);
        }
        .diff-line-added-margin {
          background: rgba(34, 197, 94, 0.35);
          border-left: 3px solid rgb(34, 197, 94);
        }
        .diff-line-removed {
          background: rgba(239, 68, 68, 0.15);
        }
        .diff-line-removed-margin {
          background: rgba(239, 68, 68, 0.35);
          border-left: 3px solid rgb(239, 68, 68);
        }
      `}</style>
    </div>
  );
}

interface ColumnProps {
  title: string;
  content: string;
  previewRef: React.RefObject<HTMLDivElement>;
  onEditorMount: OnMount;
  onEditorScroll: () => void;
  onPreviewScroll: () => void;
}

function Column({
  title,
  content,
  previewRef,
  onEditorMount,
  onEditorScroll,
  onPreviewScroll,
}: ColumnProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900 flex flex-col min-h-0 overflow-hidden">
      <div className="px-3 py-1.5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
        {title}
      </div>
      {/* 上半部: Editor 占剩余空间, 内部独立滚动 */}
      <div className="flex-1 min-h-0 overflow-hidden border-b border-slate-200 dark:border-slate-700">
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={content}
          onMount={(editor, monaco) => {
            onEditorMount(editor, monaco);
            // 真正监听 Monaco 滚轮 → 触发 left/right Editor 同步滚动 + 让 Preview 跟随
            editor.onDidScrollChange(() => onEditorScroll());
          }}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: 'on',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            domReadOnly: true,
            renderWhitespace: 'none',
          }}
        />
      </div>
      {/* 下半部: Preview 固定 40% 屏高, 始终在屏幕中可见, 内部独立滚动 */}
      <div
        ref={previewRef}
        onScroll={onPreviewScroll}
        className="h-[40vh] min-h-[200px] max-h-[50vh] overflow-y-auto p-3 bg-white dark:bg-slate-900 text-sm"
      >
        <MarkdownPreview content={content} />
      </div>
    </div>
  );
}
