import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { User, Shield, Palette, Bell, Database } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: '个人资料', icon: User },
    { id: 'appearance', label: '外观', icon: Palette },
    { id: 'notifications', label: '通知', icon: Bell },
    { id: 'data', label: '数据与存储', icon: Database },
    { id: 'security', label: '安全', icon: Shield },
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">设置</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">个人资料</h2>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center space-x-6 mb-6">
                  <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                    <User className="w-10 h-10 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">{user?.username}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      用户名
                    </label>
                    <input
                      type="text"
                      defaultValue={user?.username}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      邮箱
                    </label>
                    <input
                      type="email"
                      defaultValue={user?.email}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  <button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg transition-colors">
                    保存更改
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">外观设置</h2>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      主题
                    </label>
                    <div className="flex space-x-4">
                      {['light', 'dark', 'system'].map((theme) => (
                        <button
                          key={theme}
                          className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                            theme === 'light'
                              ? 'border-primary-500 bg-primary-50 text-primary-600'
                              : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      编辑器字体大小
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="24"
                      defaultValue="14"
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>12px</span>
                      <span>24px</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">通知设置</h2>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                <div className="space-y-4">
                  {['文件变更通知', '协作者加入通知', '版本保存提醒'].map((item) => (
                    <div key={item} className="flex items-center justify-between py-2">
                      <span className="text-slate-700 dark:text-slate-300">{item}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">数据与存储</h2>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="font-medium text-slate-800 dark:text-white mb-2">存储使用</h3>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                    <div className="bg-primary-500 h-2 rounded-full" style={{ width: '30%' }}></div>
                  </div>
                  <p className="text-sm text-slate-500">已使用 15 MB / 50 MB</p>
                </div>

                <button className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg transition-colors">
                  导出所有数据
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">安全设置</h2>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-slate-800 dark:text-white mb-2">修改密码</h3>
                    <input
                      type="password"
                      placeholder="当前密码"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg mb-2 focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
                    />
                    <input
                      type="password"
                      placeholder="新密码"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg mb-2 focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
                    />
                    <input
                      type="password"
                      placeholder="确认新密码"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  <button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg transition-colors">
                    更新密码
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
