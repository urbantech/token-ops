'use client';

/**
 * SavingsProjection
 *
 * Recharts BarChart showing projected token savings if all memory
 * reuse recommendations are implemented.
 *
 * Issue #18 — Memory Reuse Recommendations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { SavingsProjectionItem } from '@/types/memory';
import type { MemoryReuseRecommendation } from '@/types/memory';

function buildProjection(
  recs: MemoryReuseRecommendation
): SavingsProjectionItem[] {
  const items: SavingsProjectionItem[] = [];

  if (recs.duplicateQueries.length > 0) {
    items.push({
      label: 'Duplicate Queries',
      wasted: recs.duplicateQueries.reduce((s, q) => s + q.tokensConsumed, 0),
      saved: recs.duplicateQueries.reduce((s, q) => s + q.potentialSavings, 0),
    });
  }

  if (recs.repeatedResearch.length > 0) {
    items.push({
      label: 'Repeated Research',
      wasted: recs.repeatedResearch.reduce((s, q) => s + q.tokensConsumed, 0),
      saved: recs.repeatedResearch.reduce((s, q) => s + q.potentialSavings, 0),
    });
  }

  if (recs.repeatedWorkflows.length > 0) {
    items.push({
      label: 'Repeated Workflows',
      wasted: recs.repeatedWorkflows.reduce((s, w) => s + w.totalCost, 0),
      saved: recs.repeatedWorkflows.reduce(
        (s, w) => s + w.avgCost * Math.max(0, w.frequency - 1),
        0
      ),
    });
  }

  return items;
}

// Custom tooltip for the chart
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 shadow-xl">
      <p className="mb-2 text-sm font-medium text-zinc-300">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()} tokens
        </p>
      ))}
    </div>
  );
}

export function SavingsProjection() {
  const [data, setData] = useState<SavingsProjectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/memory/recommendations?timeRange=7d');
      if (res.ok) {
        const recs: MemoryReuseRecommendation = await res.json();
        setData(buildProjection(recs));
      }
    } catch {
      // Silently degrade
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-80 animate-pulse items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
        <span className="text-sm text-zinc-600">Loading chart...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
        <span className="text-sm text-zinc-500">
          No savings data available.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h3 className="mb-1 text-lg font-semibold text-zinc-100">
        Savings Projection
      </h3>
      <p className="mb-5 text-sm text-zinc-500">
        Token impact if all recommendations are applied (past 7 days)
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#27272a"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: '#71717a', fontSize: 12 }}
            axisLine={{ stroke: '#3f3f46' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#71717a', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v)
            }
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }}
          />
          <Bar
            dataKey="wasted"
            name="Tokens Wasted"
            fill="#ef4444"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="saved"
            name="Tokens Saved"
            fill="#22c55e"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
