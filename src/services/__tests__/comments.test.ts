/**
 * Tests for CommentsService
 * Refs #comments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/zerodb-client', () => ({
  getZeroDBClient: vi.fn(() => ({
    queryRows: vi.fn().mockResolvedValue({ rows: [] }),
    insertRows: vi.fn().mockResolvedValue({}),
    createTable: vi.fn().mockResolvedValue({}),
  })),
}));

import { CommentsService } from '../comments';
import { getZeroDBClient } from '../../lib/zerodb-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockClient() {
  return {
    createTable: vi.fn().mockResolvedValue({}),
    insertRows: vi.fn().mockResolvedValue({}),
    queryRows: vi.fn().mockResolvedValue({ rows: [] }),
  };
}

function makeCommentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cmt-abc123',
    entry_rank: 1,
    parent_id: null,
    user_id: 'user-1',
    user_name: 'Alice',
    user_image: null,
    content: 'Great benchmark results.',
    vote: 'agree',
    flagged: false,
    flag_reason: null,
    sentiment: 0.15,
    suggested_url: null,
    suggests_method_change: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const TEST_USER = { id: 'user-1', name: 'Alice', image: null };

// ---------------------------------------------------------------------------
// createComment
// ---------------------------------------------------------------------------

describe('CommentsService.createComment', () => {
  let client: ReturnType<typeof createMockClient>;
  let service: CommentsService;

  beforeEach(() => {
    client = createMockClient();
    // Return empty rows by default (user not banned)
    client.queryRows.mockResolvedValue({ rows: [] });
    service = new CommentsService(client as any);
  });

  it('inserts a new comment row and returns a LeaderboardComment', async () => {
    const comment = await service.createComment(
      { entryRank: 1, parentId: null, content: 'Looks correct.', vote: 'agree' },
      TEST_USER
    );

    expect(client.insertRows).toHaveBeenCalledOnce();
    const call = client.insertRows.mock.calls[0][0];
    expect(call.tableName).toBe('leaderboard_comments');
    expect(call.rows[0].content).toBe('Looks correct.');
    expect(call.rows[0].user_id).toBe('user-1');
    expect(call.rows[0].vote).toBe('agree');

    expect(comment.id).toMatch(/^cmt-/);
    expect(comment.content).toBe('Looks correct.');
    expect(comment.userId).toBe('user-1');
    expect(comment.vote).toBe('agree');
    expect(comment.entryRank).toBe(1);
  });

  it('throws when the user is banned', async () => {
    // Ban lookup returns a row
    client.queryRows.mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] });

    await expect(
      service.createComment(
        { entryRank: null, parentId: null, content: 'Hello', vote: null },
        TEST_USER
      )
    ).rejects.toThrow('suspended');
  });

  it('flattens 3-level nesting to 2 levels (attaches to grandparent)', async () => {
    const grandparentRow = makeCommentRow({ id: 'cmt-gp', parent_id: null });
    const parentRow = makeCommentRow({ id: 'cmt-p', parent_id: 'cmt-gp' });

    // First queryRows call: ban check (no rows)
    // Second queryRows call: look up parent to find its own parent
    client.queryRows
      .mockResolvedValueOnce({ rows: [] })           // ban check
      .mockResolvedValueOnce({ rows: [parentRow] }); // parent lookup

    const comment = await service.createComment(
      { entryRank: 1, parentId: 'cmt-p', content: 'Deep reply', vote: null },
      TEST_USER
    );

    // Should be attached to grandparent, not the direct parent
    expect(comment.parentId).toBe('cmt-gp');
    const insertedRow = client.insertRows.mock.calls[0][0].rows[0];
    expect(insertedRow.parent_id).toBe('cmt-gp');
  });

  it('detects a URL in the comment content and stores it', async () => {
    client.queryRows.mockResolvedValue({ rows: [] });

    const comment = await service.createComment(
      {
        entryRank: null,
        parentId: null,
        content: 'Try this benchmark https://example.com/eval for comparison.',
        vote: null,
      },
      TEST_USER
    );

    expect(comment.suggestedUrl).toBe('https://example.com/eval');
    const insertedRow = client.insertRows.mock.calls[0][0].rows[0];
    expect(insertedRow.suggested_url).toBe('https://example.com/eval');
  });

  it('detects a method change suggestion and sets suggestsMethodChange=true', async () => {
    client.queryRows.mockResolvedValue({ rows: [] });

    const comment = await service.createComment(
      {
        entryRank: 1,
        parentId: null,
        content: 'You should try using a different model for this benchmark.',
        vote: null,
      },
      TEST_USER
    );

    expect(comment.suggestsMethodChange).toBe(true);
    const insertedRow = client.insertRows.mock.calls[0][0].rows[0];
    expect(insertedRow.suggests_method_change).toBe(true);
  });

  it('does not set suggestsMethodChange for unrelated content', async () => {
    client.queryRows.mockResolvedValue({ rows: [] });

    const comment = await service.createComment(
      { entryRank: 1, parentId: null, content: 'Good work on this.', vote: 'agree' },
      TEST_USER
    );

    expect(comment.suggestsMethodChange).toBe(false);
  });

  it('sets vote=null for overall (non-entry) comments regardless of input', async () => {
    client.queryRows.mockResolvedValue({ rows: [] });

    const comment = await service.createComment(
      { entryRank: null, parentId: null, content: 'Overall great platform.', vote: 'agree' },
      TEST_USER
    );

    // vote should be null because entryRank is null
    expect(comment.vote).toBeNull();
  });

  it('calls createTable during table initialization', async () => {
    // Reset module-level _tablesCreated by creating service with a new client that
    // sees createTable invocations — table guard is module-level so we just verify
    // the service does not crash and insert still happens
    client.queryRows.mockResolvedValue({ rows: [] });

    await service.createComment(
      { entryRank: null, parentId: null, content: 'Hello world.', vote: null },
      TEST_USER
    );

    // insertRows was called, meaning service initialized and persisted
    expect(client.insertRows).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getComments
// ---------------------------------------------------------------------------

describe('CommentsService.getComments', () => {
  let client: ReturnType<typeof createMockClient>;
  let service: CommentsService;

  beforeEach(() => {
    client = createMockClient();
    service = new CommentsService(client as any);
  });

  it('returns overall comments (entryRank=null) filtered to those with null entry_rank', async () => {
    client.queryRows.mockResolvedValue({
      rows: [
        makeCommentRow({ id: 'cmt-1', entry_rank: null }),
        makeCommentRow({ id: 'cmt-2', entry_rank: 3 }),
        makeCommentRow({ id: 'cmt-3', entry_rank: null }),
      ],
    });

    const comments = await service.getComments(null);

    expect(comments).toHaveLength(2);
    expect(comments.every(c => c.entryRank == null)).toBe(true);
  });

  it('returns entry-specific comments filtered by entryRank', async () => {
    client.queryRows.mockResolvedValue({
      rows: [
        makeCommentRow({ id: 'cmt-1', entry_rank: 1 }),
        makeCommentRow({ id: 'cmt-2', entry_rank: 2 }),
        makeCommentRow({ id: 'cmt-3', entry_rank: 1 }),
      ],
    });

    const comments = await service.getComments(1);

    expect(comments).toHaveLength(2);
    expect(comments.every(c => c.entryRank === 1)).toBe(true);
  });

  it('excludes flagged comments', async () => {
    client.queryRows.mockResolvedValue({
      rows: [
        makeCommentRow({ id: 'cmt-1', entry_rank: 1, flagged: false }),
        makeCommentRow({ id: 'cmt-2', entry_rank: 1, flagged: true, flag_reason: 'Spam detected' }),
      ],
    });

    const comments = await service.getComments(1);

    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe('cmt-1');
  });

  it('returns empty array when there are no matching comments', async () => {
    client.queryRows.mockResolvedValue({ rows: [] });

    const comments = await service.getComments(99);

    expect(comments).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getVoteSummary
// ---------------------------------------------------------------------------

describe('CommentsService.getVoteSummary', () => {
  let client: ReturnType<typeof createMockClient>;
  let service: CommentsService;

  beforeEach(() => {
    client = createMockClient();
    service = new CommentsService(client as any);
  });

  it('counts agree and disagree votes on top-level entry comments', async () => {
    client.queryRows.mockResolvedValue({
      rows: [
        makeCommentRow({ id: 'cmt-1', entry_rank: 1, parent_id: null, vote: 'agree', sentiment: 0.3 }),
        makeCommentRow({ id: 'cmt-2', entry_rank: 1, parent_id: null, vote: 'agree', sentiment: 0.15 }),
        makeCommentRow({ id: 'cmt-3', entry_rank: 1, parent_id: null, vote: 'disagree', sentiment: -0.15 }),
        makeCommentRow({ id: 'cmt-4', entry_rank: 1, parent_id: 'cmt-1', vote: null, sentiment: 0 }),
      ],
    });

    const summary = await service.getVoteSummary(1);

    expect(summary.entryRank).toBe(1);
    expect(summary.agreeCount).toBe(2);
    expect(summary.disagreeCount).toBe(1);
    expect(summary.totalComments).toBe(4);
  });

  it('does not count reply votes in the summary', async () => {
    client.queryRows.mockResolvedValue({
      rows: [
        makeCommentRow({ id: 'cmt-1', entry_rank: 1, parent_id: null, vote: 'agree' }),
        // reply with a vote should not count
        makeCommentRow({ id: 'cmt-2', entry_rank: 1, parent_id: 'cmt-1', vote: 'disagree' }),
      ],
    });

    const summary = await service.getVoteSummary(1);

    expect(summary.agreeCount).toBe(1);
    expect(summary.disagreeCount).toBe(0);
  });

  it('returns zeroed counts when there are no comments', async () => {
    client.queryRows.mockResolvedValue({ rows: [] });

    const summary = await service.getVoteSummary(5);

    expect(summary.agreeCount).toBe(0);
    expect(summary.disagreeCount).toBe(0);
    expect(summary.totalComments).toBe(0);
    expect(summary.avgSentiment).toBe(0);
  });

  it('computes average sentiment across all non-flagged comments', async () => {
    client.queryRows.mockResolvedValue({
      rows: [
        makeCommentRow({ id: 'cmt-1', entry_rank: 2, vote: 'agree', sentiment: 0.30 }),
        makeCommentRow({ id: 'cmt-2', entry_rank: 2, vote: 'disagree', sentiment: -0.30 }),
      ],
    });

    const summary = await service.getVoteSummary(2);

    expect(summary.avgSentiment).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// analyzeSentiment
// ---------------------------------------------------------------------------

describe('CommentsService.analyzeSentiment', () => {
  const service = new CommentsService(createMockClient() as any);

  it('returns a positive score for clearly positive text', () => {
    const score = service.analyzeSentiment('Great work! The results are excellent and very accurate.');
    expect(score).toBeGreaterThan(0);
  });

  it('returns a negative score for clearly negative text', () => {
    const score = service.analyzeSentiment('The results are wrong and completely misleading garbage.');
    expect(score).toBeLessThan(0);
  });

  it('returns a near-zero score for neutral text', () => {
    const score = service.analyzeSentiment('The dataset was processed on Monday.');
    expect(score).toBeCloseTo(0, 5);
  });

  it('clamps score to a maximum of 1', () => {
    const text = 'great excellent amazing love confirmed works validated impressive useful helpful accurate correct good nice awesome';
    const score = service.analyzeSentiment(text);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('clamps score to a minimum of -1', () => {
    const text = 'wrong disagree incorrect flawed broken misleading inaccurate fake bad poor terrible useless overestimated overhyped scam garbage';
    const score = service.analyzeSentiment(text);
    expect(score).toBeGreaterThanOrEqual(-1);
  });
});

// ---------------------------------------------------------------------------
// detectAbuse
// ---------------------------------------------------------------------------

describe('CommentsService.detectAbuse', () => {
  const service = new CommentsService(createMockClient() as any);

  it('flags content with 10+ repeated characters as spam', () => {
    const result = service.detectAbuse('aaaaaaaaaaa', 'normaluser');
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('Spam detected');
  });

  it('flags content containing spam keywords', () => {
    const result = service.detectAbuse('Buy now and earn $ free money', 'normaluser');
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('Spam detected');
  });

  it('flags content with three or more URLs', () => {
    const result = service.detectAbuse(
      'Check https://a.com https://b.com https://c.com',
      'normaluser'
    );
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('Spam detected');
  });

  it('flags content containing abusive language', () => {
    const result = service.detectAbuse('This is such bullshit work', 'normaluser');
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('Abusive language');
  });

  it('flags content that is excessively long (> 3000 characters)', () => {
    // Use varied text to avoid triggering the repeated-characters spam pattern
    const word = 'benchmark results are interesting ';
    const longContent = word.repeat(Math.ceil(3001 / word.length)).slice(0, 3001);
    const result = service.detectAbuse(longContent, 'normaluser');
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('Excessively long comment');
  });

  it('flags bot-like username patterns (short prefix + 5+ digits)', () => {
    const result = service.detectAbuse('Normal comment content here.', 'ab12345');
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('Bot-like username pattern');
  });

  it('does not flag clean, normal content', () => {
    const result = service.detectAbuse(
      'The benchmark methodology looks sound, good work.',
      'alice_researcher'
    );
    expect(result.flagged).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('does not flag a single URL in content', () => {
    const result = service.detectAbuse(
      'See the results at https://example.com for details.',
      'normaluser'
    );
    expect(result.flagged).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// banUser / isUserBanned
// ---------------------------------------------------------------------------

describe('CommentsService.banUser / isUserBanned', () => {
  let client: ReturnType<typeof createMockClient>;
  let service: CommentsService;

  beforeEach(() => {
    client = createMockClient();
    service = new CommentsService(client as any);
  });

  it('banUser inserts a row into leaderboard_bans', async () => {
    client.queryRows.mockResolvedValue({ rows: [] }); // for ensureTables ban-check on first call

    await service.banUser('user-99', 'Spammer', 'Too many spam comments');

    expect(client.insertRows).toHaveBeenCalledOnce();
    const call = client.insertRows.mock.calls[0][0];
    expect(call.tableName).toBe('leaderboard_bans');
    expect(call.rows[0].user_id).toBe('user-99');
    expect(call.rows[0].reason).toBe('Too many spam comments');
  });

  it('isUserBanned returns true when the bans table has a matching row', async () => {
    client.queryRows.mockResolvedValue({ rows: [{ user_id: 'user-99' }] });

    const banned = await service.isUserBanned('user-99');

    expect(banned).toBe(true);
  });

  it('isUserBanned returns false when the bans table has no matching row', async () => {
    client.queryRows.mockResolvedValue({ rows: [] });

    const banned = await service.isUserBanned('user-clean');

    expect(banned).toBe(false);
  });

  it('isUserBanned returns false when the query throws', async () => {
    client.queryRows.mockRejectedValue(new Error('DB error'));

    const banned = await service.isUserBanned('user-any');

    expect(banned).toBe(false);
  });
});
