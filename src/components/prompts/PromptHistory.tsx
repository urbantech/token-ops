'use client';

/**
 * PromptHistory — Table of recently analyzed prompts with scores.
 * Uses mock data for the MVP.
 *
 * Refs #14
 */

import { Classification } from '@/types/telemetry';
import type { PromptHistoryEntry } from '@/types/prompt';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_HISTORY: PromptHistoryEntry[] = [
  {
    id: 'pa_hist_001',
    promptPreview: 'Please make sure to implement the user authentication flow with JWT tokens...',
    tokenCount: 847,
    overallScore: 62,
    verbosityScore: 71,
    duplicationScore: 45,
    contextWasteScore: 68,
    classification: Classification.UPDATING_CODE,
    tokenReduction: 203,
    tokenReductionPercent: 24,
    analyzedAt: '2026-06-14T10:30:00Z',
  },
  {
    id: 'pa_hist_002',
    promptPreview: 'Fix the bug where the dashboard crashes when loading analytics data...',
    tokenCount: 312,
    overallScore: 28,
    verbosityScore: 22,
    duplicationScore: 15,
    contextWasteScore: 42,
    classification: Classification.FIXING_ISSUES,
    tokenReduction: 41,
    tokenReductionPercent: 13,
    analyzedAt: '2026-06-14T09:15:00Z',
  },
  {
    id: 'pa_hist_003',
    promptPreview: 'I would like you to brainstorm ideas for improving the onboarding experience...',
    tokenCount: 1_203,
    overallScore: 55,
    verbosityScore: 65,
    duplicationScore: 38,
    contextWasteScore: 58,
    classification: Classification.BRAINSTORMING,
    tokenReduction: 298,
    tokenReductionPercent: 25,
    analyzedAt: '2026-06-13T16:45:00Z',
  },
  {
    id: 'pa_hist_004',
    promptPreview: 'Update the API spec to include the new /prompts/analyze endpoint with...',
    tokenCount: 2_450,
    overallScore: 78,
    verbosityScore: 82,
    duplicationScore: 71,
    contextWasteScore: 80,
    classification: Classification.UPDATING_SPECS,
    tokenReduction: 812,
    tokenReductionPercent: 33,
    analyzedAt: '2026-06-13T14:20:00Z',
  },
  {
    id: 'pa_hist_005',
    promptPreview: 'For each file in the components directory do the same refactoring to use...',
    tokenCount: 530,
    overallScore: 44,
    verbosityScore: 35,
    duplicationScore: 60,
    contextWasteScore: 38,
    classification: Classification.BATCH_COMMANDS,
    tokenReduction: 0,
    tokenReductionPercent: 0,
    analyzedAt: '2026-06-12T11:00:00Z',
  },
  {
    id: 'pa_hist_006',
    promptPreview: 'Remember to always validate input. Please ensure that you validate input...',
    tokenCount: 1_680,
    overallScore: 85,
    verbosityScore: 88,
    duplicationScore: 92,
    contextWasteScore: 74,
    classification: Classification.UPDATING_CODE,
    tokenReduction: 620,
    tokenReductionPercent: 37,
    analyzedAt: '2026-06-12T08:30:00Z',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PromptHistory() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-100">Recent Analyses</h2>
        <p className="mt-1 text-sm text-zinc-400">
          History of recently analyzed prompts and their optimization scores.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="pb-3 pr-4 font-medium text-zinc-400">Prompt</th>
              <th className="pb-3 px-3 font-medium text-zinc-400 text-right">Tokens</th>
              <th className="pb-3 px-3 font-medium text-zinc-400 text-center">Overall</th>
              <th className="pb-3 px-3 font-medium text-zinc-400 text-center">Verbose</th>
              <th className="pb-3 px-3 font-medium text-zinc-400 text-center">Duplication</th>
              <th className="pb-3 px-3 font-medium text-zinc-400 text-center">Ctx Waste</th>
              <th className="pb-3 px-3 font-medium text-zinc-400">Type</th>
              <th className="pb-3 px-3 font-medium text-zinc-400 text-right">Savings</th>
              <th className="pb-3 pl-3 font-medium text-zinc-400 text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_HISTORY.map((entry) => (
              <tr key={entry.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="py-3 pr-4">
                  <span className="block max-w-xs truncate text-zinc-300" title={entry.promptPreview}>
                    {entry.promptPreview}
                  </span>
                </td>
                <td className="py-3 px-3 text-right font-mono text-zinc-400">
                  {entry.tokenCount.toLocaleString()}
                </td>
                <td className="py-3 px-3 text-center">
                  <ScoreBadge value={entry.overallScore} />
                </td>
                <td className="py-3 px-3 text-center">
                  <ScoreBadge value={entry.verbosityScore} />
                </td>
                <td className="py-3 px-3 text-center">
                  <ScoreBadge value={entry.duplicationScore} />
                </td>
                <td className="py-3 px-3 text-center">
                  <ScoreBadge value={entry.contextWasteScore} />
                </td>
                <td className="py-3 px-3">
                  <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                    {formatClassification(entry.classification)}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  {entry.tokenReduction > 0 ? (
                    <span className="text-emerald-400">-{entry.tokenReductionPercent}%</span>
                  ) : (
                    <span className="text-zinc-600">--</span>
                  )}
                </td>
                <td className="py-3 pl-3 text-right text-zinc-500">
                  {formatDate(entry.analyzedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreBadge({ value }: { value: number }) {
  let colorClass: string;
  if (value < 50) {
    colorClass = 'bg-emerald-900/50 text-emerald-400';
  } else if (value < 80) {
    colorClass = 'bg-amber-900/50 text-amber-400';
  } else {
    colorClass = 'bg-red-900/50 text-red-400';
  }

  return (
    <span className={`inline-flex min-w-[2.5rem] justify-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatClassification(classification: string): string {
  return classification
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
