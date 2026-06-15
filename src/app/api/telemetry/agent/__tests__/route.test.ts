/**
 * Tests for POST /api/telemetry/agent route handler
 * Refs #8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the service module before importing the route so the singleton
// is never constructed with a real ZeroDB client.
vi.mock('../../../../../services/telemetry', () => ({
  getTelemetryService: vi.fn(),
}));

import { POST } from '../route';
import { getTelemetryService } from '../../../../../services/telemetry';
import { Classification } from '../../../../../types/telemetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000/api/telemetry/agent';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  agentId: 'agent-001',
  agentName: 'code-review-agent',
  tools: ['read_file', 'write_file'],
  durationMs: 3500,
  outputSizeBytes: 4096,
  tokenCost: 0.042,
  promptTokens: 800,
  completionTokens: 400,
  totalTokens: 1200,
  model: 'gpt-4',
  provider: 'openai',
  userId: 'user-abc',
  status: 'success' as const,
};

const MOCK_RESULT = {
  ...VALID_BODY,
  id: 'exec-id-123',
  timestamp: '2026-06-14T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function setupMockService(overrides?: Partial<ReturnType<typeof createMockService>>) {
  const mock = createMockService(overrides);
  vi.mocked(getTelemetryService).mockReturnValue(mock as ReturnType<typeof getTelemetryService>);
  return mock;
}

function createMockService(overrides = {}) {
  return {
    recordAgentExecution: vi.fn().mockResolvedValue(MOCK_RESULT),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/telemetry/agent', () => {
  describe('validation — required fields', () => {
    it('returns 400 when body is empty', async () => {
      const res = await POST(makeRequest({}));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Validation failed/i);
    });

    it('returns 400 when agentId is missing', async () => {
      const { agentId: _, ...body } = VALID_BODY;
      const res = await POST(makeRequest(body));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('returns 400 when agentName is missing', async () => {
      const { agentName: _, ...body } = VALID_BODY;
      const res = await POST(makeRequest(body));

      expect(res.status).toBe(400);
    });

    it('returns 400 when tools is not an array', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, tools: 'read_file' }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when status is an invalid value', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, status: 'unknown' }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when durationMs is negative', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, durationMs: -1 }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when tokenCost is negative', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, tokenCost: -0.01 }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when promptTokens is a float', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, promptTokens: 1.5 }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when parentExecutionId is not a UUID', async () => {
      const res = await POST(
        makeRequest({ ...VALID_BODY, parentExecutionId: 'not-a-uuid' })
      );

      expect(res.status).toBe(400);
    });
  });

  describe('successful recording', () => {
    it('returns 201 with success=true and data for a valid payload', async () => {
      setupMockService();

      const res = await POST(makeRequest(VALID_BODY));

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        agentId: VALID_BODY.agentId,
        agentName: VALID_BODY.agentName,
        status: VALID_BODY.status,
      });
      expect(data.timestamp).toBeTruthy();
    });

    it('calls recordAgentExecution with the parsed payload', async () => {
      const mock = setupMockService();

      await POST(makeRequest(VALID_BODY));

      expect(mock.recordAgentExecution).toHaveBeenCalledOnce();
      const arg = mock.recordAgentExecution.mock.calls[0][0];
      expect(arg.agentId).toBe(VALID_BODY.agentId);
      expect(arg.model).toBe(VALID_BODY.model);
      expect(arg.tools).toEqual(VALID_BODY.tools);
    });

    it('accepts all valid status values', async () => {
      for (const status of ['success', 'error', 'timeout'] as const) {
        setupMockService();
        const res = await POST(makeRequest({ ...VALID_BODY, status }));
        expect(res.status).toBe(201);
      }
    });

    it('accepts an optional parentExecutionId that is a valid UUID', async () => {
      setupMockService();
      const res = await POST(
        makeRequest({
          ...VALID_BODY,
          parentExecutionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        })
      );

      expect(res.status).toBe(201);
    });

    it('accepts optional teamId and workflowId fields', async () => {
      setupMockService();
      const res = await POST(
        makeRequest({ ...VALID_BODY, teamId: 'team-42', workflowId: 'wf-7' })
      );

      expect(res.status).toBe(201);
    });

    it('accepts optional metadata record', async () => {
      setupMockService();
      const res = await POST(
        makeRequest({ ...VALID_BODY, metadata: { env: 'staging', version: 2 } })
      );

      expect(res.status).toBe(201);
    });

    it('accepts an error field when status is error', async () => {
      setupMockService();
      const res = await POST(
        makeRequest({ ...VALID_BODY, status: 'error', error: 'Tool timed out' })
      );

      expect(res.status).toBe(201);
    });

    it('response includes an ISO timestamp', async () => {
      setupMockService();
      const res = await POST(makeRequest(VALID_BODY));
      const data = await res.json();

      expect(() => new Date(data.timestamp)).not.toThrow();
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });

  describe('error handling', () => {
    it('returns 500 when the service throws', async () => {
      setupMockService({
        recordAgentExecution: vi.fn().mockRejectedValue(new Error('ZeroDB unreachable')),
      });

      const res = await POST(makeRequest(VALID_BODY));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ZeroDB unreachable');
    });

    it('returns 500 with generic message when a non-Error is thrown', async () => {
      setupMockService({
        recordAgentExecution: vi.fn().mockRejectedValue('string error'),
      });

      const res = await POST(makeRequest(VALID_BODY));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });
  });
});
