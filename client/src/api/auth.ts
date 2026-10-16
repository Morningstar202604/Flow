import { http } from '../lib/http';
import type {
  RegisterRequest,
  LoginRequest,
  User,
} from '@shared/api.interface';

const USER_KEY = 'flow_user';

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__ls_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function getStoredUser(): User | null {
  if (!isLocalStorageAvailable()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  if (!isLocalStorageAvailable()) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeStoredUser(): void {
  if (!isLocalStorageAvailable()) return;
  localStorage.removeItem(USER_KEY);
}

export async function register(dto: RegisterRequest): Promise<{ user: User }> {
  const { data } = await http.post<{ user: User }>('/api/auth/register', dto);
  setStoredUser(data.user);
  return data;
}

export async function login(dto: LoginRequest): Promise<{ user: User }> {
  const { data } = await http.post<{ user: User }>('/api/auth/login', dto);
  setStoredUser(data.user);
  return data;
}

export async function getMe(): Promise<User | null> {
  try {
    const { data } = await http.get<User | null>('/api/auth/me');
    return data;
  } catch {
    return null;
  }
}

export async function mergeCart(sessionId: string): Promise<{ success: boolean }> {
  const { data } = await http.post<{ success: boolean }>(
    '/api/auth/merge-cart',
    { sessionId },
  );
  return data;
}

export async function logout(): Promise<void> {
  try {
    await http.post('/api/auth/logout', {});
  } catch {
    // ignore network errors during logout
  }
  removeStoredUser();
}
