/**
 * GET /api/consultant/insights
 * Returns customer insights (alerts, recommendations, risks, opportunities).
 * Query: start, end (ISO 8601)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConsultantService } from '../../../../services/consultant';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: 'start and end query params required' },
        { status: 400 }
      );
    }

    const service = getConsultantService();
    const insights = await service.getCustomerInsights({ start, end });

    return NextResponse.json({ success: true, data: insights, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
