// ─── Classification Categories ───────────────────────────────────────────────

export type Classification =
  | 'specs'
  | 'brainstorm'
  | 'code'
  | 'fixes'
  | 'batch'
  | 'unknown'

export const CLASSIFICATIONS: Classification[] = [
  'specs',
  'brainstorm',
  'code',
  'fixes',
  'batch',
  'unknown',
]

// ─── Model Tiers ─────────────────────────────────────────────────────────────

export type ModelTier = 'frontier' | 'standard' | 'mini' | 'local'

export interface ModelInfo {
  id: string
  name: string
  provider: 'anthropic' | 'openai' | 'google' | 'mistral' | 'local' | string
  tier: ModelTier
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
}

// ─── Token Event ─────────────────────────────────────────────────────────────

export interface TokenEvent {
  id: string
  timestamp: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number
  costMillicents: number
  classification: Classification
  agentId?: string
  sessionId?: string
  userId?: string
  projectId?: string
  tags?: string[]
}

// ─── Cost Breakdown ───────────────────────────────────────────────────────────

export interface CostBreakdown {
  total: number
  byClassification: Record<Classification, number>
  byModel: Record<string, number>
  byProvider: Record<string, number>
  byAgent: Record<string, number>
  period: {
    start: string
    end: string
  }
}

// ─── Agent Metrics ────────────────────────────────────────────────────────────

export interface AgentMetrics {
  agentId: string
  name: string
  model: string
  totalTokens: number
  totalCost: number
  requestCount: number
  avgLatencyMs: number
  successRate: number
  lastActiveAt: string
  classification: Classification
}

// ─── Usage Summary ────────────────────────────────────────────────────────────

export interface UsageSummary {
  totalTokens: number
  totalCostUsd: number
  totalRequests: number
  avgCostPerRequest: number
  avgTokensPerRequest: number
  topModel: string
  topClassification: Classification
  periodStart: string
  periodEnd: string
}

// ─── Spend Intelligence ───────────────────────────────────────────────────────

export interface SpendDataPoint {
  date: string
  totalCost: number
  byClassification: Partial<Record<Classification, number>>
  tokens: number
}

export interface SpendTrend {
  current: number
  previous: number
  changePercent: number
  direction: 'up' | 'down' | 'flat'
}

// ─── Savings Opportunity ──────────────────────────────────────────────────────

export type OpportunityType =
  | 'model_downgrade'
  | 'prompt_compression'
  | 'caching'
  | 'batching'
  | 'memory_dedup'
  | 'routing'

export interface SavingsOpportunity {
  id: string
  type: OpportunityType
  title: string
  description: string
  estimatedMonthlySavingsUsd: number
  effortLevel: 'low' | 'medium' | 'high'
  affectedAgents?: string[]
  affectedModels?: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
}

// ─── Memory Metrics ───────────────────────────────────────────────────────────

export interface MemoryMetrics {
  totalMemories: number
  episodicCount: number
  semanticCount: number
  duplicateCount: number
  staleBytesEstimate: number
  tokenOverheadEstimate: number
  potentialSavingsTokens: number
  lastConsolidatedAt: string
}

// ─── Governance ───────────────────────────────────────────────────────────────

export interface BudgetPolicy {
  id: string
  name: string
  targetType: 'agent' | 'team' | 'project' | 'classification'
  targetId: string
  monthlyLimitUsd: number
  alertThresholdPercent: number
  currentSpendUsd: number
  status: 'ok' | 'warning' | 'exceeded'
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ApiError {
  message: string
  code?: string
  status?: number
}
