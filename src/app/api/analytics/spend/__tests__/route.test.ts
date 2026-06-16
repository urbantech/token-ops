/**
 * Tests for GET /api/analytics/spend route handler
 * Now powered by AINative Core postgres (lib/ainative-db)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../../lib/ainative-db', () => ({
  getSpendByModel: vi.fn(),
  getSpendByProvider: vi.fn(),
  getSpendTrend: vi.fn(),
}));

import { GET } from '../route';
import * as db from '../../../../../lib/ainative-db';

const START = '2026-06-01T00:00:00.000Z';
const END = '2026-06-14T23:59:59.000Z';

function makeRequest(queryParams: Record<string, string>): NextRequest {
  const params = new URLSearchParams(queryParams).toString();
  return new NextRequest(
    `http://localhost:3000/api/analytics/spend?${params}`,
    { method: 'GET' }
  );
}

const MOCK_MODEL_ROWS = [
  { model: 'claude-opus-4-6', provider: 'Anthropic', total_cost: 18.42, total_tokens: 1284500, prompt_tokens: 842300, completion_tokens: 442200, event_count: 347 },
  { model: 'gpt-4o', provider: 'OpenAI', total_cost: 6.55, total_tokens: 654800, prompt_tokens: 398500, completion_tokens: 256300, event_count: 189 },
];

const MOCK_PROVIDER_ROWS = [
  { provider: 'Anthropic', total_cost: 25.0, total_tokens: 2000000, event_count: 500 },
  { provider: 'OpenAI', total_cost: 8.0, total_tokens: 800000, event_count: 200 },
];

const MOCK_TREND = [
  { bucket: '2026-06-07T00:00:00.000Z', total_cost: 7.23, total_tokens: 890000, event_count: 120 },
  { bucket: '2026-06-08T00:00:00.000Z', total_cost: 9.41, total_tokens: 1150000, event_count: 145 },
];

describe('GET /api/analytics/spend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getSpendByModel).mockResolvedValue(MOCK_MODEL_ROWS);
    vi.mocked(db.getSpendByProvider).mockResolvedValue(MOCK_PROVIDER_ROWS);
    vi.mocked(db.getSpendTrend).mockResolvedValue(MOCK_TREND);
  });

  describe('validation', () => {
    it('returns 400 when start is missing', async () => {
      const res = await GET(makeRequest({ end: END, groupBy: 'model' }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when end is missing', async () => {
      const res = await GET(makeRequest({ start: START, groupBy: 'model' }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when both start and end are missing', async () => {
      const res = await GET(makeRequest({ groupBy: 'model' }));
      expect(res.status).toBe(400);
    });
  });

  describe('groupBy=model', () => {
    it('returns model breakdown from real database', async () => {
      const res = await GET(makeRequest({ start: START, end: END, groupBy: 'model' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.breakdowns).toHaveLength(2);
      expect(body.data.breakdowns[0].category).toBe('claude-opus-4-6');
      expect(body.data.totalCost).toBeCloseTo(24.97, 1);
      expect(body.data.totalEvents).toBe(536);
    });

    it('includes percentage in breakdowns', async () => {
      const res = await GET(makeRequest({ start: START, end: END }));
      const body = await res.json();
      expect(body.data.breakdowns[0].percentage).toBeGreaterThan(0);
      expect(body.data.breakdowns[0].percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('granularity (trend)', () => {
    it('returns time-series data points', async () => {
      const res = await GET(makeRequest({ start: START, end: END, granularity: 'day' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.dataPoints).toHaveLength(2);
      expect(body.data.dataPoints[0].timestamp).toBe('2026-06-07T00:00:00.000Z');
      expect(body.data.dataPoints[0].totalCost).toBe(7.23);
    });

    it('calls db.getSpendTrend with correct params', async () => {
      await GET(makeRequest({ start: START, end: END, granularity: 'week' }));
      expect(db.getSpendTrend).toHaveBeenCalledWith(START, END, 'week');
    });
  });

  describe('error handling', () => {
    it('returns 500 when database throws', async () => {
      vi.mocked(db.getSpendByModel).mockRejectedValue(new Error('DB connection failed'));
      const res = await GET(makeRequest({ start: START, end: END, groupBy: 'model' }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('DB connection failed');
    });
  });
});
