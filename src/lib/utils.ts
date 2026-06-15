import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatCurrency(
  amountUsd: number,
  opts: { compact?: boolean; decimals?: number } = {}
): string {
  const { compact = false, decimals = 2 } = opts
  if (compact) {
    if (amountUsd >= 1000) return `$${(amountUsd / 1000).toFixed(1)}k`
    if (amountUsd >= 1) return `$${amountUsd.toFixed(decimals)}`
    if (amountUsd >= 0.01) return `$${amountUsd.toFixed(3)}`
    return `$${amountUsd.toFixed(4)}`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amountUsd)
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return tokens.toLocaleString()
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms.toFixed(0)}ms`
}

export function millicentsToUsd(millicents: number): number {
  return millicents / 100_000
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function getDateRange(days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

// ─── Trend helpers ────────────────────────────────────────────────────────────

export function calcChangePercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function trendDirection(
  current: number,
  previous: number
): 'up' | 'down' | 'flat' {
  const diff = current - previous
  if (Math.abs(diff) < 0.001) return 'flat'
  return diff > 0 ? 'up' : 'down'
}
