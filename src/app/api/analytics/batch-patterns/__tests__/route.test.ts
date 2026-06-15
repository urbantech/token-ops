/**
 * Tests for GET /api/analytics/batch-patterns route handler
 * Refs #43
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../../services/aggregation', () => ({
  getAggregationService: vi.fn(),
}));

import { GET } from '../route';
import { getAggregationService } from '../../../../../services/aggregation';
import type { BatchPattern } from '../../../../../types/telemetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(queryParams?: Record<string, string>): NextRequest {
  const params = queryParams
    ? '?' + new URLSearchParams(queryParams).toString()
    : '';
  return new NextRequest(
    `http://localhost:3000/api/analytics/batch-patterns${params}`,
    { method: 'GET' }
  );
}

const MOCK_PATTERNS: BatchPattern[] = [
  {
    pattern: 'update all files with X',
    occurrences: 7,
    firstSeen: '2026-06-01T00:00:00.000Z',
    lastSeen: '2026-06-14T00:00:00.000Z',
    totalTokens: 14_000,
    totalCost: 0.56,
    samplePrompts: ['update all files with X'],
    recommendation: 'High repetition detected. Convert to a script or automation.',
  },
  {
    pattern: 'run lint on every file',
    occurrences: 4,
    firstSeen: '2026-06-05T00:00:00.000Z',
    lastSeen: '2026-06-13T00:00:00.000Z',
    totalTokens: 8_000,
    totalCost: 0.32,
    samplePrompts: ['run lint on every file'],
    recommendation: 'Moderate repetition. Consider batching these operations.',
  },
];

function setupMockService(overrides?: object) {
  const mock = {
    getBatchPatterns: vi.fn().mockResolvedValue(MOCK_PATTERNS),
    ...overrides,
  };
  vi.mocked(getAggregationService).mockReturnValue(mock as ReturnType<typeof getAggregationService>);
  return mock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/analytics/batch-patterns', () => {
  describe('validation', () => {
    it('returns 400 when threshold is below the minimum (2)', async () => {
      const res = await GET(makeRequest({ threshold: '1' }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Validation failed/i);
    });

    it('returns 400 when threshold is 0', async () => {
      const res = await GET(makeRequest({ threshold: '0' }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when threshold is not an integer (float string)', async () => {
      const res = await GET(makeRequest({ threshold: '2.7' }));

      // coerce.number converts "2.7" to 2.7 which is not an integer
      expect(res.status).toBe(400);
    });

    it('returns 400 when threshold is a non-numeric string', async () => {
      const res = await GET(makeRequest({ threshold: 'abc' }));

      expect(res.status).toBe(400);
    });
  });

  describe('successful response', () => {
    it('returns 200 with success=true and pattern array using the default threshold', async () => {
      setupMockService();

      const res = await GET(makeRequest());

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.timestamp).toBeTruthy();
    });

    it('calls getBatchPatterns with the default threshold of 3 when none is provided', async () => {
      const mock = setupMockService();

      await GET(makeRequest());

      expect(mock.getBatchPatterns).toHaveBeenCalledOnce();
      expect(mock.getBatchPatterns).toHaveBeenCalledWith(3);
    });

    it('calls getBatchPatterns with the specified threshold', async () => {
      const mock = setupMockService();

      await GET(makeRequest({ threshold: '5' }));

      expect(mock.getBatchPatterns).toHaveBeenCalledWith(5);
    });

    it('accepts the minimum valid threshold of 2', async () => {
      setupMockService();
      const res = await GET(makeRequest({ threshold: '2' }));

      expect(res.status).toBe(200);
    });

    it('returns well-formed BatchPattern objects', async () => {
      setupMockService();

      const res = await GET(makeRequest());
      const data = await res.json();

      for (const pattern of data.data as BatchPattern[]) {
        expect(pattern).toHaveProperty('pattern');
        expect(pattern).toHaveProperty('occurrences');
        expect(pattern).toHaveProperty('firstSeen');
        expect(pattern).toHaveProperty('lastSeen');
        expect(pattern).toHaveProperty('totalTokens');
        expect(pattern).toHaveProperty('totalCost');
        expect(pattern).toHaveProperty('samplePrompts');
        expect(pattern).toHaveProperty('recommendation');
        expect(typeof pattern.pattern).toBe('string');
        expect(typeof pattern.occurrences).toBe('number');
        expect(Array.isArray(pattern.samplePrompts)).toBe(true);
      }
    });

    it('returns an empty array when there are no patterns', async () => {
      setupMockService({ getBatchPatterns: vi.fn().mockResolvedValue([]) });

      const res = await GET(makeRequest());
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
    });

    it('response includes an ISO timestamp', async () => {
      setupMockService();
      const res = await GET(makeRequest());
      const data = await res.json();

      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });

  describe('error handling', () => {
    it('returns 500 when the service throws', async () => {
      setupMockService({
        getBatchPatterns: vi.fn().mockRejectedValue(new Error('Pattern query failed')),
      });

      const res = await GET(makeRequest());

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Pattern query failed');
    });
  });
});
