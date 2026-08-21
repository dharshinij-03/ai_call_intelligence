import { SERVICE_URLS } from '../config';
import type { CallSessionOut, ComplaintStatusOut } from '../types';
import { apiFetch } from './http';

const BASE = SERVICE_URLS.citizen;

export const citizenApi = {
  requestCall: (token: string, location?: { latitude: number; longitude: number; accuracy: number }) =>
    apiFetch<CallSessionOut>(
      `${BASE}/calls/request`,
      {
        method: 'POST',
        body: JSON.stringify({
          latitude: location?.latitude,
          longitude: location?.longitude,
          location_accuracy: location?.accuracy,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      token
    ),

  queue: (token: string) => apiFetch<CallSessionOut[]>(`${BASE}/calls/queue`, {}, token),

  acceptCall: (token: string, callSessionId: string) =>
    apiFetch<CallSessionOut>(`${BASE}/calls/${callSessionId}/accept`, { method: 'POST' }, token),

  endCall: (token: string, callSessionId: string) =>
    apiFetch<CallSessionOut>(`${BASE}/calls/${callSessionId}/end`, { method: 'POST' }, token),

  myComplaints: (token: string) =>
    apiFetch<{ items: ComplaintStatusOut[] }>(`${BASE}/complaints/mine`, {}, token),

  // Submit feedback for a resolved complaint (rating: 1-5, optional comments)
  submitFeedback: (token: string, callId: string, rating: number, comments?: string) =>
    apiFetch(`${BASE}/complaints/${callId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ rating, comments }),
      headers: { 'Content-Type': 'application/json' },
    }, token),
};
