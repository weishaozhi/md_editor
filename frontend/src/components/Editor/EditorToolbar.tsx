import {
  Save,
  Clock,
  Users,
  SplitSquareHorizontal,
  Eye,
  Code,
  Check,
  Loader2,
} from 'lucide-react';

type ViewMode = 'split' | 'edit' | 'preview';

interface EditorToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSave: () => void;
  onCreateVersion: () => void;
  onToggleVersion: () => void;
  onToggleCollab: () => void;
  saveStatus: 'idle' | 'saving' | 'saved';
}

export default function EditorToolbar({
  viewMode,
  onViewModeChange,
  onSave,
  onCreateVersion,
  onToggleVersion,
  onToggleCollab,
  saveStatus,
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

      {/* Create Version */}
      <button
        onClick={onCreateVersion}
        className="flex items-center space-x-1 px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm transition-colors"
        title="创建版本快照"
      >
        <Clock className="w-4 h-4" />
        <span>版本</span>
      </button>

      {/* Collaboration */}
      <button
        onClick={onToggleCollab}
        className="flex items-center space-x-1 px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm transition-colors"
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
