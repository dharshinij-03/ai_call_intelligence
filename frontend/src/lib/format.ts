export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 1) return 'just now';
  if (Math.abs(diffMin) < 60) return `${diffMin}m ${diffMin >= 0 ? 'ago' : 'from now'}`;
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return `${diffHr}h ${diffHr >= 0 ? 'ago' : 'from now'}`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ${diffDay >= 0 ? 'ago' : 'from now'}`;
}

const URGENCY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  low: 'bg-slate-100 text-slate-700 border-slate-300',
};

export function urgencyClasses(urgency: string | null | undefined): string {
  return URGENCY_COLORS[(urgency ?? '').toLowerCase()] ?? 'bg-slate-100 text-slate-700 border-slate-300';
}

const STATUS_COLORS: Record<string, string> = {
  UNASSIGNED: 'bg-slate-100 text-slate-700 border-slate-300',
  ASSIGNED: 'bg-blue-100 text-blue-800 border-blue-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 border-amber-300',
  PENDING_INFORMATION: 'bg-purple-100 text-purple-800 border-purple-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  CLOSED: 'bg-slate-200 text-slate-600 border-slate-300',
  REOPENED: 'bg-red-100 text-red-800 border-red-300',
  WAITING: 'bg-amber-100 text-amber-800 border-amber-300',
  CONNECTED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  ENDED: 'bg-slate-100 text-slate-600 border-slate-300',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-300',
};

export function statusClasses(status: string | null | undefined): string {
  return STATUS_COLORS[(status ?? '').toUpperCase()] ?? 'bg-slate-100 text-slate-700 border-slate-300';
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
