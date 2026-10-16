import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  getStoredUser,
  setStoredUser,
  removeStoredUser,
  getMe,
  login as apiLogin,
  register as apiRegister,
  mergeCart as apiMergeCart,
  logout as apiLogout,
} from '@/api/auth';
import type { User, LoginRequest, RegisterRequest } from '@shared/api.interface';

const SESSION_ID_KEY = 'flow_session_id';

function getSessionId(): string {
  const existing = localStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const newId = crypto.randomUUID();
  localStorage.setItem(SESSION_ID_KEY, newId);
  return newId;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sessionId: string;
  login: (dto: LoginRequest) => Promise<User>;
  register: (dto: RegisterRequest) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState<string>(() => getSessionId());

  useEffect(() => {
    getMe().then((u) => {
      if (u) {
        setUser(u);
        setStoredUser(u);
      } else {
        setUser(null);
        removeStoredUser();
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (dto: LoginRequest): Promise<User> => {
    const result = await apiLogin(dto);
    setStoredUser(result.user);
    setUser(result.user);

    const sid = getSessionId();
    try {
      await apiMergeCart(sid);
    } catch (err) {
      console.warn('[auth] merge cart failed', err);
    }

    return result.user;
  }, []);

  const register = useCallback(async (dto: RegisterRequest): Promise<User> => {
    const result = await apiRegister(dto);
    setStoredUser(result.user);
    setUser(result.user);

    const sid = getSessionId();
    try {
      await apiMergeCart(sid);
    } catch (err) {
      console.warn('[auth] merge cart failed', err);
    }

    return result.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await apiLogout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    const u = await getMe();
    if (u) {
      setUser(u);
      setStoredUser(u);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    sessionId,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
