import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Plugin } from '@/types';
import { Package, Plus, Trash2, Power, Settings } from 'lucide-react';

export default function PluginList() {
  const queryClient = useQueryClient();
  const [showInstall, setShowInstall] = useState(false);
  const [installForm, setInstallForm] = useState({
    name: '',
    version: '1.0.0',
    description: '',
    author: '',
  });

  const { data: plugins, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: async () => {
      const response = await api.get<Plugin[]>('/plugins');
      return response.data;
    },
  });

  const createPluginMutation = useMutation({
    mutationFn: async (data: typeof installForm) => {
      const response = await api.post('/plugins', {
        ...data,
        manifest: { name: data.name, version: data.version },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      setShowInstall(false);
      setInstallForm({ name: '', version: '1.0.0', description: '', author: '' });
    },
  });

  const togglePluginMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const response = await api.put(`/plugins/${id}`, { enabled });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
    },
  });

  const deletePluginMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/plugins/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
          <Package className="w-6 h-6 mr-2 text-primary-500" />
          插件管理
        </h2>
        <button
          onClick={() => setShowInstall(true)}
          className="flex items-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>安装插件</span>
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500">加载中...</p>
      ) : plugins && plugins.length > 0 ? (
        <div className="space-y-4">
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              className={`p-4 rounded-xl border ${
                plugin.enabled
                  ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-slate-800 dark:text-white">
                      {plugin.name}
                    </h3>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
                      v{plugin.version}
                    </span>
                    {!plugin.enabled && (
                      <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded">
                        已禁用
                      </span>
                    )}
                  </div>
                  {plugin.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {plugin.description}
                    </p>
                  )}
                  {plugin.author && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      作者: {plugin.author}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() =>
                      togglePluginMutation.mutate({ id: plugin.id, enabled: !plugin.enabled })
                    }
                    className={`p-2 rounded-lg transition-colors ${
                      plugin.enabled
                        ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30'
                        : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                    title={plugin.enabled ? '禁用' : '启用'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title="设置"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`确定要卸载插件 "${plugin.name}" 吗？`)) {
                        deletePluginMutation.mutate(plugin.id);
                      }
                    }}
                    className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="卸载"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-2">暂无插件</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            安装插件来扩展编辑器功能
          </p>
        </div>
      )}

      {/* Install Modal */}
      {showInstall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
              安装插件
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  插件名称
                </label>
                <input
                  type="text"
                  value={installForm.name}
                  onChange={(e) => setInstallForm({ ...installForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
                  placeholder="my-plugin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  版本
                </label>
                <input
                  type="text"
                  value={installForm.version}
                  onChange={(e) => setInstallForm({ ...installForm, version: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
                  placeholder="1.0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  描述
                </label>
                <input
                  type="text"
                  value={installForm.description}
                  onChange={(e) => setInstallForm({ ...installForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
                  placeholder="插件描述..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  作者
                </label>
                <input
                  type="text"
                  value={installForm.author}
                  onChange={(e) => setInstallForm({ ...installForm, author: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
                  placeholder="作者名称"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => createPluginMutation.mutate(installForm)}
                disabled={!installForm.name}
                className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-2 rounded-lg transition-colors"
              >
                安装
              </button>
              <button
                onClick={() => setShowInstall(false)}
                className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-2 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
