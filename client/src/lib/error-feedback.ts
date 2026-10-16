import { toast } from 'sonner';

/**
 * 统一的错误反馈出口。
 *
 * 背景：审计发现 21 处 `catch` 只 `console.error` 就把错误吞掉，用户看到的是
 * "空列表 / 永远加载中 / 点了没反应"，把网络故障伪装成"没有数据"。
 *
 * 用法：
 *   catch (err) { notifyError(err, t.common.error); }
 * 需要区分"加载失败"与"确实为空"的列表页，请同时设置 error state 渲染错误态。
 */
export function notifyError(error: unknown, message: string): void {
  if (import.meta.env.DEV) {
    console.error('[error]', error);
  }
  toast.error(message);
}

/** 从 axios 风格错误里提取后端返回的可读信息（优先业务 message） */
export function extractErrorMessage(error: unknown, fallback: string): string {
  const maybe = error as { response?: { data?: { message?: string | string[] } } } | undefined;
  const raw = maybe?.response?.data?.message;
  if (Array.isArray(raw) && raw.length > 0) return raw.join('；');
  if (typeof raw === 'string' && raw.trim()) return raw;
  return fallback;
}
