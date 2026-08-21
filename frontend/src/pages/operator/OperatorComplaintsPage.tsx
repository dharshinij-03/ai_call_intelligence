import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/api/admin';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Spinner';
import { StatusBadge, UrgencyBadge } from '../../components/Badge';
import { formatRelative } from '../../lib/format';
import type { ComplaintOut } from '../../lib/types';
import { FileText, Filter } from 'lucide-react';

const STATUS_TABS = ['ALL', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export function OperatorComplaintsPage() {
  const [statusTab, setStatusTab] = useState<StatusTab>('ALL');
  const { data, isLoading, error } = useQuery({
    queryKey: ['operator-complaints', statusTab],
    queryFn: () => adminApi.complaints({ limit: 100, status: statusTab === 'ALL' ? undefined : statusTab }),
    refetchInterval: 15000,
  });

  const complaints = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="page-title">All Call Complaints</h1>
          <p className="page-subtitle">Operator view of complaint summaries, urgency, and assignment status.</p>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <Filter size={13} /> Summary Tab
        </span>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              statusTab === tab
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading && <Spinner label="Loading complaints…" />}
      {error && <ErrorBanner message="Could not load complaints." />}
      {!isLoading && complaints.length === 0 && (
        <EmptyState message="No complaints found" description="Complaints will appear here as calls are processed." />
      )}

      {complaints.length > 0 && (
        <div className="space-y-3">
          {complaints.map((c: ComplaintOut) => (
            <div key={c.call_id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 truncate">{c.department_name ?? 'Unclassified'}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Filed {formatRelative(c.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c.urgency && <UrgencyBadge urgency={c.urgency} />}
                  <StatusBadge status={c.assignment_status} />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-sm text-slate-700">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                  <FileText size={12} /> Summary
                </div>
                {c.summary ?? 'No summary generated yet.'}
              </div>

              <div className="mt-3">
                <Link to={`/admin/complaints/${c.call_id}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  Open full complaint details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

