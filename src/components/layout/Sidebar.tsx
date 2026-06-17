'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  DollarSign,
  MessageSquare,
  Brain,
  GitBranch,
  Bot,
  ShieldCheck,
  FileBarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Trophy,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: string | number | null
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/spend', label: 'AI Spend', icon: DollarSign, badge: null },
  { href: '/dashboard/prompts', label: 'Prompts', icon: MessageSquare },
  { href: '/dashboard/memory', label: 'Memory', icon: Brain },
  { href: '/dashboard/models', label: 'Model Routing', icon: GitBranch },
  { href: '/dashboard/agents', label: 'Agents', icon: Bot },
  { href: '/dashboard/governance', label: 'Governance', icon: ShieldCheck },
  { href: '/dashboard/reports', label: 'Reports', icon: FileBarChart },
  { href: '/leaderboard', label: 'Savings Leaderboard', icon: Trophy },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center gap-3 border-b border-zinc-800 p-4',
          collapsed && 'justify-center'
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-zinc-50">TokenOps</p>
            <p className="text-xs text-zinc-500">AI Cost Platform</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon
                className={cn('h-4 w-4 shrink-0', isActive && 'text-violet-400')}
              />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge != null && (
                    <Badge
                      variant="secondary"
                      className="h-5 min-w-5 px-1.5 text-xs"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center border-t border-zinc-800 p-3 text-zinc-500 hover:text-zinc-50 transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <div className="flex w-full items-center justify-between px-1 text-xs">
            <span>Collapse</span>
            <ChevronLeft className="h-4 w-4" />
          </div>
        )}
      </button>
    </aside>
  )
}
