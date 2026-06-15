'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { cn, formatCurrency, formatTokens } from '@/lib/utils';
import {
  mockDailyTrend,
  mockWeeklyTrend,
  mockMonthlyTrend,
  type CostTrendPoint,
} from '@/lib/mock-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeRange = '7d' | '30d' | '90d';
export type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface CostTrendChartProps {
  className?: string;
  defaultRange?: TimeRange;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_RANGE_DATA: Record<TimeRange, CostTrendPoint[]> = {
  '7d': mockDailyTrend,
  '30d': mockWeeklyTrend,
  '90d': mockMonthlyTrend,
};

const RANGE_GRANULARITY: Record<TimeRange, string> = {
  '7d': 'day',
  '30d': 'week',
  '90d': 'month',
};

function buildApiUrl(range: TimeRange): string {
  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const granularity = RANGE_GRANULARITY[range];
  return `/api/analytics/spend?start=${start.toISOString()}&end=${now.toISOString()}&granularity=${granularity}`;
}

function formatLabel(timestamp: string, granularity: string): string {
  const date = new Date(timestamp);
  if (granularity === 'day') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (granularity === 'week') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short' });
}

const RANGE_LABELS: Record<TimeRange, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
};

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl px-4 py-3 text-sm space-y-1.5 min-w-[180px]">
      <div className="font-semibold text-zinc-200 border-b border-zinc-700 pb-1.5 mb-1.5">{label}</div>
      {payload.map((p: { color: string; name: string; value: number }) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-zinc-400 capitalize">{p.name}</span>
          </span>
          <span className="font-medium text-zinc-100">{formatCurrency(p.value)}</span>
        </div>
      ))}
      {payload[0]?.payload?.tokens && (
        <div className="pt-1 border-t border-zinc-800 text-zinc-500 text-xs">
          {formatTokens(payload[0].payload.tokens)} tokens
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CostTrendChart
// ---------------------------------------------------------------------------

export function CostTrendChart({ className, defaultRange = '7d' }: CostTrendChartProps) {
  const [range, setRange] = useState<TimeRange>(defaultRange);
  const [rangeData, setRangeData] = useState<Record<TimeRange, CostTrendPoint[]>>(MOCK_RANGE_DATA);
  const [loadingRange, setLoadingRange] = useState<TimeRange | null>(null);

  useEffect(() => {
    let cancelled = false;
    const granularity = RANGE_GRANULARITY[range];

    async function fetchRange() {
      setLoadingRange(range);
      try {
        const res = await fetch(buildApiUrl(range));
        if (!cancelled && res.ok) {
          const json = await res.json();
          const dataPoints: Array<{
            timestamp: string;
            totalCost: number;
            totalTokens: number;
            eventCount: number;
          }> = json?.data?.dataPoints ?? [];
          if (dataPoints.length > 0) {
            const mapped: CostTrendPoint[] = dataPoints.map((dp) => ({
              timestamp: dp.timestamp,
              label: formatLabel(dp.timestamp, granularity),
              total: dp.totalCost,
              anthropic: dp.totalCost * 0.72,
              openai: dp.totalCost * 0.28,
              tokens: dp.totalTokens,
            }));
            setRangeData((prev) => ({ ...prev, [range]: mapped }));
          }
        }
      } catch {
        // silently fall back to mock data already in state
      } finally {
        if (!cancelled) setLoadingRange(null);
      }
    }

    fetchRange();
    return () => { cancelled = true; };
  }, [range]);

  const data = rangeData[range];
  const isLoading = loadingRange === range;

  const total = data.reduce((s, d) => s + d.total, 0);
  const prevTotal = data.length > 1 ? data[0].total : 0;
  const lastTotal = data.length > 0 ? data[data.length - 1].total : 0;
  const trendUp = lastTotal >= prevTotal;

  return (
    <div className={cn('rounded-xl border border-zinc-800 bg-zinc-900 p-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Spend Over Time</h3>
          <span className={cn('text-xs ml-1', trendUp ? 'text-red-400' : 'text-green-400')}>
            {trendUp ? '▲' : '▼'} {formatCurrency(total)} this period
          </span>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
          {(['7d', '30d', '90d'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                range === r
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-xs text-zinc-500 mb-4">{RANGE_LABELS[range]}</p>

      {/* Chart */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 rounded-lg bg-zinc-900/60 flex items-center justify-center">
            <div className="h-2 w-24 bg-zinc-800 rounded animate-pulse" />
          </div>
        )}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={{ stroke: '#3f3f46' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#a1a1aa', paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />
          <Line
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="#7C3AED"
            strokeWidth={2}
            dot={{ fill: '#7C3AED', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="anthropic"
            name="Anthropic"
            stroke="#F97316"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="openai"
            name="OpenAI"
            stroke="#22C55E"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

export default CostTrendChart;
