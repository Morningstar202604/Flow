import axios from 'axios';

export const http = axios.create({
  // 默认同源（dev 走 Vite /api 代理，生产由 Nest 同进程托管静态站点）。
  // 跨域部署时设置 VITE_API_BASE_URL=https://api.example.com，调用侧路径 /api/... 保持不变。
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  withCredentials: true,
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get') {
    config.headers.set('X-Requested-With', 'XMLHttpRequest');
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);
