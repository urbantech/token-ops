/**
 * POST /api/telemetry/cost
 * Record a cost event (Issue #9).
 */

import { NextRequest, NextResponse } from 'next/server';
import { costEventSchema } from '../../../../lib/validation';
import { getTelemetryService } from '../../../../services/telemetry';
import { TelemetryResponse, CostEvent } from '../../../../types/telemetry';

export async function POST(request: NextRequest): Promise<NextResponse<TelemetryResponse<CostEvent>>> {
  try {
    const body = await request.json();
    const parsed = costEventSchema.safeParse(body);

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

    const service = getTelemetryService();
    const result = await service.recordCostEvent(parsed.data);

    return NextResponse.json(
      {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('POST /api/telemetry/cost error:', message);

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
