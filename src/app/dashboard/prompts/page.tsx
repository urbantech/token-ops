'use client';

/**
 * Prompt Optimization Dashboard
 *
 * Composes:
 *   - PromptAnalyzer  (top: input area)
 *   - PromptScorecard (middle: analysis gauges)
 *   - PromptDiff      (middle: side-by-side diff)
 *   - PromptHistory   (bottom: recent analyses table)
 *
 * Refs #14, #15
 */

import { useState } from 'react';
import PromptAnalyzer from '@/components/prompts/PromptAnalyzer';
import PromptScorecard from '@/components/prompts/PromptScorecard';
import PromptDiff from '@/components/prompts/PromptDiff';
import PromptHistory from '@/components/prompts/PromptHistory';
import type { PromptScorecard as PromptScorecardType } from '@/types/prompt';

export default function PromptsPage() {
  const [scorecard, setScorecard] = useState<PromptScorecardType | null>(null);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-50">Prompt Optimization</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Analyze prompts for inefficiencies and get optimized versions with measurable token savings.
          </p>
        </div>

        {/* Top: Analyzer input */}
        <section className="mb-6">
          <PromptAnalyzer onAnalysis={setScorecard} />
        </section>

        {/* Middle: Scorecard + Diff (shown after analysis) */}
        {scorecard && (
          <>
            <section className="mb-6">
              <PromptScorecard
                analysis={scorecard.analysis}
                recommendation={scorecard.recommendation}
              />
            </section>

            <section className="mb-6">
              <PromptDiff
                original={scorecard.analysis.originalPrompt}
                recommendation={scorecard.recommendation}
              />
            </section>
          </>
        )}

        {/* Bottom: History table */}
        <section>
          <PromptHistory />
        </section>
      </div>
    </div>
  );
}
