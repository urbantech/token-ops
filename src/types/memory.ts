/**
 * Memory Optimization Types for TokenOps
 *
 * Covers GitHub Issues:
 *  #17 — Duplicate Request Detection
 *  #18 — Memory Reuse Recommendations
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum MemoryCategory {
  CONVERSATION = 'conversation',
  KNOWLEDGE = 'knowledge',
  TASK = 'task',
  ERROR = 'error',
  CONTEXT = 'context',
  INSTRUCTION = 'instruction',
  FEEDBACK = 'feedback',
  SUMMARY = 'summary',
}

// ---------------------------------------------------------------------------
// Duplicate Detection (Issue #17)
// ---------------------------------------------------------------------------

export interface DuplicateDetectionResult {
  /** Whether the query was identified as a duplicate */
  isDuplicate: boolean;
  /** Similarity confidence score between 0 and 1 */
  confidence: number;
  /** The cached answer from a prior identical/similar request, if available */
  priorAnswer: string | null;
  /** Reference ID of the matched memory entry */
  memoryReference: string | null;
  /** Estimated tokens saved by reusing the cached response */
  tokensSaved: number;
}

// ---------------------------------------------------------------------------
// Memory Reuse Recommendations (Issue #18)
// ---------------------------------------------------------------------------

export interface RepeatedQuery {
  /** The query text (or representative text for the cluster) */
  query: string;
  /** Number of times this query (or near-duplicate) was issued */
  frequency: number;
  /** Total tokens consumed across all duplicate invocations */
  tokensConsumed: number;
  /** Tokens that could be saved by caching */
  potentialSavings: number;
  /** Average similarity score within the cluster */
  avgSimilarity: number;
}

export interface RepeatedWorkflow {
  /** Descriptive name of the repeated workflow pattern */
  workflowName: string;
  /** Number of times this workflow was executed */
  frequency: number;
  /** Average token cost per execution */
  avgCost: number;
  /** Total token cost across all executions */
  totalCost: number;
}

export interface MemoryReuseRecommendation {
  /** Groups of similar queries with their frequency and cost */
  duplicateQueries: RepeatedQuery[];
  /** Topics that were researched multiple times */
  repeatedResearch: RepeatedQuery[];
  /** Workflow patterns executed repeatedly */
  repeatedWorkflows: RepeatedWorkflow[];
  /** Total estimated tokens saveable if all recommendations are applied */
  totalPotentialSavings: number;
}

// ---------------------------------------------------------------------------
// Memory Stats
// ---------------------------------------------------------------------------

export interface CategoryStat {
  category: MemoryCategory;
  count: number;
  percentage: number;
}

export interface MemoryStats {
  /** Total number of stored memories */
  totalMemories: number;
  /** Percentage of requests served from cache (0-100) */
  reuseRate: number;
  /** Average duplicate-detection confidence across matched queries */
  avgConfidence: number;
  /** Most common memory categories, sorted by frequency */
  topCategories: CategoryStat[];
  /** Total tokens saved through deduplication to date */
  totalTokensSaved: number;
  /** Total tokens consumed (including duplicates) */
  totalTokensConsumed: number;
}

// ---------------------------------------------------------------------------
// API Request / Response shapes
// ---------------------------------------------------------------------------

export interface DetectDuplicateRequest {
  query: string;
  threshold?: number;
}

export interface RecommendationsQuery {
  timeRange?: '24h' | '7d' | '30d' | '90d';
}

// ---------------------------------------------------------------------------
// Savings Projection (for the chart)
// ---------------------------------------------------------------------------

export interface SavingsProjectionItem {
  /** Label for the category or time bucket */
  label: string;
  /** Tokens currently wasted on duplicates */
  wasted: number;
  /** Tokens that would be saved after caching */
  saved: number;
}
