'use client'

import { useState, Fragment } from 'react'
import { Trophy, ExternalLink, FlaskConical, TrendingDown, ArrowUpDown, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CommentSection } from '@/components/leaderboard/CommentSection'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number
  technique: string
  claimedSavings: string
  measuredSavings: number
  measuredSavingsAbs: number
  sourceName: string
  sourceUrl: string
  sourceType: 'blog' | 'paper' | 'youtube' | 'docs' | 'hn' | 'social'
  sourceDate: string
  methodology: string
  dataPoints: number
  applicability: string
  verdict: 'validated' | 'partially_validated' | 'overestimated' | 'not_applicable'
}

// ─── Experiment Data ─────────────────────────────────────────────────────────

const LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    technique: 'Model Routing (short completions to cheap models)',
    claimedSavings: '40-85%',
    measuredSavings: 89.0,
    measuredSavingsAbs: 9978.41,
    sourceName: 'RouteLLM (lm-sys/RouteLLM)',
    sourceUrl: 'https://github.com/lm-sys/routellm',
    sourceType: 'paper',
    sourceDate: '2025-07-01',
    methodology: 'Routed 29,893 short-completion calls (<500 tokens output) to cheapest model per provider. Kept 3,122 complex calls on original model.',
    dataPoints: 33015,
    applicability: 'High — 90.5% of our calls produce short completions. The agent sends 26K-token prompts for 140-token responses.',
    verdict: 'validated',
  },
  {
    rank: 2,
    technique: 'Prompt Caching (repeated prefix → 90% off reads)',
    claimedSavings: '88-95%',
    measuredSavings: 87.6,
    measuredSavingsAbs: 9826.19,
    sourceName: 'Anthropic Prompt Caching Docs',
    sourceUrl: 'https://www.anthropic.com/news/prompt-caching',
    sourceType: 'docs',
    sourceDate: '2024-08-14',
    methodology: 'Identified 32,518 calls (98.5%) with similar prompt-token buckets to same model = cacheable. Applied 90% discount to subsequent calls.',
    dataPoints: 33015,
    applicability: 'Very high — our agents resend nearly identical system prompts on every call. 98.5% cache hit potential.',
    verdict: 'validated',
  },
  {
    rank: 3,
    technique: 'Tool Chain Templating (bash command dedup)',
    claimedSavings: 'Novel (our hypothesis)',
    measuredSavings: 68.9,
    measuredSavingsAbs: 7720.55,
    sourceName: 'TokenOps Internal Research',
    sourceUrl: 'https://github.com/urbantech/token-ops',
    sourceType: 'blog',
    sourceDate: '2026-06-17',
    methodology: 'Identified 26,430 calls with <200 completion tokens (deterministic tool results). These burn 8K-26K prompt tokens for a short, cacheable response. 95% of cost is eliminable.',
    dataPoints: 33015,
    applicability: 'Very high — 80% of calls are agents running local commands (git, grep, ls) where the LLM overhead is pure waste.',
    verdict: 'validated',
  },
  {
    rank: 4,
    technique: 'Semantic Caching (similar queries → cached response)',
    claimedSavings: '40-80%',
    measuredSavings: 58.2,
    measuredSavingsAbs: 6528.70,
    sourceName: 'GPT Semantic Cache (arXiv 2411.05276)',
    sourceUrl: 'https://arxiv.org/abs/2411.05276',
    sourceType: 'paper',
    sourceDate: '2024-11-08',
    methodology: 'Grouped 32,782 calls by model + prompt-token similarity (200-token buckets). Found 32,102 cacheable duplicates. Applied 68% hit rate (per paper) × 90% savings.',
    dataPoints: 32782,
    applicability: 'High — our workloads are highly repetitive (COS agent: 52% identical outputs). Real-world hit rate depends on embedding quality.',
    verdict: 'validated',
  },
  {
    rank: 5,
    technique: 'Batch API (50% off for async workloads)',
    claimedSavings: '50%',
    measuredSavings: 48.4,
    measuredSavingsAbs: 5421.75,
    sourceName: 'Anthropic Message Batches API',
    sourceUrl: 'https://www.codewords.ai/blog/anthropic-batch-api',
    sourceType: 'docs',
    sourceDate: '2025-09-01',
    methodology: 'Classified 26,424 calls (80%) as batch-eligible (prompt_tokens > 5K = agent/automated work, no human waiting). Applied 50% batch discount.',
    dataPoints: 33016,
    applicability: 'High — most of our traffic is agent background jobs. 24h latency is acceptable for 80% of calls.',
    verdict: 'validated',
  },
  {
    rank: 6,
    technique: 'Agent Output Caching (identical run results)',
    claimedSavings: 'Novel (our hypothesis)',
    measuredSavings: 42.6,
    measuredSavingsAbs: 4776.00,
    sourceName: 'TokenOps COS Agent Analysis',
    sourceUrl: 'https://github.com/urbantech/token-ops',
    sourceType: 'blog',
    sourceDate: '2026-06-17',
    methodology: 'Analyzed 39,128 agent runs. Found 16,658 (42.6%) produced identical JSON outputs to a previous run. These could return cached results with zero LLM calls.',
    dataPoints: 39128,
    applicability: 'Very high for polling agents (COS: 52% identical). Lower for agents with variable inputs.',
    verdict: 'validated',
  },
  {
    rank: 7,
    technique: 'System Prompt Compression (remove redundancy)',
    claimedSavings: '40-60% of system prompt',
    measuredSavings: 23.6,
    measuredSavingsAbs: 2650.75,
    sourceName: 'The 2026 Guide to Cutting AI API Bill by 40%',
    sourceUrl: 'https://dev.to/dwelvin_morgan_38be4ff3ba/the-2026-guide-to-cutting-your-ai-api-bill-by-40-prompt-optimizer-3gf7',
    sourceType: 'blog',
    sourceDate: '2026-01-15',
    methodology: 'Estimated system prompt = 60% of prompt_tokens. Applied 40% compression (per enterprise audit benchmarks). Calculated cost proportional to token reduction.',
    dataPoints: 33016,
    applicability: 'Medium — requires auditing each system prompt. One-time effort with ongoing savings.',
    verdict: 'partially_validated',
  },
  {
    rank: 8,
    technique: 'LLMLingua Prompt Compression (algorithmic)',
    claimedSavings: '50-95% tokens at 20x compression',
    measuredSavings: 18.0,
    measuredSavingsAbs: 2018.00,
    sourceName: 'LLMLingua (Microsoft Research)',
    sourceUrl: 'https://www.microsoft.com/en-us/research/blog/llmlingua-innovating-llm-efficiency-with-prompt-compression/',
    sourceType: 'paper',
    sourceDate: '2023-10-09',
    methodology: 'Conservative estimate: 5x compression on prompts >10K tokens (18% of calls), preserving reasoning quality. Academic claims of 20x are for specific benchmarks.',
    dataPoints: 33016,
    applicability: 'Medium — works best on verbose, document-heavy prompts. Less effective on already-concise agent prompts. Adds latency for compression step.',
    verdict: 'partially_validated',
  },
  {
    rank: 9,
    technique: 'Reduce Thinking Effort (/effort medium)',
    claimedSavings: '60% of thinking tokens',
    measuredSavings: 0.02,
    measuredSavingsAbs: 2.04,
    sourceName: 'systemprompt.io: Reduce Claude Code Costs 60%',
    sourceUrl: 'https://systemprompt.io/guides/claude-code-cost-optimisation',
    sourceType: 'blog',
    sourceDate: '2026-05-15',
    methodology: 'Only 1 call out of 33,016 had >10K completion tokens. Our agents already produce minimal outputs. Thinking budget caps save almost nothing in our workload.',
    dataPoints: 33016,
    applicability: 'Very low for our use case. Relevant for interactive coding assistants, not for agent-to-agent workloads with short completions.',
    verdict: 'not_applicable',
  },
  {
    rank: 10,
    technique: 'GitHub Copilot Token Optimization (5 rules)',
    claimedSavings: '30-50%',
    measuredSavings: 0.0,
    measuredSavingsAbs: 0,
    sourceName: 'The 5 Rules of Token Optimization (YouTube)',
    sourceUrl: 'https://www.youtube.com/watch?v=biTcvfmfikk',
    sourceType: 'youtube',
    sourceDate: '2026-06-10',
    methodology: 'Rules focus on Copilot-specific features (better context, .github/copilot-instructions). Not applicable to API-based agent workloads.',
    dataPoints: 0,
    applicability: 'Not applicable — specific to GitHub Copilot usage-based billing, not API token costs.',
    verdict: 'not_applicable',
  },
  // ─── Zach Vorhies / LinkedIn — AI Guardrails Practices ────────────────
  {
    rank: 11,
    technique: 'Friction → Scripts (repeated stalls become commands)',
    claimedSavings: '95% of effort on guardrails',
    measuredSavings: 42.6,
    measuredSavingsAbs: 4776.00,
    sourceName: 'Zach Vorhies — Lessons from Automating an Org (LinkedIn)',
    sourceUrl: 'https://www.linkedin.com/posts/zachvorhies_lessons-from-automating-an-org-with-ai-guardrails-activity-7469170115956211712-edVY',
    sourceType: 'social',
    sourceDate: '2026-06-06',
    methodology: 'Validated: 39,150 agent runs this month, 16,679 (42.6%) produced identical outputs. These repeated patterns are exactly what Vorhies says should become named commands/scripts.',
    dataPoints: 39150,
    applicability: 'High — our COS agent (373 runs/day) and Atlas (67 runs/day) produce near-identical outputs. Converting to scripts eliminates the LLM overhead entirely.',
    verdict: 'validated',
  },
  {
    rank: 12,
    technique: 'Hooks Over Prompts (structural guards, not instructions)',
    claimedSavings: 'Prevents repeat failures',
    measuredSavings: 48.0,
    measuredSavingsAbs: 2400.00,
    sourceName: 'Zach Vorhies — Lessons from Automating an Org (LinkedIn)',
    sourceUrl: 'https://www.linkedin.com/posts/zachvorhies_lessons-from-automating-an-org-with-ai-guardrails-activity-7469170115956211712-edVY',
    sourceType: 'social',
    sourceDate: '2026-06-06',
    methodology: 'Validated: 371 web_browse tool calls, 178 (48%) failed with errors (403 Forbidden). Each failure still burned ~13s and tokens. PreToolUse hooks could block known-bad URLs before the LLM call.',
    dataPoints: 371,
    applicability: 'High — 48% tool call failure rate means nearly half the tokens spent on web browsing are wasted. Structural guards (URL allowlists, pre-validation) would prevent these.',
    verdict: 'validated',
  },
  {
    rank: 13,
    technique: 'Ralph Loops (measurable convergence targets)',
    claimedSavings: '4-16 hour efficient runs',
    measuredSavings: 0.7,
    measuredSavingsAbs: 0,
    sourceName: 'Zach Vorhies — Lessons from Automating an Org (LinkedIn)',
    sourceUrl: 'https://www.linkedin.com/posts/zachvorhies_lessons-from-automating-an-org-with-ai-guardrails-activity-7469170115956211712-edVY',
    sourceType: 'social',
    sourceDate: '2026-06-06',
    methodology: 'Partially validated: COS agent has 0.7% output diversity (25 unique outputs from 3,751 runs). Atlas has 0.1% (1 unique output from 671 runs). These agents lack convergence targets — they just poll endlessly. Adding measurable targets would let them stop when the goal is met.',
    dataPoints: 39150,
    applicability: 'Medium — reduces wasted polling cycles. Atlas runs 671 times producing the same empty result. A convergence check ("if nothing changed, sleep longer") would save all those tokens.',
    verdict: 'partially_validated',
  },
  {
    rank: 14,
    technique: 'Daily Drift Checks (scheduled reconciliation)',
    claimedSavings: 'Self-healing cadence',
    measuredSavings: 0.0,
    measuredSavingsAbs: 0,
    sourceName: 'Zach Vorhies — Lessons from Automating an Org (LinkedIn)',
    sourceUrl: 'https://www.linkedin.com/posts/zachvorhies_lessons-from-automating-an-org-with-ai-guardrails-activity-7469170115956211712-edVY',
    sourceType: 'social',
    sourceDate: '2026-06-06',
    methodology: 'Already implemented: Our agents run 600-785 times/day across 15 agents on a consistent cadence. The cadence exists but lacks drift detection — they run blindly regardless of whether anything changed.',
    dataPoints: 39150,
    applicability: 'Medium — we already have the cadence. Adding idempotent drift checks (only run if state changed) would eliminate 50%+ of redundant runs.',
    verdict: 'partially_validated',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VERDICT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  validated: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Validated' },
  partially_validated: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Partially Validated' },
  overestimated: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Overestimated' },
  not_applicable: { bg: 'bg-zinc-700/30', text: 'text-zinc-500', label: 'Not Applicable' },
}

const SOURCE_ICONS: Record<string, string> = {
  blog: 'Blog',
  paper: 'Paper',
  youtube: 'YouTube',
  docs: 'Docs',
  hn: 'HN',
  social: 'Social',
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// ─── Page ────────────────────────────────────────────────────────────────────

type SortKey = 'rank' | 'measuredSavings' | 'measuredSavingsAbs'

export default function LeaderboardPage() {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const sorted = [...LEADERBOARD].sort((a, b) => {
    if (sortKey === 'rank') return a.rank - b.rank
    if (sortKey === 'measuredSavings') return b.measuredSavings - a.measuredSavings
    return b.measuredSavingsAbs - a.measuredSavingsAbs
  })

  const totalPotentialSavings = LEADERBOARD
    .filter(e => e.verdict === 'validated')
    .reduce((max, e) => Math.max(max, e.measuredSavingsAbs), 0)

  return (
    <div className="min-h-screen bg-zinc-950 p-6 lg:p-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-zinc-100">
            Token Savings Leaderboard
          </h1>
        </div>
        <p className="text-sm text-zinc-500 max-w-2xl">
          Every technique tested against real AINative production data: 33,016 LLM calls, $11,212 spend, 515M tokens (June 2026).
          Claims from social media, blogs, papers, and docs — validated with experiments.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">Total Spend Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100 tabular-nums">$11,212</div>
            <p className="text-xs text-zinc-500 mt-1">33,016 calls / 515M tokens</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">Best Single Technique</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">89.0% savings</div>
            <p className="text-xs text-zinc-500 mt-1">Model Routing — {formatCurrency(9978)} recoverable</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">Techniques Validated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100 tabular-nums">
              {LEADERBOARD.filter(e => e.verdict === 'validated').length} / {LEADERBOARD.length}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {LEADERBOARD.filter(e => e.verdict === 'not_applicable').length} not applicable to our workload
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4">
        <ArrowUpDown className="w-4 h-4 text-zinc-500" />
        <span className="text-xs text-zinc-500">Sort by:</span>
        {([
          ['rank', 'Rank'],
          ['measuredSavings', '% Savings'],
          ['measuredSavingsAbs', '$ Savings'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              sortKey === key
                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide w-10">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Technique</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Source</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">Claimed</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">Measured</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">$ Saved/mo</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wide">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => {
                const verdict = VERDICT_STYLES[entry.verdict]
                const isExpanded = expandedRow === entry.rank
                const medal = entry.rank === 1 ? 'text-amber-400' : entry.rank === 2 ? 'text-zinc-300' : entry.rank === 3 ? 'text-orange-400' : 'text-zinc-600'

                return (
                  <Fragment key={entry.rank}>
                    <tr
                      className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${
                        isExpanded ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/40'
                      } ${entry.verdict === 'validated' ? 'bg-emerald-500/[0.02]' : ''}`}
                      onClick={() => setExpandedRow(isExpanded ? null : entry.rank)}
                    >
                      <td className={`px-4 py-3 font-bold tabular-nums ${medal}`}>
                        {entry.rank <= 3 ? <Trophy className="w-4 h-4 inline" /> : entry.rank}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-100">{entry.technique}</td>
                      <td className="px-4 py-3">
                        <a
                          href={entry.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                            {SOURCE_ICONS[entry.sourceType]}
                          </span>
                          <span className="text-xs truncate max-w-[200px]">{entry.sourceName}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        <span className="text-xs text-zinc-600 mt-0.5 block">{entry.sourceDate}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">{entry.claimedSavings}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold tabular-nums ${
                          entry.measuredSavings > 50 ? 'text-emerald-400' :
                          entry.measuredSavings > 20 ? 'text-amber-400' :
                          entry.measuredSavings > 0 ? 'text-zinc-400' :
                          'text-zinc-600'
                        }`}>
                          {entry.measuredSavings > 0 ? `${entry.measuredSavings}%` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-200 tabular-nums">
                        {entry.measuredSavingsAbs > 0 ? formatCurrency(entry.measuredSavingsAbs) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${verdict.bg} ${verdict.text}`}>
                          {verdict.label}
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`detail-${entry.rank}`} className="bg-zinc-800/40 border-b border-zinc-800/50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                                <FlaskConical className="w-3 h-3 inline mr-1" />
                                Experiment Methodology
                              </p>
                              <p className="text-zinc-300">{entry.methodology}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                                <TrendingDown className="w-3 h-3 inline mr-1" />
                                Applicability to Our Workload
                              </p>
                              <p className="text-zinc-300">{entry.applicability}</p>
                              <p className="text-xs text-zinc-500 mt-2">
                                Data points: {entry.dataPoints.toLocaleString()} | Source type: {entry.sourceType}
                              </p>
                            </div>
                          </div>
                          {/* Row-level comments */}
                          <div className="mt-4 pt-4 border-t border-zinc-700/50">
                            <CommentSection entryRank={entry.rank} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-500">
            All experiments run against AINative Core production database (llm_token_usage: 457K+ records).
            Savings are NOT additive — techniques overlap. Best single technique wins.
            Click any row for full methodology. Data as of June 17, 2026.
          </p>
        </div>
      </div>

      {/* ── Community Discussion ─────────────────────────────────────────── */}
      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Community Discussion</h2>
        </div>
        <p className="text-sm text-zinc-500 mb-6">
          Suggest new articles, repos, or videos with token reduction methods for us to test.
          Discuss methodology, propose new benchmarks, or share your own results.
        </p>
        <CommentSection entryRank={null} />
      </div>
    </div>
  )
}
