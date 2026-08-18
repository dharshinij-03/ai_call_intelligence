import { SERVICE_URLS } from '../config';
import type { User } from '../types';
import { apiFetch } from './http';

const BASE = SERVICE_URLS.userManagement;

export const userManagementApi = {
  me: (token: string) => apiFetch<User>(`${BASE}/users/me`, {}, token),

  list: (token: string, params: { role?: string; department?: string } = {}) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<User[]>(`${BASE}/users${qs ? `?${qs}` : ''}`, {}, token);
  },

  updateUser: (
    token: string,
    userId: string,
    payload: Partial<Pick<User, 'full_name' | 'phone_number' | 'role' | 'department' | 'is_active'>>,
  ) =>
    apiFetch<User>(
      `${BASE}/users/${userId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token,
    ),
};
