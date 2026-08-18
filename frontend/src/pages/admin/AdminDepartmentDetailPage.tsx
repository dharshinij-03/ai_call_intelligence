import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api/admin';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Spinner';
import { ArrowLeft, Mail, Clock, CheckCircle2, TrendingUp, Shield } from 'lucide-react';

function OfficerMetric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-1">
        <Icon size={11} />
        {label}
      </div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
    </div>
  );
}

export function AdminDepartmentDetailPage() {
  const { departmentId } = useParams<{ departmentId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-department-officers', departmentId],
    queryFn: () => adminApi.departmentOfficers(departmentId!),
    enabled: !!departmentId,
  });

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        to="/admin/departments"
        className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
      >
        <ArrowLeft size={16} /> All departments
      </Link>

      {/* Header */}
      <div>
        <h1 className="page-title">Officers — {departmentId}</h1>
        <p className="page-subtitle">Live workload and performance metrics per officer</p>
      </div>

      {isLoading && <Spinner label="Loading officers…" />}
      {error && <ErrorBanner message="Could not load officers for this department." />}
      {data && data.length === 0 && (
        <EmptyState
          message="No officers registered"
          description="No officers have been registered for this department yet."
        />
      )}

      <div className="space-y-4">
        {data?.map((o, i) => (
          <div
            key={o.id}
            className="card p-5 animate-fade-in-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Officer header */}
            <div className="flex items-start gap-4 mb-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  boxShadow: '0 4px 12px rgb(99 102 241 / 0.25)',
                }}
              >
                {o.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-slate-800">{o.full_name}</span>
                  <div
                    className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: o.is_active ? '#ecfdf5' : '#f1f5f9',
                      color: o.is_active ? '#059669' : '#94a3b8',
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: o.is_active ? '#059669' : '#94a3b8' }}
                    />
                    {o.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                  <Mail size={13} />
                  {o.email}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <Shield size={13} className="text-indigo-400" />
                Field Officer
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <OfficerMetric
                label="Open Workload"
                value={String(o.open_workload)}
                icon={Clock}
              />
              <OfficerMetric
                label="Resolved"
                value={String(o.resolved_count)}
                icon={CheckCircle2}
              />
              <OfficerMetric
                label="Avg. Resolution"
                value={o.avg_resolution_hours != null ? `${o.avg_resolution_hours.toFixed(1)}h` : '—'}
                icon={TrendingUp}
              />
              <OfficerMetric
                label="SLA Compliance"
                value={o.sla_compliance_pct != null ? `${o.sla_compliance_pct.toFixed(0)}%` : '—'}
                icon={Shield}
              />
            </div>

            {/* SLA compliance bar */}
            {o.sla_compliance_pct != null && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">SLA Compliance</span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: o.sla_compliance_pct >= 80 ? '#059669' : o.sla_compliance_pct >= 50 ? '#d97706' : '#dc2626' }}
                  >
                    {o.sla_compliance_pct.toFixed(0)}%
                  </span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{
                      '--progress-width': `${o.sla_compliance_pct}%`,
                      width: `${o.sla_compliance_pct}%`,
                      background: o.sla_compliance_pct >= 80
                        ? 'linear-gradient(90deg, #059669, #10b981)'
                        : o.sla_compliance_pct >= 50
                          ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                          : 'linear-gradient(90deg, #dc2626, #ef4444)',
                    } as React.CSSProperties}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
