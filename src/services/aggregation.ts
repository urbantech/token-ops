/**
 * Usage Aggregation Service
 *
 * Ported from core/src/backend/app/services/usage_aggregation_service.py.
 * Queries ZeroDB tables to produce spend breakdowns, trends, and batch
 * pattern analytics for the TokenOps dashboard.
 */

import { getZeroDBClient, ZeroDBClient } from '../lib/zerodb-client';
import { getDetectedBatchPatterns } from './classifier';
import {
  AggregationTimeRange,
  AnalyticsResponse,
  BatchPattern,
  Granularity,
  SpendBreakdown,
  SpendTrend,
  TrendResponse,
} from '../types/telemetry';

// ---------------------------------------------------------------------------
// Table names (must match telemetry.ts)
// ---------------------------------------------------------------------------

const TABLE_PROMPT_EVENTS = 'prompt_events';
const TABLE_COST_EVENTS = 'cost_events';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toRows(result: { rows: Record<string, unknown>[] }): Record<string, unknown>[] {
  return result?.rows ?? [];
}

function sumField(rows: Record<string, unknown>[], field: string): number {
  return rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
}

function groupBy<T extends Record<string, unknown>>(rows: T[], key: string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = String(row[key] ?? 'unknown');
    const arr = groups.get(k) ?? [];
    arr.push(row);
    groups.set(k, arr);
  }
  return groups;
}

/**
 * Bucket a timestamp string into the requested granularity.
 */
function bucketTimestamp(ts: string, granularity: Granularity): string {
  const d = new Date(ts);
  switch (granularity) {
    case 'hour':
      d.setMinutes(0, 0, 0);
      break;
    case 'day':
      d.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
  }
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AggregationService {
  private client: ZeroDBClient;

  constructor(client?: ZeroDBClient) {
    this.client = client ?? getZeroDBClient();
  }

  // -----------------------------------------------------------------------
  // Core query helper — fetches cost events within a time range
  // -----------------------------------------------------------------------

  private async fetchCostRows(
    timeRange: AggregationTimeRange,
    extraFilters?: Record<string, unknown>
  ): Promise<Record<string, unknown>[]> {
    // ZeroDB NoSQL does not support range filters (gte/lte).
    // Fetch all rows and filter client-side by timestamp.
    const result = await this.client.queryRows({
      tableName: TABLE_COST_EVENTS,
      filters: extraFilters ?? {},
      orderBy: 'timestamp',
      order: 'asc',
      limit: 10_000,
    });
    const rows = toRows(result);
    return rows.filter((r) => {
      const ts = r.timestamp ? String(r.timestamp) : '';
      if (!ts) return true;
      return ts >= timeRange.start && ts <= timeRange.end;
    });
  }

  private async fetchPromptRows(
    timeRange: AggregationTimeRange,
    extraFilters?: Record<string, unknown>
  ): Promise<Record<string, unknown>[]> {
    const result = await this.client.queryRows({
      tableName: TABLE_PROMPT_EVENTS,
      filters: extraFilters ?? {},
      orderBy: 'timestamp',
      order: 'asc',
      limit: 10_000,
    });
    const rows = toRows(result);
    return rows.filter((r) => {
      const ts = r.timestamp ? String(r.timestamp) : '';
      if (!ts) return true;
      return ts >= timeRange.start && ts <= timeRange.end;
    });

  }

  // -----------------------------------------------------------------------
  // Spend by Model
  // -----------------------------------------------------------------------

  async getSpendByModel(timeRange: AggregationTimeRange): Promise<AnalyticsResponse> {
    const rows = await this.fetchCostRows(timeRange);
    const totalCost = sumField(rows, 'total_cost');
    const totalTokens = sumField(rows, 'total_tokens');
    const groups = groupBy(rows, 'model');

    const breakdowns: SpendBreakdown[] = [];
    for (const [model, modelRows] of groups) {
      const cost = sumField(modelRows, 'total_cost');
      breakdowns.push({
        category: model,
        totalCost: cost,
        totalTokens: sumField(modelRows, 'total_tokens'),
        eventCount: modelRows.length,
        percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0,
      });
    }

    breakdowns.sort((a, b) => b.totalCost - a.totalCost);

    return {
      timeRange,
      breakdowns,
      totalCost,
      totalTokens,
      totalEvents: rows.length,
    };
  }

  // -----------------------------------------------------------------------
  // Spend by Team
  // -----------------------------------------------------------------------

  async getSpendByTeam(timeRange: AggregationTimeRange): Promise<AnalyticsResponse> {
    const rows = await this.fetchCostRows(timeRange);
    const totalCost = sumField(rows, 'total_cost');
    const totalTokens = sumField(rows, 'total_tokens');
    const groups = groupBy(rows, 'team_id');

    const breakdowns: SpendBreakdown[] = [];
    for (const [team, teamRows] of groups) {
      const cost = sumField(teamRows, 'total_cost');
      breakdowns.push({
        category: team,
        totalCost: cost,
        totalTokens: sumField(teamRows, 'total_tokens'),
        eventCount: teamRows.length,
        percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0,
      });
    }

    breakdowns.sort((a, b) => b.totalCost - a.totalCost);

    return {
      timeRange,
      breakdowns,
      totalCost,
      totalTokens,
      totalEvents: rows.length,
    };
  }

  // -----------------------------------------------------------------------
  // Spend by Classification (Issue #43)
  // -----------------------------------------------------------------------

  async getSpendByClassification(timeRange: AggregationTimeRange): Promise<AnalyticsResponse> {
    const rows = await this.fetchCostRows(timeRange);
    const totalCost = sumField(rows, 'total_cost');
    const totalTokens = sumField(rows, 'total_tokens');
    const groups = groupBy(rows, 'classification');

    const breakdowns: SpendBreakdown[] = [];
    for (const [classification, classRows] of groups) {
      const cost = sumField(classRows, 'total_cost');
      breakdowns.push({
        category: classification,
        totalCost: cost,
        totalTokens: sumField(classRows, 'total_tokens'),
        eventCount: classRows.length,
        percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0,
      });
    }

    breakdowns.sort((a, b) => b.totalCost - a.totalCost);

    return {
      timeRange,
      breakdowns,
      totalCost,
      totalTokens,
      totalEvents: rows.length,
    };
  }

  // -----------------------------------------------------------------------
  // Spend Trend (time series)
  // -----------------------------------------------------------------------

  async getSpendTrend(
    timeRange: AggregationTimeRange,
    granularity: Granularity
  ): Promise<TrendResponse> {
    const rows = await this.fetchCostRows(timeRange);
    const totalCost = sumField(rows, 'total_cost');

    // Bucket rows into time periods
    const buckets = new Map<string, { totalCost: number; totalTokens: number; eventCount: number }>();

    for (const row of rows) {
      const bucket = bucketTimestamp(String(row.timestamp), granularity);
      const existing = buckets.get(bucket) ?? { totalCost: 0, totalTokens: 0, eventCount: 0 };
      existing.totalCost += Number(row.total_cost) || 0;
      existing.totalTokens += Number(row.total_tokens) || 0;
      existing.eventCount += 1;
      buckets.set(bucket, existing);
    }

    const dataPoints: SpendTrend[] = [];
    for (const [timestamp, data] of buckets) {
      dataPoints.push({ timestamp, ...data });
    }

    dataPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      timeRange,
      granularity,
      dataPoints,
      totalCost,
    };
  }

  // -----------------------------------------------------------------------
  // Total Spend
  // -----------------------------------------------------------------------

  async getTotalSpend(timeRange: AggregationTimeRange): Promise<{
    totalCost: number;
    totalTokens: number;
    totalEvents: number;
    timeRange: AggregationTimeRange;
  }> {
    const rows = await this.fetchCostRows(timeRange);

    return {
      totalCost: sumField(rows, 'total_cost'),
      totalTokens: sumField(rows, 'total_tokens'),
      totalEvents: rows.length,
      timeRange,
    };
  }

  // -----------------------------------------------------------------------
  // Batch Patterns (Issue #43)
  // -----------------------------------------------------------------------

  async getBatchPatterns(threshold: number = 3): Promise<BatchPattern[]> {
    // Get in-memory batch patterns from the classifier
    const detected = getDetectedBatchPatterns(threshold);

    return detected.map((d) => ({
      pattern: d.pattern,
      occurrences: d.count,
      firstSeen: new Date(d.firstSeen).toISOString(),
      lastSeen: new Date(d.lastSeen).toISOString(),
      totalTokens: 0, // Would need cross-reference with prompt events
      totalCost: 0,
      samplePrompts: [d.pattern],
      recommendation:
        d.count >= 5
          ? 'High repetition detected. Convert to a script or automation.'
          : 'Moderate repetition. Consider batching these operations.',
    }));
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _service: AggregationService | null = null;

export function getAggregationService(): AggregationService {
  if (!_service) {
    _service = new AggregationService();
  }
  return _service;
}
