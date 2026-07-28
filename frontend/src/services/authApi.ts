import axios from 'axios';
import api from './api';
import { User } from '@/types';

// FastAPI 的 OAuth2PasswordRequestForm 依赖 application/x-www-form-urlencoded，
// axios 默认把对象序列化为 JSON，所以单独创建一个走默认 form-encode 的实例。
const formApi = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

// 拦截器：复用统一的 token 注入与 401 登出逻辑
formApi.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('token') ||
    (() => {
      try {
        const raw = localStorage.getItem('auth-storage');
        return raw ? JSON.parse(raw)?.state?.token : null;
      } catch {
        return null;
      }
    })();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
formApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post<User>('/auth/register', data).then((res) => res.data),

  login: (username: string, password: string) => {
    const body = new URLSearchParams();
    body.set('username', username);
    body.set('password', password);
    return formApi
      .post<{ access_token: string; token_type: string }>('/auth/login', body.toString())
      .then((res) => res.data);
  },

  logout: () => {
    localStorage.removeItem('token');
  },

  getMe: () => api.get<User>('/auth/me').then((res) => res.data),
};
