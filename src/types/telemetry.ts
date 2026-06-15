/**
 * Telemetry Types for TokenOps
 *
 * Covers GitHub Issues:
 *  #7  — Prompt Event Collection
 *  #8  — Agent Execution Collection
 *  #9  — Cost Event Collection
 *  #43 — Token Spend Classification Engine
 */

// ---------------------------------------------------------------------------
// Classification (Issue #43)
// ---------------------------------------------------------------------------

export enum Classification {
  UPDATING_SPECS = 'updating_specs',
  BRAINSTORMING = 'brainstorming',
  UPDATING_CODE = 'updating_code',
  FIXING_ISSUES = 'fixing_issues',
  BATCH_COMMANDS = 'batch_commands',
}

export interface ClassificationResult {
  classification: Classification;
  confidence: number; // 0-1
  matchedPatterns: string[];
  isBatchCandidate: boolean;
}

// ---------------------------------------------------------------------------
// Prompt Events (Issue #7)
// ---------------------------------------------------------------------------

export interface PromptEvent {
  id?: string;
  prompt: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  userId: string;
  teamId?: string;
  agentId?: string;
  sessionId?: string;
  classification?: Classification;
  costUsd?: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
  timestamp?: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Agent Execution (Issue #8)
// ---------------------------------------------------------------------------

export interface AgentExecution {
  id?: string;
  agentId: string;
  agentName: string;
  workflowId?: string;
  workflowName?: string;
  tools: string[];
  durationMs: number;
  outputSizeBytes: number;
  tokenCost: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  provider: string;
  userId: string;
  teamId?: string;
  parentExecutionId?: string;
  status: 'success' | 'error' | 'timeout';
  error?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Cost Events (Issue #9)
// ---------------------------------------------------------------------------

export interface CostEvent {
  id?: string;
  modelCost: number;
  providerCost: number;
  workflowCost: number;
  teamCost: number;
  totalCost: number;
  currency: string;
  model: string;
  provider: string;
  userId: string;
  teamId?: string;
  agentId?: string;
  workflowId?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  classification?: Classification;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Aggregation & Analytics
// ---------------------------------------------------------------------------

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface AggregationTimeRange {
  start: string; // ISO 8601
  end: string;   // ISO 8601
}

export interface SpendBreakdown {
  category: string;
  totalCost: number;
  totalTokens: number;
  eventCount: number;
  percentage: number;
}

export interface SpendTrend {
  timestamp: string;
  totalCost: number;
  totalTokens: number;
  eventCount: number;
}

export interface BatchPattern {
  pattern: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  totalTokens: number;
  totalCost: number;
  samplePrompts: string[];
  recommendation: string;
}

// ---------------------------------------------------------------------------
// API Response Wrappers
// ---------------------------------------------------------------------------

export interface TelemetryResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface AnalyticsResponse {
  timeRange: AggregationTimeRange;
  breakdowns: SpendBreakdown[];
  totalCost: number;
  totalTokens: number;
  totalEvents: number;
}

export interface TrendResponse {
  timeRange: AggregationTimeRange;
  granularity: Granularity;
  dataPoints: SpendTrend[];
  totalCost: number;
}
