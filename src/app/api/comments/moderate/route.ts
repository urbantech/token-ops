/**
 * POST /api/comments/moderate
 * Run the comment moderation agent. Returns flagged comments,
 * suggested submissions, method change requests, and agent replies.
 */

import { NextResponse } from 'next/server';
import { getCommentModerator } from '../../../../services/comment-moderator';

export async function POST() {
  try {
    const moderator = getCommentModerator();
    const report = await moderator.runModeration();

    return NextResponse.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
