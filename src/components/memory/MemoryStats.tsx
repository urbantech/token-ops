'use client';

/**
 * MemoryStats
 *
 * Stat cards displaying: total memories, reuse rate %, tokens saved,
 * and top memory categories.
 *
 * Issues #17 and #18
 */

import { useState, useEffect } from 'react';
import type { MemoryStats as MemoryStatsType } from '@/types/memory';

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  accentClass?: string;
}

function StatCard({ label, value, subtext, accentClass = 'text-zinc-100' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${accentClass}`}>
        {value}
      </p>
      {subtext && (
        <p className="mt-1 text-xs text-zinc-500">{subtext}</p>
      )}
    </div>
  );
}

export function MemoryStats() {
  const [stats, setStats] = useState<MemoryStatsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/memory/stats');
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        // Silently degrade
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900"
          />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const savingsPercent =
    stats.totalTokensConsumed > 0
      ? ((stats.totalTokensSaved / stats.totalTokensConsumed) * 100).toFixed(1)
      : '0';

  return (
    <div className="space-y-4">
      {/* Primary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Memories"
          value={stats.totalMemories.toLocaleString()}
          subtext="Across all categories"
        />
        <StatCard
          label="Reuse Rate"
          value={`${stats.reuseRate}%`}
          subtext="Requests served from cache"
          accentClass="text-green-400"
        />
        <StatCard
          label="Tokens Saved"
          value={stats.totalTokensSaved.toLocaleString()}
          subtext={`${savingsPercent}% of total consumption`}
          accentClass="text-green-400"
        />
        <StatCard
          label="Avg Confidence"
          value={`${(stats.avgConfidence * 100).toFixed(1)}%`}
          subtext="Duplicate detection accuracy"
        />
      </div>

      {/* Category breakdown */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Top Categories
        </p>
        <div className="flex flex-wrap gap-2">
          {stats.topCategories.map((cat) => (
            <span
              key={cat.category}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-xs"
            >
              <span className="font-medium text-zinc-300">
                {cat.category}
              </span>
              <span className="text-zinc-500">
                {cat.count.toLocaleString()} ({cat.percentage.toFixed(1)}%)
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
