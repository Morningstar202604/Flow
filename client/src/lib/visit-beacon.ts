import { http } from './http';

const SESSION_ID_KEY = 'globalecom_session_id';
const VISIT_KEY = 'globalecom_last_visit_date';

function getSessionId(): string {
  const existing = localStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const newId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(SESSION_ID_KEY, newId);
  return newId;
}

/**
 * 每个浏览器会话每天上报一次访问（卖家看板「访客数」的数据来源）。
 * 失败静默：埋点绝不影响页面功能。
 */
export function reportVisitOnce(): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(VISIT_KEY) === today) return;
    localStorage.setItem(VISIT_KEY, today);

    void http
      .post('/api/analytics/visit', {
        sessionId: getSessionId(),
        path: window.location.pathname,
      })
      .catch(() => {
        // 埋点失败：回滚标记，下次访问重试
        localStorage.removeItem(VISIT_KEY);
      });
  } catch {
    // localStorage 不可用等异常直接忽略
  }
}
