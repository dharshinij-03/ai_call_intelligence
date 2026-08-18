import { SERVICE_URLS } from '../config';
import type { CallAnalysisOut } from '../types';
import { apiFetch } from './http';

const BASE = SERVICE_URLS.callAnalysis;

export const callAnalysisApi = {
  getAnalysis: (callId: string) => apiFetch<CallAnalysisOut>(`${BASE}/analysis/${callId}`),
};
