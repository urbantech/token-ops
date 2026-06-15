'use client';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsageItem {
  label: string;
  current: number;
  max: number;
  unit?: string;
  formatValue?: (value: number) => string;
}

export interface UsageIndicatorProps {
  items: UsageItem[];
  className?: string;
  compact?: boolean;
  warningThreshold?: number;
  criticalThreshold?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultFormat(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

// ---------------------------------------------------------------------------
// UsageBar
// ---------------------------------------------------------------------------

interface UsageBarProps extends UsageItem {
  compact?: boolean;
  warningThreshold: number;
  criticalThreshold: number;
}

function UsageBar({
  label,
  current,
  max,
  unit = '',
  formatValue = defaultFormat,
  compact = false,
  warningThreshold,
  criticalThreshold,
}: UsageBarProps) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isWarning = percentage >= warningThreshold;
  const isCritical = percentage >= criticalThreshold;

  const barColor = isCritical
    ? 'from-red-500 to-red-600'
    : isWarning
    ? 'from-amber-400 to-amber-500'
    : 'from-violet-500 to-violet-600';

  const badgeColor = isCritical
    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
    : isWarning
    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    : 'bg-zinc-700 text-zinc-400 border border-zinc-600';

  const labelColor = isCritical
    ? 'text-red-400'
    : isWarning
    ? 'text-amber-400'
    : 'text-zinc-300';

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">{label}</span>
          <span className={cn('font-medium', labelColor)}>
            {formatValue(current)}/{formatValue(max)}{unit}
          </span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn('h-full bg-gradient-to-r rounded-full transition-all duration-700 ease-out', barColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-zinc-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', labelColor)}>
            {formatValue(current)} / {formatValue(max)}{unit}
          </span>
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', badgeColor)}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full bg-gradient-to-r rounded-full transition-all duration-700 ease-out', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isCritical && (
        <p className="text-xs text-red-400">Critical: usage is above {criticalThreshold}% of limit</p>
      )}
      {isWarning && !isCritical && (
        <p className="text-xs text-amber-400">Warning: usage is above {warningThreshold}% of limit</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UsageIndicator (exported)
// ---------------------------------------------------------------------------

export function UsageIndicator({
  items,
  className,
  compact = false,
  warningThreshold = 80,
  criticalThreshold = 95,
}: UsageIndicatorProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item, index) => (
        <UsageBar
          key={index}
          {...item}
          compact={compact}
          warningThreshold={warningThreshold}
          criticalThreshold={criticalThreshold}
        />
      ))}
    </div>
  );
}

export default UsageIndicator;
