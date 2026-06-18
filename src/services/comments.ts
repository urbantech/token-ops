/**
 * Comments Service — ZeroDB-backed leaderboard discussion system
 *
 * Tables (in ZeroDB project token-ops):
 *   leaderboard_comments — all comments and replies
 *   leaderboard_bans     — banned users
 *
 * Features:
 *   - Comments on individual rows or overall board
 *   - 2-level deep replies
 *   - Agree/Disagree voting on row comments
 *   - Bot/abuse detection flags
 *   - Sentiment scoring
 */

import { getZeroDBClient, ZeroDBClient } from '../lib/zerodb-client';
import {
  LeaderboardComment,
  CommentVoteSummary,
  CreateCommentInput,
  BannedUser,
} from '../types/comments';

const TABLE_COMMENTS = 'leaderboard_comments';
const TABLE_BANS = 'leaderboard_bans';

let _tablesCreated = false;

async function ensureTables(client: ZeroDBClient): Promise<void> {
  if (_tablesCreated) return;
  try {
    await client.createTable({
      tableName: TABLE_COMMENTS,
      columns: [
        { name: 'id', type: 'string' },
        { name: 'entry_rank', type: 'integer', nullable: true },
        { name: 'parent_id', type: 'string', nullable: true },
        { name: 'user_id', type: 'string' },
        { name: 'user_name', type: 'string' },
        { name: 'user_image', type: 'string', nullable: true },
        { name: 'content', type: 'string' },
        { name: 'vote', type: 'string', nullable: true },
        { name: 'flagged', type: 'boolean' },
        { name: 'flag_reason', type: 'string', nullable: true },
        { name: 'sentiment', type: 'float', nullable: true },
        { name: 'suggested_url', type: 'string', nullable: true },
        { name: 'suggests_method_change', type: 'boolean' },
        { name: 'created_at', type: 'timestamp' },
        { name: 'updated_at', type: 'timestamp' },
      ],
    });
  } catch { /* table may already exist */ }
  try {
    await client.createTable({
      tableName: TABLE_BANS,
      columns: [
        { name: 'user_id', type: 'string' },
        { name: 'user_name', type: 'string' },
        { name: 'reason', type: 'string' },
        { name: 'banned_at', type: 'timestamp' },
      ],
    });
  } catch { /* table may already exist */ }
  _tablesCreated = true;
}

function rowToComment(row: Record<string, unknown>): LeaderboardComment {
  return {
    id: String(row.id ?? ''),
    entryRank: row.entry_rank != null ? Number(row.entry_rank) : null,
    parentId: row.parent_id ? String(row.parent_id) : null,
    userId: String(row.user_id ?? ''),
    userName: String(row.user_name ?? ''),
    userImage: row.user_image ? String(row.user_image) : null,
    content: String(row.content ?? ''),
    vote: row.vote ? String(row.vote) as 'agree' | 'disagree' : null,
    flagged: Boolean(row.flagged),
    flagReason: row.flag_reason ? String(row.flag_reason) : null,
    sentiment: row.sentiment != null ? Number(row.sentiment) : null,
    suggestedUrl: row.suggested_url ? String(row.suggested_url) : null,
    suggestsMethodChange: Boolean(row.suggests_method_change),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export class CommentsService {
  private client: ZeroDBClient;

  constructor(client?: ZeroDBClient) {
    this.client = client ?? getZeroDBClient();
  }

  async createComment(
    input: CreateCommentInput,
    user: { id: string; name: string; image?: string | null }
  ): Promise<LeaderboardComment> {
    await ensureTables(this.client);

    // Check ban
    const banned = await this.isUserBanned(user.id);
    if (banned) {
      throw new Error('Your account has been suspended from commenting.');
    }

    // Enforce 2-level depth: if parent itself has a parent, attach to grandparent
    let effectiveParentId = input.parentId;
    if (effectiveParentId) {
      const parent = await this.getComment(effectiveParentId);
      if (parent?.parentId) {
        effectiveParentId = parent.parentId; // flatten to 2 levels
      }
    }

    // Detect suggested URLs
    const urlMatch = input.content.match(/https?:\/\/[^\s)]+/);
    const suggestedUrl = urlMatch ? urlMatch[0] : null;

    // Detect method change suggestions
    const methodKeywords = ['test method', 'test with', 'try using', 'different model', 'dataset', 'benchmark', 'reproduce', 'verification', 'run the test', 'retest'];
    const suggestsMethodChange = methodKeywords.some(k => input.content.toLowerCase().includes(k));

    // Simple sentiment analysis
    const sentiment = this.analyzeSentiment(input.content);

    // Simple bot detection
    const { flagged, reason } = this.detectAbuse(input.content, user.name);

    const now = new Date().toISOString();
    const id = `cmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const comment: LeaderboardComment = {
      id,
      entryRank: input.entryRank,
      parentId: effectiveParentId,
      userId: user.id,
      userName: user.name,
      userImage: user.image ?? null,
      content: input.content,
      vote: input.entryRank != null ? input.vote : null,
      flagged,
      flagReason: reason,
      sentiment,
      suggestedUrl,
      suggestsMethodChange,
      createdAt: now,
      updatedAt: now,
    };

    await this.client.insertRows({
      tableName: TABLE_COMMENTS,
      rows: [{
        id: comment.id,
        entry_rank: comment.entryRank,
        parent_id: comment.parentId,
        user_id: comment.userId,
        user_name: comment.userName,
        user_image: comment.userImage,
        content: comment.content,
        vote: comment.vote,
        flagged: comment.flagged,
        flag_reason: comment.flagReason,
        sentiment: comment.sentiment,
        suggested_url: comment.suggestedUrl,
        suggests_method_change: comment.suggestsMethodChange,
        created_at: comment.createdAt,
        updated_at: comment.updatedAt,
      }],
    });

    return comment;
  }

  async getComments(entryRank: number | null): Promise<LeaderboardComment[]> {
    await ensureTables(this.client);
    // ZeroDB JSON stores values as text — fetch all and filter client-side
    const result = await this.client.queryRows({
      tableName: TABLE_COMMENTS,
      filters: {},
      limit: 500,
    });
    const all = (result.rows ?? []).map(rowToComment).filter(c => !c.flagged);

    if (entryRank == null) {
      // Overall comments: return only those with null entry_rank
      return all.filter(c => c.entryRank == null);
    }
    // Filter by rank client-side (ZeroDB JSON doesn't support typed filters)
    return all.filter(c => c.entryRank === entryRank);
  }

  async getComment(id: string): Promise<LeaderboardComment | null> {
    const result = await this.client.queryRows({
      tableName: TABLE_COMMENTS,
      filters: { id },
      limit: 1,
    });
    const rows = result.rows ?? [];
    return rows.length > 0 ? rowToComment(rows[0]) : null;
  }

  async getVoteSummary(entryRank: number): Promise<CommentVoteSummary> {
    const comments = await this.getComments(entryRank);
    const withVotes = comments.filter(c => c.vote != null && c.parentId == null);
    return {
      entryRank,
      agreeCount: withVotes.filter(c => c.vote === 'agree').length,
      disagreeCount: withVotes.filter(c => c.vote === 'disagree').length,
      totalComments: comments.length,
      avgSentiment: comments.length > 0
        ? comments.reduce((s, c) => s + (c.sentiment ?? 0), 0) / comments.length
        : 0,
    };
  }

  async getAllVoteSummaries(): Promise<CommentVoteSummary[]> {
    await ensureTables(this.client);
    const result = await this.client.queryRows({
      tableName: TABLE_COMMENTS,
      filters: {},
      limit: 5000,
    });
    const all = (result.rows ?? []).map(rowToComment).filter(c => !c.flagged);

    const byRank = new Map<number, LeaderboardComment[]>();
    for (const c of all) {
      if (c.entryRank == null) continue;
      const arr = byRank.get(c.entryRank) ?? [];
      arr.push(c);
      byRank.set(c.entryRank, arr);
    }

    const summaries: CommentVoteSummary[] = [];
    for (const [rank, comments] of byRank) {
      const topLevel = comments.filter(c => c.parentId == null && c.vote != null);
      summaries.push({
        entryRank: rank,
        agreeCount: topLevel.filter(c => c.vote === 'agree').length,
        disagreeCount: topLevel.filter(c => c.vote === 'disagree').length,
        totalComments: comments.length,
        avgSentiment: comments.reduce((s, c) => s + (c.sentiment ?? 0), 0) / comments.length,
      });
    }
    return summaries;
  }

  async getSuggestedSubmissions(): Promise<LeaderboardComment[]> {
    const result = await this.client.queryRows({
      tableName: TABLE_COMMENTS,
      filters: {},
      limit: 1000,
    });
    return (result.rows ?? [])
      .map(rowToComment)
      .filter(c => c.suggestedUrl && !c.flagged);
  }

  async getMethodChangeRequests(): Promise<LeaderboardComment[]> {
    const result = await this.client.queryRows({
      tableName: TABLE_COMMENTS,
      filters: {},
      limit: 1000,
    });
    return (result.rows ?? [])
      .map(rowToComment)
      .filter(c => c.suggestsMethodChange && !c.flagged);
  }

  // ── Moderation ──────────────────────────────────────────────────────────

  async banUser(userId: string, userName: string, reason: string): Promise<void> {
    await ensureTables(this.client);
    await this.client.insertRows({
      tableName: TABLE_BANS,
      rows: [{ user_id: userId, user_name: userName, reason, banned_at: new Date().toISOString() }],
    });
  }

  async isUserBanned(userId: string): Promise<boolean> {
    try {
      const result = await this.client.queryRows({
        tableName: TABLE_BANS,
        filters: { user_id: userId },
        limit: 1,
      });
      return (result.rows?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }

  // ── Analysis helpers ────────────────────────────────────────────────────

  analyzeSentiment(text: string): number {
    const positive = ['great', 'excellent', 'amazing', 'love', 'agree', 'confirmed', 'works', 'validated', 'impressive', 'useful', 'helpful', 'accurate', 'correct', 'good', 'nice', 'awesome'];
    const negative = ['wrong', 'disagree', 'incorrect', 'flawed', 'broken', 'misleading', 'inaccurate', 'fake', 'bad', 'poor', 'terrible', 'useless', 'overestimated', 'overhyped', 'scam', 'garbage'];

    const lower = text.toLowerCase();
    let score = 0;
    for (const w of positive) { if (lower.includes(w)) score += 0.15; }
    for (const w of negative) { if (lower.includes(w)) score -= 0.15; }
    return Math.max(-1, Math.min(1, Math.round(score * 100) / 100));
  }

  detectAbuse(content: string, userName: string): { flagged: boolean; reason: string | null } {
    const lower = content.toLowerCase();

    // Spam patterns
    const spamPatterns = [
      /(.)\1{10,}/, // 10+ repeated characters
      /buy now|click here|free money|earn \$|make money|casino|viagra/i,
      /https?:\/\/[^\s]+\s*https?:\/\/[^\s]+\s*https?:\/\//i, // 3+ URLs
    ];
    for (const p of spamPatterns) {
      if (p.test(content)) return { flagged: true, reason: 'Spam detected' };
    }

    // Abuse patterns
    const abuseWords = ['fuck', 'shit', 'asshole', 'bitch', 'retard', 'kill yourself', 'die'];
    for (const w of abuseWords) {
      if (lower.includes(w)) return { flagged: true, reason: 'Abusive language' };
    }

    // Bot-like patterns
    if (content.length > 3000) return { flagged: true, reason: 'Excessively long comment' };
    if (userName.match(/^[a-z]{2,3}\d{5,}/)) return { flagged: true, reason: 'Bot-like username pattern' };

    return { flagged: false, reason: null };
  }
}

let _service: CommentsService | null = null;

export function getCommentsService(): CommentsService {
  if (!_service) _service = new CommentsService();
  return _service;
}
