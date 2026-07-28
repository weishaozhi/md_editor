import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/services/authApi';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, FileText } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setToken } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const data = await authApi.login(formData.username, formData.password);
        setToken(data.access_token);
        // 使用 replace 替换历史记录，避免用户回退到登录页
        navigate('/', { replace: true });
      } else {
        await authApi.register(formData);
        setIsLogin(true);
        setError('注册成功，请登录');
      }
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: {
            detail?: string | Array<{ msg?: string; loc?: unknown[] }>;
          };
        };
        message?: string;
      };
      let detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        detail = detail
          .map((d) => d?.msg)
          .filter(Boolean)
          .join('；');
      }
      setError(detail || error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-slate-900 dark:to-slate-800">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-primary-500 rounded-xl p-3">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold ml-3 text-slate-800 dark:text-white">MD Editor</h1>
        </div>

        <h2 className="text-xl font-semibold text-center mb-6 text-slate-700 dark:text-slate-200">
          {isLogin ? '登录账户' : '创建账户'}
        </h2>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
              placeholder="请输入用户名"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                邮箱
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                placeholder="请输入邮箱"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                placeholder="请输入密码"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          {isLogin ? '还没有账户？' : '已有账户？'}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary-500 hover:text-primary-600 font-medium ml-1"
          >
            {isLogin ? '立即注册' : '立即登录'}
          </button>
        </p>
      </div>
    </div>
  );
}
