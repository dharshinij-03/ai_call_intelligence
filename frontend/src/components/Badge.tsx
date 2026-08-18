interface BadgeProps {
  text: string;
  classes?: string;
  dot?: boolean;
}

export function Badge({ text, classes = '', dot = false }: BadgeProps) {
  return (
    <span className={`badge ${classes}`}>
      {dot && <span className="badge-dot" style={{ background: 'currentColor' }} />}
      {text}
    </span>
  );
}

// Predefined semantic badge variants
export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? '').toUpperCase();
  const configs: Record<string, { label: string; color: string }> = {
    UNASSIGNED: { label: 'Unassigned', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    ASSIGNED: { label: 'Assigned', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    PENDING_INFORMATION: { label: 'Pending Info', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    RESOLVED: { label: 'Resolved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CLOSED: { label: 'Closed', color: 'bg-slate-100 text-slate-500 border-slate-200' },
    REOPENED: { label: 'Reopened', color: 'bg-red-50 text-red-700 border-red-200' },
    WAITING: { label: 'Waiting', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    CONNECTED: { label: 'Connected', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    ENDED: { label: 'Ended', color: 'bg-slate-100 text-slate-500 border-slate-200' },
  };
  const config = configs[s] ?? { label: status ?? '—', color: 'bg-slate-100 text-slate-600 border-slate-200' };
  return <Badge text={config.label} classes={config.color} dot />;
}

export function UrgencyBadge({ urgency }: { urgency: string | null | undefined }) {
  const u = (urgency ?? '').toLowerCase();
  const configs: Record<string, { label: string; color: string }> = {
    critical: { label: 'Critical', color: 'bg-red-50 text-red-700 border-red-200' },
    high: { label: 'High', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    medium: { label: 'Medium', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    low: { label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  };
  const config = configs[u] ?? { label: urgency ?? '—', color: 'bg-slate-100 text-slate-600 border-slate-200' };
  return <Badge text={config.label} classes={config.color} dot />;
}
