/**
 * GET /api/context/utilization
 *
 * Returns context utilization metrics for a given time range,
 * including waste percentage, oversized prompt counts, and
 * actionable recommendations.
 *
 * Refs #19, #21
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getContextUtilization } from '@/services/context-compression';

const UtilizationQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = UtilizationQuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
        },
        { status: 400 }
      );
    }

    const utilization = await getContextUtilization({
      start: parsed.data.start,
      end: parsed.data.end,
    });

    return NextResponse.json({
      success: true,
      data: utilization,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
