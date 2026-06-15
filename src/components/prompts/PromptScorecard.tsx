'use client';

/**
 * PromptScorecard — Circular progress indicators for verbosity,
 * duplication, context waste, and overall score.
 *
 * Uses Recharts RadialBarChart for the gauge visualization.
 *
 * Refs #14
 */

import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import type { PromptAnalysis, PromptRecommendation } from '@/types/prompt';

interface PromptScorecardProps {
  analysis: PromptAnalysis;
  recommendation: PromptRecommendation;
}

export default function PromptScorecard({ analysis, recommendation }: PromptScorecardProps) {
  const scores = [
    {
      label: 'Verbosity',
      value: analysis.verbosityScore,
      description: 'How verbose the prompt is relative to its intent',
    },
    {
      label: 'Duplication',
      value: analysis.duplicationScore,
      description: 'Semantic similarity to repeated instructions',
    },
    {
      label: 'Context Waste',
      value: analysis.contextWasteScore,
      description: 'Ratio of context tokens to useful output',
    },
    {
      label: 'Overall Waste',
      value: analysis.overallScore,
      description: 'Weighted composite score (lower is better)',
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Scorecard</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Lower waste scores indicate a more efficient prompt.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-400">
            {analysis.tokenCount} tokens
          </span>
          {recommendation.tokenReduction > 0 && (
            <span className="rounded-full bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-400">
              -{recommendation.tokenReductionPercent}% potential savings
            </span>
          )}
        </div>
      </div>

      {/* Score gauges */}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {scores.map((score) => (
          <ScoreGauge key={score.label} {...score} />
        ))}
      </div>

      {/* Classification + details */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
          {formatClassification(analysis.classification)}
        </span>
        {analysis.repeatedInstructions.length > 0 && (
          <span className="rounded-full border border-amber-800/50 bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-400">
            {analysis.repeatedInstructions.length} repeated instruction{analysis.repeatedInstructions.length > 1 ? 's' : ''}
          </span>
        )}
        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">
          Quality estimate: {recommendation.performanceEstimate}/100
        </span>
      </div>

      {/* Repeated instructions detail */}
      {analysis.repeatedInstructions.length > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-300">Repeated Instructions</h3>
          <ul className="space-y-2">
            {analysis.repeatedInstructions.map((ri, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="text-zinc-400">
                  <span className="text-zinc-300">&quot;{truncate(ri.text, 80)}&quot;</span>
                  {' '} -- repeated {ri.count}x, wasting ~{ri.wastedTokens} tokens
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScoreGauge — single radial bar
// ---------------------------------------------------------------------------

interface ScoreGaugeProps {
  label: string;
  value: number;
  description: string;
}

function ScoreGauge({ label, value, description }: ScoreGaugeProps) {
  const color = getScoreColor(value);
  const data = [{ name: label, value, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={data}
            barSize={8}
          >
            <RadialBar
              background={{ fill: '#27272a' }}
              dataKey="value"
              cornerRadius={4}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pt-2">
          <span className="text-2xl font-bold" style={{ color }}>
            {value}
          </span>
        </div>
      </div>
      <span className="mt-1 text-sm font-medium text-zinc-200">{label}</span>
      <span className="mt-0.5 text-center text-xs text-zinc-500">{description}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(value: number): string {
  // For waste scores: low = green (good), high = red (bad)
  if (value < 50) return '#22c55e'; // green-500
  if (value < 80) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

function formatClassification(classification: string): string {
  return classification
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}
