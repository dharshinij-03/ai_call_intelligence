import { SERVICE_URLS } from '../config';
import { apiFetch } from './http';

const BASE = SERVICE_URLS.callManagement;

export interface TranscriptSegment {
  id: string;
  sequence: number;
  detected_language: string | null;
  original_text: string;
  translated_text: string | null;
  confidence: number | null;
  is_final: boolean;
}

export interface CallDetailOut {
  id: string;
  source: string;
  status: string;
  caller_id: string | null;
  primary_language: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  created_at: string;
  segments: TranscriptSegment[];
}

export const callManagementApi = {
  getCall: (callId: string) => apiFetch<CallDetailOut>(`${BASE}/calls/${callId}`),
};
