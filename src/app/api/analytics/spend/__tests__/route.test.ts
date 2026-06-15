/**
 * Tests for GET /api/analytics/spend route handler
 * Refs #43
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../../services/aggregation', () => ({
  getAggregationService: vi.fn(),
}));

import { GET } from '../route';
import { getAggregationService } from '../../../../../services/aggregation';
import type { AnalyticsResponse, TrendResponse } from '../../../../../types/telemetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const START = '2026-06-01T00:00:00.000Z';
const END = '2026-06-14T23:59:59.000Z';

function makeRequest(queryParams: Record<string, string>): NextRequest {
  const params = new URLSearchParams(queryParams).toString();
  return new NextRequest(
    `http://localhost:3000/api/analytics/spend?${params}`,
    { method: 'GET' }
  );
}

const MOCK_ANALYTICS: AnalyticsResponse = {
  timeRange: { start: START, end: END },
  breakdowns: [
    {
      category: 'gpt-4',
      totalCost: 12.5,
      totalTokens: 500_000,
      eventCount: 120,
      percentage: 62.5,
    },
    {
      category: 'claude-3-5-sonnet',
      totalCost: 7.5,
      totalTokens: 300_000,
      eventCount: 80,
      percentage: 37.5,
    },
  ],
  totalCost: 20.0,
  totalTokens: 800_000,
  totalEvents: 200,
};

const MOCK_TREND: TrendResponse = {
  timeRange: { start: START, end: END },
  granularity: 'day',
  dataPoints: [
    { timestamp: '2026-06-01T00:00:00.000Z', totalCost: 2.5, totalTokens: 100_000, eventCount: 20 },
    { timestamp: '2026-06-02T00:00:00.000Z', totalCost: 3.0, totalTokens: 120_000, eventCount: 25 },
  ],
  totalCost: 5.5,
};

function setupMockService(overrides?: object) {
  const mock = {
    getSpendByModel: vi.fn().mockResolvedValue(MOCK_ANALYTICS),
    getSpendByTeam: vi.fn().mockResolvedValue(MOCK_ANALYTICS),
    getSpendByClassification: vi.fn().mockResolvedValue(MOCK_ANALYTICS),
    getSpendTrend: vi.fn().mockResolvedValue(MOCK_TREND),
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

describe('GET /api/analytics/spend', () => {
  describe('validation', () => {
    it('returns 400 when start is missing', async () => {
      const res = await GET(makeRequest({ end: END }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Validation failed/i);
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
      const res = await GET(makeRequest({ start: START, end: 'June 14 2026' }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when groupBy is an invalid value', async () => {
      const res = await GET(
        makeRequest({ start: START, end: END, groupBy: 'project' })
      );

      expect(res.status).toBe(400);
    });

    it('returns 400 when granularity is an invalid value', async () => {
      const res = await GET(
        makeRequest({ start: START, end: END, granularity: 'year' })
      );

      expect(res.status).toBe(400);
    });
  });

  describe('groupBy breakdown responses', () => {
    it('calls getSpendByModel and returns analytics when groupBy defaults to model', async () => {
      const mock = setupMockService();

      const res = await GET(makeRequest({ start: START, end: END }));

      expect(res.status).toBe(200);
      expect(mock.getSpendByModel).toHaveBeenCalledOnce();
      expect(mock.getSpendByTeam).not.toHaveBeenCalled();
      expect(mock.getSpendByClassification).not.toHaveBeenCalled();

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('breakdowns');
      expect(data.data).toHaveProperty('totalCost');
      expect(data.data).toHaveProperty('totalTokens');
      expect(data.data).toHaveProperty('totalEvents');
    });

    it('calls getSpendByModel when groupBy=model is explicit', async () => {
      const mock = setupMockService();

      await GET(makeRequest({ start: START, end: END, groupBy: 'model' }));

      expect(mock.getSpendByModel).toHaveBeenCalledOnce();
    });

    it('calls getSpendByTeam when groupBy=team', async () => {
      const mock = setupMockService();

      const res = await GET(makeRequest({ start: START, end: END, groupBy: 'team' }));

      expect(res.status).toBe(200);
      expect(mock.getSpendByTeam).toHaveBeenCalledOnce();
      expect(mock.getSpendByModel).not.toHaveBeenCalled();
    });

    it('calls getSpendByClassification when groupBy=classification', async () => {
      const mock = setupMockService();

      const res = await GET(
        makeRequest({ start: START, end: END, groupBy: 'classification' })
      );

      expect(res.status).toBe(200);
      expect(mock.getSpendByClassification).toHaveBeenCalledOnce();
    });

    it('passes the parsed timeRange to the service', async () => {
      const mock = setupMockService();

      await GET(makeRequest({ start: START, end: END, groupBy: 'model' }));

      const arg = mock.getSpendByModel.mock.calls[0][0];
      expect(arg.start).toBe(START);
      expect(arg.end).toBe(END);
    });

    it('returns well-formed SpendBreakdown objects', async () => {
      setupMockService();

      const res = await GET(makeRequest({ start: START, end: END }));
      const data = await res.json();

      for (const breakdown of data.data.breakdowns) {
        expect(breakdown).toHaveProperty('category');
        expect(breakdown).toHaveProperty('totalCost');
        expect(breakdown).toHaveProperty('totalTokens');
        expect(breakdown).toHaveProperty('eventCount');
        expect(breakdown).toHaveProperty('percentage');
        expect(typeof breakdown.category).toBe('string');
        expect(typeof breakdown.totalCost).toBe('number');
      }
    });
  });

  describe('trend (granularity) response', () => {
    it('calls getSpendTrend and returns trend data when granularity is provided', async () => {
      const mock = setupMockService();

      const res = await GET(
        makeRequest({ start: START, end: END, granularity: 'day' })
      );

      expect(res.status).toBe(200);
      expect(mock.getSpendTrend).toHaveBeenCalledOnce();
      expect(mock.getSpendByModel).not.toHaveBeenCalled();

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('granularity');
      expect(data.data).toHaveProperty('dataPoints');
    });

    it('calls getSpendTrend with the correct granularity value', async () => {
      const mock = setupMockService();

      await GET(makeRequest({ start: START, end: END, granularity: 'week' }));

      const [, granularity] = mock.getSpendTrend.mock.calls[0];
      expect(granularity).toBe('week');
    });

    it('accepts all valid granularity values', async () => {
      for (const granularity of ['hour', 'day', 'week', 'month']) {
        setupMockService();
        const res = await GET(makeRequest({ start: START, end: END, granularity }));
        expect(res.status).toBe(200);
      }
    });

    it('returns well-formed SpendTrend data points', async () => {
      setupMockService();

      const res = await GET(
        makeRequest({ start: START, end: END, granularity: 'day' })
      );
      const data = await res.json();

      for (const point of data.data.dataPoints) {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('totalCost');
        expect(point).toHaveProperty('totalTokens');
        expect(point).toHaveProperty('eventCount');
      }
    });
  });

  describe('response envelope', () => {
    it('response includes an ISO timestamp', async () => {
      setupMockService();
      const res = await GET(makeRequest({ start: START, end: END }));
      const data = await res.json();

      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });

  describe('error handling', () => {
    it('returns 500 when the service throws', async () => {
      setupMockService({
        getSpendByModel: vi.fn().mockRejectedValue(new Error('Aggregation failed')),
      });

      const res = await GET(makeRequest({ start: START, end: END }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Aggregation failed');
    });

    it('returns 500 with a fallback message when a non-Error is thrown', async () => {
      setupMockService({
        getSpendByModel: vi.fn().mockRejectedValue(undefined),
      });

      const res = await GET(makeRequest({ start: START, end: END }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});
