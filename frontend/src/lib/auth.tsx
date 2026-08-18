import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { SERVICE_URLS } from './config';
import type { Department, UserRole } from './types';

interface TokenClaims {
  sub: string;
  role: UserRole;
  name: string;
  exp: number;
}

export interface CurrentUser {
  id: string;
  role: UserRole;
  name: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone_number?: string;
  role?: UserRole;
  department?: Department;
  admin_bootstrap_key?: string;
}

const STORAGE_KEY = 'complaint-portal-token';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeUser(token: string): CurrentUser | null {
  try {
    const claims = jwtDecode<TokenClaims>(token);
    if (claims.exp * 1000 < Date.now()) return null;
    return { id: claims.sub, role: claims.role, name: claims.name };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && decodeUser(stored)) {
      setToken(stored);
    } else if (stored) {
      localStorage.removeItem(STORAGE_KEY);
    }
    setLoading(false);
  }, []);

  const user = useMemo(() => (token ? decodeUser(token) : null), [token]);

  async function login(email: string, password: string) {
    const body = new URLSearchParams({ username: email, password });
    const resp = await fetch(`${SERVICE_URLS.userManagement}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!resp.ok) {
      const detail = await resp.json().catch(() => null);
      throw new Error(detail?.detail ?? 'Login failed');
    }
    const data = await resp.json();
    localStorage.setItem(STORAGE_KEY, data.access_token);
    setToken(data.access_token);
  }

  async function register(payload: RegisterPayload) {
    const resp = await fetch(`${SERVICE_URLS.userManagement}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const detail = await resp.json().catch(() => null);
      throw new Error(detail?.detail ?? 'Registration failed');
    }
    await login(payload.email, payload.password);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
