'use client';

/**
 * PromptAnalyzer — Input area to paste a prompt and trigger analysis.
 *
 * Calls POST /api/prompts/analyze and POST /api/prompts/recommend,
 * then passes results to parent via onAnalysis callback.
 *
 * Refs #14, #15
 */

import { useState, useCallback } from 'react';
import type { PromptAnalysis, PromptRecommendation, PromptScorecard } from '@/types/prompt';

interface PromptAnalyzerProps {
  onAnalysis: (scorecard: PromptScorecard) => void;
  isLoading?: boolean;
}

export default function PromptAnalyzer({ onAnalysis, isLoading: externalLoading }: PromptAnalyzerProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoading = externalLoading || loading;

  const handleAnalyze = useCallback(async () => {
    if (!prompt.trim() || isLoading) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: Analyze
      const analyzeRes = await fetch('/api/prompts/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!analyzeRes.ok) {
        const errBody = await analyzeRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Analysis failed (${analyzeRes.status})`);
      }

      const analyzeData = await analyzeRes.json();
      const analysis: PromptAnalysis = analyzeData.data;

      // Step 2: Recommend
      const recommendRes = await fetch('/api/prompts/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, analysis }),
      });

      if (!recommendRes.ok) {
        const errBody = await recommendRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Recommendation failed (${recommendRes.status})`);
      }

      const recommendData = await recommendRes.json();
      const recommendation: PromptRecommendation = recommendData.data;

      onAnalysis({ analysis, recommendation });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [prompt, isLoading, onAnalysis]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Prompt Analyzer</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Paste a prompt to analyze verbosity, duplication, and context waste.
          </p>
        </div>
        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">
          {countTokensLocal(prompt)} tokens
        </span>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Paste your prompt here..."
        rows={8}
        className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleAnalyze}
          disabled={isLoading || !prompt.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <LoadingSpinner />
              Analyzing...
            </>
          ) : (
            'Analyze Prompt'
          )}
        </button>

        <button
          onClick={() => {
            setPrompt('');
            setError(null);
          }}
          disabled={isLoading}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/** Client-side token estimation (same heuristic as the service) */
function countTokensLocal(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return Math.ceil(normalized.length / 4);
}
