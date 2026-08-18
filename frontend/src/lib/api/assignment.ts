import { SERVICE_URLS } from '../config';
import type { AssignmentOut, AssignmentStatus, DepartmentMasterOut, RecommendationOut } from '../types';
import { apiFetch } from './http';

const BASE = SERVICE_URLS.assignment;

export const assignmentApi = {
  departments: () => apiFetch<DepartmentMasterOut[]>(`${BASE}/departments`),

  route: (callId: string) => apiFetch<AssignmentOut>(`${BASE}/route/${callId}`, { method: 'POST' }),

  getAssignment: (callId: string) => apiFetch<AssignmentOut>(`${BASE}/assignments/${callId}`),

  listAssignments: (params: { department_id?: string; officer_id?: string; status?: string } = {}) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<AssignmentOut[]>(`${BASE}/assignments${qs ? `?${qs}` : ''}`);
  },

  updateStatus: (callId: string, status: AssignmentStatus) =>
    apiFetch<AssignmentOut>(`${BASE}/assignments/${callId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  generateRecommendation: (callId: string) =>
    apiFetch<RecommendationOut>(`${BASE}/recommendations/${callId}`, { method: 'POST' }),

  getRecommendation: (callId: string) => apiFetch<RecommendationOut>(`${BASE}/recommendations/${callId}`),

  reviewRecommendation: (callId: string, acceptedByOfficer: boolean, officerAction?: string) =>
    apiFetch<RecommendationOut>(`${BASE}/recommendations/${callId}`, {
      method: 'PATCH',
      body: JSON.stringify({ accepted_by_officer: acceptedByOfficer, officer_action: officerAction }),
    }),
};
