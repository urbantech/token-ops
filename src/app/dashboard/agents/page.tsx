'use client'

import { Bot, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CostTracker } from '@/components/dashboard/CostTracker'

export default function AgentsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-50">Agent Workforce Analytics</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Cost attribution, efficiency scores, and optimization opportunities per agent.
        </p>
      </div>

      {/* Top-level stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Agents', value: '13', icon: Bot, sub: '4 frontier, 9 mini' },
          { label: 'Total Spend', value: '$847', icon: TrendingUp, sub: 'This month' },
          { label: 'Avg Cost/Agent', value: '$65.15', icon: Activity, sub: 'Per month' },
          { label: 'Most Expensive', value: 'cody-lead', icon: TrendingDown, sub: '$318.42 this month' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                <stat.icon className="h-5 w-5 text-zinc-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-zinc-50">{stat.value}</p>
                <p className="text-xs text-zinc-400">{stat.label}</p>
                <p className="text-xs text-zinc-600">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cost tracker component (ported from core) */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Cost Breakdown</CardTitle>
          <CardDescription>Live cost tracking with 10s polling. Sorted by cost descending.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <CostTracker projectId="default" />
        </CardContent>
      </Card>
    </div>
  )
}
