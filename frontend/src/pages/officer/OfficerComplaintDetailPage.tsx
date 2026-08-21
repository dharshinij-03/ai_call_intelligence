import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignmentApi } from '../../lib/api/assignment';
import { callAnalysisApi } from '../../lib/api/callAnalysis';
import { ApiError } from '../../lib/api/http';
import { UrgencyBadge, StatusBadge, Badge } from '../../components/Badge';
import { ErrorBanner, Spinner } from '../../components/Spinner';
import { formatDateTime, titleCase } from '../../lib/format';
import type { AssignmentStatus } from '../../lib/types';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Clock,
  Tag,
  Brain,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';

const STATUS_OPTIONS: AssignmentStatus[] = [
  'ASSIGNED', 'IN_PROGRESS', 'PENDING_INFORMATION', 'RESOLVED', 'CLOSED', 'REOPENED',
];

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  ASSIGNED: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  IN_PROGRESS: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  PENDING_INFORMATION: { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' },
  RESOLVED: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  CLOSED: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  REOPENED: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
};

export function OfficerComplaintDetailPage() {
  const { callId } = useParams<{ callId: string }>();
  const queryClient = useQueryClient();
  const [officerAction, setOfficerAction] = useState('');

  const assignmentQuery = useQuery({
    queryKey: ['assignment', callId],
    queryFn: () => assignmentApi.getAssignment(callId!),
    enabled: !!callId,
  });

  const analysisQuery = useQuery({
    queryKey: ['analysis', callId],
    queryFn: () => callAnalysisApi.getAnalysis(callId!),
    enabled: !!callId,
  });

  const recommendationQuery = useQuery({
    queryKey: ['recommendation', callId],
    queryFn: () => assignmentApi.getRecommendation(callId!),
    enabled: !!callId,
    retry: false,
  });

  const statusMutation = useMutation({
    mutationFn: (status: AssignmentStatus) => assignmentApi.updateStatus(callId!, status),
    onSuccess: () => {
      // Refresh this assignment detail
      queryClient.invalidateQueries({ queryKey: ['assignment', callId] });
      // Also invalidate citizen complaints so a signed-in citizen client will see updates promptly
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
    },
  });

  const generateRecMutation = useMutation({
    mutationFn: () => assignmentApi.generateRecommendation(callId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendation', callId] }),
  });

  const reviewRecMutation = useMutation({
    mutationFn: (accepted: boolean) =>
      assignmentApi.reviewRecommendation(callId!, accepted, officerAction || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendation', callId] }),
  });

  if (!callId) return null;
  if (assignmentQuery.isLoading || analysisQuery.isLoading) return <Spinner label="Loading complaint…" />;
  if (assignmentQuery.error || analysisQuery.error) {
    return <ErrorBanner message="Could not load this complaint." />;
  }

  const assignment = assignmentQuery.data!;
  const analysis = analysisQuery.data!;
  const recommendationMissing =
    recommendationQuery.error instanceof ApiError && recommendationQuery.error.status === 404;
  const recommendation = recommendationQuery.data;

  return (
    <div className="max-w-3xl space-y-5">
      {/* Back */}
      <Link
        to="/officer/complaints"
        className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
      >
        <ArrowLeft size={16} /> Back to my assignments
      </Link>

      {/* Summary card */}
      <div className="card p-6 animate-fade-in-up stagger-1">
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={22} className="text-indigo-500" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900 mb-1.5">{assignment.department_name}</h1>
            <div className="flex flex-wrap gap-2">
              <UrgencyBadge urgency={analysis.urgency} />
              <StatusBadge status={assignment.status} />
              {analysis.is_duplicate && (
                <Badge text="Possible Duplicate" classes="bg-purple-50 text-purple-700 border-purple-200" />
              )}
            </div>
          </div>
        </div>

        {analysis.summary && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 mb-4 text-sm text-slate-700 leading-relaxed">
            {analysis.summary}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-1">
              <MapPin size={11} /> Location
            </div>
            <div className="text-sm text-slate-700 font-medium">{analysis.location ?? '—'}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-1">
              <Clock size={11} /> SLA Due
            </div>
            <div className="text-sm text-slate-700 font-medium">{formatDateTime(assignment.sla_due_at)}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-1">
              <Zap size={11} /> Sentiment
            </div>
            <div className="text-sm text-slate-700 font-medium">{titleCase(analysis.sentiment)}</div>
          </div>
        </div>

        {analysis.tags && analysis.tags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-2">
              <Tag size={12} /> Tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.tags.map((t: string) => (
                <span key={t} className="chip" style={{ cursor: 'default', fontSize: '11px', padding: '3px 10px' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {analysis.reasoning && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              <Brain size={12} /> Routing Reasoning
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{analysis.reasoning}</p>
          </div>
        )}
      </div>

      {/* Update status card */}
      <div className="card p-6 animate-fade-in-up stagger-2">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          Update Status
        </h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => {
            const isActive = assignment.status === s;
            const colors = STATUS_COLORS[s] ?? { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
            return (
              <button
                key={s}
                onClick={() => statusMutation.mutate(s)}
                disabled={statusMutation.isPending || isActive}
                className="px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
                style={{
                  background: isActive ? colors.bg : 'white',
                  color: isActive ? colors.color : '#64748b',
                  borderColor: isActive ? colors.border : '#e2e8f0',
                  opacity: statusMutation.isPending && !isActive ? 0.5 : 1,
                  cursor: isActive ? 'default' : 'pointer',
                }}
              >
                {titleCase(s)}
              </button>
            );
          })}
        </div>
        {statusMutation.isPending && (
          <p className="text-xs text-slate-400 mt-2 animate-fade-in">Updating status…</p>
        )}
      </div>

      {/* AI recommendation card */}
      <div className="card p-6 animate-fade-in-up stagger-3">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Brain size={16} className="text-indigo-400" />
          AI Recommendation
          <Badge text="Powered by Gemini" classes="bg-indigo-50 text-indigo-600 border-indigo-100" />
        </h2>

        {recommendationMissing && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              No recommendation generated yet. Let AI analyze this complaint and suggest a course of action.
            </p>
            <button
              onClick={() => generateRecMutation.mutate()}
              disabled={generateRecMutation.isPending}
              className="btn btn-primary btn-sm"
            >
              {generateRecMutation.isPending ? (
                <>
                  <span
                    className="w-3.5 h-3.5 border-2 border-white/30 rounded-full"
                    style={{ borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }}
                  />
                  Asking AI…
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Generate recommendation
                </>
              )}
            </button>
          </div>
        )}

        {recommendation && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge text={titleCase(recommendation.recommendation_type)} classes="bg-indigo-50 text-indigo-700 border-indigo-200" />
              <div className="flex items-center gap-2">
                <div className="progress-bar-track" style={{ width: '80px', height: '4px' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      '--progress-width': `${Math.round(recommendation.confidence * 100)}%`,
                      width: `${Math.round(recommendation.confidence * 100)}%`,
                      background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                    } as React.CSSProperties}
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {Math.round(recommendation.confidence * 100)}% confidence
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
              <p className="text-sm text-slate-700 leading-relaxed">{recommendation.recommendation_text}</p>
            </div>

            {recommendation.accepted_by_officer === null ? (
              <div className="space-y-3">
                <input
                  placeholder="Describe what you actually did (optional)"
                  value={officerAction}
                  onChange={(e) => setOfficerAction(e.target.value)}
                  className="form-input"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => reviewRecMutation.mutate(true)}
                    disabled={reviewRecMutation.isPending}
                    className="btn btn-success btn-sm"
                  >
                    <CheckCircle2 size={14} /> Accept
                  </button>
                  <button
                    onClick={() => reviewRecMutation.mutate(false)}
                    disabled={reviewRecMutation.isPending}
                    className="btn btn-secondary btn-sm"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
                style={{
                  background: recommendation.accepted_by_officer ? '#f0fdf4' : '#f8fafc',
                  color: recommendation.accepted_by_officer ? '#15803d' : '#64748b',
                }}
              >
                {recommendation.accepted_by_officer
                  ? <CheckCircle2 size={16} />
                  : <XCircle size={16} />
                }
                <span className="font-medium">
                  {recommendation.accepted_by_officer ? 'Accepted' : 'Rejected'}
                </span>
                {recommendation.officer_action && (
                  <span className="text-slate-400 ml-1">— {recommendation.officer_action}</span>
                )}
              </div>
            )}

            <button
              onClick={() => generateRecMutation.mutate()}
              disabled={generateRecMutation.isPending}
              className="btn btn-ghost btn-xs flex items-center gap-1.5"
            >
              <RefreshCw size={12} />
              {generateRecMutation.isPending ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
