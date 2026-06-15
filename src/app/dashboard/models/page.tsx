'use client'

import { GitBranch, ArrowRightLeft, TrendingDown, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface RoutingRule {
  id: string
  from: string
  to: string
  condition: string
  estimatedSavings: string
  status: 'active' | 'suggested' | 'paused'
}

const ROUTING_RULES: RoutingRule[] = [
  {
    id: '1',
    from: 'claude-opus-4-5',
    to: 'claude-haiku-3-5',
    condition: 'classification = batch_commands',
    estimatedSavings: '$120/mo',
    status: 'suggested',
  },
  {
    id: '2',
    from: 'gpt-4o',
    to: 'gpt-4o-mini',
    condition: 'tokens < 2000 AND classification != specs',
    estimatedSavings: '$68/mo',
    status: 'active',
  },
  {
    id: '3',
    from: 'claude-sonnet-4-5',
    to: 'gemini-2.0-flash',
    condition: 'classification = brainstorm AND latency_ok',
    estimatedSavings: '$45/mo',
    status: 'suggested',
  },
]

const STATUS_BADGE: Record<RoutingRule['status'], { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  active: { label: 'Active', variant: 'success' },
  suggested: { label: 'Suggested', variant: 'warning' },
  paused: { label: 'Paused', variant: 'secondary' },
}

export default function ModelsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-50">Model Routing</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Intelligently route requests to the right model tier based on task complexity and cost targets.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Active Rules', value: '2', icon: GitBranch },
          { label: 'Suggested Optimizations', value: '2', icon: Zap },
          { label: 'Estimated Monthly Savings', value: '$233/mo', icon: TrendingDown },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/10">
                <stat.icon className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-zinc-50">{stat.value}</p>
                <p className="text-xs text-zinc-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Routing rules */}
      <Card>
        <CardHeader>
          <CardTitle>Routing Rules</CardTitle>
          <CardDescription>
            Rules are evaluated top-to-bottom. First match wins.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-zinc-800">
            {ROUTING_RULES.map((rule) => {
              const badge = STATUS_BADGE[rule.status]
              return (
                <div
                  key={rule.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ArrowRightLeft className="h-4 w-4 shrink-0 text-zinc-500" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-mono text-amber-300">{rule.from}</code>
                        <span className="text-zinc-600 text-xs">→</span>
                        <code className="text-xs font-mono text-emerald-300">{rule.to}</code>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 font-mono truncate">
                        when {rule.condition}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-emerald-400">
                      {rule.estimatedSavings}
                    </span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
