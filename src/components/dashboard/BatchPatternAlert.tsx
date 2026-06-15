'use client';

import { useState } from 'react';
import { X, Terminal, Sparkles, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { cn, formatCurrency, formatTokens } from '@/lib/utils';
import { mockBatchPatterns, type DetectedBatchPattern } from '@/lib/mock-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BatchPatternAlertProps {
  patterns?: DetectedBatchPattern[];
  totalSavings?: number;
  className?: string;
  onGenerateScript?: (pattern: DetectedBatchPattern) => void;
  onDismiss?: () => void;
}

// ---------------------------------------------------------------------------
// PatternRow
// ---------------------------------------------------------------------------

function PatternRow({
  pattern,
  onGenerateScript,
}: {
  pattern: DetectedBatchPattern;
  onGenerateScript?: (p: DetectedBatchPattern) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pattern.scriptTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-zinc-700/60 overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/50">
        <Terminal className="w-4 h-4 text-purple-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate">{pattern.pattern}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {pattern.frequency} occurrences &middot; {formatTokens(pattern.totalTokens)} tokens &middot;{' '}
            {formatCurrency(pattern.totalCost)} spent
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-green-400">
            Save {formatCurrency(pattern.estimatedSavings)}/mo
          </span>
          <button
            onClick={() => {
              onGenerateScript?.(pattern);
              setExpanded((e) => !e);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Generate Script
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded: sample prompts + script */}
      {expanded && (
        <div className="border-t border-zinc-700/60 px-4 py-4 space-y-4 bg-zinc-900">
          {/* Sample prompts */}
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              Sample Prompts
            </p>
            {pattern.samplePrompts.map((prompt, i) => (
              <p key={i} className="text-xs text-zinc-400 italic mb-1">
                &ldquo;{prompt}&rdquo;
              </p>
            ))}
          </div>

          {/* Script template */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                Generated Script
              </p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="text-xs font-mono text-zinc-300 bg-zinc-950 rounded-lg px-4 py-3 overflow-x-auto border border-zinc-800">
              {pattern.scriptTemplate}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BatchPatternAlert
// ---------------------------------------------------------------------------

export function BatchPatternAlert({
  patterns = mockBatchPatterns,
  totalSavings,
  className,
  onGenerateScript,
  onDismiss,
}: BatchPatternAlertProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const savings = totalSavings ?? patterns.reduce((s, p) => s + p.estimatedSavings, 0);
  const totalFrequency = patterns.reduce((s, p) => s + p.frequency, 0);

  if (dismissed || patterns.length === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-purple-500/30 bg-purple-500/5 overflow-hidden',
        className,
      )}
      role="alert"
    >
      {/* Banner */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
          <Terminal className="w-4 h-4 text-purple-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100">
            {patterns.length} repetitive pattern{patterns.length !== 1 ? 's' : ''} detected
            <span className="mx-2 text-zinc-600">&mdash;</span>
            <span className="text-green-400">potential savings: {formatCurrency(savings)}/month</span>
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {totalFrequency} total occurrences across {patterns.length} command patterns. Convert to scripts to eliminate redundant LLM calls.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Hide
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                View Patterns
              </>
            )}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Dismiss batch pattern alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pattern list */}
      {expanded && (
        <div className="border-t border-purple-500/20 px-5 py-4 space-y-3">
          {patterns.map((pattern) => (
            <PatternRow
              key={pattern.id}
              pattern={pattern}
              onGenerateScript={onGenerateScript}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default BatchPatternAlert;
