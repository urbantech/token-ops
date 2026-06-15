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
