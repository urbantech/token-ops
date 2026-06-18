/**
 * Tests for CommentModerator
 * Refs #comments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../comments', () => ({
  getCommentsService: vi.fn(),
  CommentsService: vi.fn(),
}));

import { CommentModerator } from '../comment-moderator';
import { LeaderboardComment } from '../../types/comments';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComment(overrides: Partial<LeaderboardComment> = {}): LeaderboardComment {
  return {
    id: 'cmt-default',
    entryRank: 1,
    parentId: null,
    userId: 'user-1',
    userName: 'Alice',
    userImage: null,
    content: 'The benchmark results look accurate.',
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

function createMockCommentsService(overrides: Record<string, unknown> = {}) {
  return {
    getComments: vi.fn().mockResolvedValue([]),
    banUser: vi.fn().mockResolvedValue(undefined),
    isUserBanned: vi.fn().mockResolvedValue(false),
    getSuggestedSubmissions: vi.fn().mockResolvedValue([]),
    getMethodChangeRequests: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// runModeration — empty comments
// ---------------------------------------------------------------------------

describe('CommentModerator.runModeration — empty comment set', () => {
  it('returns a zero-count report when there are no comments', async () => {
    const mockService = createMockCommentsService();
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(report.totalComments).toBe(0);
    expect(report.flaggedComments).toBe(0);
    expect(report.bannedUsers).toHaveLength(0);
    expect(report.suggestedSubmissions).toHaveLength(0);
    expect(report.methodChangeRequests).toHaveLength(0);
    expect(report.agentReplies).toHaveLength(0);
    expect(report.sentimentByEntry).toEqual({});
    expect(report.scannedAt).toBeTruthy();
  });

  it('sets scannedAt to a valid ISO timestamp', async () => {
    const mockService = createMockCommentsService();
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(() => new Date(report.scannedAt)).not.toThrow();
    expect(new Date(report.scannedAt).toISOString()).toBe(report.scannedAt);
  });
});

// ---------------------------------------------------------------------------
// runModeration — flagged comments
// ---------------------------------------------------------------------------

describe('CommentModerator.runModeration — flagged comment handling', () => {
  it('counts flagged comments in the report', async () => {
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce([makeComment({ flagged: true, userId: 'user-spam' })])
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(report.flaggedComments).toBe(1);
  });

  it('does NOT auto-ban a user with fewer than 3 flagged comments', async () => {
    const flagged = [
      makeComment({ id: 'cmt-1', flagged: true, userId: 'user-bad' }),
      makeComment({ id: 'cmt-2', flagged: true, userId: 'user-bad' }),
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(flagged)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(report.bannedUsers).toHaveLength(0);
    expect(mockService.banUser).not.toHaveBeenCalled();
  });

  it('auto-bans a user who has 3 or more flagged comments', async () => {
    const flagged = [
      makeComment({ id: 'cmt-1', flagged: true, userId: 'user-repeat', userName: 'Spammer' }),
      makeComment({ id: 'cmt-2', flagged: true, userId: 'user-repeat', userName: 'Spammer' }),
      makeComment({ id: 'cmt-3', flagged: true, userId: 'user-repeat', userName: 'Spammer' }),
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(flagged)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(report.bannedUsers).toContain('user-repeat');
    expect(mockService.banUser).toHaveBeenCalledOnce();
    const banCall = mockService.banUser.mock.calls[0];
    expect(banCall[0]).toBe('user-repeat');
    expect(banCall[1]).toBe('Spammer');
    expect(banCall[2]).toMatch(/Auto-banned/);
  });

  it('does not ban the same user twice in a single scan', async () => {
    const flagged = [
      makeComment({ id: 'cmt-1', flagged: true, userId: 'user-repeat', userName: 'SpamBot' }),
      makeComment({ id: 'cmt-2', flagged: true, userId: 'user-repeat', userName: 'SpamBot' }),
      makeComment({ id: 'cmt-3', flagged: true, userId: 'user-repeat', userName: 'SpamBot' }),
      makeComment({ id: 'cmt-4', flagged: true, userId: 'user-repeat', userName: 'SpamBot' }),
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(flagged)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    // User ID should appear only once in bannedUsers
    const occurrences = report.bannedUsers.filter(id => id === 'user-repeat').length;
    expect(occurrences).toBe(1);
    expect(mockService.banUser).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// runModeration — sentiment analysis
// ---------------------------------------------------------------------------

describe('CommentModerator.runModeration — sentiment analysis', () => {
  it('groups sentiments by entry rank', async () => {
    const comments = [
      makeComment({ id: 'cmt-1', entryRank: 2, sentiment: 0.5, flagged: false }),
      makeComment({ id: 'cmt-2', entryRank: 2, sentiment: -0.3, flagged: false }),
      makeComment({ id: 'cmt-3', entryRank: 5, sentiment: 0.2, flagged: false }),
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(comments)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(report.sentimentByEntry[2]).toBeDefined();
    expect(report.sentimentByEntry[5]).toBeDefined();
    expect(report.sentimentByEntry[2].avg).toBeCloseTo(0.1, 5);
  });

  it('categorises sentiments as positive, negative, and neutral', async () => {
    const comments = [
      makeComment({ id: 'cmt-1', entryRank: 3, sentiment: 0.5 }),  // positive
      makeComment({ id: 'cmt-2', entryRank: 3, sentiment: -0.5 }), // negative
      makeComment({ id: 'cmt-3', entryRank: 3, sentiment: 0.0 }),  // neutral
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(comments)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(report.sentimentByEntry[3].positive).toBe(1);
    expect(report.sentimentByEntry[3].negative).toBe(1);
    expect(report.sentimentByEntry[3].neutral).toBe(1);
  });

  it('excludes flagged comments from sentiment grouping', async () => {
    const comments = [
      makeComment({ id: 'cmt-1', entryRank: 4, sentiment: 0.8, flagged: false }),
      makeComment({ id: 'cmt-2', entryRank: 4, sentiment: -0.9, flagged: true }),
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(comments)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    // Only the non-flagged comment should be in the entry
    expect(report.sentimentByEntry[4].positive).toBe(1);
    expect(report.sentimentByEntry[4].negative).toBe(0);
  });

  it('does not create a sentiment entry for overall (null entryRank) comments', async () => {
    const comments = [
      makeComment({ id: 'cmt-1', entryRank: null, sentiment: 0.5, flagged: false }),
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(comments)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    // null entryRank should not appear as a key (NaN or "null" would be wrong)
    expect(Object.keys(report.sentimentByEntry)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// runModeration — suggested submissions
// ---------------------------------------------------------------------------

describe('CommentModerator.runModeration — suggested submissions extraction', () => {
  it('extracts suggested URLs from comments that have a suggestedUrl', async () => {
    const comments = [
      makeComment({
        id: 'cmt-url',
        userName: 'Bob',
        suggestedUrl: 'https://example.com/model-eval',
        flagged: false,
      }),
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(comments)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(report.suggestedSubmissions).toHaveLength(1);
    expect(report.suggestedSubmissions[0].url).toBe('https://example.com/model-eval');
    expect(report.suggestedSubmissions[0].commentId).toBe('cmt-url');
    expect(report.suggestedSubmissions[0].userName).toBe('Bob');
  });

  it('excludes flagged comments from suggested submissions', async () => {
    const comments = [
      makeComment({
        id: 'cmt-flagged',
        suggestedUrl: 'https://spam.com',
        flagged: true,
      }),
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(comments)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(report.suggestedSubmissions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// runModeration — method change request classification
// ---------------------------------------------------------------------------

describe('CommentModerator.runModeration — method change request classification', () => {
  it('classifies a clear method change request and generates a run_new_test reply', async () => {
    // A comment with enough clarity signals to score >= 3
    const content = 'Please retest using gpt-4o model with the GSM benchmark dataset. This should show 30% token reduction from compression.';
    const comments = [
      makeComment({
        id: 'cmt-method',
        userName: 'Charlie',
        suggestsMethodChange: true,
        flagged: false,
        content,
      }),
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(comments)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    const reply = report.agentReplies.find(r => r.commentId === 'cmt-method');
    expect(reply).toBeDefined();
    expect(reply!.action).toBe('run_new_test');
    expect(reply!.reply).toContain('Charlie');

    const req = report.methodChangeRequests.find(r => r.commentId === 'cmt-method');
    expect(req).toBeDefined();
    expect(req!.summary).toContain('Clear request');
  });

  it('classifies an unclear method change request and generates a request_clarification reply', async () => {
    const content = 'You should try a different approach for this benchmark.';
    const comments = [
      makeComment({
        id: 'cmt-unclear',
        userName: 'Dave',
        suggestsMethodChange: true,
        flagged: false,
        content,
      }),
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(comments)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    const reply = report.agentReplies.find(r => r.commentId === 'cmt-unclear');
    expect(reply).toBeDefined();
    expect(reply!.action).toBe('request_clarification');
    expect(reply!.reply).toContain('Dave');

    const req = report.methodChangeRequests.find(r => r.commentId === 'cmt-unclear');
    expect(req).toBeDefined();
    expect(req!.summary).toContain('Needs clarification');
  });

  it('excludes flagged method change requests', async () => {
    const comments = [
      makeComment({
        id: 'cmt-flagged-method',
        suggestsMethodChange: true,
        flagged: true,
        content: 'Try using gpt-4o with the GSM benchmark for 30% token cost reduction.',
      }),
    ];
    const mockService = createMockCommentsService({
      getComments: vi.fn()
        .mockResolvedValueOnce(comments)
        .mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(report.methodChangeRequests).toHaveLength(0);
    expect(report.agentReplies).toHaveLength(0);
  });

  it('returns empty arrays when there are no method change comments', async () => {
    const mockService = createMockCommentsService({
      getComments: vi.fn().mockResolvedValue([]),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(report.methodChangeRequests).toHaveLength(0);
    expect(report.agentReplies).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// runModeration — resilience
// ---------------------------------------------------------------------------

describe('CommentModerator.runModeration — resilience', () => {
  it('returns an empty report when getComments throws', async () => {
    const mockService = createMockCommentsService({
      getComments: vi.fn().mockRejectedValue(new Error('DB unavailable')),
    });
    const moderator = new CommentModerator(mockService as any);

    const report = await moderator.runModeration();

    expect(report.totalComments).toBe(0);
    expect(report.flaggedComments).toBe(0);
  });
});
