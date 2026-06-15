'use client';

/**
 * MemoryReuseTable
 *
 * Displays a table of duplicate/repeated queries with frequency,
 * tokens wasted, potential savings, and a "Cache This" action button.
 *
 * Issue #18 — Memory Reuse Recommendations
 */

import { useState, useEffect, useCallback } from 'react';
import type { MemoryReuseRecommendation, RepeatedQuery } from '@/types/memory';

type TimeRange = '24h' | '7d' | '30d' | '90d';

export function MemoryReuseTable() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [data, setData] = useState<MemoryReuseRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [cachedIds, setCachedIds] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/memory/recommendations?timeRange=${timeRange}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Silently degrade — table stays empty
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleCache(index: number) {
    setCachedIds((prev) => new Set(prev).add(index));
  }

  // Combine duplicate queries and repeated research for display
  const allQueries: (RepeatedQuery & { source: string })[] = [
    ...(data?.duplicateQueries.map((q) => ({ ...q, source: 'duplicate' })) ?? []),
    ...(data?.repeatedResearch.map((q) => ({ ...q, source: 'research' })) ?? []),
  ].sort((a, b) => b.potentialSavings - a.potentialSavings);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">
            Memory Reuse Opportunities
          </h3>
          {data && (
            <p className="mt-1 text-sm text-zinc-500">
              {allQueries.length} repeated queries found
              {' \u00b7 '}
              <span className="text-green-400">
                {data.totalPotentialSavings.toLocaleString()} tokens saveable
              </span>
            </p>
          )}
        </div>

        {/* Time range selector */}
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                timeRange === range
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
          Loading recommendations...
        </div>
      ) : allQueries.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
          No duplicate queries found in this time range.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                <th className="pb-3 pr-4 font-medium">Query</th>
                <th className="pb-3 pr-4 font-medium text-right">Freq</th>
                <th className="pb-3 pr-4 font-medium text-right">Tokens Used</th>
                <th className="pb-3 pr-4 font-medium text-right">Saveable</th>
                <th className="pb-3 pr-4 font-medium text-right">Similarity</th>
                <th className="pb-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {allQueries.map((q, i) => {
                const isCached = cachedIds.has(i);
                return (
                  <tr
                    key={i}
                    className="border-b border-zinc-800/50 last:border-0"
                  >
                    <td className="max-w-xs truncate py-3 pr-4 text-zinc-300">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            q.source === 'duplicate'
                              ? 'bg-red-500'
                              : 'bg-yellow-500'
                          }`}
                        />
                        {q.query}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-zinc-400">
                      {q.frequency}x
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-red-400">
                      {q.tokensConsumed.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-green-400">
                      {q.potentialSavings.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-zinc-400">
                      {(q.avgSimilarity * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 text-right">
                      {isCached ? (
                        <span className="inline-flex items-center rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400 ring-1 ring-green-500/20">
                          Cached
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCache(i)}
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-green-600 hover:bg-green-500/10 hover:text-green-400"
                        >
                          Cache This
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Workflows section */}
      {data && data.repeatedWorkflows.length > 0 && (
        <div className="mt-6 border-t border-zinc-800 pt-5">
          <h4 className="mb-3 text-sm font-medium text-zinc-400">
            Repeated Workflows
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.repeatedWorkflows.map((w, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3"
              >
                <p className="truncate text-sm text-zinc-300">
                  {w.workflowName}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{w.frequency}x runs</span>
                  <span className="font-mono text-red-400">
                    {w.totalCost.toLocaleString()} tokens
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
