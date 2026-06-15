import type { Classification, ModelTier } from '@/types'

// ─── Classification metadata ──────────────────────────────────────────────────

export const CLASSIFICATION_CONFIG: Record<
  Classification,
  { label: string; color: string; description: string }
> = {
  specs: {
    label: 'Specs',
    color: '#7c3aed',
    description: 'Requirements, planning, documentation generation',
  },
  brainstorm: {
    label: 'Brainstorm',
    color: '#2563eb',
    description: 'Ideation, research, exploration tasks',
  },
  code: {
    label: 'Code',
    color: '#059669',
    description: 'Code generation, review, refactoring',
  },
  fixes: {
    label: 'Fixes',
    color: '#d97706',
    description: 'Bug fixes, debugging, error resolution',
  },
  batch: {
    label: 'Batch',
    color: '#0891b2',
    description: 'Bulk processing, scheduled jobs',
  },
  unknown: {
    label: 'Unknown',
    color: '#6b7280',
    description: 'Unclassified requests',
  },
}

// ─── Model tier metadata ──────────────────────────────────────────────────────

export const MODEL_TIER_CONFIG: Record<
  ModelTier,
  { label: string; color: string; badge: string }
> = {
  frontier: {
    label: 'Frontier',
    color: '#7c3aed',
    badge: 'bg-violet-900/50 text-violet-300 border-violet-700',
  },
  standard: {
    label: 'Standard',
    color: '#2563eb',
    badge: 'bg-blue-900/50 text-blue-300 border-blue-700',
  },
  mini: {
    label: 'Mini',
    color: '#059669',
    badge: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
  },
  local: {
    label: 'Local',
    color: '#6b7280',
    badge: 'bg-zinc-800/50 text-zinc-300 border-zinc-700',
  },
}

// ─── Chart colors ─────────────────────────────────────────────────────────────

export const CHART_COLORS = {
  primary: '#7c3aed',
  secondary: '#2563eb',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#0891b2',
  muted: '#6b7280',
  // Palette for multi-series charts
  series: [
    '#7c3aed',
    '#2563eb',
    '#059669',
    '#d97706',
    '#0891b2',
    '#db2777',
    '#9333ea',
    '#ea580c',
  ],
}

// ─── Date range options ───────────────────────────────────────────────────────

export const DATE_RANGES = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 6 months', value: 180 },
  { label: 'Last year', value: 365 },
] as const

// ─── Known model catalog ──────────────────────────────────────────────────────

export const KNOWN_MODELS = {
  'claude-opus-4-5': { tier: 'frontier' as ModelTier, provider: 'anthropic' },
  'claude-sonnet-4-5': { tier: 'standard' as ModelTier, provider: 'anthropic' },
  'claude-haiku-3-5': { tier: 'mini' as ModelTier, provider: 'anthropic' },
  'gpt-4o': { tier: 'frontier' as ModelTier, provider: 'openai' },
  'gpt-4o-mini': { tier: 'mini' as ModelTier, provider: 'openai' },
  'gemini-2.0-flash': { tier: 'mini' as ModelTier, provider: 'google' },
  'gemini-2.5-pro': { tier: 'frontier' as ModelTier, provider: 'google' },
} as const

// ─── Navigation items ─────────────────────────────────────────────────────────

export const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
  },
  {
    href: '/dashboard/spend',
    label: 'AI Spend',
    icon: 'DollarSign',
    badge: null,
  },
  {
    href: '/dashboard/prompts',
    label: 'Prompts',
    icon: 'MessageSquare',
  },
  {
    href: '/dashboard/memory',
    label: 'Memory',
    icon: 'Brain',
  },
  {
    href: '/dashboard/models',
    label: 'Model Routing',
    icon: 'GitBranch',
  },
  {
    href: '/dashboard/agents',
    label: 'Agents',
    icon: 'Bot',
  },
  {
    href: '/dashboard/governance',
    label: 'Governance',
    icon: 'ShieldCheck',
  },
  {
    href: '/dashboard/reports',
    label: 'Reports',
    icon: 'FileBarChart',
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: 'Settings',
  },
] as const
