/**
 * POST /api/consultant/action-plans
 * Create an action plan from recommendations.
 * Body: { title: string, recommendations: [...] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConsultantService } from '../../../../services/consultant';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title || !Array.isArray(body.recommendations)) {
      return NextResponse.json(
        { success: false, error: 'title (string) and recommendations (array) required' },
        { status: 400 }
      );
    }

    const service = getConsultantService();
    const plan = await service.createActionPlan(body.title, body.recommendations);

    return NextResponse.json(
      { success: true, data: plan, timestamp: new Date().toISOString() },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
