/**
 * Tests for Zod validation schemas
 * Refs #7 #8 #9
 */

import { describe, it, expect } from 'vitest';
import {
  promptEventSchema,
  agentExecutionSchema,
  costEventSchema,
  spendQuerySchema,
  batchPatternsQuerySchema,
} from '../validation';

// ---------------------------------------------------------------------------
// promptEventSchema
// ---------------------------------------------------------------------------

describe('promptEventSchema', () => {
  const validPayload = {
    prompt: 'Fix the login bug',
    model: 'gpt-4',
    provider: 'openai',
    promptTokens: 100,
    completionTokens: 200,
    totalTokens: 300,
    userId: 'user-123',
  };

  it('accepts a valid minimal payload', () => {
    const result = promptEventSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('accepts a payload with all optional fields', () => {
    const full = {
      ...validPayload,
      id: '550e8400-e29b-41d4-a716-446655440000',
      teamId: 'team-1',
      agentId: 'agent-1',
      sessionId: 'session-1',
      classification: 'fixing_issues',
      costUsd: 0.05,
      latencyMs: 1200,
      metadata: { source: 'api' },
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const result = promptEventSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it('rejects when prompt is missing', () => {
    const { prompt, ...missing } = validPayload;
    void prompt;
    const result = promptEventSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('rejects when prompt is empty string', () => {
    const result = promptEventSchema.safeParse({ ...validPayload, prompt: '' });
    expect(result.success).toBe(false);
  });

  it('rejects when model is missing', () => {
    const { model, ...missing } = validPayload;
    void model;
    const result = promptEventSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('rejects negative token counts', () => {
    const result = promptEventSchema.safeParse({ ...validPayload, promptTokens: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer token counts', () => {
    const result = promptEventSchema.safeParse({ ...validPayload, promptTokens: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for id', () => {
    const result = promptEventSchema.safeParse({ ...validPayload, id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects negative costUsd', () => {
    const result = promptEventSchema.safeParse({ ...validPayload, costUsd: -0.01 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid classification enum value', () => {
    const result = promptEventSchema.safeParse({
      ...validPayload,
      classification: 'invalid_category',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// agentExecutionSchema
// ---------------------------------------------------------------------------

describe('agentExecutionSchema', () => {
  const validPayload = {
    agentId: 'agent-001',
    agentName: 'CodeReviewer',
    tools: ['read_file', 'write_file'],
    durationMs: 5000,
    outputSizeBytes: 1024,
    tokenCost: 0.12,
    promptTokens: 500,
    completionTokens: 300,
    totalTokens: 800,
    model: 'gpt-4',
    provider: 'openai',
    userId: 'user-123',
    status: 'success' as const,
  };

  it('accepts a valid payload', () => {
    const result = agentExecutionSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('accepts all optional fields', () => {
    const full = {
      ...validPayload,
      id: '550e8400-e29b-41d4-a716-446655440000',
      workflowId: 'wf-1',
      workflowName: 'CI Pipeline',
      teamId: 'team-1',
      parentExecutionId: '550e8400-e29b-41d4-a716-446655440001',
      error: 'timeout exceeded',
      metadata: { retries: 2 },
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const result = agentExecutionSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it('rejects invalid status value', () => {
    const result = agentExecutionSchema.safeParse({ ...validPayload, status: 'running' });
    expect(result.success).toBe(false);
  });

  it('rejects empty agentId', () => {
    const result = agentExecutionSchema.safeParse({ ...validPayload, agentId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects non-array tools', () => {
    const result = agentExecutionSchema.safeParse({ ...validPayload, tools: 'read_file' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// costEventSchema
// ---------------------------------------------------------------------------

describe('costEventSchema', () => {
  const validPayload = {
    modelCost: 0.05,
    providerCost: 0.01,
    workflowCost: 0.02,
    teamCost: 0.01,
    totalCost: 0.09,
    currency: 'USD',
    model: 'gpt-4',
    provider: 'openai',
    userId: 'user-123',
    promptTokens: 500,
    completionTokens: 300,
    totalTokens: 800,
  };

  it('accepts a valid minimal payload', () => {
    const result = costEventSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('rejects negative cost values', () => {
    const result = costEventSchema.safeParse({ ...validPayload, totalCost: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects empty currency', () => {
    const result = costEventSchema.safeParse({ ...validPayload, currency: '' });
    expect(result.success).toBe(false);
  });

  it('defaults currency to USD when not provided', () => {
    const { currency, ...rest } = validPayload;
    void currency;
    const result = costEventSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('USD');
    }
  });
});

// ---------------------------------------------------------------------------
// spendQuerySchema
// ---------------------------------------------------------------------------

describe('spendQuerySchema', () => {
  it('accepts valid date range', () => {
    const result = spendQuerySchema.safeParse({
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('defaults groupBy to model', () => {
    const result = spendQuerySchema.safeParse({
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupBy).toBe('model');
    }
  });

  it('rejects invalid groupBy value', () => {
    const result = spendQuerySchema.safeParse({
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-31T23:59:59.000Z',
      groupBy: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-ISO date strings', () => {
    const result = spendQuerySchema.safeParse({
      start: 'January 1st 2026',
      end: '2026-01-31T23:59:59.000Z',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// batchPatternsQuerySchema
// ---------------------------------------------------------------------------

describe('batchPatternsQuerySchema', () => {
  it('accepts valid threshold', () => {
    const result = batchPatternsQuerySchema.safeParse({ threshold: 5 });
    expect(result.success).toBe(true);
  });

  it('defaults threshold to 3', () => {
    const result = batchPatternsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.threshold).toBe(3);
    }
  });

  it('rejects threshold below 2', () => {
    const result = batchPatternsQuerySchema.safeParse({ threshold: 1 });
    expect(result.success).toBe(false);
  });

  it('coerces string threshold to number', () => {
    const result = batchPatternsQuerySchema.safeParse({ threshold: '4' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.threshold).toBe(4);
    }
  });
});
