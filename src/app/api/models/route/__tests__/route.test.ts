/**
 * Tests for POST /api/models/route
 * Refs #24
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../../services/model-router', () => ({
  routeRequest: vi.fn(),
}));

import { POST } from '../route';
import { routeRequest } from '../../../../../services/model-router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000/api/models/route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  classification: 'code',
  tokenEstimate: 1000,
};

const MOCK_DECISION = {
  selectedModel: 'claude-sonnet-4-6',
  rule: 'rule-code',
  reason: 'Preferred model is within cost limit.',
  estimatedCost: 0.009,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/models/route', () => {
  describe('validation', () => {
    it('returns 400 when body is empty', async () => {
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Validation failed/i);
    });

    it('returns 400 when classification is missing', async () => {
      const res = await POST(makeRequest({ tokenEstimate: 1000 }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when classification is empty string', async () => {
      const res = await POST(makeRequest({ classification: '', tokenEstimate: 1000 }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when tokenEstimate is missing', async () => {
      const res = await POST(makeRequest({ classification: 'code' }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when tokenEstimate is zero', async () => {
      const res = await POST(makeRequest({ classification: 'code', tokenEstimate: 0 }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when tokenEstimate is negative', async () => {
      const res = await POST(makeRequest({ classification: 'code', tokenEstimate: -100 }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when tokenEstimate is a float', async () => {
      const res = await POST(makeRequest({ classification: 'code', tokenEstimate: 1.5 }));
      expect(res.status).toBe(400);
    });
  });

  describe('successful routing', () => {
    it('returns 200 with routing decision for valid body', async () => {
      vi.mocked(routeRequest).mockReturnValue(MOCK_DECISION);

      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(MOCK_DECISION);
    });

    it('calls routeRequest with correct params', async () => {
      vi.mocked(routeRequest).mockReturnValue(MOCK_DECISION);

      await POST(makeRequest(VALID_BODY));
      expect(routeRequest).toHaveBeenCalledWith('code', 1000);
    });

    it('response includes a timestamp', async () => {
      vi.mocked(routeRequest).mockReturnValue(MOCK_DECISION);

      const res = await POST(makeRequest(VALID_BODY));
      const data = await res.json();
      expect(data.timestamp).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('returns 500 when service throws', async () => {
      vi.mocked(routeRequest).mockImplementation(() => {
        throw new Error('Routing failure');
      });

      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Routing failure');
    });

    it('returns 500 with fallback message for non-Error throw', async () => {
      vi.mocked(routeRequest).mockImplementation(() => {
        throw 'string-error';
      });

      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});
