import { AlertCircle, RefreshCw, Inbox, X } from 'lucide-react';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative w-10 h-10">
        <div
          className="w-10 h-10 rounded-full border-[3px] border-indigo-100"
          style={{ borderTopColor: '#6366f1', animation: 'spin 0.7s linear infinite' }}
        />
      </div>
      <p className="text-sm text-slate-400 font-medium">{label}</p>

    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
      </div>
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-3/4 rounded" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex gap-3">
        <div className="skeleton h-8 w-36 rounded-lg" />
        <div className="skeleton h-8 w-28 rounded-lg" />
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {[1, 2, 3, 4].map((i) => (
              <th key={i}>
                <div className="skeleton h-3 w-16 rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td><div className="skeleton h-4 w-32 rounded" /></td>
              <td><div className="skeleton h-5 w-16 rounded-full" /></td>
              <td><div className="skeleton h-4 w-20 rounded" /></td>
              <td><div className="skeleton h-4 w-24 rounded" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 animate-fade-in"
    >
      <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={18} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800">Something went wrong</p>
        <p className="text-xs text-red-600 mt-0.5">{message}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 transition-colors font-medium"
        >
          <RefreshCw size={13} />
          Retry
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-700 p-1 transition-colors rounded-lg hover:bg-red-100"
            title="Dismiss error"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  message,
  description,
  action,
}: {
  message: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state animate-fade-in-up">
      <div className="empty-state-icon">
        <Inbox size={28} />
      </div>
      <p className="text-base font-semibold text-slate-700 mb-1">{message}</p>
      {description && (
        <p className="text-sm text-slate-400 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
