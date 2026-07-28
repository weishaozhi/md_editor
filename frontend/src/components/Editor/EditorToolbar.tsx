import {
  Save,
  Clock,
  Users,
  SplitSquareHorizontal,
  Eye,
  Code,
  Check,
  Loader2,
  Link,
  Link2Off,
} from 'lucide-react';

type ViewMode = 'split' | 'edit' | 'preview';

interface EditorToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSave: () => void;
  onToggleVersion: () => void;
  onToggleCollab: () => void;
  saveStatus: 'idle' | 'saving' | 'saved';
  versionPanelOpen?: boolean;
  collabPanelOpen?: boolean;
  syncScroll?: boolean;
  onToggleSyncScroll?: () => void;
}

export default function EditorToolbar({
  viewMode,
  onViewModeChange,
  onSave,
  onToggleVersion,
  onToggleCollab,
  saveStatus,
  versionPanelOpen = false,
  collabPanelOpen = false,
  syncScroll = true,
  onToggleSyncScroll,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center space-x-2">
      {/* Save Button */}
      <button
        onClick={onSave}
        disabled={saveStatus === 'saving'}
        className="flex items-center space-x-1 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
      >
        {saveStatus === 'saving' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : saveStatus === 'saved' ? (
          <Check className="w-4 h-4" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        <span>{saveStatus === 'saved' ? '已保存' : '保存'}</span>
      </button>

      {/* Version Panel Toggle */}
      <button
        onClick={onToggleVersion}
        className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          versionPanelOpen
            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
        title="版本历史"
      >
        <Clock className="w-4 h-4" />
        <span>版本</span>
      </button>

      {/* Sync Scroll Toggle (编辑栏 ↔ 预览栏 联动滚动) */}
      <button
        onClick={onToggleSyncScroll}
        className={`p-2 rounded-lg text-sm transition-colors ${
          syncScroll
            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
        title={syncScroll ? '已开启：编辑栏与预览栏同步滚动（点击关闭）' : '已关闭：编辑栏与预览栏独立滚动（点击开启）'}
        aria-label={syncScroll ? '关闭同步滚动' : '开启同步滚动'}
      >
        {syncScroll ? <Link className="w-4 h-4" /> : <Link2Off className="w-4 h-4" />}
      </button>

      {/* Collaboration */}
      <button
        onClick={onToggleCollab}
        className={`p-2 rounded-lg text-sm transition-colors ${
          collabPanelOpen
            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
        title="协作"
      >
        <Users className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />

      {/* View Mode */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
        <button
          onClick={() => onViewModeChange('edit')}
          className={`p-1.5 rounded ${
            viewMode === 'edit'
              ? 'bg-white dark:bg-slate-600 shadow text-primary-600'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
          title="仅编辑"
        >
          <Code className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewModeChange('split')}
          className={`p-1.5 rounded ${
            viewMode === 'split'
              ? 'bg-white dark:bg-slate-600 shadow text-primary-600'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
          title="分屏"
        >
          <SplitSquareHorizontal className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewModeChange('preview')}
          className={`p-1.5 rounded ${
            viewMode === 'preview'
              ? 'bg-white dark:bg-slate-600 shadow text-primary-600'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
          title="仅预览"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
