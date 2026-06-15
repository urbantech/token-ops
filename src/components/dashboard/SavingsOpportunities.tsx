'use client';

import { useState } from 'react';
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
  opportunities = mockSavingsOpportunities,
  className,
  onOpportunityClick,
}: SavingsOpportunitiesProps) {
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
