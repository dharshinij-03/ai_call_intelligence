import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { assignmentApi } from '../../lib/api/assignment';
import { UrgencyBadge, StatusBadge } from '../../components/Badge';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Spinner';
import { formatDateTime, formatRelative } from '../../lib/format';
import { Clock, AlertTriangle, CheckCircle2, ChevronRight, Building2 } from 'lucide-react';

export function OfficerComplaintsPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['officer-assignments', user?.id],
    queryFn: () => assignmentApi.listAssignments({ officer_id: user!.id }),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const sorted = data
    ?.slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) ?? [];

  const openCount = sorted.filter(a => !['RESOLVED', 'CLOSED'].includes(a.status)).length;
  const resolvedCount = sorted.filter(a => ['RESOLVED', 'CLOSED'].includes(a.status)).length;
  const criticalCount = sorted.filter(a => a.priority === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">My Assignments</h1>
          <p className="page-subtitle">Complaints assigned to you, most recent first</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          Auto-refreshes every 15s
        </div>
      </div>

      {/* Stats bar */}
      {data && data.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 text-center stagger-1">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock size={16} className="text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Open</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{openCount}</div>
          </div>
          <div className="card p-4 text-center stagger-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resolved</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{resolvedCount}</div>
          </div>
          <div className="card p-4 text-center stagger-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Critical</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: criticalCount > 0 ? '#dc2626' : '#0f172a' }}>
              {criticalCount}
            </div>
          </div>
        </div>
      )}

      {isLoading && <Spinner label="Loading your assignments…" />}
      {error && <ErrorBanner message="Could not load your assignments." />}
      {data && data.length === 0 && (
        <EmptyState
          message="No assignments yet"
          description="Complaints assigned to you will appear here. Check back shortly."
        />
      )}

      {/* Complaint list */}
      {sorted.length > 0 && (
        <div className="card overflow-hidden animate-fade-in-up">
          <div className="divide-y divide-slate-100">
            {sorted.map((a, i) => (
              <Link
                key={a.id}
                to={`/officer/complaints/${a.call_id}`}
                className="flex items-start gap-4 p-5 hover:bg-slate-50 transition-colors group"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Left priority indicator */}
                <div
                  className="w-1.5 h-full min-h-[60px] rounded-full flex-shrink-0"
                  style={{
                    background: a.priority === 'critical' ? '#dc2626'
                      : a.priority === 'high' ? '#ea580c'
                      : a.priority === 'medium' ? '#d97706'
                      : '#94a3b8'
                  }}
                />

                {/* Department icon */}
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Building2 size={18} className="text-indigo-500" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-semibold text-slate-800 text-sm">{a.department_name}</span>
                    <UrgencyBadge urgency={a.priority} />
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      Assigned {formatRelative(a.assigned_at)}
                    </span>
                    {a.sla_due_at && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle size={11} />
                        SLA due {formatDateTime(a.sla_due_at)}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-400 flex-shrink-0 mt-1 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
