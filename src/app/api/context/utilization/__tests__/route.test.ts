/**
 * Tests for GET /api/context/utilization route handler
 *
 * Refs #19, #21
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/context-compression', () => ({
  getContextUtilization: vi.fn(),
}));

import { GET } from '../route';
import { getContextUtilization } from '@/services/context-compression';
import type { ContextUtilization } from '@/types/context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const START = '2026-06-01T00:00:00.000Z';
const END = '2026-06-14T23:59:59.000Z';

function makeRequest(queryParams: Record<string, string>): NextRequest {
  const params = new URLSearchParams(queryParams).toString();
  return new NextRequest(
    `http://localhost:3000/api/context/utilization?${params}`,
    { method: 'GET' }
  );
}

const MOCK_UTILIZATION: ContextUtilization = {
  avgContextSize: 1500,
  avgUsefulContext: 900,
  wastePercent: 40,
  oversizedPrompts: 5,
  totalPrompts: 50,
  recommendations: [
    'Consider compressing context blocks in oversized prompts.',
    'Remove redundant instructions that appear in multiple prompts.',
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getContextUtilization).mockResolvedValue(MOCK_UTILIZATION);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/context/utilization', () => {
  describe('validation', () => {
    it('returns 400 when start is missing', async () => {
      const res = await GET(makeRequest({ end: END }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('returns 400 when end is missing', async () => {
      const res = await GET(makeRequest({ start: START }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when start is not a valid ISO 8601 datetime', async () => {
      const res = await GET(makeRequest({ start: '2026-06-01', end: END }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when end is not a valid ISO 8601 datetime', async () => {
      const res = await GET(makeRequest({ start: START, end: 'June 14' }));

      expect(res.status).toBe(400);
    });
  });

  describe('successful utilization query', () => {
    it('returns 200 with utilization data', async () => {
      const res = await GET(makeRequest({ start: START, end: END }));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        avgContextSize: 1500,
        avgUsefulContext: 900,
        wastePercent: 40,
        oversizedPrompts: 5,
        totalPrompts: 50,
      });
      expect(data.data.recommendations).toHaveLength(2);
    });

    it('calls getContextUtilization with parsed time range', async () => {
      await GET(makeRequest({ start: START, end: END }));

      expect(getContextUtilization).toHaveBeenCalledOnce();
      expect(getContextUtilization).toHaveBeenCalledWith({
        start: START,
        end: END,
      });
    });

    it('response includes an ISO timestamp', async () => {
      const res = await GET(makeRequest({ start: START, end: END }));
      const data = await res.json();

      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('response data includes all required ContextUtilization fields', async () => {
      const res = await GET(makeRequest({ start: START, end: END }));
      const data = await res.json();
      const utilization = data.data;

      expect(utilization).toHaveProperty('avgContextSize');
      expect(utilization).toHaveProperty('avgUsefulContext');
      expect(utilization).toHaveProperty('wastePercent');
      expect(utilization).toHaveProperty('oversizedPrompts');
      expect(utilization).toHaveProperty('totalPrompts');
      expect(utilization).toHaveProperty('recommendations');
    });
  });

  describe('error handling', () => {
    it('returns 500 when getContextUtilization throws', async () => {
      vi.mocked(getContextUtilization).mockRejectedValue(
        new Error('ZeroDB query failed')
      );

      const res = await GET(makeRequest({ start: START, end: END }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ZeroDB query failed');
    });

    it('returns 500 with fallback message for non-Error throws', async () => {
      vi.mocked(getContextUtilization).mockRejectedValue('unexpected');

      const res = await GET(makeRequest({ start: START, end: END }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});
