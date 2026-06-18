/**
 * Tests for GET /api/comments and POST /api/comments
 * Refs #comments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../services/comments', () => ({
  getCommentsService: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

import { GET, POST } from '../route';
import { getCommentsService } from '../../../../services/comments';
import { getServerSession } from 'next-auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000/api/comments';

function makeGetRequest(searchParams?: Record<string, string>): NextRequest {
  const url = new URL(BASE_URL);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url.toString(), { method: 'GET' });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cmt-abc',
    entryRank: 1,
    parentId: null,
    userId: 'user-1',
    userName: 'Alice',
    userImage: null,
    content: 'This looks correct.',
    vote: 'agree',
    flagged: false,
    flagReason: null,
    sentiment: 0.15,
    suggestedUrl: null,
    suggestsMethodChange: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function setupCommentsService(overrides: Record<string, unknown> = {}) {
  const mock = {
    getComments: vi.fn().mockResolvedValue([]),
    createComment: vi.fn().mockResolvedValue(makeComment()),
    ...overrides,
  };
  vi.mocked(getCommentsService).mockReturnValue(mock as ReturnType<typeof getCommentsService>);
  return mock;
}

function setupSession(user: Record<string, unknown> | null) {
  vi.mocked(getServerSession).mockResolvedValue(
    user ? { user } : null
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/comments
// ---------------------------------------------------------------------------

describe('GET /api/comments', () => {
  it('returns 200 with threaded comments when comments exist', async () => {
    const parent = makeComment({ id: 'cmt-parent', parentId: null });
    const reply = makeComment({ id: 'cmt-reply', parentId: 'cmt-parent' });
    setupCommentsService({ getComments: vi.fn().mockResolvedValue([parent, reply]) });

    const res = await GET(makeGetRequest({ entryRank: '1' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1); // one top-level thread
    expect(body.data[0].id).toBe('cmt-parent');
    expect(body.data[0].replies).toHaveLength(1);
    expect(body.data[0].replies[0].id).toBe('cmt-reply');
  });

  it('passes null entryRank when no entryRank param is provided', async () => {
    const mockService = setupCommentsService({ getComments: vi.fn().mockResolvedValue([]) });

    await GET(makeGetRequest());

    expect(mockService.getComments).toHaveBeenCalledWith(null);
  });

  it('passes parsed integer entryRank to the service', async () => {
    const mockService = setupCommentsService({ getComments: vi.fn().mockResolvedValue([]) });

    await GET(makeGetRequest({ entryRank: '5' }));

    expect(mockService.getComments).toHaveBeenCalledWith(5);
  });

  it('passes null when entryRank param is not a valid number', async () => {
    const mockService = setupCommentsService({ getComments: vi.fn().mockResolvedValue([]) });

    await GET(makeGetRequest({ entryRank: 'abc' }));

    expect(mockService.getComments).toHaveBeenCalledWith(null);
  });

  it('returns empty threads array when there are no comments', async () => {
    setupCommentsService({ getComments: vi.fn().mockResolvedValue([]) });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });

  it('includes a timestamp field in the response', async () => {
    setupCommentsService({ getComments: vi.fn().mockResolvedValue([]) });

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body.timestamp).toBeTruthy();
    expect(() => new Date(body.timestamp)).not.toThrow();
  });

  it('returns 500 and success=false when the service throws', async () => {
    setupCommentsService({
      getComments: vi.fn().mockRejectedValue(new Error('DB failure')),
    });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('DB failure');
  });

  it('organises replies under the correct parent thread', async () => {
    const parentA = makeComment({ id: 'cmt-A', parentId: null });
    const parentB = makeComment({ id: 'cmt-B', parentId: null });
    const replyToA = makeComment({ id: 'cmt-A1', parentId: 'cmt-A' });
    const replyToB = makeComment({ id: 'cmt-B1', parentId: 'cmt-B' });

    setupCommentsService({
      getComments: vi.fn().mockResolvedValue([parentA, parentB, replyToA, replyToB]),
    });

    const res = await GET(makeGetRequest({ entryRank: '1' }));
    const body = await res.json();

    const threadA = body.data.find((t: { id: string }) => t.id === 'cmt-A');
    const threadB = body.data.find((t: { id: string }) => t.id === 'cmt-B');

    expect(threadA.replies[0].id).toBe('cmt-A1');
    expect(threadB.replies[0].id).toBe('cmt-B1');
  });
});

// ---------------------------------------------------------------------------
// POST /api/comments — authentication
// ---------------------------------------------------------------------------

describe('POST /api/comments — authentication', () => {
  it('returns 401 when the session is null (not authenticated)', async () => {
    setupSession(null);

    const res = await POST(makePostRequest({ content: 'A valid comment.' }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Sign in required/i);
  });

  it('returns 401 when the session has no user', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: undefined } as any);

    const res = await POST(makePostRequest({ content: 'A valid comment.' }));

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/comments — validation
// ---------------------------------------------------------------------------

describe('POST /api/comments — input validation', () => {
  beforeEach(() => {
    setupSession({ id: 'user-1', name: 'Alice', email: 'alice@example.com', image: null });
  });

  it('returns 400 when content is missing', async () => {
    setupCommentsService();

    const res = await POST(makePostRequest({ entryRank: 1 }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when content is an empty string', async () => {
    setupCommentsService();

    const res = await POST(makePostRequest({ content: '' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when content is only whitespace', async () => {
    setupCommentsService();

    const res = await POST(makePostRequest({ content: '   ' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when content exceeds 2000 characters', async () => {
    setupCommentsService();

    const res = await POST(makePostRequest({ content: 'x'.repeat(2001) }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/2000/);
  });

  it('returns 400 when content is not a string', async () => {
    setupCommentsService();

    const res = await POST(makePostRequest({ content: 42 }));

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/comments — successful creation
// ---------------------------------------------------------------------------

describe('POST /api/comments — successful creation', () => {
  beforeEach(() => {
    setupSession({ id: 'user-1', name: 'Alice', email: 'alice@example.com', image: null });
  });

  it('returns 201 with the new comment on success', async () => {
    const created = makeComment({ id: 'cmt-new', content: 'Valid comment here.' });
    setupCommentsService({ createComment: vi.fn().mockResolvedValue(created) });

    const res = await POST(makePostRequest({ content: 'Valid comment here.', entryRank: 1, vote: 'agree' }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('cmt-new');
    expect(body.data.content).toBe('Valid comment here.');
  });

  it('trims whitespace from the content before storing', async () => {
    const mockService = setupCommentsService();

    await POST(makePostRequest({ content: '  trimmed content  ' }));

    const createCall = mockService.createComment.mock.calls[0];
    expect(createCall[0].content).toBe('trimmed content');
  });

  it('passes entryRank, parentId, and vote through to createComment', async () => {
    const mockService = setupCommentsService();

    await POST(makePostRequest({
      content: 'A reply with a vote.',
      entryRank: 3,
      parentId: 'cmt-parent',
      vote: 'disagree',
    }));

    const input = mockService.createComment.mock.calls[0][0];
    expect(input.entryRank).toBe(3);
    expect(input.parentId).toBe('cmt-parent');
    expect(input.vote).toBe('disagree');
  });

  it('uses the session user id to create the comment', async () => {
    setupSession({ id: 'user-42', name: 'Bob', email: 'bob@example.com', image: null });
    const mockService = setupCommentsService();

    await POST(makePostRequest({ content: 'Hello there.' }));

    const userArg = mockService.createComment.mock.calls[0][1];
    expect(userArg.id).toBe('user-42');
    expect(userArg.name).toBe('Bob');
  });

  it('falls back to email as user id when session.user.id is absent', async () => {
    setupSession({ name: 'Carol', email: 'carol@example.com', image: null });
    const mockService = setupCommentsService();

    await POST(makePostRequest({ content: 'Using email as id.' }));

    const userArg = mockService.createComment.mock.calls[0][1];
    expect(userArg.id).toBe('carol@example.com');
  });

  it('includes a timestamp in the response', async () => {
    setupCommentsService();

    const res = await POST(makePostRequest({ content: 'Timestamp check.' }));
    const body = await res.json();

    expect(body.timestamp).toBeTruthy();
    expect(() => new Date(body.timestamp)).not.toThrow();
  });

  it('defaults entryRank to null when omitted', async () => {
    const mockService = setupCommentsService();

    await POST(makePostRequest({ content: 'Overall comment.' }));

    const input = mockService.createComment.mock.calls[0][0];
    expect(input.entryRank).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POST /api/comments — error handling
// ---------------------------------------------------------------------------

describe('POST /api/comments — error handling', () => {
  beforeEach(() => {
    setupSession({ id: 'user-1', name: 'Alice', email: 'alice@example.com', image: null });
  });

  it('returns 403 when the service throws a "suspended" error', async () => {
    setupCommentsService({
      createComment: vi.fn().mockRejectedValue(
        new Error('Your account has been suspended from commenting.')
      ),
    });

    const res = await POST(makePostRequest({ content: 'Banned user comment.' }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('suspended');
  });

  it('returns 500 when the service throws a generic error', async () => {
    setupCommentsService({
      createComment: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });

    const res = await POST(makePostRequest({ content: 'Service down comment.' }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Connection refused');
  });

  it('returns 500 with a fallback message when a non-Error is thrown', async () => {
    setupCommentsService({
      createComment: vi.fn().mockRejectedValue('string error'),
    });

    const res = await POST(makePostRequest({ content: 'Non-error throw.' }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
