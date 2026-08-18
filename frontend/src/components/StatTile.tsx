import { useEffect, useRef, useState } from 'react';

interface StatTileProps {
  label: string;
  value: number | string;
  tone?: 'default' | 'critical' | 'good' | 'warning';
  icon?: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  subtitle?: string;
}

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof target !== 'number') return;
    startRef.current = null;
    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return count;
}

export function StatTile({ label, value, tone = 'default', icon: Icon, iconColor, iconBg, subtitle }: StatTileProps) {
  const numericValue = typeof value === 'number' ? value : NaN;
  const animated = useCountUp(isNaN(numericValue) ? 0 : numericValue);
  const displayValue = isNaN(numericValue) ? value : animated;

  const toneStyles = {
    critical: { valueColor: '#dc2626' },
    good: { valueColor: '#059669' },
    warning: { valueColor: '#d97706' },
    default: { valueColor: '#0f172a' },
  };

  const style = toneStyles[tone];

  return (
    <div className="stat-card animate-fade-in-up">
      {Icon && (
        <div
          className="stat-card-icon"
          style={{ background: iconBg ?? '#eef2ff', color: iconColor ?? '#6366f1' }}
        >
          <Icon size={22} />
        </div>
      )}
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value animate-count-up" style={{ color: style.valueColor }}>
        {displayValue}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-400 mt-2">{subtitle}</div>
      )}
    </div>
  );
}
