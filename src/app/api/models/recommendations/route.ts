/**
 * GET /api/models/recommendations
 * Returns model recommendations for a classification.
 * Refs #23
 */

import { NextRequest, NextResponse } from 'next/server';
import { recommendationsQuerySchema } from '../../../../lib/validation';
import { getRecommendations } from '../../../../services/model-router';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = recommendationsQuerySchema.safeParse({
      classification: searchParams.get('classification') ?? '',
    });

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

    const recommendations = getRecommendations(parsed.data.classification);

    return NextResponse.json(
      {
        success: true,
        data: recommendations,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('GET /api/models/recommendations error:', message);

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
