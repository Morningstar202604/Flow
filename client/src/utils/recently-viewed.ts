const KEY = 'flow_recently_viewed';
const MAX = 8;

export function pushRecentlyViewed(productId: string): void {
  try {
    const current = getRecentlyViewed();
    const next = [productId, ...current.filter((id) => id !== productId)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 隐私模式/存储满时静默失败
  }
}

export function getRecentlyViewed(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
