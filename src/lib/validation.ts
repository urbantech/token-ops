/**
 * Zod validation schemas for telemetry API routes.
 *
 * Centralized here so route handlers stay thin and schemas
 * can be reused across endpoints and tests.
 */

import { z } from 'zod';
import { Classification } from '../types/telemetry';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const classificationEnum = z.nativeEnum(Classification).optional();
const isoTimestamp = z.string().datetime().optional();
const granularityEnum = z.enum(['hour', 'day', 'week', 'month']);

// ---------------------------------------------------------------------------
// Prompt Event (Issue #7)
// ---------------------------------------------------------------------------

export const promptEventSchema = z.object({
  id: z.string().uuid().optional(),
  prompt: z.string().min(1, 'prompt is required'),
  model: z.string().min(1, 'model is required'),
  provider: z.string().min(1, 'provider is required'),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  userId: z.string().min(1, 'userId is required'),
  teamId: z.string().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  classification: classificationEnum,
  costUsd: z.number().nonnegative().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: isoTimestamp,
});

export type PromptEventInput = z.infer<typeof promptEventSchema>;

// ---------------------------------------------------------------------------
// Agent Execution (Issue #8)
// ---------------------------------------------------------------------------

export const agentExecutionSchema = z.object({
  id: z.string().uuid().optional(),
  agentId: z.string().min(1, 'agentId is required'),
  agentName: z.string().min(1, 'agentName is required'),
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
  tools: z.array(z.string()),
  durationMs: z.number().int().nonnegative(),
  outputSizeBytes: z.number().int().nonnegative(),
  tokenCost: z.number().nonnegative(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  model: z.string().min(1),
  provider: z.string().min(1),
  userId: z.string().min(1),
  teamId: z.string().optional(),
  parentExecutionId: z.string().uuid().optional(),
  status: z.enum(['success', 'error', 'timeout']),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: isoTimestamp,
});

export type AgentExecutionInput = z.infer<typeof agentExecutionSchema>;

// ---------------------------------------------------------------------------
// Cost Event (Issue #9)
// ---------------------------------------------------------------------------

export const costEventSchema = z.object({
  id: z.string().uuid().optional(),
  modelCost: z.number().nonnegative(),
  providerCost: z.number().nonnegative(),
  workflowCost: z.number().nonnegative(),
  teamCost: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  currency: z.string().min(1).default('USD'),
  model: z.string().min(1),
  provider: z.string().min(1),
  userId: z.string().min(1),
  teamId: z.string().optional(),
  agentId: z.string().optional(),
  workflowId: z.string().optional(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  classification: classificationEnum,
  metadata: z.record(z.unknown()).optional(),
  timestamp: isoTimestamp,
});

export type CostEventInput = z.infer<typeof costEventSchema>;

// ---------------------------------------------------------------------------
// Analytics Query Parameters
// ---------------------------------------------------------------------------

export const spendQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  groupBy: z.enum(['model', 'team', 'classification']).default('model'),
  granularity: granularityEnum.optional(),
});

export type SpendQueryInput = z.infer<typeof spendQuerySchema>;

export const batchPatternsQuerySchema = z.object({
  threshold: z.coerce.number().int().min(2).default(3),
});

export type BatchPatternsQueryInput = z.infer<typeof batchPatternsQuerySchema>;

// ---------------------------------------------------------------------------
// Workflow Analysis Query (Issue #27)
// ---------------------------------------------------------------------------

export const workflowAnalysisQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export type WorkflowAnalysisQueryInput = z.infer<typeof workflowAnalysisQuerySchema>;

// ---------------------------------------------------------------------------
// Knowledge Entity (Issues #28, #29, #30)
// ---------------------------------------------------------------------------

const knowledgeEntityTypeEnum = z.enum([
  'person',
  'project',
  'system',
  'prompt',
  'workflow',
]);

export const createEntitySchema = z.object({
  type: knowledgeEntityTypeEnum,
  name: z.string().min(1, 'name is required'),
  metadata: z.record(z.unknown()).default({}),
  connections: z.array(z.string()).default([]),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;

export const entityQuerySchema = z.object({
  type: knowledgeEntityTypeEnum.optional(),
});

export type EntityQueryInput = z.infer<typeof entityQuerySchema>;

export const entitySearchSchema = z.object({
  query: z.string().min(1, 'query is required'),
});

export type EntitySearchInput = z.infer<typeof entitySearchSchema>;

// ---------------------------------------------------------------------------
// Model Routing (Issues #22, #23, #24)
// ---------------------------------------------------------------------------

export const recommendationsQuerySchema = z.object({
  classification: z.string().min(1, 'classification is required'),
});

export type RecommendationsQueryInput = z.infer<typeof recommendationsQuerySchema>;

export const routeRequestSchema = z.object({
  classification: z.string().min(1, 'classification is required'),
  tokenEstimate: z.number().int().positive('tokenEstimate must be a positive integer'),
});

export type RouteRequestInput = z.infer<typeof routeRequestSchema>;

export const upsertRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).optional(),
  classification: z.string().min(1).optional(),
  preferredModel: z.string().min(1).optional(),
  fallbackModel: z.string().min(1).optional(),
  maxCostPer1kTokens: z.number().positive().optional(),
  enabled: z.boolean().optional(),
});

export type UpsertRuleInput = z.infer<typeof upsertRuleSchema>;

// ---------------------------------------------------------------------------
// Context Compression (Issues #19, #20, #21)
// ---------------------------------------------------------------------------

export const compressTextSchema = z.object({
  text: z
    .string()
    .min(1, 'Text must not be empty')
    .max(200_000, 'Text exceeds maximum length of 200 000 characters'),
});

export type CompressTextInput = z.infer<typeof compressTextSchema>;

export const contextUtilizationQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export type ContextUtilizationQueryInput = z.infer<typeof contextUtilizationQuerySchema>;
