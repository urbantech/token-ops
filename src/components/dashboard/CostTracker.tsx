'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, AlertCircle, RefreshCw, Bot } from 'lucide-react';
import { cn, formatCurrency, formatTokens } from '@/lib/utils';
import { mockAgentCosts, mockTotalCost, type AgentCostRow } from '@/lib/mock-data';
import { Classification } from '@/types/telemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostTrackerProps {
  projectId?: string;
  refreshInterval?: number;
  warningThreshold?: number;
  errorThreshold?: number;
  className?: string;
}

interface CostAlert {
  level: 'warning' | 'error';
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLASSIFICATION_LABELS: Record<Classification, string> = {
  [Classification.UPDATING_SPECS]: 'Updating Specs',
  [Classification.BRAINSTORMING]: 'Brainstorming',
  [Classification.UPDATING_CODE]: 'Updating Code',
  [Classification.FIXING_ISSUES]: 'Fixing Issues',
  [Classification.BATCH_COMMANDS]: 'Batch Commands',
};

const CLASSIFICATION_COLORS: Record<Classification, string> = {
  [Classification.UPDATING_SPECS]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  [Classification.BRAINSTORMING]: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  [Classification.UPDATING_CODE]: 'bg-green-500/20 text-green-400 border-green-500/30',
  [Classification.FIXING_ISSUES]: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  [Classification.BATCH_COMMANDS]: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function getCostAlert(cost: number, warningThreshold: number, errorThreshold: number): CostAlert | null {
  if (cost >= errorThreshold) {
    return {
      level: 'error',
      message: `Total cost has exceeded $${errorThreshold.toFixed(0)}. Consider pausing non-critical agents.`,
    };
  }
  if (cost >= warningThreshold) {
    return {
      level: 'warning',
      message: `Spend is approaching $${warningThreshold.toFixed(0)}. Monitor closely.`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TrendBadge({ trend, percent }: { trend: AgentCostRow['trend']; percent: number }) {
  if (trend === 'stable') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
        <Minus className="w-3 h-3" />
        {percent.toFixed(1)}%
      </span>
    );
  }
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400">
        <TrendingUp className="w-3 h-3" />
        +{percent.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-400">
      <TrendingDown className="w-3 h-3" />
      -{percent.toFixed(1)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// CostTracker
// ---------------------------------------------------------------------------

export function CostTracker({
  projectId: _projectId,
  refreshInterval = 10_000,
  warningThreshold = 5,
  errorThreshold = 10,
  className,
}: CostTrackerProps) {
  const [agents, setAgents] = useState<AgentCostRow[]>([]);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [alert, setAlert] = useState<CostAlert | null>(null);
  const [sortField, setSortField] = useState<keyof AgentCostRow>('cost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        '/api/analytics/spend?start=2026-06-01T00:00:00Z&end=2026-06-30T23:59:59Z&groupBy=model',
      );
      if (res.ok) {
        const json = await res.json();
        const breakdowns: Array<{
          category: string;
          totalCost: number;
          totalTokens: number;
          eventCount: number;
          percentage: number;
        }> = json?.data?.breakdowns ?? [];
        if (breakdowns.length > 0) {
          const rows: AgentCostRow[] = breakdowns.map((bd) => ({
            name: bd.category,
            model: bd.category,
            provider: bd.category.includes('claude') ? 'Anthropic' : 'OpenAI',
            tokens: bd.totalTokens,
            promptTokens: Math.round(bd.totalTokens * 0.65),
            completionTokens: Math.round(bd.totalTokens * 0.35),
            cost: bd.totalCost,
            requests: bd.eventCount,
            classification: Classification.UPDATING_CODE,
            trend: 'stable' as const,
            trendPercent: 0,
          }));
          const apiTotal: number = json?.data?.totalCost ?? rows.reduce((s, r) => s + r.cost, 0);
          setAgents(rows);
          setTotalCost(apiTotal);
          setAlert(getCostAlert(apiTotal, warningThreshold, errorThreshold));
          setLastRefreshed(new Date());
          setLoading(false);
          return;
        }
      }
    } catch {
      // fall through to mock data
    }
    setAgents(mockAgentCosts);
    setTotalCost(mockTotalCost);
    setAlert(getCostAlert(mockTotalCost, warningThreshold, errorThreshold));
    setLastRefreshed(new Date());
    setLoading(false);
  }, [warningThreshold, errorThreshold]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, refreshInterval);
    return () => clearInterval(id);
  }, [fetchData, refreshInterval]);

  const sorted = [...agents].sort((a, b) => {
    const va = a[sortField] as number | string;
    const vb = b[sortField] as number | string;
    const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb));
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const handleSort = (field: keyof AgentCostRow) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: keyof AgentCostRow }) => {
    if (field !== sortField) return <span className="text-zinc-600 ml-1">↕</span>;
    return <span className="text-violet-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className={cn('rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-violet-400" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Agent Cost Breakdown</h3>
            {lastRefreshed && (
              <p className="text-xs text-zinc-500">
                Updated {lastRefreshed.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Total cost pill */}
          <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-1.5">
            <span className="text-xs text-zinc-400">Total</span>
            <span className="text-sm font-bold text-zinc-100">{formatCurrency(totalCost)}</span>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label="Refresh cost data"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {alert && (
        <div
          className={cn(
            'flex items-start gap-3 px-6 py-3 text-sm',
            alert.level === 'error'
              ? 'bg-red-500/10 text-red-400 border-b border-red-500/20'
              : 'bg-amber-500/10 text-amber-400 border-b border-amber-500/20',
          )}
          role="alert"
        >
          {alert.level === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {[
                { key: 'name' as keyof AgentCostRow, label: 'Agent' },
                { key: 'model' as keyof AgentCostRow, label: 'Model' },
                { key: 'classification' as keyof AgentCostRow, label: 'Category' },
                { key: 'tokens' as keyof AgentCostRow, label: 'Tokens' },
                { key: 'requests' as keyof AgentCostRow, label: 'Requests' },
                { key: 'cost' as keyof AgentCostRow, label: 'Cost' },
                { key: 'trendPercent' as keyof AgentCostRow, label: 'Trend' },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-300 transition-colors select-none whitespace-nowrap',
                    key === 'tokens' || key === 'requests' || key === 'cost' ? 'text-right' : '',
                  )}
                  onClick={() => handleSort(key)}
                >
                  {label}
                  <SortIcon field={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && agents.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-zinc-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  No agent cost data available
                </td>
              </tr>
            ) : (
              sorted.map((agent, idx) => (
                <tr
                  key={agent.name}
                  className={cn(
                    'border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors',
                    idx === sorted.length - 1 && 'border-b-0',
                  )}
                >
                  <td className="px-4 py-3 font-medium text-zinc-100 whitespace-nowrap">{agent.name}</td>
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap font-mono text-xs">{agent.model}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
                        CLASSIFICATION_COLORS[agent.classification],
                      )}
                    >
                      {CLASSIFICATION_LABELS[agent.classification]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                    {formatTokens(agent.tokens)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                    {agent.requests.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-100 tabular-nums">
                    {formatCurrency(agent.cost)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <TrendBadge trend={agent.trend} percent={agent.trendPercent} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-700">
                <td className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-200 tabular-nums">
                  {formatTokens(agents.reduce((s, a) => s + a.tokens, 0))}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-200 tabular-nums">
                  {agents.reduce((s, a) => s + a.requests, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-violet-400 tabular-nums">
                  {formatCurrency(totalCost)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default CostTracker;
