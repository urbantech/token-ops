'use client'

import Link from 'next/link'
import {
  DollarSign,
  TrendingUp,
  Bot,
  Brain,
  ArrowRight,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CostTrendChart } from '@/components/dashboard/CostTrendChart'
import { SavingsOpportunities } from '@/components/dashboard/SavingsOpportunities'

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: string
  sub: string
  icon: React.ElementType
  trend?: { label: string; up: boolean }
  href?: string
}

function StatCard({ title, value, sub, icon: Icon, trend, href }: StatCardProps) {
  const content = (
    <Card className="group hover:border-zinc-700 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400">{title}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 group-hover:bg-violet-600/20 transition-colors">
          <Icon className="h-4 w-4 text-zinc-400 group-hover:text-violet-400 transition-colors" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-zinc-50 tabular-nums">{value}</div>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-xs text-zinc-500">{sub}</p>
          {trend && (
            <span
              className={`text-xs font-medium ${
                trend.up ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {trend.up ? '+' : ''}{trend.label}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    )
  }
  return content
}

// ─── Quick links ──────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  {
    href: '/dashboard/spend',
    label: 'View AI Spend Intelligence',
    description: 'Full cost breakdown by agent, model, and classification',
    icon: DollarSign,
  },
  {
    href: '/dashboard/prompts',
    label: 'Optimize Prompts',
    description: 'Reduce token waste through prompt compression and deduplication',
    icon: Zap,
  },
  {
    href: '/dashboard/memory',
    label: 'Memory Optimization',
    description: 'Detect and eliminate redundant ZeroMemory entries',
    icon: Brain,
  },
  {
    href: '/dashboard/agents',
    label: 'Agent Workforce Analytics',
    description: 'Cost attribution and efficiency scores per agent',
    icon: Bot,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Summary stats */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          This Month
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total AI Spend"
            value="$847.32"
            sub="vs $612.14 last month"
            icon={DollarSign}
            trend={{ label: '38.4%', up: true }}
            href="/dashboard/spend"
          />
          <StatCard
            title="Total Tokens"
            value="142.8M"
            sub="across all models"
            icon={TrendingUp}
            trend={{ label: '22.1%', up: true }}
          />
          <StatCard
            title="Active Agents"
            value="13"
            sub="running this month"
            icon={Bot}
            href="/dashboard/agents"
          />
          <StatCard
            title="Potential Savings"
            value="$214/mo"
            sub="identified by analysis"
            icon={Brain}
            trend={{ label: '25% reducible', up: false }}
            href="/dashboard/spend"
          />
        </div>
      </section>

      {/* Charts row */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CostTrendChart />
        </div>
        <div>
          <SavingsOpportunities />
        </div>
      </section>

      {/* Quick links */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Quick Navigation
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="group h-full hover:border-zinc-700 transition-colors cursor-pointer">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600/10 group-hover:bg-violet-600/20 transition-colors">
                    <link.icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-100 group-hover:text-violet-300 transition-colors">
                        {link.label}
                      </p>
                      <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-violet-400 transition-colors shrink-0 ml-2" />
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                      {link.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
