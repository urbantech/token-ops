/**
 * GET /api/comments/vote-summary — get agree/disagree counts for all entries
 */

import { NextResponse } from 'next/server';
import { getCommentsService } from '../../../../services/comments';

export async function GET() {
  try {
    const service = getCommentsService();
    const summaries = await service.getAllVoteSummaries();

    return NextResponse.json({
      success: true,
      data: summaries,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
