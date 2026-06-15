/**
 * Tests for Workflow Optimization Service
 * Refs #27
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WorkflowOptimizerService,
  WorkflowDataClient,
} from '../workflow-optimizer';
import type { WorkflowEvent } from '../../types/workflow';

// ---------------------------------------------------------------------------
// Mock client factory
// ---------------------------------------------------------------------------

function createMockClient(
  overrides?: Partial<WorkflowDataClient>
): WorkflowDataClient {
  return {
    queryAgentEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Sample workflow events
// ---------------------------------------------------------------------------

function makeEvent(partial: Partial<WorkflowEvent>): WorkflowEvent {
  return {
    id: partial.id ?? 'evt-1',
    workflowId: partial.workflowId ?? 'wf-1',
    workflowName: partial.workflowName ?? 'deploy-pipeline',
    agentId: partial.agentId ?? 'agent-1',
    tools: partial.tools ?? ['build', 'test', 'deploy'],
    durationMs: partial.durationMs ?? 5000,
    totalTokens: partial.totalTokens ?? 10000,
    promptTokens: partial.promptTokens ?? 7000,
    completionTokens: partial.completionTokens ?? 3000,
    status: partial.status ?? 'success',
    timestamp: partial.timestamp ?? '2026-06-10T12:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// analyzeWorkflows
// ---------------------------------------------------------------------------

describe('WorkflowOptimizerService.analyzeWorkflows', () => {
  it('returns empty analysis when no events found', async () => {
    const client = createMockClient();
    const service = new WorkflowOptimizerService(client);

    const result = await service.analyzeWorkflows({
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-14T23:59:59.000Z',
    });

    expect(result.totalWorkflows).toBe(0);
    expect(result.duplicatedWorkflows).toEqual([]);
    expect(result.inefficientWorkflows).toEqual([]);
    expect(result.excessiveToolCalls).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it('groups events by workflowName and counts unique workflows', async () => {
    const events = [
      makeEvent({ workflowId: 'wf-1', workflowName: 'deploy-pipeline' }),
      makeEvent({ workflowId: 'wf-2', workflowName: 'deploy-pipeline' }),
      makeEvent({ workflowId: 'wf-3', workflowName: 'code-review' }),
    ];
    const client = createMockClient({
      queryAgentEvents: vi.fn().mockResolvedValue({ events, total: 3 }),
    });
    const service = new WorkflowOptimizerService(client);

    const result = await service.analyzeWorkflows({
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-14T23:59:59.000Z',
    });

    expect(result.totalWorkflows).toBe(2);
  });

  it('detects inefficient workflows with high token usage', async () => {
    const events = [
      makeEvent({
        workflowName: 'heavy-workflow',
        totalTokens: 50000,
        durationMs: 60000,
      }),
      makeEvent({
        workflowName: 'heavy-workflow',
        totalTokens: 55000,
        durationMs: 70000,
      }),
    ];
    const client = createMockClient({
      queryAgentEvents: vi.fn().mockResolvedValue({ events, total: 2 }),
    });
    const service = new WorkflowOptimizerService(client);

    const result = await service.analyzeWorkflows({
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-14T23:59:59.000Z',
    });

    expect(result.inefficientWorkflows.length).toBeGreaterThanOrEqual(1);
    const heavy = result.inefficientWorkflows.find(
      (w) => w.workflow === 'heavy-workflow'
    );
    expect(heavy).toBeDefined();
    expect(heavy!.avgTokens).toBe(52500);
    expect(heavy!.avgDuration).toBe(65000);
    expect(heavy!.inefficiencyScore).toBeGreaterThan(0);
    expect(heavy!.suggestion).toBeTruthy();
  });

  it('detects excessive tool calls', async () => {
    const events = [
      makeEvent({
        workflowName: 'tool-heavy',
        tools: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'],
        totalTokens: 20000,
      }),
      makeEvent({
        workflowName: 'tool-heavy',
        tools: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
        totalTokens: 22000,
      }),
    ];
    const client = createMockClient({
      queryAgentEvents: vi.fn().mockResolvedValue({ events, total: 2 }),
    });
    const service = new WorkflowOptimizerService(client);

    const result = await service.analyzeWorkflows({
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-14T23:59:59.000Z',
    });

    expect(result.excessiveToolCalls.length).toBe(1);
    expect(result.excessiveToolCalls[0].workflow).toBe('tool-heavy');
    expect(result.excessiveToolCalls[0].toolCallCount).toBeGreaterThanOrEqual(
      10
    );
    expect(result.excessiveToolCalls[0].suggestion).toBeTruthy();
  });

  it('generates recommendations when issues are found', async () => {
    const events = [
      makeEvent({
        workflowName: 'heavy-workflow',
        totalTokens: 50000,
        durationMs: 60000,
        tools: Array(12).fill('tool'),
      }),
    ];
    const client = createMockClient({
      queryAgentEvents: vi.fn().mockResolvedValue({ events, total: 1 }),
    });
    const service = new WorkflowOptimizerService(client);

    const result = await service.analyzeWorkflows({
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-14T23:59:59.000Z',
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('passes time range to the data client', async () => {
    const queryFn = vi.fn().mockResolvedValue({ events: [], total: 0 });
    const client = createMockClient({ queryAgentEvents: queryFn });
    const service = new WorkflowOptimizerService(client);

    const timeRange = {
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-14T23:59:59.000Z',
    };
    await service.analyzeWorkflows(timeRange);

    expect(queryFn).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: timeRange.start,
        endTime: timeRange.end,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// findDuplicates
// ---------------------------------------------------------------------------

describe('WorkflowOptimizerService.findDuplicates', () => {
  it('returns empty array for zero or one workflow', () => {
    const service = new WorkflowOptimizerService(createMockClient());

    expect(service.findDuplicates([])).toEqual([]);
    expect(service.findDuplicates(['deploy-pipeline'])).toEqual([]);
  });

  it('returns empty array when no workflows are similar', () => {
    const service = new WorkflowOptimizerService(createMockClient());

    const result = service.findDuplicates([
      'deploy-pipeline',
      'code-review',
      'data-backup',
    ]);

    // All names are quite different, expect no duplicates above threshold
    expect(result.every((d) => d.similarity < 0.7)).toBe(true);
  });

  it('detects similar workflow names', () => {
    const service = new WorkflowOptimizerService(createMockClient());

    const result = service.findDuplicates([
      'deploy-pipeline',
      'deploy-pipeline-v2',
      'code-review',
    ]);

    const match = result.find(
      (d) =>
        (d.workflowA === 'deploy-pipeline' &&
          d.workflowB === 'deploy-pipeline-v2') ||
        (d.workflowA === 'deploy-pipeline-v2' &&
          d.workflowB === 'deploy-pipeline')
    );

    expect(match).toBeDefined();
    expect(match!.similarity).toBeGreaterThan(0.5);
  });

  it('calculates estimated waste for duplicated workflows', () => {
    const service = new WorkflowOptimizerService(createMockClient());

    const result = service.findDuplicates([
      'deploy-pipeline',
      'deploy-pipeline-v2',
    ]);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].estimatedWaste).toBeGreaterThanOrEqual(0);
  });
});
