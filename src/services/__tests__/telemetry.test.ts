/**
 * Tests for Telemetry Collection Service
 * Refs #7, #8, #9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the zerodb-client module to avoid resolving axios at import time
vi.mock('../../lib/zerodb-client', () => ({
  getZeroDBClient: vi.fn(),
  ZeroDBClient: vi.fn(),
}));

import { TelemetryService, _resetTablesInitialized } from '../telemetry';
import { Classification } from '../../types/telemetry';

// ---------------------------------------------------------------------------
// Mock ZeroDB client
// ---------------------------------------------------------------------------

function createMockClient() {
  return {
    createTable: vi.fn().mockResolvedValue({}),
    insertRows: vi.fn().mockResolvedValue({}),
    queryRows: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    createEvent: vi.fn().mockResolvedValue({ id: 'evt_1' }),
    listEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
    healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' }),
  };
}

// ---------------------------------------------------------------------------
// Prompt Event tests (Issue #7)
// ---------------------------------------------------------------------------

describe('TelemetryService — recordPromptEvent', () => {
  let service: TelemetryService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    _resetTablesInitialized();
    mockClient = createMockClient();
    service = new TelemetryService(mockClient as any);
  });

  it('persists a prompt event to the prompt_events table', async () => {
    const event = {
      prompt: 'Implement user auth',
      model: 'gpt-4',
      provider: 'openai',
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      userId: 'user_1',
    };

    await service.recordPromptEvent(event);

    expect(mockClient.insertRows).toHaveBeenCalledOnce();
    const call = mockClient.insertRows.mock.calls[0][0];
    expect(call.tableName).toBe('prompt_events');
    expect(call.rows[0].prompt).toBe('Implement user auth');
    expect(call.rows[0].user_id).toBe('user_1');
  });

  it('generates an id when not provided', async () => {
    const event = {
      prompt: 'Fix the login bug',
      model: 'gpt-4',
      provider: 'openai',
      promptTokens: 50,
      completionTokens: 100,
      totalTokens: 150,
      userId: 'user_1',
    };

    const result = await service.recordPromptEvent(event);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.id!.length).toBeGreaterThan(0);
  });

  it('preserves a provided id', async () => {
    const event = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      prompt: 'Test prompt',
      model: 'gpt-4',
      provider: 'openai',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      userId: 'user_1',
    };

    const result = await service.recordPromptEvent(event);
    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('generates a timestamp when not provided', async () => {
    const event = {
      prompt: 'Test prompt',
      model: 'gpt-4',
      provider: 'openai',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      userId: 'user_1',
    };

    const result = await service.recordPromptEvent(event);
    expect(result.timestamp).toBeDefined();
    expect(() => new Date(result.timestamp!).toISOString()).not.toThrow();
  });

  it('auto-classifies the prompt when classification is not provided', async () => {
    const event = {
      prompt: 'Fix bug in the auth handler',
      model: 'gpt-4',
      provider: 'openai',
      promptTokens: 50,
      completionTokens: 100,
      totalTokens: 150,
      userId: 'user_1',
    };

    const result = await service.recordPromptEvent(event);
    expect(result.classification).toBeDefined();
    expect(result.classification).toBe(Classification.FIXING_ISSUES);
  });

  it('respects explicit classification when provided', async () => {
    const event = {
      prompt: 'Some ambiguous prompt',
      model: 'gpt-4',
      provider: 'openai',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      userId: 'user_1',
      classification: Classification.UPDATING_SPECS,
    };

    const result = await service.recordPromptEvent(event);
    expect(result.classification).toBe(Classification.UPDATING_SPECS);
  });

  it('emits a telemetry.prompt event', async () => {
    const event = {
      prompt: 'Deploy the staging build',
      model: 'gpt-4',
      provider: 'openai',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      userId: 'user_1',
    };

    await service.recordPromptEvent(event);

    expect(mockClient.createEvent).toHaveBeenCalledOnce();
    const evtCall = mockClient.createEvent.mock.calls[0][0];
    expect(evtCall.eventType).toBe('telemetry.prompt');
    expect(evtCall.payload.model).toBe('gpt-4');
  });

  it('handles optional fields as null in the row', async () => {
    const event = {
      prompt: 'Test prompt',
      model: 'gpt-4',
      provider: 'openai',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      userId: 'user_1',
    };

    await service.recordPromptEvent(event);

    const row = mockClient.insertRows.mock.calls[0][0].rows[0];
    expect(row.team_id).toBeNull();
    expect(row.agent_id).toBeNull();
    expect(row.session_id).toBeNull();
    expect(row.cost_usd).toBeNull();
    expect(row.latency_ms).toBeNull();
    expect(row.metadata).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Agent Execution tests (Issue #8)
// ---------------------------------------------------------------------------

describe('TelemetryService — recordAgentExecution', () => {
  let service: TelemetryService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    _resetTablesInitialized();
    mockClient = createMockClient();
    service = new TelemetryService(mockClient as any);
  });

  it('persists an agent execution to the agent_executions table', async () => {
    const event = {
      agentId: 'agent_1',
      agentName: 'Token Auditor',
      tools: ['search', 'analyze'],
      durationMs: 5000,
      outputSizeBytes: 1024,
      tokenCost: 0.05,
      promptTokens: 200,
      completionTokens: 400,
      totalTokens: 600,
      model: 'gpt-4',
      provider: 'openai',
      userId: 'user_1',
      status: 'success' as const,
    };

    await service.recordAgentExecution(event);

    expect(mockClient.insertRows).toHaveBeenCalledOnce();
    const call = mockClient.insertRows.mock.calls[0][0];
    expect(call.tableName).toBe('agent_executions');
    expect(call.rows[0].agent_id).toBe('agent_1');
    expect(call.rows[0].agent_name).toBe('Token Auditor');
    expect(call.rows[0].status).toBe('success');
  });

  it('emits a telemetry.agent_execution event', async () => {
    const event = {
      agentId: 'agent_2',
      agentName: 'Prompt Architect',
      tools: [],
      durationMs: 2000,
      outputSizeBytes: 512,
      tokenCost: 0.02,
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      model: 'gpt-4',
      provider: 'openai',
      userId: 'user_1',
      status: 'success' as const,
    };

    await service.recordAgentExecution(event);

    expect(mockClient.createEvent).toHaveBeenCalledOnce();
    const evtCall = mockClient.createEvent.mock.calls[0][0];
    expect(evtCall.eventType).toBe('telemetry.agent_execution');
    expect(evtCall.metadata.agentId).toBe('agent_2');
  });

  it('generates id and timestamp when not provided', async () => {
    const event = {
      agentId: 'agent_1',
      agentName: 'Test Agent',
      tools: [],
      durationMs: 1000,
      outputSizeBytes: 256,
      tokenCost: 0.01,
      promptTokens: 50,
      completionTokens: 100,
      totalTokens: 150,
      model: 'gpt-4',
      provider: 'openai',
      userId: 'user_1',
      status: 'success' as const,
    };

    const result = await service.recordAgentExecution(event);
    expect(result.id).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });

  it('stores error information for failed executions', async () => {
    const event = {
      agentId: 'agent_1',
      agentName: 'Failing Agent',
      tools: ['tool_a'],
      durationMs: 500,
      outputSizeBytes: 0,
      tokenCost: 0.01,
      promptTokens: 50,
      completionTokens: 0,
      totalTokens: 50,
      model: 'gpt-4',
      provider: 'openai',
      userId: 'user_1',
      status: 'error' as const,
      error: 'Connection timeout',
    };

    await service.recordAgentExecution(event);

    const row = mockClient.insertRows.mock.calls[0][0].rows[0];
    expect(row.status).toBe('error');
    expect(row.error).toBe('Connection timeout');
  });
});

// ---------------------------------------------------------------------------
// Cost Event tests (Issue #9)
// ---------------------------------------------------------------------------

describe('TelemetryService — recordCostEvent', () => {
  let service: TelemetryService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    _resetTablesInitialized();
    mockClient = createMockClient();
    service = new TelemetryService(mockClient as any);
  });

  it('persists a cost event to the cost_events table', async () => {
    const event = {
      modelCost: 0.05,
      providerCost: 0.06,
      workflowCost: 0.10,
      teamCost: 0.10,
      totalCost: 0.10,
      currency: 'USD',
      model: 'gpt-4',
      provider: 'openai',
      userId: 'user_1',
      promptTokens: 200,
      completionTokens: 400,
      totalTokens: 600,
    };

    await service.recordCostEvent(event);

    expect(mockClient.insertRows).toHaveBeenCalledOnce();
    const call = mockClient.insertRows.mock.calls[0][0];
    expect(call.tableName).toBe('cost_events');
    expect(call.rows[0].total_cost).toBe(0.10);
    expect(call.rows[0].currency).toBe('USD');
  });

  it('defaults classification to BRAINSTORMING when not provided', async () => {
    const event = {
      modelCost: 0.01,
      providerCost: 0.01,
      workflowCost: 0.02,
      teamCost: 0.02,
      totalCost: 0.02,
      currency: 'USD',
      model: 'gpt-4',
      provider: 'openai',
      userId: 'user_1',
      promptTokens: 50,
      completionTokens: 100,
      totalTokens: 150,
    };

    const result = await service.recordCostEvent(event);
    expect(result.classification).toBe(Classification.BRAINSTORMING);
  });

  it('emits a telemetry.cost event with totalCost in metadata', async () => {
    const event = {
      modelCost: 0.50,
      providerCost: 0.55,
      workflowCost: 0.60,
      teamCost: 0.60,
      totalCost: 0.60,
      currency: 'USD',
      model: 'gpt-4',
      provider: 'openai',
      userId: 'user_1',
      promptTokens: 1000,
      completionTokens: 2000,
      totalTokens: 3000,
    };

    await service.recordCostEvent(event);

    const evtCall = mockClient.createEvent.mock.calls[0][0];
    expect(evtCall.eventType).toBe('telemetry.cost');
    expect(evtCall.metadata.totalCost).toBe(0.60);
  });

  it('generates id and timestamp when not provided', async () => {
    const event = {
      modelCost: 0.01,
      providerCost: 0.01,
      workflowCost: 0.02,
      teamCost: 0.02,
      totalCost: 0.02,
      currency: 'USD',
      model: 'gpt-4',
      provider: 'openai',
      userId: 'user_1',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    };

    const result = await service.recordCostEvent(event);
    expect(result.id).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Table initialization
// ---------------------------------------------------------------------------

describe('TelemetryService — initialization', () => {
  beforeEach(() => {
    _resetTablesInitialized();
  });

  it('calls createTable for all three tables on first use', async () => {
    const mockClient = createMockClient();
    const service = new TelemetryService(mockClient as any);

    await service.initialize();

    expect(mockClient.createTable).toHaveBeenCalledTimes(3);
    const tableNames = mockClient.createTable.mock.calls.map(
      (c: any[]) => c[0].tableName
    );
    expect(tableNames).toContain('prompt_events');
    expect(tableNames).toContain('agent_executions');
    expect(tableNames).toContain('cost_events');
  });

  it('tolerates "already exists" errors during table creation', async () => {
    const mockClient = createMockClient();
    mockClient.createTable.mockRejectedValue(new Error('Table already exists'));
    const service = new TelemetryService(mockClient as any);

    await expect(service.initialize()).resolves.not.toThrow();
  });

  it('rethrows non-already-exists errors', async () => {
    const mockClient = createMockClient();
    mockClient.createTable.mockRejectedValue(new Error('Network failure'));
    const service = new TelemetryService(mockClient as any);

    await expect(service.initialize()).rejects.toThrow('Network failure');
  });
});
