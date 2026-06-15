'use client';

import { useState } from 'react';
import { ArrowRight, TrendingDown, CheckCircle2, Sparkles } from 'lucide-react';
import { cn, formatCurrency, formatTokens } from '@/lib/utils';
import { mockModelComparisons, type ModelComparison } from '@/lib/mock-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelCostComparisonProps {
  data?: ModelComparison[];
  className?: string;
}

type SortKey = 'savingsAmount' | 'savingsPercent' | 'currentMonthlyCost';

// ---------------------------------------------------------------------------
// Provider badge
// ---------------------------------------------------------------------------

function ProviderBadge({ provider }: { provider: string }) {
  const isAnthropic = provider === 'Anthropic';
  return (
    <span
      className={cn(
        'text-xs px-1.5 py-0.5 rounded border font-medium',
        isAnthropic
          ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
          : 'bg-green-500/10 text-green-400 border-green-500/20',
      )}
    >
      {provider}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ModelCostComparison
// ---------------------------------------------------------------------------

export function ModelCostComparison({
  data = mockModelComparisons,
  className,
}: ModelCostComparisonProps) {
  const [sortKey, setSortKey] = useState<SortKey>('savingsAmount');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const sorted = [...data].sort((a, b) => b[sortKey] - a[sortKey]);

  const totalCurrentCost = data.reduce((s, r) => s + r.currentMonthlyCost, 0);
  const totalProjectedCost = data.reduce((s, r) => s + r.projectedMonthlyCost, 0);
  const totalSavings = data.reduce((s, r) => s + r.savingsAmount, 0);

  const SortBtn = ({ field, label }: { field: SortKey; label: string }) => (
    <button
      onClick={() => setSortKey(field)}
      className={cn(
        'text-xs px-2 py-1 rounded transition-colors',
        sortKey === field
          ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30'
          : 'text-zinc-500 hover:text-zinc-300',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className={cn('rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Model Cost Comparison</h3>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500 mr-1">Sort by:</span>
          <SortBtn field="savingsAmount" label="$ Savings" />
          <SortBtn field="savingsPercent" label="% Savings" />
          <SortBtn field="currentMonthlyCost" label="Current Cost" />
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-px bg-zinc-800 border-b border-zinc-800">
        {[
          { label: 'Current Monthly', value: formatCurrency(totalCurrentCost), color: 'text-zinc-200' },
          { label: 'Projected Monthly', value: formatCurrency(totalProjectedCost), color: 'text-blue-400' },
          { label: 'Potential Savings', value: formatCurrency(totalSavings), color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 px-4 py-3 text-center">
            <div className={cn('text-lg font-bold tabular-nums', color)}>{value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                Current Model
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                Current Cost
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  Recommended
                </span>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                Projected
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                Savings
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const rowKey = `${row.currentModel}-${idx}`;
              const isExpanded = expandedRow === rowKey;
              const isHighSavings = row.savingsAmount > 10;
              const isNoSavings = row.savingsAmount === 0;

              return (
                <>
                  <tr
                    key={rowKey}
                    className={cn(
                      'border-b border-zinc-800/50 cursor-pointer transition-colors',
                      isHighSavings && 'bg-green-500/5',
                      isExpanded ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/40',
                    )}
                    onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                  >
                    {/* Current model */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-zinc-200">{row.currentModel}</span>
                        <ProviderBadge provider={row.currentProvider} />
                      </div>
                    </td>

                    {/* Current cost */}
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-zinc-200 tabular-nums">
                        {formatCurrency(row.currentMonthlyCost)}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {formatTokens(row.currentMonthlyTokens)} tokens
                      </div>
                    </td>

                    {/* Recommended model */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {isNoSavings ? (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Already optimal
                          </span>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <ArrowRight className="w-3 h-3 text-violet-400 shrink-0" />
                              <span className="font-mono text-xs text-violet-300">{row.recommendedModel}</span>
                            </div>
                            <ProviderBadge provider={row.recommendedProvider} />
                          </>
                        )}
                      </div>
                    </td>

                    {/* Projected cost */}
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'font-semibold tabular-nums',
                        isNoSavings ? 'text-zinc-400' : 'text-blue-400',
                      )}>
                        {formatCurrency(row.projectedMonthlyCost)}
                      </span>
                    </td>

                    {/* Savings */}
                    <td className="px-4 py-3 text-right">
                      {isNoSavings ? (
                        <span className="text-zinc-600 text-xs">—</span>
                      ) : (
                        <div>
                          <div className="font-bold text-green-400 tabular-nums">
                            {formatCurrency(row.savingsAmount)}
                          </div>
                          <div className="text-xs text-green-600">
                            {row.savingsPercent.toFixed(0)}% less
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr key={`${rowKey}-detail`} className="bg-zinc-800/40 border-b border-zinc-800/50">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                            Use Case
                          </p>
                          <p className="text-sm text-zinc-300">{row.useCase}</p>
                          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mt-2">
                            Trade-offs
                          </p>
                          <p className="text-sm text-zinc-400">{row.tradeoffs}</p>
                          <div className="mt-2 text-xs text-zinc-500">
                            Cost per 1K tokens: {formatCurrency(row.currentCostPer1k, { decimals: 4 })} →{' '}
                            <span className="text-green-500">
                              {formatCurrency(row.recommendedCostPer1k, { decimals: 4 })}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-zinc-800">
        <p className="text-xs text-zinc-500">
          Click any row to see use case details and trade-off analysis.
        </p>
      </div>
    </div>
  );
}

export default ModelCostComparison;
