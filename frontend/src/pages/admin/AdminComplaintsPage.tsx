import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api/admin';
import { Badge, UrgencyBadge, StatusBadge } from '../../components/Badge';
import { EmptyState, ErrorBanner, SkeletonTable } from '../../components/Spinner';
import { formatDateTime, titleCase } from '../../lib/format';
import type { AssignmentStatus } from '../../lib/types';
import {
  Filter,
  AlertCircle,
  MapPin,
  User,
  ChevronRight,
  Search
} from 'lucide-react';

const STATUS_OPTIONS: AssignmentStatus[] = [
  'UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_INFORMATION',
  'RESOLVED', 'CLOSED', 'REOPENED',
];

export function AdminComplaintsPage() {
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');

  const departmentsQuery = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => adminApi.departments(),
  });

  const complaintsQuery = useQuery({
    queryKey: ['admin-complaints', departmentId, status],
    queryFn: () => adminApi.complaints({
      department_id: departmentId || undefined,
      status: status || undefined,
      limit: 100,
    }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">All Complaints</h1>
          <p className="page-subtitle">Every complaint across all departments, assigned officers, and statuses</p>
        </div>
        {complaintsQuery.data && (
          <div className="px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-100">
            <span className="text-indigo-700 text-sm font-semibold">
              {complaintsQuery.data.items.length} complaint{complaintsQuery.data.items.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Filter size={15} />
            <span className="font-medium">Filters</span>
          </div>
          <div className="h-4 w-px bg-slate-200" />

          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="form-select"
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="">All departments</option>
            {departmentsQuery.data?.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="form-select"
            style={{ width: 'auto', minWidth: '160px' }}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{titleCase(s)}</option>
            ))}
          </select>

          {(departmentId || status) && (
            <button
              onClick={() => { setDepartmentId(''); setStatus(''); }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {complaintsQuery.isLoading && <SkeletonTable rows={6} />}
      {complaintsQuery.error && <ErrorBanner message="Could not load complaints." />}
      {complaintsQuery.data && complaintsQuery.data.items.length === 0 && (
        <EmptyState
          message="No complaints found"
          description="No complaints match the selected filters. Try adjusting your search."
          action={
            <button
              onClick={() => { setDepartmentId(''); setStatus(''); }}
              className="btn btn-secondary btn-sm"
            >
              <Search size={14} /> Clear filters
            </button>
          }
        />
      )}

      {complaintsQuery.data && complaintsQuery.data.items.length > 0 && (
        <div className="card overflow-hidden animate-fade-in-up">
          <div className="divide-y divide-slate-100">
            {complaintsQuery.data.items.map((c, i) => (
              <Link
                key={c.call_id}
                to={`/admin/complaints/${c.call_id}`}
                className="flex items-start gap-4 p-5 hover:bg-slate-50 transition-colors group"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Left - urgency indicator */}
                <div
                  className="w-1.5 h-full min-h-[60px] rounded-full flex-shrink-0"
                  style={{
                    background: c.urgency === 'critical' ? '#dc2626'
                      : c.urgency === 'high' ? '#ea580c'
                      : c.urgency === 'medium' ? '#d97706'
                      : '#94a3b8'
                  }}
                />

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-semibold text-slate-800 text-sm">
                      {c.department_name ?? 'Not yet classified'}
                    </span>
                    {c.urgency && <UrgencyBadge urgency={c.urgency} />}
                    <StatusBadge status={c.assignment_status} />
                    {c.is_duplicate && (
                      <Badge text="Duplicate" classes="bg-purple-50 text-purple-700 border-purple-200" />
                    )}
                  </div>
                  {c.summary && (
                    <p className="text-sm text-slate-500 mb-2 line-clamp-2">{c.summary}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <AlertCircle size={11} />
                      {formatDateTime(c.created_at)}
                    </span>
                    {c.officer_name && (
                      <span className="flex items-center gap-1">
                        <User size={11} /> {c.officer_name}
                      </span>
                    )}
                    {c.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {c.location}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight
                  size={18}
                  className="text-slate-300 group-hover:text-indigo-400 flex-shrink-0 mt-1 transition-colors"
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
