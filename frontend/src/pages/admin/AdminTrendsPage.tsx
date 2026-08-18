import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adminApi } from '../../lib/api/admin';
import { ErrorBanner, Spinner } from '../../components/Spinner';
import { TrendingUp } from 'lucide-react';

const CHART_PRIMARY = '#6366f1';
const CHART_SECONDARY = '#14b8a6';
const GRID = '#f1f5f9';
const AXIS_INK = '#94a3b8';

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="card px-4 py-3"
      style={{ minWidth: '140px', borderRadius: '12px', boxShadow: '0 8px 25px rgb(0 0 0 / 0.1)' }}
    >
      <div className="text-xs font-semibold text-slate-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-slate-800">
        {payload[0].value}
        <span className="text-xs font-normal text-slate-400 ml-1">complaints</span>
      </div>
    </div>
  );
}

export function AdminTrendsPage() {
  const [days, setDays] = useState(30);

  const dailyQuery = useQuery({
    queryKey: ['admin-trends-daily', days],
    queryFn: () => adminApi.trends(days, false),
  });

  const byDeptQuery = useQuery({
    queryKey: ['admin-trends-dept', days],
    queryFn: () => adminApi.trends(days, true),
  });

  const departmentTotals = useMemo(() => {
    if (!byDeptQuery.data) return [];
    const totals = new Map<string, number>();
    for (const point of byDeptQuery.data) {
      if (!point.department_name) continue;
      totals.set(point.department_name, (totals.get(point.department_name) ?? 0) + point.count);
    }
    return Array.from(totals.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [byDeptQuery.data]);

  const dailyData = useMemo(
    () =>
      dailyQuery.data?.map((p) => ({
        day: new Date(p.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: p.count,
      })) ?? [],
    [dailyQuery.data],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">Complaint Trends</h1>
          <p className="page-subtitle">Historical complaint volume — daily and by department</p>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: days === opt.value ? '#6366f1' : 'transparent',
                color: days === opt.value ? 'white' : '#64748b',
                boxShadow: days === opt.value ? '0 2px 8px rgb(99 102 241 / 0.3)' : 'none',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Daily volume chart */}
      <div className="card p-6 animate-fade-in-up stagger-1">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={16} className="text-indigo-400" />
          <h2 className="font-semibold text-slate-800">Daily complaint volume</h2>
        </div>
        {dailyQuery.isLoading && <Spinner />}
        {dailyQuery.error && <ErrorBanner message="Could not load trends." />}
        {dailyData.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 0" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: AXIS_INK }}
                axisLine={{ stroke: GRID }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: AXIS_INK }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="count"
                stroke={CHART_PRIMARY}
                strokeWidth={2.5}
                fill="url(#volumeFill)"
                dot={false}
                activeDot={{ r: 5, fill: CHART_PRIMARY, stroke: 'white', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* By department chart */}
      <div className="card p-6 animate-fade-in-up stagger-2">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-3 h-3 rounded-sm" style={{ background: CHART_SECONDARY }} />
          <h2 className="font-semibold text-slate-800">Total by department (same range)</h2>
        </div>
        {byDeptQuery.isLoading && <Spinner />}
        {byDeptQuery.error && <ErrorBanner message="Could not load department trends." />}
        {departmentTotals.length > 0 && (
          <ResponsiveContainer width="100%" height={Math.max(220, departmentTotals.length * 38)}>
            <BarChart data={departmentTotals} layout="vertical" margin={{ left: 16, right: 20 }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: AXIS_INK }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={190}
                tick={{ fontSize: 11, fill: AXIS_INK }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8faff' }} />
              <Bar
                dataKey="count"
                fill={CHART_SECONDARY}
                radius={[0, 6, 6, 0]}
                barSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
