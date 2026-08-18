import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api/admin';
import { StatTile } from '../../components/StatTile';
import { ErrorBanner, Spinner } from '../../components/Spinner';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Building2,
  ArrowRight,
  TrendingUp,
  Users
} from 'lucide-react';
import { Badge } from '../../components/Badge';

export function AdminOverviewPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminApi.overview(),
    refetchInterval: 20000,
  });

  if (isLoading) return <Spinner label="Loading overview…" />;
  if (error || !data) return <ErrorBanner message="Could not load the overview." />;

  const resolutionRate = data.total_complaints > 0
    ? Math.round((data.resolved_complaints / data.total_complaints) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">City Overview</h1>
          <p className="page-subtitle">Real-time complaint statistics across all departments</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live data
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="stagger-1">
          <StatTile
            label="Total"
            value={data.total_complaints}
            icon={AlertCircle}
            iconBg="#eef2ff"
            iconColor="#6366f1"
          />
        </div>
        <div className="stagger-2">
          <StatTile
            label="Open"
            value={data.open_complaints}
            icon={Clock}
            iconBg="#fef3c7"
            iconColor="#d97706"
            tone="warning"
          />
        </div>
        <div className="stagger-3">
          <StatTile
            label="Resolved"
            value={data.resolved_complaints}
            icon={CheckCircle2}
            iconBg="#ecfdf5"
            iconColor="#059669"
            tone="good"
          />
        </div>
        <div className="stagger-4">
          <StatTile
            label="Critical"
            value={data.critical_complaints}
            icon={AlertTriangle}
            iconBg="#fef2f2"
            iconColor="#dc2626"
            tone="critical"
          />
        </div>
        <div className="stagger-5">
          <StatTile
            label="Duplicates"
            value={data.duplicate_complaints}
            icon={Copy}
            iconBg="#f5f3ff"
            iconColor="#7c3aed"
          />
        </div>
        <div className="stagger-6">
          <StatTile
            label="SLA Breaches"
            value={data.sla_breaches}
            icon={TrendingUp}
            iconBg={data.sla_breaches > 0 ? "#fef2f2" : "#ecfdf5"}
            iconColor={data.sla_breaches > 0 ? "#dc2626" : "#059669"}
            tone={data.sla_breaches > 0 ? 'critical' : 'good'}
          />
        </div>
      </div>

      {/* Resolution rate */}
      <div className="card p-6 animate-fade-in-up stagger-7">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Resolution Rate</h2>
            <p className="text-xs text-slate-400 mt-0.5">Resolved vs total complaints</p>
          </div>
          <span className="text-2xl font-bold text-indigo-600">{resolutionRate}%</span>
        </div>
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{
              '--progress-width': `${resolutionRate}%`,
              width: `${resolutionRate}%`,
              background: resolutionRate >= 70
                ? 'linear-gradient(90deg, #059669, #10b981)'
                : resolutionRate >= 40
                  ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                  : 'linear-gradient(90deg, #dc2626, #ef4444)',
            } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Departments table */}
      <div className="card overflow-hidden animate-fade-in-up stagger-8">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-slate-400" />
              <h2 className="font-semibold text-slate-800">By Department</h2>
            </div>
            <Link
              to="/admin/departments"
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              Manage departments <ArrowRight size={13} />
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th><span className="flex items-center gap-1"><Users size={12} /> Officers</span></th>
                <th>Total</th>
                <th>Open</th>
                <th>Critical</th>
                <th>SLA Breaches</th>
              </tr>
            </thead>
            <tbody>
              {data.departments.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link
                      to={`/admin/departments/${d.id}`}
                      className="flex items-center gap-2 font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                      {d.name}
                    </Link>
                  </td>
                  <td>
                    <span className="text-slate-600">{d.officer_count}</span>
                  </td>
                  <td>
                    <span className="font-medium text-slate-700">{d.total_complaints}</span>
                  </td>
                  <td>
                    {d.open_complaints > 0
                      ? <Badge text={String(d.open_complaints)} classes="bg-amber-50 text-amber-700 border-amber-200" />
                      : <span className="text-slate-400">—</span>
                    }
                  </td>
                  <td>
                    {d.critical_complaints > 0
                      ? <Badge text={String(d.critical_complaints)} classes="bg-red-50 text-red-700 border-red-200" dot />
                      : <span className="text-slate-400">—</span>
                    }
                  </td>
                  <td>
                    {d.sla_breaches > 0
                      ? <Badge text={String(d.sla_breaches)} classes="bg-red-50 text-red-700 border-red-200" dot />
                      : <Badge text="OK" classes="bg-emerald-50 text-emerald-700 border-emerald-200" />
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
