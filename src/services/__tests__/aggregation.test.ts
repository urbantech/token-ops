/**
 * Tests for Usage Aggregation Service
 * Refs #7, #9, #43
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the zerodb-client module to avoid resolving axios at import time
vi.mock('../../lib/zerodb-client', () => ({
  getZeroDBClient: vi.fn(),
  ZeroDBClient: vi.fn(),
}));

import { AggregationService } from '../aggregation';

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

function makeCostRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cost_1',
    model: 'gpt-4',
    provider: 'openai',
    total_cost: 0.10,
    total_tokens: 300,
    team_id: 'team_a',
    classification: 'updating_code',
    timestamp: '2026-06-10T12:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getSpendByModel
// ---------------------------------------------------------------------------

describe('AggregationService — getSpendByModel', () => {
  let service: AggregationService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    service = new AggregationService(mockClient as any);
  });

  it('returns empty breakdowns when no rows exist', async () => {
    const result = await service.getSpendByModel({
      start: '2026-06-01T00:00:00Z',
      end: '2026-06-14T23:59:59Z',
    });

    expect(result.breakdowns).toEqual([]);
    expect(result.totalCost).toBe(0);
    expect(result.totalTokens).toBe(0);
    expect(result.totalEvents).toBe(0);
  });

  it('groups cost events by model', async () => {
    mockClient.queryRows.mockResolvedValue({
      rows: [
        makeCostRow({ model: 'gpt-4', total_cost: 0.20, total_tokens: 500 }),
        makeCostRow({ model: 'gpt-4', total_cost: 0.30, total_tokens: 700 }),
        makeCostRow({ model: 'deepseek', total_cost: 0.05, total_tokens: 200 }),
      ],
      total: 3,
    });

    const result = await service.getSpendByModel({
      start: '2026-06-01T00:00:00Z',
      end: '2026-06-14T23:59:59Z',
    });

    expect(result.breakdowns.length).toBe(2);
    expect(result.totalCost).toBeCloseTo(0.55);
    expect(result.totalEvents).toBe(3);

    const gpt4 = result.breakdowns.find((b) => b.category === 'gpt-4');
    expect(gpt4).toBeDefined();
    expect(gpt4!.totalCost).toBeCloseTo(0.50);
    expect(gpt4!.eventCount).toBe(2);
  });

  it('sorts breakdowns by totalCost descending', async () => {
    mockClient.queryRows.mockResolvedValue({
      rows: [
        makeCostRow({ model: 'cheap-model', total_cost: 0.01 }),
        makeCostRow({ model: 'expensive-model', total_cost: 5.00 }),
        makeCostRow({ model: 'mid-model', total_cost: 1.00 }),
      ],
      total: 3,
    });

    const result = await service.getSpendByModel({
      start: '2026-06-01T00:00:00Z',
      end: '2026-06-14T23:59:59Z',
    });

    expect(result.breakdowns[0].category).toBe('expensive-model');
    expect(result.breakdowns[1].category).toBe('mid-model');
    expect(result.breakdowns[2].category).toBe('cheap-model');
  });

  it('calculates percentage correctly', async () => {
    mockClient.queryRows.mockResolvedValue({
      rows: [
        makeCostRow({ model: 'a', total_cost: 75 }),
        makeCostRow({ model: 'b', total_cost: 25 }),
      ],
      total: 2,
    });

    const result = await service.getSpendByModel({
      start: '2026-06-01T00:00:00Z',
      end: '2026-06-14T23:59:59Z',
    });

    const a = result.breakdowns.find((b) => b.category === 'a');
    expect(a!.percentage).toBeCloseTo(75);
  });
});

// ---------------------------------------------------------------------------
// getSpendByTeam
// ---------------------------------------------------------------------------

describe('AggregationService — getSpendByTeam', () => {
  let service: AggregationService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    service = new AggregationService(mockClient as any);
  });

  it('groups cost events by team_id', async () => {
    mockClient.queryRows.mockResolvedValue({
      rows: [
        makeCostRow({ team_id: 'team_a', total_cost: 0.40 }),
        makeCostRow({ team_id: 'team_b', total_cost: 0.60 }),
      ],
      total: 2,
    });

    const result = await service.getSpendByTeam({
      start: '2026-06-01T00:00:00Z',
      end: '2026-06-14T23:59:59Z',
    });

    expect(result.breakdowns.length).toBe(2);
    expect(result.breakdowns[0].category).toBe('team_b');
    expect(result.breakdowns[0].totalCost).toBeCloseTo(0.60);
  });

  it('uses "unknown" for rows without team_id', async () => {
    mockClient.queryRows.mockResolvedValue({
      rows: [
        makeCostRow({ team_id: null, total_cost: 0.10 }),
      ],
      total: 1,
    });

    const result = await service.getSpendByTeam({
      start: '2026-06-01T00:00:00Z',
      end: '2026-06-14T23:59:59Z',
    });

    expect(result.breakdowns[0].category).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// getSpendByClassification
// ---------------------------------------------------------------------------

describe('AggregationService — getSpendByClassification', () => {
  let service: AggregationService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    service = new AggregationService(mockClient as any);
  });

  it('groups cost events by classification', async () => {
    mockClient.queryRows.mockResolvedValue({
      rows: [
        makeCostRow({ classification: 'updating_code', total_cost: 0.40 }),
        makeCostRow({ classification: 'fixing_issues', total_cost: 0.30 }),
        makeCostRow({ classification: 'updating_code', total_cost: 0.20 }),
      ],
      total: 3,
    });

    const result = await service.getSpendByClassification({
      start: '2026-06-01T00:00:00Z',
      end: '2026-06-14T23:59:59Z',
    });

    expect(result.breakdowns.length).toBe(2);
    const code = result.breakdowns.find((b) => b.category === 'updating_code');
    expect(code!.totalCost).toBeCloseTo(0.60);
    expect(code!.eventCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getSpendTrend
// ---------------------------------------------------------------------------

describe('AggregationService — getSpendTrend', () => {
  let service: AggregationService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    service = new AggregationService(mockClient as any);
  });

  it('returns empty data points when no rows exist', async () => {
    const result = await service.getSpendTrend(
      { start: '2026-06-01T00:00:00Z', end: '2026-06-14T23:59:59Z' },
      'day'
    );

    expect(result.dataPoints).toEqual([]);
    expect(result.totalCost).toBe(0);
    expect(result.granularity).toBe('day');
  });

  it('buckets rows by day granularity', async () => {
    mockClient.queryRows.mockResolvedValue({
      rows: [
        makeCostRow({ timestamp: '2026-06-10T08:00:00.000Z', total_cost: 0.10 }),
        makeCostRow({ timestamp: '2026-06-10T14:00:00.000Z', total_cost: 0.20 }),
        makeCostRow({ timestamp: '2026-06-11T09:00:00.000Z', total_cost: 0.30 }),
      ],
      total: 3,
    });

    const result = await service.getSpendTrend(
      { start: '2026-06-10T00:00:00Z', end: '2026-06-11T23:59:59Z' },
      'day'
    );

    expect(result.dataPoints.length).toBe(2);
    expect(result.totalCost).toBeCloseTo(0.60);
  });

  it('sorts data points chronologically', async () => {
    mockClient.queryRows.mockResolvedValue({
      rows: [
        makeCostRow({ timestamp: '2026-06-12T10:00:00.000Z', total_cost: 0.30 }),
        makeCostRow({ timestamp: '2026-06-10T10:00:00.000Z', total_cost: 0.10 }),
        makeCostRow({ timestamp: '2026-06-11T10:00:00.000Z', total_cost: 0.20 }),
      ],
      total: 3,
    });

    const result = await service.getSpendTrend(
      { start: '2026-06-10T00:00:00Z', end: '2026-06-12T23:59:59Z' },
      'day'
    );

    expect(result.dataPoints.length).toBe(3);
    expect(new Date(result.dataPoints[0].timestamp).getTime())
      .toBeLessThan(new Date(result.dataPoints[1].timestamp).getTime());
  });
});

// ---------------------------------------------------------------------------
// getTotalSpend
// ---------------------------------------------------------------------------

describe('AggregationService — getTotalSpend', () => {
  let service: AggregationService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    service = new AggregationService(mockClient as any);
  });

  it('returns zero totals when no data exists', async () => {
    const result = await service.getTotalSpend({
      start: '2026-06-01T00:00:00Z',
      end: '2026-06-14T23:59:59Z',
    });

    expect(result.totalCost).toBe(0);
    expect(result.totalTokens).toBe(0);
    expect(result.totalEvents).toBe(0);
  });

  it('sums cost and token fields correctly', async () => {
    mockClient.queryRows.mockResolvedValue({
      rows: [
        makeCostRow({ total_cost: 1.50, total_tokens: 5000 }),
        makeCostRow({ total_cost: 2.50, total_tokens: 8000 }),
      ],
      total: 2,
    });

    const result = await service.getTotalSpend({
      start: '2026-06-01T00:00:00Z',
      end: '2026-06-14T23:59:59Z',
    });

    expect(result.totalCost).toBeCloseTo(4.00);
    expect(result.totalTokens).toBe(13000);
    expect(result.totalEvents).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getBatchPatterns
// ---------------------------------------------------------------------------

describe('AggregationService — getBatchPatterns', () => {
  let service: AggregationService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    service = new AggregationService(mockClient as any);
  });

  it('returns empty array when no batch patterns are detected', async () => {
    const patterns = await service.getBatchPatterns();
    expect(patterns).toEqual([]);
  });
});
