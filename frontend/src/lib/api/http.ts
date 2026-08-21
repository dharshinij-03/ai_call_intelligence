export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof URLSearchParams) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const resp = await fetch(url, { ...options, headers });
  if (!resp.ok) {
    const detail = await resp.json().catch(() => null);
    throw new ApiError(resp.status, detail?.detail ?? `Request failed (${resp.status})`);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json();
}
