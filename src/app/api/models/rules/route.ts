/**
 * GET /api/models/rules
 * Returns all routing rules.
 * Refs #24
 */

import { NextResponse } from 'next/server';
import { getRoutingRules } from '../../../../services/model-router';

export async function GET(): Promise<NextResponse> {
  try {
    const rules = getRoutingRules();

    return NextResponse.json(
      {
        success: true,
        data: rules,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('GET /api/models/rules error:', message);

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
