'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { FirstLoginSetupForm } from '@/components/auth/first-login-setup-form';
import { ApiError, authApi } from '@/lib/auth-api';
import { getCurrentPortalRole } from '@/lib/portal';
import type { LoginPayload, RegisterPayload, User } from '@/types/auth';

interface AuthContextValue {
  user: User | null;
  isInitializing: boolean;
  signIn: (payload: LoginPayload) => Promise<User>;
  signUp: (payload: RegisterPayload) => Promise<User>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    authApi.setUnauthorizedHandler(() => setUser(null));
    return () => authApi.setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        await authApi.refresh();
        const currentUser = await authApi.me();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch {
        if (isMounted) {
          authApi.clearAccessToken();
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = useCallback(
    async (payload: LoginPayload) => {
      const session = await authApi.login(payload);
      if (session.user.role !== getCurrentPortalRole()) {
        await authApi.logout().catch(() => undefined);
        throw new ApiError('Tài khoản không có quyền truy cập khu vực đăng nhập này.', 403);
      }
      setUser(session.user);
      return session.user;
    },
    [],
  );

  const signUp = useCallback(async (payload: RegisterPayload) => {
    const session = await authApi.register(payload);
    setUser(session.user);
    return session.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const signOutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  const value = useMemo(
    () => ({ user, isInitializing, signIn, signUp, signOut, signOutAll, updateUser }),
    [user, isInitializing, signIn, signUp, signOut, signOutAll, updateUser],
  );

  return (
    <AuthContext.Provider value={value}>
      {user?.role === 'STUDENT' && user.requiresFirstLoginSetup ? (
        <FirstLoginSetupForm modal />
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return context;
}
