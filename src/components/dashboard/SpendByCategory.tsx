'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { cn, formatCurrency, formatTokens } from '@/lib/utils';
import { mockCategorySpend, type CategorySpend } from '@/lib/mock-data';

// ---------------------------------------------------------------------------
// Category color map used when mapping API response to CategorySpend
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  updating_specs: '#3B82F6',
  brainstorming: '#A855F7',
  updating_code: '#22C55E',
  fixing_issues: '#F97316',
  batch_commands: '#EF4444',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpendByCategoryProps {
  data?: CategorySpend[];
  className?: string;
  onSegmentClick?: (category: CategorySpend) => void;
}

// ---------------------------------------------------------------------------
// Custom active shape for richer hover state
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveShape(props: any) {
  const {
    cx, cy,
    innerRadius, outerRadius,
    startAngle, endAngle,
    fill,
    payload,
    percent,
  } = props;

  return (
    <g>
      <text x={cx} y={cy - 14} textAnchor="middle" className="fill-zinc-100 text-base font-semibold" style={{ fontSize: 14, fontWeight: 600 }}>
        {payload.label}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: fill }}>
        {formatCurrency(payload.value)}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" style={{ fontSize: 11, fill: '#71717a' }}>
        {(percent * 100).toFixed(1)}% of total
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 12}
        outerRadius={outerRadius + 16}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.4}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: CategorySpend = payload[0].payload;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl px-4 py-3 text-sm space-y-1">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: d.color }} />
        <span className="font-semibold text-zinc-100">{d.label}</span>
      </div>
      <div className="text-zinc-400">Cost: <span className="text-zinc-100 font-medium">{formatCurrency(d.value)}</span></div>
      <div className="text-zinc-400">Tokens: <span className="text-zinc-100 font-medium">{formatTokens(d.tokens)}</span></div>
      <div className="text-zinc-400">Events: <span className="text-zinc-100 font-medium">{d.count.toLocaleString()}</span></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpendByCategory
// ---------------------------------------------------------------------------

export function SpendByCategory({
  data,
  className,
  onSegmentClick,
}: SpendByCategoryProps) {
  const [categories, setCategories] = useState<CategorySpend[]>(data ?? mockCategorySpend);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [selected, setSelected] = useState<CategorySpend | null>(null);

  useEffect(() => {
    if (data !== undefined) {
      setCategories(data.length > 0 ? data : mockCategorySpend);
      return;
    }
    const controller = new AbortController();
    fetch(
      '/api/analytics/spend?start=2026-06-01T00:00:00Z&end=2026-06-30T23:59:59Z&groupBy=classification',
      { signal: controller.signal },
    )
      .then((res) => res.json())
      .then((json) => {
        const breakdowns: Array<{
          category: string;
          totalCost: number;
          totalTokens: number;
          eventCount: number;
          percentage: number;
        }> = json?.data?.breakdowns ?? [];
        if (breakdowns.length === 0) return;
        setCategories(
          breakdowns.map((b) => ({
            name: b.category,
            label: b.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            value: b.totalCost,
            tokens: b.totalTokens,
            count: b.eventCount,
            color: CATEGORY_COLORS[b.category] ?? '#71717a',
            fill: CATEGORY_COLORS[b.category] ?? '#71717a',
          })),
        );
      })
      .catch(() => {
        // fetch failed or aborted — keep existing state (mock fallback)
      });
    return () => controller.abort();
  }, [data]);

  const total = categories.reduce((s, d) => s + d.value, 0);

  // Limit pie chart to top 8 + "Other" bucket for visual clarity
  const pieData = (() => {
    if (categories.length <= 10) return categories;
    const top = categories.slice(0, 8);
    const rest = categories.slice(8);
    const otherValue = rest.reduce((s, d) => s + d.value, 0);
    const otherTokens = rest.reduce((s, d) => s + d.tokens, 0);
    const otherCount = rest.reduce((s, d) => s + d.count, 0);
    return [
      ...top,
      {
        name: 'other',
        label: `Other (${rest.length} models)`,
        value: otherValue,
        tokens: otherTokens,
        count: otherCount,
        color: '#52525b',
        fill: '#52525b',
      },
    ];
  })();

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(undefined);
  }, []);

  const onPieClick = useCallback(
    (_: unknown, index: number) => {
      const item = pieData[index];
      if (!item) return;
      setSelected((prev) => (prev?.name === item.name ? null : item));
      onSegmentClick?.(item);
    },
    [pieData, onSegmentClick],
  );

  return (
    <div className={cn('rounded-xl border border-zinc-800 bg-zinc-900 p-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <PieIcon className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-zinc-100">Spend by Category</h3>
        <span className="ml-auto text-xs text-zinc-500">Click a segment to drill down</span>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Pie chart */}
        <div className="w-full lg:w-64 h-64 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                dataKey="value"
                activeIndex={activeIndex}
                activeShape={ActiveShape}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                onClick={onPieClick}
                style={{ cursor: 'pointer' }}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={entry.fill}
                    opacity={selected && selected.name !== entry.name ? 0.35 : 1}
                    stroke={selected?.name === entry.name ? entry.color : 'transparent'}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {/* Center total — rendered only when no segment is active */}
              {activeIndex === undefined && (
                <text
                  x="50%"
                  y="48%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  <tspan
                    x="50%"
                    dy="-8"
                    style={{ fontSize: 18, fontWeight: 700, fill: '#f4f4f5' }}
                  >
                    {formatCurrency(total)}
                  </tspan>
                  <tspan
                    x="50%"
                    dy="20"
                    style={{ fontSize: 11, fill: '#71717a' }}
                  >
                    total spend
                  </tspan>
                </text>
              )}
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend + detail */}
        <div className="flex-1 w-full space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {categories.slice(0, 10).map((item) => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            const isSelected = selected?.name === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setSelected((prev) => (prev?.name === item.name ? null : item));
                  onSegmentClick?.(item);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                  isSelected
                    ? 'bg-zinc-800 ring-1 ring-violet-500/40'
                    : 'hover:bg-zinc-800/60',
                )}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="flex-1 text-sm text-zinc-300 truncate">{item.label}</span>
                <div className="flex items-center gap-3 shrink-0">
                  {/* Mini bar */}
                  <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 w-10 text-right">{pct.toFixed(0)}%</span>
                  <span className="text-sm font-semibold text-zinc-100 w-16 text-right tabular-nums">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              </button>
            );
          })}

          {/* "Other" summary for remaining items */}
          {categories.length > 10 && (() => {
            const rest = categories.slice(10);
            const restTotal = rest.reduce((s, i) => s + i.value, 0);
            const restPct = total > 0 ? (restTotal / total) * 100 : 0;
            return (
              <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left bg-zinc-800/30">
                <span className="w-3 h-3 rounded-full shrink-0 bg-zinc-600" />
                <span className="flex-1 text-sm text-zinc-500">
                  +{rest.length} other models
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-zinc-500 w-10 text-right">{restPct.toFixed(0)}%</span>
                  <span className="text-sm font-semibold text-zinc-400 w-16 text-right tabular-nums">
                    {formatCurrency(restTotal)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Drill-down panel */}
          {selected && (
            <div className="mt-3 p-3 bg-zinc-800/60 rounded-lg border border-zinc-700 space-y-2">
              <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
                {selected.label} — Details
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-zinc-500">Cost</div>
                  <div className="font-semibold text-zinc-100">{formatCurrency(selected.value)}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Tokens</div>
                  <div className="font-semibold text-zinc-100">{formatTokens(selected.tokens)}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Events</div>
                  <div className="font-semibold text-zinc-100">{selected.count.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpendByCategory;
