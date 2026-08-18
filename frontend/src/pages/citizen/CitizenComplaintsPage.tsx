import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { citizenApi } from '../../lib/api/citizen';
import { UrgencyBadge, StatusBadge } from '../../components/Badge';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Spinner';
import { formatDateTime, formatRelative } from '../../lib/format';
import {
  FileText,
  MapPin,
  Clock,
  User,
  CheckCircle2,
  Circle,
  AlertCircle,
  Building2,
} from 'lucide-react';

function StatusTimeline({ status }: { status: string | null | undefined }) {
  const steps = [
    { key: 'UNASSIGNED', label: 'Complaint Filed' },
    { key: 'ASSIGNED', label: 'Assigned to Officer' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'RESOLVED', label: 'Resolved' },
  ];

  const ORDER: Record<string, number> = {
    UNASSIGNED: 0, ASSIGNED: 1, IN_PROGRESS: 2,
    PENDING_INFORMATION: 2, RESOLVED: 3, CLOSED: 3, REOPENED: 1,
  };

  const currentIdx = ORDER[(status ?? 'UNASSIGNED').toUpperCase()] ?? 0;

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const isDone = i <= currentIdx;
        const isActive = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0"
                style={{
                  borderColor: isDone ? '#6366f1' : '#e2e8f0',
                  background: isDone ? '#6366f1' : 'white',
                  boxShadow: isActive ? '0 0 0 4px rgb(99 102 241 / 0.15)' : 'none',
                }}
              >
                {isDone
                  ? <CheckCircle2 size={16} className="text-white" />
                  : <Circle size={14} className="text-slate-300" />
                }
              </div>
              <div
                className="text-[10px] text-center mt-1.5 font-medium leading-tight"
                style={{ color: isDone ? '#4f46e5' : '#94a3b8', maxWidth: '72px' }}
              >
                {step.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-0.5 -mt-4"
                style={{ background: i < currentIdx ? '#6366f1' : '#e2e8f0' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CitizenComplaintsPage() {
  const { token } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: () => citizenApi.myComplaints(token!),
    enabled: !!token,
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">My Complaints</h1>
          <p className="page-subtitle">Track the status of complaints filed through your calls</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100">
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          Live tracking
        </div>
      </div>

      {isLoading && <Spinner label="Loading your complaints…" />}
      {error && <ErrorBanner message="Could not load your complaints." />}
      {data && data.items.length === 0 && (
        <EmptyState
          message="No complaints yet"
          description="Complaints filed through your calls will appear here. Call an operator to report a civic issue."
          action={
            <a href="/citizen/call" className="btn btn-primary btn-sm">
              <AlertCircle size={14} /> Make a Call
            </a>
          }
        />
      )}

      {/* Complaint cards */}
      <div className="space-y-4">
        {data?.items.map((c, i) => (
          <div
            key={c.call_id}
            className="card p-6 animate-fade-in-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Header row */}
            <div className="flex flex-wrap items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Building2 size={20} className="text-indigo-500" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-800 mb-1.5">
                  {c.department_name ?? 'Classification Pending'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.urgency && <UrgencyBadge urgency={c.urgency} />}
                  <StatusBadge status={c.assignment_status} />
                </div>
              </div>
            </div>

            {/* Summary */}
            {c.summary && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 mb-4">
                <p className="text-sm text-slate-600 leading-relaxed">{c.summary}</p>
              </div>
            )}

            {/* Timeline */}
            <div className="mb-5 px-2 py-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                <Clock size={11} /> Status Progress
              </div>
              <StatusTimeline status={c.assignment_status} />
            </div>

            {/* Details */}
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock size={12} className="text-slate-300" />
                Filed {formatRelative(c.requested_at)}
              </span>
              {c.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-slate-300" />
                  {c.location}
                </span>
              )}
              {c.officer_name && (
                <span className="flex items-center gap-1.5">
                  <User size={12} className="text-slate-300" />
                  Officer: {c.officer_name}
                </span>
              )}
              {c.sla_due_at && (
                <span className="flex items-center gap-1.5">
                  <FileText size={12} className="text-slate-300" />
                  Expected by {formatDateTime(c.sla_due_at)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
