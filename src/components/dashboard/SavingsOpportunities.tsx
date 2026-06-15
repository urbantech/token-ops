'use client';

import { useState, useEffect } from 'react';
import {
  Copy,
  Zap,
  Terminal,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  DollarSign,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  mockSavingsOpportunities,
  type SavingsOpportunity,
} from '@/lib/mock-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavingsOpportunitiesProps {
  opportunities?: SavingsOpportunity[];
  className?: string;
  onOpportunityClick?: (opp: SavingsOpportunity) => void;
}

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICONS: Record<SavingsOpportunity['type'], React.ElementType> = {
  duplicate_prompts: Copy,
  expensive_models: Zap,
  batch_patterns: Terminal,
  memory_reuse: BrainCircuit,
};

const ICON_COLORS: Record<SavingsOpportunity['type'], string> = {
  duplicate_prompts: 'text-blue-400 bg-blue-500/10',
  expensive_models: 'text-amber-400 bg-amber-500/10',
  batch_patterns: 'text-purple-400 bg-purple-500/10',
  memory_reuse: 'text-green-400 bg-green-500/10',
};

const PRIORITY_STYLES: Record<SavingsOpportunity['priority'], { badge: string; ring: string }> = {
  high: {
    badge: 'bg-red-500/10 text-red-400 border border-red-500/20',
    ring: 'ring-red-500/20',
  },
  medium: {
    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    ring: 'ring-amber-500/20',
  },
  low: {
    badge: 'bg-zinc-700 text-zinc-400 border border-zinc-600',
    ring: 'ring-zinc-700/40',
  },
};

// ---------------------------------------------------------------------------
// OpportunityCard
// ---------------------------------------------------------------------------

function OpportunityCard({
  opportunity,
  onClick,
}: {
  opportunity: SavingsOpportunity;
  onClick?: (opp: SavingsOpportunity) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICONS[opportunity.type];
  const iconStyle = ICON_COLORS[opportunity.type];
  const priorityStyle = PRIORITY_STYLES[opportunity.priority];

  const handleToggle = () => {
    setExpanded((e) => !e);
    onClick?.(opportunity);
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden ring-1',
        priorityStyle.ring,
        'transition-shadow hover:shadow-lg hover:shadow-black/30',
      )}
    >
      {/* Card header — always visible */}
      <button
        onClick={handleToggle}
        className="w-full text-left px-5 py-4 flex items-start gap-4"
        aria-expanded={expanded}
      >
        {/* Icon */}
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', iconStyle)}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-sm font-semibold text-zinc-100 truncate">{opportunity.title}</h4>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cn('text-xs px-1.5 py-0.5 rounded font-medium capitalize', priorityStyle.badge)}
              >
                {opportunity.priority}
              </span>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mb-3">{opportunity.subtitle}</p>

          {/* Stats row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500">Instances:</span>
              <span className="text-xs font-semibold text-zinc-200">{opportunity.count.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3 h-3 text-green-400" />
              <span className="text-xs font-bold text-green-400">
                Save {formatCurrency(opportunity.estimatedSavingsMonthly)}/mo
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-zinc-800 px-5 py-4 space-y-2 bg-zinc-800/30">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Details</p>
          {opportunity.details.map((detail, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-zinc-300">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
              <span>{detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SavingsOpportunities
// ---------------------------------------------------------------------------

export function SavingsOpportunities({
  opportunities: opportunitiesProp,
  className,
  onOpportunityClick,
}: SavingsOpportunitiesProps) {
  const [opportunities, setOpportunities] = useState<SavingsOpportunity[]>(
    opportunitiesProp ?? mockSavingsOpportunities,
  );

  useEffect(() => {
    // If a parent passed explicit opportunities, use those directly.
    if (opportunitiesProp !== undefined) {
      setOpportunities(opportunitiesProp);
      return;
    }

    let cancelled = false;

    async function fetchOpportunities() {
      const SPEND_URL =
        '/api/analytics/spend?start=2026-06-01T00:00:00Z&end=2026-06-30T23:59:59Z&groupBy=model';
      const BATCH_URL = '/api/analytics/batch-patterns?threshold=3';
      const MEMORY_URL = '/api/memory/stats';

      const [memoryResult, spendResult, batchResult] = await Promise.allSettled([
        fetch(MEMORY_URL).then((r) => r.json()),
        fetch(SPEND_URL).then((r) => r.json()),
        fetch(BATCH_URL).then((r) => r.json()),
      ]);

      if (cancelled) return;

      // Determine per-category data availability.
      const memoryData =
        memoryResult.status === 'fulfilled' && memoryResult.value?.success
          ? memoryResult.value.data
          : null;

      const spendData =
        spendResult.status === 'fulfilled' && spendResult.value?.success
          ? spendResult.value.data
          : null;

      const batchData =
        batchResult.status === 'fulfilled' &&
        batchResult.value?.success &&
        Array.isArray(batchResult.value.data) &&
        batchResult.value.data.length > 0
          ? (batchResult.value.data as Array<{ totalCost: number }>)
          : null;

      // If everything failed, keep the mock defaults.
      if (!memoryData && !spendData && !batchData) return;

      const built: SavingsOpportunity[] = [];

      // duplicate_prompts — from memory stats
      if (memoryData && typeof memoryData.duplicateCount === 'number') {
        const dupCount: number = memoryData.duplicateCount;
        const dupSavings: number = memoryData.estimatedSavings ?? dupCount * 0.06;
        built.push({
          id: 'dup-prompts',
          type: 'duplicate_prompts',
          title: 'Duplicate Prompts',
          subtitle: 'Identical or near-identical requests detected',
          count: dupCount,
          estimatedSavingsMonthly: dupSavings,
          priority: dupCount > 100 ? 'high' : dupCount > 30 ? 'medium' : 'low',
          details: [
            `${dupCount} duplicate requests identified in the last 30 days`,
            'Response caching could eliminate the majority of duplicates',
          ],
        });
      } else {
        built.push(mockSavingsOpportunities.find((o) => o.type === 'duplicate_prompts')!);
      }

      // expensive_models — from spend breakdown by model
      if (spendData && Array.isArray(spendData.breakdowns)) {
        const EXPENSIVE_MODELS = ['claude-opus', 'gpt-4o', 'gpt-4-turbo'];
        const expensiveCount: number = (spendData.breakdowns as Array<{ category: string }>).filter(
          (b) => EXPENSIVE_MODELS.some((m) => b.category?.toLowerCase().includes(m)),
        ).length;
        const expensiveSavings: number = spendData.totalCost ? spendData.totalCost * 0.45 : 0;
        built.push({
          id: 'expensive-models',
          type: 'expensive_models',
          title: 'Expensive Models',
          subtitle: 'Models that could be downgraded for common tasks',
          count: expensiveCount || 1,
          estimatedSavingsMonthly: expensiveSavings,
          priority: expensiveSavings > 20 ? 'high' : expensiveSavings > 5 ? 'medium' : 'low',
          details: [
            `${expensiveCount} model(s) with cheaper alternatives detected`,
            'Downgrading to smaller models can save 40-85% per call',
          ],
        });
      } else {
        built.push(mockSavingsOpportunities.find((o) => o.type === 'expensive_models')!);
      }

      // batch_patterns — from batch-patterns API
      if (batchData) {
        const batchCount = batchData.length;
        const batchSavings = batchData.reduce((s, p) => s + p.totalCost * 0.75, 0);
        built.push({
          id: 'batch-patterns',
          type: 'batch_patterns',
          title: 'Batch Patterns',
          subtitle: 'Repetitive commands that could be scripted',
          count: batchCount,
          estimatedSavingsMonthly: batchSavings,
          priority: batchCount >= 5 ? 'medium' : 'low',
          details: [
            `${batchCount} repetitive command pattern${batchCount !== 1 ? 's' : ''} detected this month`,
            'Converting to batch scripts reduces per-call overhead by ~60%',
          ],
        });
      } else {
        built.push(mockSavingsOpportunities.find((o) => o.type === 'batch_patterns')!);
      }

      // memory_reuse — from memory stats
      if (memoryData && typeof memoryData.reuseOpportunities === 'number') {
        const reuseCount: number = memoryData.reuseOpportunities;
        const reuseSavings: number = memoryData.reuseSavings ?? reuseCount * 0.087;
        built.push({
          id: 'memory-reuse',
          type: 'memory_reuse',
          title: 'Memory Reuse',
          subtitle: 'Cached context available but not utilised',
          count: reuseCount,
          estimatedSavingsMonthly: reuseSavings,
          priority: reuseCount > 40 ? 'medium' : 'low',
          details: [
            `${reuseCount} conversations reloading identical context from scratch`,
            'ZeroMemory semantic cache can eliminate repeat context loads',
          ],
        });
      } else {
        built.push(mockSavingsOpportunities.find((o) => o.type === 'memory_reuse')!);
      }

      setOpportunities(built);
    }

    fetchOpportunities().catch(() => {
      // On unexpected error keep mock data already set in initial state.
    });

    return () => {
      cancelled = true;
    };
  }, [opportunitiesProp]);

  const totalSavings = opportunities.reduce((s, o) => s + o.estimatedSavingsMonthly, 0);
  const highCount = opportunities.filter((o) => o.priority === 'high').length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Savings Opportunities</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {highCount} high-priority item{highCount !== 1 ? 's' : ''} requiring attention
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
          <DollarSign className="w-4 h-4 text-green-400" />
          <div>
            <div className="text-sm font-bold text-green-400 tabular-nums">
              {formatCurrency(totalSavings)}/mo
            </div>
            <div className="text-xs text-green-600">available savings</div>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            onClick={onOpportunityClick}
          />
        ))}
      </div>
    </div>
  );
}

export default SavingsOpportunities;
