'use client'

import { ShieldCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils'

interface BudgetPolicy {
  id: string
  name: string
  target: string
  limitUsd: number
  spentUsd: number
  alertThreshold: number
  status: 'ok' | 'warning' | 'exceeded'
}

const POLICIES: BudgetPolicy[] = [
  { id: '1', name: 'Engineering Team', target: 'team:engineering', limitUsd: 500, spentUsd: 423.10, alertThreshold: 80, status: 'warning' },
  { id: '2', name: 'Cody (Lead Agent)', target: 'agent:cody-lead', limitUsd: 200, spentUsd: 318.42, alertThreshold: 90, status: 'exceeded' },
  { id: '3', name: 'Batch Processing', target: 'classification:batch', limitUsd: 100, spentUsd: 42.33, alertThreshold: 80, status: 'ok' },
  { id: '4', name: 'Research Agents', target: 'team:research', limitUsd: 150, spentUsd: 64.80, alertThreshold: 80, status: 'ok' },
]

const STATUS_CONFIG = {
  ok: { icon: CheckCircle, color: 'text-emerald-400', badge: 'success' as const },
  warning: { icon: AlertTriangle, color: 'text-amber-400', badge: 'warning' as const },
  exceeded: { icon: XCircle, color: 'text-red-400', badge: 'destructive' as const },
}

export default function GovernancePage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Governance</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Budget policies, spend controls, and compliance for your AI workforce.
          </p>
        </div>
        <ShieldCheck className="h-8 w-8 text-violet-400 opacity-50" />
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-emerald-800/50">
          <CardContent className="p-4">
            <p className="text-sm text-zinc-400">Policies OK</p>
            <p className="text-2xl font-bold text-emerald-400">2 / 4</p>
          </CardContent>
        </Card>
        <Card className="border-amber-800/50">
          <CardContent className="p-4">
            <p className="text-sm text-zinc-400">Near Limit</p>
            <p className="text-2xl font-bold text-amber-400">1 / 4</p>
          </CardContent>
        </Card>
        <Card className="border-red-800/50">
          <CardContent className="p-4">
            <p className="text-sm text-zinc-400">Exceeded</p>
            <p className="text-2xl font-bold text-red-400">1 / 4</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget policies */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Policies</CardTitle>
          <CardDescription>Monthly spend limits by team, agent, or classification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 pt-0">
          {POLICIES.map((policy) => {
            const config = STATUS_CONFIG[policy.status]
            const percent = Math.min((policy.spentUsd / policy.limitUsd) * 100, 100)
            const StatusIcon = config.icon

            return (
              <div key={policy.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 ${config.color}`} />
                    <span className="text-sm font-medium text-zinc-200">{policy.name}</span>
                    <code className="text-xs text-zinc-500 font-mono">{policy.target}</code>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-zinc-400">
                      {formatCurrency(policy.spentUsd)} / {formatCurrency(policy.limitUsd)}
                    </span>
                    <Badge variant={config.badge} className="capitalize">
                      {policy.status}
                    </Badge>
                  </div>
                </div>
                <Progress
                  value={percent}
                  className={`h-1.5 ${
                    policy.status === 'exceeded'
                      ? '[&>div]:bg-red-500'
                      : policy.status === 'warning'
                        ? '[&>div]:bg-amber-500'
                        : '[&>div]:bg-emerald-500'
                  }`}
                />
                <p className="text-xs text-zinc-600">
                  Alert at {policy.alertThreshold}% — {percent.toFixed(1)}% used
                </p>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
