/**
 * Token Spend Classification Engine
 * Issue #43 — Classifies every token event into a spend category.
 *
 * Strategy:
 *  1. Fast keyword/pattern matching (zero LLM cost, < 1 ms per call).
 *  2. Batch pattern detection: tracks prompt similarity over time
 *     and flags when the same semantic pattern appears 3+ times.
 */

import { Classification, ClassificationResult } from '../types/telemetry';

// ---------------------------------------------------------------------------
// Pattern definitions — ordered by specificity (most specific first)
// ---------------------------------------------------------------------------

interface PatternRule {
  classification: Classification;
  patterns: RegExp[];
  keywords: string[];
}

const RULES: PatternRule[] = [
  {
    classification: Classification.FIXING_ISSUES,
    patterns: [
      /fix\s+(\w+\s+)*(bug|issue|error|crash|regression|flaky)/i,
      /debug(ging)?\s/i,
      /troubleshoot/i,
      /stack\s*trace/i,
      /error\s*(message|log|handling)/i,
      /patch\s+(security|vulnerability|CVE)/i,
      /hotfix/i,
      /failing\s+test/i,
      /broken\s/i,
      /not\s+working/i,
      /doesn.t\s+work/i,
      /investigate\s+(failure|crash|error)/i,
    ],
    keywords: [
      'bugfix', 'bug fix', 'debug', 'fix error', 'fix crash',
      'resolve issue', 'patch', 'hotfix', 'stack trace', 'traceback',
      'exception', 'segfault', 'undefined is not', 'null pointer',
    ],
  },
  {
    classification: Classification.UPDATING_CODE,
    patterns: [
      /implement\s/i,
      /refactor\s/i,
      /add\s+(feature|endpoint|route|component|method|function|class|module)/i,
      /create\s+(\w+\s+)*(function|class|component|service|handler|middleware)/i,
      /update\s+(code|implementation|logic|handler|function|service)/i,
      /write\s+(code|function|class|test|unit test|integration test)/i,
      /migrate\s+(from|to)\s/i,
      /convert\s+(to|from)\s/i,
      /build\s+(a|the|an)\s/i,
      /code\s+review/i,
      /pull\s+request/i,
      /merge\s+(branch|PR|pull)/i,
      /run\s+(test|tests|suite|lint|build|ci)/i,
      /deploy\s/i,
    ],
    keywords: [
      'implement', 'refactor', 'add feature', 'create endpoint',
      'write code', 'code review', 'pull request', 'PR', 'deploy',
      'scaffold', 'boilerplate', 'CRUD', 'API route', 'migration',
    ],
  },
  {
    classification: Classification.UPDATING_SPECS,
    patterns: [
      /update\s+(readme|docs|documentation|changelog|prd|spec)/i,
      /write\s+(docs|documentation|readme|spec|prd|rfc|adr)/i,
      /create\s+(\w+\s+)*(prd|spec|rfc|adr|proposal|plan)/i,
      /document\s/i,
      /planning\s/i,
      /roadmap/i,
      /requirements?\s+(document|gathering|analysis)/i,
      /acceptance\s+criteria/i,
      /user\s+stor(y|ies)/i,
      /design\s+doc/i,
    ],
    keywords: [
      'documentation', 'README', 'changelog', 'PRD', 'spec',
      'specification', 'RFC', 'ADR', 'proposal', 'plan', 'roadmap',
      'requirements', 'acceptance criteria', 'user story',
    ],
  },
  {
    classification: Classification.BRAINSTORMING,
    patterns: [
      /brainstorm/i,
      /explore\s+(options|alternatives|approaches|ideas)/i,
      /what\s+(are|is)\s+(the\s+)?(best|good|recommended)/i,
      /how\s+(should|would|could|can)\s+(I|we)\s/i,
      /compare\s+(and\s+contrast|options|approaches)/i,
      /pros?\s+(and|&)\s+cons?/i,
      /research\s/i,
      /ideation/i,
      /suggest\s+(an?\s+)?(approach|solution|architecture|design)/i,
      /what\s+do\s+you\s+think\s+about/i,
      /trade.?offs?/i,
      /evaluate\s/i,
    ],
    keywords: [
      'brainstorm', 'explore', 'research', 'ideation', 'compare',
      'pros and cons', 'tradeoffs', 'trade-offs', 'evaluate',
      'suggest approach', 'what do you think', 'best practice',
    ],
  },
  {
    classification: Classification.BATCH_COMMANDS,
    patterns: [
      /for\s+each\s+(file|item|entry|record|row)/i,
      /batch\s+(process|update|delete|create|run)/i,
      /bulk\s+(update|insert|delete|create)/i,
      /repeat\s+(for|this|the same)/i,
      /do\s+the\s+same\s+(for|to|with)/i,
      /apply\s+(this|the same)\s+(to|across)\s+(all|every)/i,
      /rename\s+all/i,
      /update\s+all/i,
      /search\s+and\s+replace/i,
      /find\s+and\s+replace/i,
    ],
    keywords: [
      'batch', 'bulk', 'for each', 'repeat', 'do the same',
      'apply to all', 'rename all', 'update all', 'search and replace',
      'find and replace', 'mass update',
    ],
  },
];

// ---------------------------------------------------------------------------
// Batch pattern detection — in-memory sliding window
// ---------------------------------------------------------------------------

interface PromptFingerprint {
  normalized: string;
  timestamp: number;
}

const PROMPT_HISTORY: PromptFingerprint[] = [];
const MAX_HISTORY = 500;
const BATCH_THRESHOLD_DEFAULT = 3;
const BATCH_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Normalize a prompt for similarity comparison.
 * Strips numbers, UUIDs, file paths, and excessive whitespace so that
 * structurally identical prompts collapse to the same string.
 */
function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<UUID>')
    .replace(/\/[\w\-./]+/g, '<PATH>')
    .replace(/\b\d+\b/g, '<NUM>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check whether the prompt matches a repetitive batch pattern.
 * Returns true when the same normalized prompt has appeared at least
 * `threshold` times within the sliding window.
 */
function isBatchPattern(prompt: string, threshold: number = BATCH_THRESHOLD_DEFAULT): boolean {
  const normalized = normalizePrompt(prompt);
  const now = Date.now();
  const cutoff = now - BATCH_WINDOW_MS;

  // Record current prompt
  PROMPT_HISTORY.push({ normalized, timestamp: now });

  // Evict stale entries
  while (PROMPT_HISTORY.length > MAX_HISTORY || (PROMPT_HISTORY.length > 0 && PROMPT_HISTORY[0].timestamp < cutoff)) {
    PROMPT_HISTORY.shift();
  }

  // Count occurrences of this normalized form
  const count = PROMPT_HISTORY.filter(
    (fp) => fp.normalized === normalized && fp.timestamp >= cutoff
  ).length;

  return count >= threshold;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ClassificationContext {
  previousClassifications?: Classification[];
  agentId?: string;
  workflowId?: string;
  batchThreshold?: number;
}

/**
 * Classify a token event based on prompt content analysis.
 *
 * This is a zero-cost, keyword/pattern-based classifier that runs entirely
 * in-process without any LLM calls. It returns in under 1 ms for typical
 * prompt lengths.
 */
export function classifyTokenEvent(
  prompt: string,
  context?: ClassificationContext
): ClassificationResult {
  const matchedPatterns: string[] = [];
  let bestMatch: Classification | null = null;
  let bestConfidence = 0;

  const lowerPrompt = prompt.toLowerCase();

  // 1. Check batch patterns first (highest priority override)
  const batchDetected = isBatchPattern(prompt, context?.batchThreshold);
  if (batchDetected) {
    matchedPatterns.push('batch_similarity_detected');
  }

  // 2. Run through classification rules
  for (const rule of RULES) {
    let ruleScore = 0;
    const ruleMatches: string[] = [];

    // Regex pattern matching
    for (const pattern of rule.patterns) {
      if (pattern.test(prompt)) {
        ruleScore += 2;
        ruleMatches.push(pattern.source);
      }
    }

    // Keyword matching
    for (const keyword of rule.keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        ruleScore += 1;
        ruleMatches.push(`kw:${keyword}`);
      }
    }

    if (ruleScore > bestConfidence) {
      bestConfidence = ruleScore;
      bestMatch = rule.classification;
      matchedPatterns.push(...ruleMatches);
    }
  }

  // 3. If batch was detected and the best match is not already BATCH_COMMANDS,
  //    override only if the match confidence is low
  if (batchDetected && bestMatch !== Classification.BATCH_COMMANDS && bestConfidence < 3) {
    bestMatch = Classification.BATCH_COMMANDS;
    bestConfidence = 3;
  }

  // 4. Default to BRAINSTORMING if nothing matched (general questions / exploration)
  if (!bestMatch) {
    bestMatch = Classification.BRAINSTORMING;
    bestConfidence = 1;
    matchedPatterns.push('default_fallback');
  }

  // Normalize confidence to 0-1 scale (cap at 10 rule hits)
  const normalizedConfidence = Math.min(bestConfidence / 10, 1);

  return {
    classification: bestMatch,
    confidence: normalizedConfidence,
    matchedPatterns,
    isBatchCandidate: batchDetected,
  };
}

/**
 * Get recent batch patterns detected in the sliding window.
 * Used by the analytics endpoint to surface automation opportunities.
 */
export function getDetectedBatchPatterns(threshold: number = BATCH_THRESHOLD_DEFAULT): Array<{
  pattern: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}> {
  const now = Date.now();
  const cutoff = now - BATCH_WINDOW_MS;

  // Group by normalized prompt
  const groups = new Map<string, { count: number; firstSeen: number; lastSeen: number }>();

  for (const fp of PROMPT_HISTORY) {
    if (fp.timestamp < cutoff) continue;

    const existing = groups.get(fp.normalized);
    if (existing) {
      existing.count += 1;
      existing.firstSeen = Math.min(existing.firstSeen, fp.timestamp);
      existing.lastSeen = Math.max(existing.lastSeen, fp.timestamp);
    } else {
      groups.set(fp.normalized, {
        count: 1,
        firstSeen: fp.timestamp,
        lastSeen: fp.timestamp,
      });
    }
  }

  // Filter by threshold
  const results: Array<{ pattern: string; count: number; firstSeen: number; lastSeen: number }> = [];
  for (const [pattern, stats] of groups) {
    if (stats.count >= threshold) {
      results.push({ pattern, ...stats });
    }
  }

  return results.sort((a, b) => b.count - a.count);
}

/**
 * Reset the in-memory prompt history. Useful for testing.
 */
export function resetPromptHistory(): void {
  PROMPT_HISTORY.length = 0;
}
