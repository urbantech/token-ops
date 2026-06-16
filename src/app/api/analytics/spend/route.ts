/**
 * GET /api/analytics/spend
 *
 * Spend analytics powered by AINative Core's production postgres
 * (llm_token_usage table with 457K+ real usage records).
 *
 * Query params:
 *   start       — ISO 8601 start of range (required)
 *   end         — ISO 8601 end of range (required)
 *   groupBy     — "model" | "provider" | "team" | "classification" (default: "model")
 *   granularity — "hour" | "day" | "week" | "month" (optional, returns trend)
 */

import { NextRequest, NextResponse } from 'next/server';
import { spendQuerySchema } from '../../../../lib/validation';
import * as db from '../../../../lib/ainative-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const params = {
      start: searchParams.get('start') ?? '',
      end: searchParams.get('end') ?? '',
      groupBy: searchParams.get('groupBy') ?? 'model',
      granularity: searchParams.get('granularity') ?? undefined,
    };

    const parsed = spendQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation failed: ${parsed.error.issues.map((i: { path: (string | number)[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { start, end, groupBy, granularity } = parsed.data;

    // Time-series trend
    if (granularity) {
      const dataPoints = await db.getSpendTrend(start, end, granularity as 'hour' | 'day' | 'week' | 'month');
      const totalCost = dataPoints.reduce((s, d) => s + d.total_cost, 0);

      return NextResponse.json({
        success: true,
        data: {
          timeRange: { start, end },
          granularity,
          dataPoints: dataPoints.map((d) => ({
            timestamp: d.bucket,
            totalCost: d.total_cost,
            totalTokens: d.total_tokens,
            eventCount: d.event_count,
          })),
          totalCost,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Grouped breakdown
    if (groupBy === 'model' || groupBy === 'classification') {
      // Both use model breakdown from real DB (no classification column in llm_token_usage)
      const rows = groupBy === 'provider'
        ? await db.getSpendByProvider(start, end)
        : await db.getSpendByModel(start, end);

      const totalCost = rows.reduce((s, r) => s + r.total_cost, 0);
      const totalTokens = rows.reduce((s, r) => s + r.total_tokens, 0);

      const breakdowns = rows.map((r) => ({
        category: 'model' in r ? r.model : r.provider,
        totalCost: r.total_cost,
        totalTokens: r.total_tokens,
        eventCount: r.event_count,
        percentage: totalCost > 0 ? (r.total_cost / totalCost) * 100 : 0,
        ...('provider' in r && 'model' in r ? { provider: r.provider } : {}),
      }));

      return NextResponse.json({
        success: true,
        data: {
          timeRange: { start, end },
          breakdowns,
          totalCost,
          totalTokens,
          totalEvents: rows.reduce((s, r) => s + r.event_count, 0),
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Provider breakdown
    const rows = await db.getSpendByProvider(start, end);
    const totalCost = rows.reduce((s, r) => s + r.total_cost, 0);
    const totalTokens = rows.reduce((s, r) => s + r.total_tokens, 0);

    return NextResponse.json({
      success: true,
      data: {
        timeRange: { start, end },
        breakdowns: rows.map((r) => ({
          category: r.provider,
          totalCost: r.total_cost,
          totalTokens: r.total_tokens,
          eventCount: r.event_count,
          percentage: totalCost > 0 ? (r.total_cost / totalCost) * 100 : 0,
        })),
        totalCost,
        totalTokens,
        totalEvents: rows.reduce((s, r) => s + r.event_count, 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('GET /api/analytics/spend error:', message);

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
