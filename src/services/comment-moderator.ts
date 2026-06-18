/**
 * Comment Moderation Agent
 *
 * Scans leaderboard comments for:
 * 1. Bots and abuse → ban users
 * 2. Sentiment analysis → track social popularity
 * 3. New submission suggestions → extract URLs for testing
 * 4. Test method change requests → reply asking for clarification or run new tests
 *
 * This is the orchestration agent that maintains leaderboard quality.
 */

import { getCommentsService, CommentsService } from './comments';
import { LeaderboardComment } from '../types/comments';

export interface ModerationReport {
  scannedAt: string;
  totalComments: number;
  flaggedComments: number;
  bannedUsers: string[];
  suggestedSubmissions: { url: string; commentId: string; userName: string }[];
  methodChangeRequests: { commentId: string; userName: string; summary: string }[];
  sentimentByEntry: Record<number, { avg: number; positive: number; negative: number; neutral: number }>;
  agentReplies: { commentId: string; reply: string; action: string }[];
}

export class CommentModerator {
  private comments: CommentsService;

  constructor(comments?: CommentsService) {
    this.comments = comments ?? getCommentsService();
  }

  /**
   * Run full moderation scan across all comments.
   * Called periodically by the weekly cron or on-demand.
   */
  async runModeration(): Promise<ModerationReport> {
    const allComments = await this.fetchAllComments();
    const report: ModerationReport = {
      scannedAt: new Date().toISOString(),
      totalComments: allComments.length,
      flaggedComments: 0,
      bannedUsers: [],
      suggestedSubmissions: [],
      methodChangeRequests: [],
      sentimentByEntry: {},
      agentReplies: [],
    };

    // 1. Scan for bots and abuse
    for (const comment of allComments) {
      if (comment.flagged) {
        report.flaggedComments++;
        // Auto-ban repeat offenders (3+ flagged comments)
        const userFlagCount = allComments.filter(
          c => c.userId === comment.userId && c.flagged
        ).length;
        if (userFlagCount >= 3 && !report.bannedUsers.includes(comment.userId)) {
          await this.comments.banUser(
            comment.userId,
            comment.userName,
            `Auto-banned: ${userFlagCount} flagged comments`
          );
          report.bannedUsers.push(comment.userId);
        }
      }
    }

    // 2. Sentiment analysis by entry
    const byEntry = new Map<number, LeaderboardComment[]>();
    for (const c of allComments.filter(c => c.entryRank != null && !c.flagged)) {
      const arr = byEntry.get(c.entryRank!) ?? [];
      arr.push(c);
      byEntry.set(c.entryRank!, arr);
    }

    for (const [rank, comments] of byEntry) {
      const sentiments = comments.map(c => c.sentiment ?? 0);
      report.sentimentByEntry[rank] = {
        avg: sentiments.reduce((a, b) => a + b, 0) / sentiments.length,
        positive: sentiments.filter(s => s > 0.1).length,
        negative: sentiments.filter(s => s < -0.1).length,
        neutral: sentiments.filter(s => s >= -0.1 && s <= 0.1).length,
      };
    }

    // 3. Extract suggested submissions
    const suggestions = allComments.filter(c => c.suggestedUrl && !c.flagged);
    report.suggestedSubmissions = suggestions.map(c => ({
      url: c.suggestedUrl!,
      commentId: c.id,
      userName: c.userName,
    }));

    // 4. Process test method change requests
    const methodRequests = allComments.filter(c => c.suggestsMethodChange && !c.flagged);
    for (const req of methodRequests) {
      const clarity = this.assessClarity(req.content);

      if (clarity === 'clear') {
        // Clear enough to act on — generate agent reply
        report.agentReplies.push({
          commentId: req.id,
          reply: `Thanks @${req.userName}! Your suggested test method changes are clear. We'll run a new verification (Method #${this.getNextMethodNumber(req.entryRank)}) and post results to the leaderboard with a link back to this discussion.`,
          action: 'run_new_test',
        });
        report.methodChangeRequests.push({
          commentId: req.id,
          userName: req.userName,
          summary: `Clear request: ${req.content.slice(0, 200)}`,
        });
      } else {
        // Needs clarification — generate reply asking for specifics
        report.agentReplies.push({
          commentId: req.id,
          reply: `Thanks for the suggestion @${req.userName}! To run a new verification test, we need a bit more detail:\n\n1. **Which model(s)** should we test with?\n2. **What dataset or prompt pattern** should we use?\n3. **What metric** defines success (% token reduction, cost savings, quality retention)?\n\nOnce we have these specifics, we'll run the test and post as a new verification method on the leaderboard.`,
          action: 'request_clarification',
        });
        report.methodChangeRequests.push({
          commentId: req.id,
          userName: req.userName,
          summary: `Needs clarification: ${req.content.slice(0, 200)}`,
        });
      }
    }

    return report;
  }

  /**
   * Assess whether a method change request is clear enough to act on.
   */
  private assessClarity(content: string): 'clear' | 'needs_clarification' {
    const lower = content.toLowerCase();
    const hasModel = /model|gpt|claude|llama|mistral|qwen|deepseek/i.test(content);
    const hasMetric = /token|cost|saving|percent|%|reduction|latency|quality/i.test(content);
    const hasMethod = /compress|cache|route|batch|template|prune|quantiz|fine.?tun/i.test(content);
    const hasDataset = /dataset|benchmark|gsm|mmlu|humaneval|prompt|test with/i.test(content);

    const clarityScore = [hasModel, hasMetric, hasMethod, hasDataset].filter(Boolean).length;
    return clarityScore >= 3 ? 'clear' : 'needs_clarification';
  }

  private getNextMethodNumber(entryRank: number | null): number {
    // In production, this would query existing method variants
    return 2;
  }

  private async fetchAllComments(): Promise<LeaderboardComment[]> {
    // Fetch both overall and entry-specific comments
    try {
      const result = await this.comments.getComments(null);
      const entryComments: LeaderboardComment[] = [];

      // Also fetch entry-specific comments for ranks 1-14
      for (let rank = 1; rank <= 14; rank++) {
        const comments = await this.comments.getComments(rank);
        entryComments.push(...comments);
      }

      return [...result, ...entryComments];
    } catch {
      return [];
    }
  }
}

let _moderator: CommentModerator | null = null;

export function getCommentModerator(): CommentModerator {
  if (!_moderator) _moderator = new CommentModerator();
  return _moderator;
}
