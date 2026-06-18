/**
 * GET /api/comments?entryRank=N  — get comments for a row (or overall if no rank)
 * POST /api/comments             — create a comment (requires auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getCommentsService } from '../../../services/comments';

export async function GET(request: NextRequest) {
  try {
    const rank = request.nextUrl.searchParams.get('entryRank');
    const entryRank = rank != null ? parseInt(rank, 10) : null;

    const service = getCommentsService();
    const comments = await service.getComments(isNaN(entryRank as number) ? null : entryRank);

    // Organize into threads: top-level + replies
    const topLevel = comments.filter(c => c.parentId == null);
    const replies = comments.filter(c => c.parentId != null);

    const threads = topLevel.map(parent => ({
      ...parent,
      replies: replies.filter(r => r.parentId === parent.id),
    }));

    return NextResponse.json({ success: true, data: threads, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require auth
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Sign in required to comment' },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment content is required' },
        { status: 400 }
      );
    }

    if (body.content.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Comment must be under 2000 characters' },
        { status: 400 }
      );
    }

    const service = getCommentsService();
    const comment = await service.createComment(
      {
        entryRank: body.entryRank ?? null,
        parentId: body.parentId ?? null,
        content: body.content.trim(),
        vote: body.vote ?? null,
      },
      {
        id: (session.user as Record<string, unknown>).id as string ?? session.user.email ?? 'unknown',
        name: session.user.name ?? 'Anonymous',
        image: session.user.image,
      }
    );

    return NextResponse.json(
      { success: true, data: comment, timestamp: new Date().toISOString() },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('suspended') ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
