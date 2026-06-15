'use client';

/**
 * PromptDiff — Side-by-side diff showing original vs optimized prompt
 * with highlighted changes.
 *
 * Refs #15
 */

import type { PromptRecommendation } from '@/types/prompt';

interface PromptDiffProps {
  original: string;
  recommendation: PromptRecommendation;
}

export default function PromptDiff({ original, recommendation }: PromptDiffProps) {
  const { revisedPrompt, tokenReduction, tokenReductionPercent, changes } = recommendation;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Optimization Diff</h2>
        {tokenReduction > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">
              Saved <span className="font-medium text-emerald-400">{tokenReduction}</span> tokens
            </span>
            <span className="rounded-full bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-400">
              -{tokenReductionPercent}%
            </span>
          </div>
        )}
      </div>

      {/* Side by side panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Original */}
        <div className="flex flex-col">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-zinc-300">Original</span>
            <span className="ml-auto text-xs text-zinc-500">{countTokens(original)} tokens</span>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
              {original}
            </pre>
          </div>
        </div>

        {/* Optimized */}
        <div className="flex flex-col">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-zinc-300">Optimized</span>
            <span className="ml-auto text-xs text-zinc-500">{countTokens(revisedPrompt)} tokens</span>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border border-emerald-900/30 bg-zinc-950 p-4">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
              {revisedPrompt}
            </pre>
          </div>
        </div>
      </div>

      {/* Changes list */}
      {changes.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-300">Changes Applied</h3>
          <ul className="space-y-1.5">
            {changes.map((change, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ChangeTypeBadge type={change.type} />
                <span className="text-zinc-400">
                  {change.description}
                  {change.tokensSaved > 0 && (
                    <span className="ml-1 text-emerald-400">(-{change.tokensSaved} tokens)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Copy button */}
      <div className="mt-4 flex justify-end">
        <CopyButton text={revisedPrompt} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChangeTypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    remove_redundancy: 'bg-red-900/50 text-red-400 border-red-800/50',
    compress_context: 'bg-blue-900/50 text-blue-400 border-blue-800/50',
    template_reuse: 'bg-purple-900/50 text-purple-400 border-purple-800/50',
    batch_conversion: 'bg-amber-900/50 text-amber-400 border-amber-800/50',
    shorten_instruction: 'bg-orange-900/50 text-orange-400 border-orange-800/50',
    deduplicate: 'bg-cyan-900/50 text-cyan-400 border-cyan-800/50',
  };

  const labelMap: Record<string, string> = {
    remove_redundancy: 'Redundancy',
    compress_context: 'Compress',
    template_reuse: 'Template',
    batch_conversion: 'Batch',
    shorten_instruction: 'Shorten',
    deduplicate: 'Dedup',
  };

  const colors = colorMap[type] || 'bg-zinc-800 text-zinc-400 border-zinc-700';
  const label = labelMap[type] || type;

  return (
    <span className={`mt-0.5 inline-flex shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      Copy Optimized
    </button>
  );
}

function countTokens(text: string): number {
  return Math.ceil(text.replace(/\s+/g, ' ').trim().length / 4);
}
