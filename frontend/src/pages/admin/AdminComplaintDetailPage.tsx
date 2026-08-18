import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api/admin';
import { Badge, UrgencyBadge, StatusBadge } from '../../components/Badge';
import { ErrorBanner, Spinner } from '../../components/Spinner';
import { formatDateTime, titleCase } from '../../lib/format';
import {
  ArrowLeft,
  Building2,
  User,
  MapPin,
  Clock,
  Tag,
  Brain,
  AlertCircle,
  CheckCircle2,
  Zap
} from 'lucide-react';

function DetailRow({ label, icon: Icon, value }: { label: string; icon: React.ElementType; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</div>
        <div className="text-sm text-slate-700">{value}</div>
      </div>
    </div>
  );
}

function TimelineStep({
  label,
  time,
  active,
  done,
}: {
  label: string;
  time?: string | null;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all"
          style={{
            borderColor: done ? '#059669' : active ? '#6366f1' : '#e2e8f0',
            background: done ? '#ecfdf5' : active ? '#eef2ff' : 'white',
          }}
        >
          {done
            ? <CheckCircle2 size={15} className="text-emerald-600" />
            : active
              ? <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              : <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
          }
        </div>
        <div className="w-0.5 flex-1 bg-slate-100 my-1" style={{ minHeight: '24px' }} />
      </div>
      <div className="flex-1 pb-4">
        <div
          className="text-sm font-medium"
          style={{ color: done ? '#059669' : active ? '#4f46e5' : '#94a3b8' }}
        >
          {label}
        </div>
        {time && <div className="text-xs text-slate-400 mt-0.5">{formatDateTime(time)}</div>}
      </div>
    </div>
  );
}

export function AdminComplaintDetailPage() {
  const { callId } = useParams<{ callId: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-complaint', callId],
    queryFn: () => adminApi.complaint(callId!),
    enabled: !!callId,
  });

  const statusOrder = ['UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  return (
    <div className="max-w-3xl">
      {/* Back nav */}
      <Link
        to="/admin/complaints"
        className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> All complaints
      </Link>

      {isLoading && <Spinner label="Loading complaint details…" />}
      {error && <ErrorBanner message="Could not load this complaint." />}

      {data && (
        <div className="space-y-5 animate-fade-in-up">
          {/* Main card */}
          <div className="card p-6">
            <div className="flex flex-wrap items-start gap-3 mb-4">
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900 mb-1">
                  {data.department_name ?? 'Classification Pending'}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  {data.urgency && <UrgencyBadge urgency={data.urgency} />}
                  <StatusBadge status={data.assignment_status} />
                  {data.is_duplicate && (
                    <Badge text="Possible Duplicate" classes="bg-purple-50 text-purple-700 border-purple-200" />
                  )}
                </div>
              </div>
            </div>

            {data.summary && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 mb-4">
                <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
              </div>
            )}

            <div className="divide-y divide-slate-100">
              <DetailRow label="Department" icon={Building2} value={data.department_name ?? '—'} />
              <DetailRow label="Assigned Officer" icon={User} value={data.officer_name ?? 'Unassigned'} />
              <DetailRow label="Location" icon={MapPin} value={data.location ?? '—'} />
              <DetailRow label="Filed At" icon={Clock} value={formatDateTime(data.created_at)} />
              <DetailRow label="SLA Deadline" icon={AlertCircle} value={formatDateTime(data.sla_due_at)} />
              <DetailRow
                label="Tags"
                icon={Tag}
                value={
                  data.tags?.length
                    ? (
                      <div className="flex flex-wrap gap-1.5">
                        {data.tags.map((t: string) => (
                          <span key={t} className="chip" style={{ cursor: 'default', fontSize: '11px', padding: '2px 8px' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )
                    : '—'
                }
              />
              <DetailRow
                label="Sentiment"
                icon={Zap}
                value={titleCase(data.sentiment)}
              />
            </div>

            {data.reasoning && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  <Brain size={13} /> AI Routing Reasoning
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{data.reasoning}</p>
              </div>
            )}
          </div>

          {/* Status timeline */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              Status Timeline
            </h2>
            <div>
              {statusOrder.map((s, i) => {
                const currentIdx = statusOrder.indexOf(data.assignment_status ?? 'UNASSIGNED');
                const isDone = i < currentIdx;
                const isActive = i === currentIdx;
                const showConnector = i < statusOrder.length - 1;
                return (
                  <div key={s} className={showConnector ? '' : '[&_.divider]:hidden'}>
                    <TimelineStep
                      label={titleCase(s)}
                      active={isActive}
                      done={isDone}
                      time={isActive ? data.created_at : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI recommendation */}
          {data.recommendation_text && (
            <div className="card p-6 animate-fade-in-up">
              <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Brain size={16} className="text-indigo-400" />
                AI Recommendation
              </h2>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <Badge
                  text={titleCase(data.recommendation_type)}
                  classes="bg-indigo-50 text-indigo-700 border-indigo-200"
                />
                {data.recommendation_confidence != null && (
                  <div className="flex items-center gap-2">
                    <div className="progress-bar-track" style={{ width: '80px', height: '4px' }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          '--progress-width': `${Math.round(data.recommendation_confidence * 100)}%`,
                          width: `${Math.round(data.recommendation_confidence * 100)}%`,
                          background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                        } as React.CSSProperties}
                      />
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {Math.round(data.recommendation_confidence * 100)}% confidence
                    </span>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{data.recommendation_text}</p>
              {data.officer_action && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
                  Officer action: {data.officer_action}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
