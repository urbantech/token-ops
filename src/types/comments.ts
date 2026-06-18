/**
 * Types for the Leaderboard Comments System
 */

export interface LeaderboardComment {
  id: string;
  /** null = overall board comment, number = specific leaderboard entry rank */
  entryRank: number | null;
  /** null = top-level comment, string = parent comment ID (max 2 levels) */
  parentId: string | null;
  userId: string;
  userName: string;
  userImage: string | null;
  content: string;
  /** For row comments: user's agreement with TokenOps analysis */
  vote: 'agree' | 'disagree' | null;
  /** Agent-detected flags */
  flagged: boolean;
  flagReason: string | null;
  /** Sentiment score from agent analysis (-1 to 1) */
  sentiment: number | null;
  /** If this comment suggests a new submission URL */
  suggestedUrl: string | null;
  /** If this comment suggests test method changes */
  suggestsMethodChange: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentVoteSummary {
  entryRank: number;
  agreeCount: number;
  disagreeCount: number;
  totalComments: number;
  avgSentiment: number;
}

export interface CreateCommentInput {
  entryRank: number | null;
  parentId: string | null;
  content: string;
  vote: 'agree' | 'disagree' | null;
}

export interface BannedUser {
  userId: string;
  userName: string;
  reason: string;
  bannedAt: string;
}
