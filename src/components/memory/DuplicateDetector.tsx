'use client';

/**
 * DuplicateDetector
 *
 * Interactive query input that checks whether a request has already been
 * answered and cached in memory. Shows similarity confidence and the
 * prior answer when a duplicate is found.
 *
 * Issue #17 — Duplicate Request Detection
 */

import { useState } from 'react';
import type { DuplicateDetectionResult } from '@/types/memory';

export function DuplicateDetector() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DuplicateDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDetect() {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/memory/detect-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Detection failed');
      }

      const data: DuplicateDetectionResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function confidenceColor(confidence: number): string {
    if (confidence >= 0.85) return 'text-red-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-green-400';
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h3 className="mb-4 text-lg font-semibold text-zinc-100">
        Duplicate Request Detector
      </h3>

      {/* Input area */}
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleDetect()}
          placeholder="Enter a query to check for duplicates..."
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none ring-zinc-600 transition focus:border-zinc-600 focus:ring-1"
        />
        <button
          onClick={handleDetect}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Checking...' : 'Detect'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      {/* Results */}
      {result && (
        <div className="mt-5 space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                result.isDuplicate
                  ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                  : 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
              }`}
            >
              {result.isDuplicate ? 'Duplicate Found' : 'Unique Request'}
            </span>

            <span className={`text-sm font-mono ${confidenceColor(result.confidence)}`}>
              {(result.confidence * 100).toFixed(1)}% confidence
            </span>

            {result.tokensSaved > 0 && (
              <span className="text-sm text-green-400">
                {result.tokensSaved.toLocaleString()} tokens saved
              </span>
            )}
          </div>

          {/* Confidence bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                result.isDuplicate ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${result.confidence * 100}%` }}
            />
          </div>

          {/* Prior answer */}
          {result.priorAnswer && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Cached Answer
              </p>
              <p className="text-sm leading-relaxed text-zinc-300">
                {result.priorAnswer}
              </p>
              {result.memoryReference && (
                <p className="mt-2 font-mono text-xs text-zinc-600">
                  ref: {result.memoryReference}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
