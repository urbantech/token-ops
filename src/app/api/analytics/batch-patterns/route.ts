/**
 * GET /api/analytics/batch-patterns
 * Returns detected repetitive prompt patterns that are candidates
 * for script/automation conversion (Issue #43).
 *
 * Query params:
 *   threshold — minimum occurrence count (default: 3, min: 2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { batchPatternsQuerySchema } from '../../../../lib/validation';
import { getAggregationService } from '../../../../services/aggregation';
import { TelemetryResponse, BatchPattern } from '../../../../types/telemetry';

export async function GET(
  request: NextRequest
): Promise<NextResponse<TelemetryResponse<BatchPattern[]>>> {
  try {
    const { searchParams } = request.nextUrl;

    const params = {
      threshold: searchParams.get('threshold') ?? '3',
    };

    const parsed = batchPatternsQuerySchema.safeParse(params);
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

    const service = getAggregationService();
    const patterns = await service.getBatchPatterns(parsed.data.threshold);

    return NextResponse.json({
      success: true,
      data: patterns,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('GET /api/analytics/batch-patterns error:', message);

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
