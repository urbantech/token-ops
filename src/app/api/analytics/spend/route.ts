/**
 * GET /api/analytics/spend
 * Spend analytics with groupBy support (model, team, classification).
 * Optionally returns time-series trend data when granularity is specified.
 *
 * Query params:
 *   start       — ISO 8601 start of range (required)
 *   end         — ISO 8601 end of range (required)
 *   groupBy     — "model" | "team" | "classification" (default: "model")
 *   granularity — "hour" | "day" | "week" | "month" (optional, returns trend)
 */

import { NextRequest, NextResponse } from 'next/server';
import { spendQuerySchema } from '../../../../lib/validation';
import { getAggregationService } from '../../../../services/aggregation';
import {
  TelemetryResponse,
  AnalyticsResponse,
  TrendResponse,
} from '../../../../types/telemetry';

export async function GET(
  request: NextRequest
): Promise<NextResponse<TelemetryResponse<AnalyticsResponse | TrendResponse>>> {
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
    const timeRange = { start, end };
    const service = getAggregationService();

    // If granularity is specified, return a time-series trend
    if (granularity) {
      const trend = await service.getSpendTrend(timeRange, granularity);
      return NextResponse.json({
        success: true,
        data: trend,
        timestamp: new Date().toISOString(),
      });
    }

    // Otherwise return a grouped breakdown
    let result: AnalyticsResponse;
    switch (groupBy) {
      case 'team':
        result = await service.getSpendByTeam(timeRange);
        break;
      case 'classification':
        result = await service.getSpendByClassification(timeRange);
        break;
      case 'model':
      default:
        result = await service.getSpendByModel(timeRange);
        break;
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('GET /api/analytics/spend error:', message);

    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
