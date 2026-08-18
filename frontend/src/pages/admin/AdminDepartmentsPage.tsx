import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api/admin';
import { ErrorBanner, Spinner } from '../../components/Spinner';
import { Badge } from '../../components/Badge';
import { Building2, Users, AlertCircle, ChevronRight, TrendingUp } from 'lucide-react';

const DEPT_COLORS = [
  '#6366f1', '#0d9488', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#16a34a', '#9333ea', '#ea580c', '#0284c7',
  '#4f46e5', '#be185d',
];

export function AdminDepartmentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => adminApi.departments(),
  });

  if (isLoading) return <Spinner label="Loading departments…" />;
  if (error || !data) return <ErrorBanner message="Could not load departments." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">All {data.length} civic departments and their current workload</p>
        </div>
      </div>

      {/* Department grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((d, i) => {
          const color = DEPT_COLORS[i % DEPT_COLORS.length];
          const workloadPct = d.total_complaints > 0
            ? Math.round((d.open_complaints / d.total_complaints) * 100)
            : 0;

          return (
            <Link
              key={d.id}
              to={`/admin/departments/${d.id}`}
              className="card card-hover p-5 flex flex-col gap-4 animate-fade-in-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Top row */}
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18`, color }}
                >
                  <Building2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    {d.code}
                  </div>
                  <div className="font-semibold text-slate-800 text-sm leading-tight">{d.name}</div>
                </div>
                <ChevronRight size={16} className="text-slate-300 flex-shrink-0 mt-1" />
              </div>

              {/* Stats row */}
              <div className="flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users size={12} /> {d.officer_count} officer{d.officer_count !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <AlertCircle size={12} /> {d.total_complaints} total
                </span>
                {d.open_complaints > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <TrendingUp size={12} /> {d.open_complaints} open
                  </span>
                )}
              </div>

              {/* Workload bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-slate-400">Open workload</span>
                  <span className="text-[11px] font-semibold" style={{ color: workloadPct > 70 ? '#dc2626' : workloadPct > 40 ? '#d97706' : '#059669' }}>
                    {workloadPct}%
                  </span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{
                      '--progress-width': `${workloadPct}%`,
                      width: `${workloadPct}%`,
                      background: workloadPct > 70
                        ? 'linear-gradient(90deg, #dc2626, #ef4444)'
                        : workloadPct > 40
                          ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                          : `linear-gradient(90deg, ${color}bb, ${color})`,
                    } as React.CSSProperties}
                  />
                </div>
              </div>

              {/* SLA badge */}
              {d.sla_breaches > 0 && (
                <Badge
                  text={`${d.sla_breaches} SLA breach${d.sla_breaches !== 1 ? 'es' : ''}`}
                  classes="bg-red-50 text-red-700 border-red-200 w-fit"
                  dot
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
