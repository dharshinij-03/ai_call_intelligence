export const SERVICE_URLS = {
  callManagement: import.meta.env.VITE_CALL_MANAGEMENT_URL as string,
  callManagementWs: import.meta.env.VITE_CALL_MANAGEMENT_WS_URL as string,
  callAnalysis: import.meta.env.VITE_CALL_ANALYSIS_URL as string,
  userManagement: import.meta.env.VITE_USER_MANAGEMENT_URL as string,
  assignment: import.meta.env.VITE_ASSIGNMENT_URL as string,
  admin: import.meta.env.VITE_ADMIN_URL as string,
  citizen: import.meta.env.VITE_CITIZEN_URL as string,
  citizenWs: import.meta.env.VITE_CITIZEN_WS_URL as string,
} as const;

export const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
