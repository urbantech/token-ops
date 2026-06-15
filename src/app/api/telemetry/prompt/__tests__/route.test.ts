/**
 * Tests for POST /api/telemetry/prompt route handler
 * Refs #7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../../services/telemetry', () => ({
  getTelemetryService: vi.fn(),
}));

import { POST } from '../route';
import { getTelemetryService } from '../../../../../services/telemetry';
import { Classification } from '../../../../../types/telemetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000/api/telemetry/prompt';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  prompt: 'Implement a user authentication flow using JWT.',
  model: 'gpt-4o',
  provider: 'openai',
  promptTokens: 320,
  completionTokens: 180,
  totalTokens: 500,
  userId: 'user-001',
};

const MOCK_RESULT = {
  ...VALID_BODY,
  id: 'prompt-id-789',
  timestamp: '2026-06-14T12:00:00.000Z',
  classification: Classification.UPDATING_CODE,
};

function setupMockService(overrides?: object) {
  const mock = {
    recordPromptEvent: vi.fn().mockResolvedValue(MOCK_RESULT),
    ...overrides,
  };
  vi.mocked(getTelemetryService).mockReturnValue(mock as ReturnType<typeof getTelemetryService>);
  return mock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/telemetry/prompt', () => {
  describe('validation — required fields', () => {
    it('returns 400 when body is empty', async () => {
      const res = await POST(makeRequest({}));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Validation failed/i);
    });

    it('returns 400 when prompt is empty string', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, prompt: '' }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when model is missing', async () => {
      const { model: _, ...body } = VALID_BODY;
      const res = await POST(makeRequest(body));

      expect(res.status).toBe(400);
    });

    it('returns 400 when provider is missing', async () => {
      const { provider: _, ...body } = VALID_BODY;
      const res = await POST(makeRequest(body));

      expect(res.status).toBe(400);
    });

    it('returns 400 when userId is missing', async () => {
      const { userId: _, ...body } = VALID_BODY;
      const res = await POST(makeRequest(body));

      expect(res.status).toBe(400);
    });

    it('returns 400 when promptTokens is missing', async () => {
      const { promptTokens: _, ...body } = VALID_BODY;
      const res = await POST(makeRequest(body));

      expect(res.status).toBe(400);
    });

    it('returns 400 when promptTokens is negative', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, promptTokens: -1 }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when completionTokens is a float', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, completionTokens: 2.5 }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when classification is an unrecognised value', async () => {
      const res = await POST(
        makeRequest({ ...VALID_BODY, classification: 'garbage' })
      );

      expect(res.status).toBe(400);
    });

    it('returns 400 when timestamp is not ISO 8601', async () => {
      const res = await POST(
        makeRequest({ ...VALID_BODY, timestamp: '14th June 2026' })
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
        prompt: VALID_BODY.prompt,
        model: VALID_BODY.model,
        userId: VALID_BODY.userId,
      });
      expect(data.timestamp).toBeTruthy();
    });

    it('calls recordPromptEvent with the parsed payload', async () => {
      const mock = setupMockService();

      await POST(makeRequest(VALID_BODY));

      expect(mock.recordPromptEvent).toHaveBeenCalledOnce();
      const arg = mock.recordPromptEvent.mock.calls[0][0];
      expect(arg.prompt).toBe(VALID_BODY.prompt);
      expect(arg.model).toBe(VALID_BODY.model);
      expect(arg.promptTokens).toBe(VALID_BODY.promptTokens);
    });

    it('accepts an optional classification field', async () => {
      setupMockService();
      const res = await POST(
        makeRequest({ ...VALID_BODY, classification: Classification.BRAINSTORMING })
      );

      expect(res.status).toBe(201);
    });

    it('accepts all valid Classification enum values', async () => {
      for (const classification of Object.values(Classification)) {
        setupMockService();
        const res = await POST(makeRequest({ ...VALID_BODY, classification }));
        expect(res.status).toBe(201);
      }
    });

    it('accepts optional teamId and agentId', async () => {
      setupMockService();
      const res = await POST(
        makeRequest({ ...VALID_BODY, teamId: 'team-eng', agentId: 'agent-5' })
      );

      expect(res.status).toBe(201);
    });

    it('accepts optional costUsd and latencyMs', async () => {
      setupMockService();
      const res = await POST(
        makeRequest({ ...VALID_BODY, costUsd: 0.0034, latencyMs: 1250 })
      );

      expect(res.status).toBe(201);
    });

    it('accepts optional sessionId', async () => {
      setupMockService();
      const res = await POST(
        makeRequest({ ...VALID_BODY, sessionId: 'sess-abc123' })
      );

      expect(res.status).toBe(201);
    });

    it('response includes an ISO timestamp', async () => {
      setupMockService();
      const res = await POST(makeRequest(VALID_BODY));
      const data = await res.json();

      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });

  describe('error handling', () => {
    it('returns 500 when the service throws an Error', async () => {
      setupMockService({
        recordPromptEvent: vi.fn().mockRejectedValue(new Error('Connection refused')),
      });

      const res = await POST(makeRequest(VALID_BODY));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Connection refused');
    });

    it('returns 500 with a fallback message when a non-Error is thrown', async () => {
      setupMockService({
        recordPromptEvent: vi.fn().mockRejectedValue(null),
      });

      const res = await POST(makeRequest(VALID_BODY));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});
