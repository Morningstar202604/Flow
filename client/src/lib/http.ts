import axios from 'axios';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
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
