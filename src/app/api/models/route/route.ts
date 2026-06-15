/**
 * POST /api/models/route
 * Route a request to the optimal model.
 * Refs #24
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeRequestSchema } from '../../../../lib/validation';
import { routeRequest } from '../../../../services/model-router';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = routeRequestSchema.safeParse(body);

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

    const decision = routeRequest(parsed.data.classification, parsed.data.tokenEstimate);

    return NextResponse.json(
      {
        success: true,
        data: decision,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('POST /api/models/route error:', message);

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
