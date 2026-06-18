'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { MessageSquare, ThumbsUp, ThumbsDown, CornerDownRight, Send, Loader2, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Comment {
  id: string;
  entryRank: number | null;
  parentId: string | null;
  content: string;
  vote: 'agree' | 'disagree' | null;
  author: {
    name: string;
    image?: string | null;
  };
  createdAt: string;
  replies?: Comment[];
}

interface VoteSummary {
  entryRank: number;
  agree: number;
  disagree: number;
}

export interface CommentSectionProps {
  entryRank: number | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Deterministic hue from a string so each user gets a consistent avatar color
function avatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return h % 360;
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ name, image }: { name: string; image?: string | null }) {
  const hue = avatarHue(name);

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        width={28}
        height={28}
        className="rounded-full shrink-0 object-cover"
        style={{ width: 28, height: 28 }}
      />
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white select-none"
      style={{
        width: 28,
        height: 28,
        background: `hsl(${hue}, 55%, 38%)`,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// VoteBar  (row comments only)
// ---------------------------------------------------------------------------

function VoteBar({ entryRank }: { entryRank: number }) {
  const [summary, setSummary] = useState<VoteSummary | null>(null);

  useEffect(() => {
    fetch(`/api/comments/vote-summary?entryRank=${entryRank}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: VoteSummary | null) => {
        if (data) setSummary(data);
      })
      .catch(() => null);
  }, [entryRank]);

  if (!summary) return null;

  return (
    <div className="flex items-center gap-3 mt-1 text-xs">
      <span className="flex items-center gap-1.5 text-emerald-400">
        <ThumbsUp className="w-3.5 h-3.5" />
        <span className="tabular-nums font-medium">{summary.agree}</span>
        <span className="text-zinc-500">Agree</span>
      </span>
      <span className="text-zinc-700">·</span>
      <span className="flex items-center gap-1.5 text-red-400">
        <ThumbsDown className="w-3.5 h-3.5" />
        <span className="tabular-nums font-medium">{summary.disagree}</span>
        <span className="text-zinc-500">Disagree</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentCard
// ---------------------------------------------------------------------------

interface CommentCardProps {
  comment: Comment;
  isRowComment: boolean;
  onReply: (parentId: string, parentAuthor: string) => void;
  depth?: number;
}

function CommentCard({ comment, isRowComment, onReply, depth = 0 }: CommentCardProps) {
  const isNested = depth > 0;

  return (
    <div
      className={cn(
        'group',
        isNested && 'ml-6 pl-3 border-l-2 border-zinc-800',
      )}
    >
      <div className="flex items-start gap-2.5 py-3">
        <Avatar name={comment.author.name} image={comment.author.image} />

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className="text-xs font-semibold text-zinc-200 leading-none">
              @{comment.author.name.replace(/\s+/g, '').toLowerCase()}
            </span>
            <span className="text-zinc-600 text-xs">·</span>
            <time
              className="text-xs text-zinc-500"
              dateTime={comment.createdAt}
              title={new Date(comment.createdAt).toLocaleString()}
            >
              {relativeTime(comment.createdAt)}
            </time>
            {comment.vote && (
              <>
                <span className="text-zinc-600 text-xs">·</span>
                <span
                  className={cn(
                    'text-xs font-medium px-1.5 py-0.5 rounded',
                    comment.vote === 'agree'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400',
                  )}
                >
                  {comment.vote === 'agree' ? 'Agrees' : 'Disagrees'}
                </span>
              </>
            )}
          </div>

          {/* Body */}
          <p className="text-sm text-zinc-300 leading-relaxed break-words">{comment.content}</p>

          {/* Actions */}
          {!isNested && (
            <button
              onClick={() => onReply(comment.id, comment.author.name)}
              className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-400 transition-colors"
              aria-label={`Reply to ${comment.author.name}`}
            >
              <CornerDownRight className="w-3 h-3" />
              Reply
            </button>
          )}
        </div>
      </div>

      {/* Nested replies — max 1 level deep */}
      {!isNested && comment.replies && comment.replies.length > 0 && (
        <div className="pb-1">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              isRowComment={isRowComment}
              onReply={onReply}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentForm
// ---------------------------------------------------------------------------

interface CommentFormProps {
  entryRank: number | null;
  parentId: string | null;
  replyingTo: string | null;
  isRowComment: boolean;
  onSubmit: (content: string, vote: 'agree' | 'disagree' | null) => Promise<void>;
  onCancelReply: () => void;
}

function CommentForm({
  entryRank,
  parentId,
  replyingTo,
  isRowComment,
  onSubmit,
  onCancelReply,
}: CommentFormProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState('');
  const [vote, setVote] = useState<'agree' | 'disagree' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when replying
  useEffect(() => {
    if (parentId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [parentId]);

  // Auto-resize textarea
  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(content.trim(), vote);
      setContent('');
      setVote(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-center mt-4">
        <p className="text-xs text-zinc-500">
          <button
            onClick={() => signIn()}
            className="text-violet-400 hover:text-violet-300 transition-colors font-medium underline underline-offset-2"
          >
            Sign in
          </button>
          {' '}to join the discussion
        </p>
      </div>
    );
  }

  const isReply = parentId !== null;
  const placeholder = isRowComment
    ? isReply
      ? `Replying to @${replyingTo?.replace(/\s+/g, '').toLowerCase()}…`
      : 'Share your experience with this technique…'
    : 'Suggest a technique to test — paste a URL to an article, repo, or video…';

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      {isReply && (
        <div className="flex items-center justify-between mb-2 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <CornerDownRight className="w-3 h-3" />
            Replying to{' '}
            <span className="text-zinc-300 font-medium">
              @{replyingTo?.replace(/\s+/g, '').toLowerCase()}
            </span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onInput={handleInput}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none bg-transparent px-3 pt-3 pb-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none leading-relaxed"
          aria-label={placeholder}
          maxLength={2000}
        />

        {/* URL hint for overall comments */}
        {!isRowComment && !isReply && content === '' && (
          <p className="px-3 pb-2 text-xs text-zinc-600 flex items-center gap-1.5">
            <Link2 className="w-3 h-3" />
            Paste a URL to a blog post, paper, GitHub repo, or YouTube video
          </p>
        )}

        <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
          {/* Vote buttons — only on row comments and not on replies */}
          {isRowComment && !isReply ? (
            <div className="flex items-center gap-1.5" role="group" aria-label="Vote on this analysis">
              <button
                type="button"
                onClick={() => setVote(vote === 'agree' ? null : 'agree')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all',
                  vote === 'agree'
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                    : 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10',
                )}
                aria-pressed={vote === 'agree'}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                Agree
              </button>
              <button
                type="button"
                onClick={() => setVote(vote === 'disagree' ? null : 'disagree')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all',
                  vote === 'disagree'
                    ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
                    : 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10',
                )}
                aria-pressed={vote === 'disagree'}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                Disagree
              </button>
            </div>
          ) : (
            <span /> /* spacer */
          )}

          <div className="flex items-center gap-2">
            {content.length > 1600 && (
              <span className={cn('text-xs tabular-nums', content.length > 1900 ? 'text-red-400' : 'text-zinc-500')}>
                {2000 - content.length}
              </span>
            )}
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all',
                content.trim() && !submitting
                  ? 'bg-violet-600 hover:bg-violet-500 text-white'
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
              )}
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {isReply ? 'Reply' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// CommentSection
// ---------------------------------------------------------------------------

export function CommentSection({ entryRank, className }: CommentSectionProps) {
  const isRowComment = entryRank !== null;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<{ id: string; author: string } | null>(null);

  // Nest replies into their parent comment locally
  const threaded = useCallback((flat: Comment[]): Comment[] => {
    const map = new Map<string, Comment>();
    const roots: Comment[] = [];

    for (const c of flat) {
      map.set(c.id, { ...c, replies: [] });
    }
    for (const c of map.values()) {
      if (c.parentId) {
        const parent = map.get(c.parentId);
        if (parent) {
          parent.replies!.push(c);
          continue;
        }
      }
      roots.push(c);
    }
    return roots;
  }, []);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = entryRank !== null ? `?entryRank=${entryRank}` : '';
      const res = await fetch(`/api/comments${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Comment[] = await res.json();
      setComments(threaded(data));
    } catch {
      setError('Could not load comments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [entryRank, threaded]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (content: string, vote: 'agree' | 'disagree' | null) => {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryRank,
        parentId: replyTarget?.id ?? null,
        content,
        vote: isRowComment ? vote : null,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to post comment: HTTP ${res.status}`);
    }

    setReplyTarget(null);
    await fetchComments();
  };

  const totalComments = comments.reduce(
    (sum, c) => sum + 1 + (c.replies?.length ?? 0),
    0,
  );

  return (
    <section className={cn('rounded-xl border border-zinc-800 bg-zinc-900 p-5', className)}>
      {/* Section header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-100">
            {isRowComment ? 'Discussion' : 'Community Discussion'}
            {totalComments > 0 && (
              <span className="ml-2 text-xs font-normal text-zinc-500 tabular-nums">
                ({totalComments} {totalComments === 1 ? 'comment' : 'comments'})
              </span>
            )}
          </h3>
        </div>

        {isRowComment ? (
          /* Vote summary bar for row comments */
          <VoteBar entryRank={entryRank} />
        ) : (
          /* Overall board description */
          <p className="text-xs text-zinc-500 leading-relaxed">
            Suggest new articles, repos, or videos for token reduction methods to test.
            Drop a URL and explain why it applies to agentic workloads.
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800 mb-1" />

      {/* Comment list */}
      {loading ? (
        <div className="space-y-4 py-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5 py-3 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-zinc-800 rounded w-1/4" />
                <div className="h-3 bg-zinc-800 rounded w-3/4" />
                <div className="h-3 bg-zinc-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-6 text-center">
          <p className="text-xs text-zinc-500 mb-2">{error}</p>
          <button
            onClick={fetchComments}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : comments.length === 0 ? (
        <div className="py-6 text-center">
          <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-xs text-zinc-600">
            {isRowComment
              ? 'No comments yet — be the first to share your experience.'
              : 'No suggestions yet. Paste a URL to kick things off.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              isRowComment={isRowComment}
              onReply={(id, author) => setReplyTarget({ id, author })}
            />
          ))}
        </div>
      )}

      {/* Comment form */}
      <CommentForm
        entryRank={entryRank}
        parentId={replyTarget?.id ?? null}
        replyingTo={replyTarget?.author ?? null}
        isRowComment={isRowComment}
        onSubmit={handleSubmit}
        onCancelReply={() => setReplyTarget(null)}
      />
    </section>
  );
}

export default CommentSection;
