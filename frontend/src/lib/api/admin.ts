import { SERVICE_URLS } from '../config';
import type {
  ComplaintDetailOut,
  ComplaintListOut,
  DepartmentSummaryOut,
  HeatmapCellOut,
  OfficerSummaryOut,
  OverviewOut,
  TrendPointOut,
} from '../types';
import { apiFetch } from './http';

const BASE = SERVICE_URLS.admin;

export const adminApi = {
  overview: () => apiFetch<OverviewOut>(`${BASE}/overview`),

  departments: () => apiFetch<DepartmentSummaryOut[]>(`${BASE}/departments`),

  departmentOfficers: (departmentId: string) =>
    apiFetch<OfficerSummaryOut[]>(`${BASE}/departments/${departmentId}/officers`),

  complaints: (
    params: {
      department_id?: string;
      status?: string;
      officer_id?: string;
      is_duplicate?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    ).toString();
    return apiFetch<ComplaintListOut>(`${BASE}/complaints${qs ? `?${qs}` : ''}`);
  },

  complaint: (callId: string) => apiFetch<ComplaintDetailOut>(`${BASE}/complaints/${callId}`),

  heatmap: () => apiFetch<HeatmapCellOut[]>(`${BASE}/heatmap`),

  trends: (days = 30, byDepartment = false) =>
    apiFetch<TrendPointOut[]>(`${BASE}/trends?days=${days}&by_department=${byDepartment}`),
};
