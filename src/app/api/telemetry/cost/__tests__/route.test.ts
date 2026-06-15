/**
 * Tests for POST /api/telemetry/cost route handler
 * Refs #9
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

const BASE_URL = 'http://localhost:3000/api/telemetry/cost';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  modelCost: 0.02,
  providerCost: 0.005,
  workflowCost: 0.001,
  teamCost: 0.003,
  totalCost: 0.029,
  currency: 'USD',
  model: 'claude-3-5-sonnet',
  provider: 'anthropic',
  userId: 'user-xyz',
  promptTokens: 500,
  completionTokens: 250,
  totalTokens: 750,
};

const MOCK_RESULT = {
  ...VALID_BODY,
  id: 'cost-id-456',
  timestamp: '2026-06-14T11:00:00.000Z',
  classification: Classification.UPDATING_CODE,
};

function setupMockService(overrides?: object) {
  const mock = {
    recordCostEvent: vi.fn().mockResolvedValue(MOCK_RESULT),
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

describe('POST /api/telemetry/cost', () => {
  describe('validation — required fields', () => {
    it('returns 400 when body is empty', async () => {
      const res = await POST(makeRequest({}));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Validation failed/i);
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

    it('returns 400 when totalCost is negative', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, totalCost: -1 }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when modelCost is negative', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, modelCost: -0.01 }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when promptTokens is a float', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, promptTokens: 1.7 }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when completionTokens is negative', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, completionTokens: -10 }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when classification is an invalid enum value', async () => {
      const res = await POST(
        makeRequest({ ...VALID_BODY, classification: 'invalid_class' })
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
        model: VALID_BODY.model,
        provider: VALID_BODY.provider,
        userId: VALID_BODY.userId,
        totalCost: VALID_BODY.totalCost,
      });
      expect(data.timestamp).toBeTruthy();
    });

    it('calls recordCostEvent with the parsed payload', async () => {
      const mock = setupMockService();

      await POST(makeRequest(VALID_BODY));

      expect(mock.recordCostEvent).toHaveBeenCalledOnce();
      const arg = mock.recordCostEvent.mock.calls[0][0];
      expect(arg.totalCost).toBe(VALID_BODY.totalCost);
      expect(arg.model).toBe(VALID_BODY.model);
    });

    it('defaults currency to USD when omitted', async () => {
      setupMockService();
      const { currency: _, ...bodyWithoutCurrency } = VALID_BODY;
      const res = await POST(makeRequest(bodyWithoutCurrency));

      // Should still pass validation — currency has a default
      expect(res.status).toBe(201);
    });

    it('accepts a valid classification enum value', async () => {
      setupMockService();
      const res = await POST(
        makeRequest({ ...VALID_BODY, classification: Classification.FIXING_ISSUES })
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

    it('accepts optional teamId and agentId fields', async () => {
      setupMockService();
      const res = await POST(
        makeRequest({ ...VALID_BODY, teamId: 'team-1', agentId: 'agent-99' })
      );

      expect(res.status).toBe(201);
    });

    it('accepts an optional timestamp in ISO 8601 format', async () => {
      setupMockService();
      const res = await POST(
        makeRequest({ ...VALID_BODY, timestamp: '2026-06-14T09:30:00.000Z' })
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
        recordCostEvent: vi.fn().mockRejectedValue(new Error('DB write failed')),
      });

      const res = await POST(makeRequest(VALID_BODY));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('DB write failed');
    });

    it('returns 500 with a message when a non-Error is thrown', async () => {
      setupMockService({
        recordCostEvent: vi.fn().mockRejectedValue(42),
      });

      const res = await POST(makeRequest(VALID_BODY));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});
