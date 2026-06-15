/**
 * GET /api/maturity
 * Generate an AI Maturity Report for a given period.
 * Query: start, end (ISO 8601)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMaturityAssessor } from '../../../services/maturity-assessor';

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

    const assessor = getMaturityAssessor();
    const report = await assessor.generateReport({ start, end });

    return NextResponse.json({ success: true, data: report, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
