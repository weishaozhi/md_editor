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

  // Monaco 当前 scrollTop (用于 overlay 色块定位)
  const [leftScrollTop, setLeftScrollTop] = useState(0);
  const [rightScrollTop, setRightScrollTop] = useState(0);

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
    // 更新 overlay 用的 scrollTop state, 让绝对定位的色块跟随 Monaco 滚动
    if (source === 'left') setLeftScrollTop(scrollTop);
    else setRightScrollTop(scrollTop);
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
          editorRef={leftEditorRef}
          highlightRows={leftRows}
          highlightKind="removed"
          scrollTop={leftScrollTop}
          onEditorMount={handleEditorMount('left')}
          onEditorScroll={() => syncEditorScroll('left')}
          onPreviewScroll={() => syncPreviewScroll('left')}
        />
        <Column
          title="当前内容"
          content={currentVersionMeta.content}
          previewRef={rightPreviewRef}
          editorRef={rightEditorRef}
          highlightRows={rightRows}
          highlightKind="added"
          scrollTop={rightScrollTop}
          onEditorMount={handleEditorMount('right')}
          onEditorScroll={() => syncEditorScroll('right')}
          onPreviewScroll={() => syncPreviewScroll('right')}
        />
      </div>

      {/* 全局样式: diff overlay 高亮 (绝对定位 div, 每行一个色块) */}
      <style>{`
        .diff-overlay-added > div {
          background: rgba(34, 197, 94, 0.22);
          border-left: 3px solid rgb(34, 197, 94);
        }
        .diff-overlay-removed > div {
          background: rgba(239, 68, 68, 0.22);
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
  /** Monaco editor 实例 ref (用于 overlay 计算精确行位置) */
  editorRef: React.MutableRefObject<Parameters<OnMount>[0] | null>;
  /** diff 高亮行号 + 类型 */
  highlightRows: DecorationRow[];
  /** 高亮类型: added(右绿) / removed(左红) */
  highlightKind: 'added' | 'removed';
  /** Monaco 当前 scrollTop */
  scrollTop: number;
  /** Monaco mount 回调 (父组件需要 editor ref + lineHeight) */
  onEditorMount: OnMount;
  /** 滚动事件: 同步对侧 Editor + Preview */
  onEditorScroll: () => void;
  onPreviewScroll: () => void;
}

function Column({
  title,
  content,
  previewRef,
  editorRef,
  highlightRows,
  highlightKind,
  scrollTop,
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
      <div className="flex-1 min-h-0 overflow-hidden relative border-b border-slate-200 dark:border-slate-700">
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
        {/* diff 行高亮 overlay:
            - 绝对定位覆盖 Monaco 内容区
            - 每行一个 div, top 用 editor.getTopForLineNumber(line) 取精确像素位置
            - height = 当前行 lineHeight (从 editor.getOption(EditorOption.lineHeight) 读)
            - 永不外溢, 不会像 Monaco className 那样把整列染色 */}
        <DiffOverlay
          editorRef={editorRef as React.MutableRefObject<Parameters<OnMount>[0] | null>}
          highlightRows={highlightRows}
          scrollTop={scrollTop}
          highlightKind={highlightKind}
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

/**
 * diff 行高亮 overlay:
 *  - 用 editor.getTopForLineNumber(line) 拿精确像素位置, 避免 Monaco lineHeight 计算偏差
 *  - 每行一个 div, top/height 都从 Monaco 真实度量拿
 *  - 永不外溢, 不会像 Monaco className 那样把整列染色
 */
interface DiffOverlayProps {
  editorRef: React.MutableRefObject<Parameters<OnMount>[0] | null>;
  highlightRows: DecorationRow[];
  scrollTop: number;
  highlightKind: 'added' | 'removed';
}

function DiffOverlay({ editorRef, highlightRows, scrollTop, highlightKind }: DiffOverlayProps) {
  // editor 内容尺寸变化时 (例如 word-wrap 切换), 重渲染以更新色块位置
  const [, setVersion] = useState(0);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const d1 = editor.onDidContentSizeChange(() => setVersion((v) => v + 1));
    const d2 = editor.onDidChangeConfiguration(() => setVersion((v) => v + 1));
    return () => {
      d1.dispose();
      d2.dispose();
    };
  }, [editorRef]);

  const editor = editorRef.current;
  if (!editor || highlightRows.length === 0) return null;

  // 计算每行的精确 top + height (像素)
  const segments = highlightRows.map((r, i) => {
    const startTop = editor.getTopForLineNumber(r.startLine);
    // 下一行的 top = endLine 行底
    const endBottom = editor.getTopForLineNumber(r.endLine + 1);
    return {
      key: `${i}-${r.startLine}-${r.endLine}`,
      top: startTop - scrollTop,
      height: endBottom - startTop,
    };
  });

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none diff-overlay-${highlightKind}`}
      style={{ zIndex: 5 }}
    >
      {segments.map((s) => (
        <div
          key={s.key}
          style={{
            position: 'absolute',
            top: `${s.top}px`,
            left: 0,
            right: 0,
            height: `${s.height}px`,
          }}
        />
      ))}
    </div>
  );
}
