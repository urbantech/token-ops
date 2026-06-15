/**
 * Context Compression Engine Service
 *
 * Analyzes prompts and conversations for compressibility, detecting
 * redundancy, verbose phrasing, excessive examples, and summarizable
 * context blocks. Also provides context utilization reporting by
 * querying ZeroDB prompt_events.
 *
 * Refs #19, #20, #21
 */

import { getZeroDBClient } from '@/lib/zerodb-client';
import type {
  CompressionAnalysis,
  CompressionTechnique,
  ContextUtilization,
} from '@/types/context';
import { countTokens } from './prompt-analyzer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABLE_PROMPT_EVENTS = 'prompt_events';

/** Threshold (in tokens) above which a prompt is considered oversized */
const OVERSIZED_THRESHOLD = 2000;

/** Minimum examples before we suggest pruning */
const EXAMPLE_PRUNE_THRESHOLD = 3;

// Filler phrases that inflate token counts (reused from prompt-analyzer)
const FILLER_PHRASES: RegExp[] = [
  /please\s+(make\s+sure|ensure|note|remember|be\s+sure)\s+/gi,
  /I\s+would\s+like\s+you\s+to\s+/gi,
  /can\s+you\s+please\s+/gi,
  /it\s+is\s+(important|crucial|critical|essential)\s+that\s+/gi,
  /make\s+sure\s+to\s+/gi,
  /you\s+should\s+always\s+/gi,
  /don't\s+forget\s+to\s+/gi,
  /remember\s+to\s+always\s+/gi,
  /as\s+mentioned\s+(earlier|before|above|previously)\s*/gi,
  /as\s+I\s+said\s+(earlier|before|above)\s*/gi,
];

// ---------------------------------------------------------------------------
// Compression Analysis (Issue #20)
// ---------------------------------------------------------------------------

/**
 * Detect repeated instruction patterns and estimate token savings.
 */
function detectRedundancy(text: string): CompressionTechnique | null {
  const sentences = text
    .split(/[.!?\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const seen = new Map<string, { text: string; count: number }>();

  for (const sentence of sentences) {
    const words = new Set(sentence.toLowerCase().split(/\s+/));
    let matched = false;

    for (const [key, entry] of seen.entries()) {
      const keyWords = new Set(key.split(/\s+/));
      const intersection = [...words].filter((w) => keyWords.has(w)).length;
      const union = new Set([...words, ...keyWords]).size;
      const jaccard = union > 0 ? intersection / union : 0;

      if (jaccard > 0.6) {
        entry.count += 1;
        matched = true;
        break;
      }
    }

    if (!matched) {
      seen.set(sentence.toLowerCase(), { text: sentence, count: 1 });
    }
  }

  let totalWasted = 0;
  for (const entry of seen.values()) {
    if (entry.count > 1) {
      totalWasted += countTokens(entry.text) * (entry.count - 1);
    }
  }

  if (totalWasted === 0) return null;

  return {
    name: 'remove_redundancy',
    tokensSaved: totalWasted,
    description: 'Removed repeated instruction patterns that appear multiple times.',
  };
}

/**
 * Detect verbose filler phrases and estimate token savings from removal.
 */
function detectFillerPhrases(text: string): CompressionTechnique | null {
  let fillerTokens = 0;

  for (const pattern of FILLER_PHRASES) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        fillerTokens += countTokens(match);
      }
    }
  }

  if (fillerTokens === 0) return null;

  return {
    name: 'deduplicate_instructions',
    tokensSaved: fillerTokens,
    description: 'Removed verbose filler phrases that add no informational value.',
  };
}

/**
 * Detect excessive examples (e.g. "Example 1:", "Example 2:", etc.) and
 * suggest pruning down to a reasonable number.
 */
function detectExcessiveExamples(text: string): CompressionTechnique | null {
  const examplePattern = /example\s*\d+\s*:/gi;
  const matches = text.match(examplePattern);

  if (!matches || matches.length <= EXAMPLE_PRUNE_THRESHOLD) return null;

  // Estimate: we can prune all examples beyond the first 2
  const excessCount = matches.length - 2;
  // Estimate each example line at ~20 tokens on average
  const lines = text.split(/\n|(?=example\s*\d+\s*:)/i);
  let excessTokens = 0;
  let examplesSeen = 0;

  for (const line of lines) {
    if (/example\s*\d+\s*:/i.test(line)) {
      examplesSeen++;
      if (examplesSeen > 2) {
        excessTokens += countTokens(line);
      }
    }
  }

  // Fallback estimate if line splitting didn't capture per-line tokens
  if (excessTokens === 0) {
    excessTokens = excessCount * 20;
  }

  return {
    name: 'prune_examples',
    tokensSaved: excessTokens,
    description: `Detected ${matches.length} examples; pruning to 2 would save tokens.`,
  };
}

/**
 * Detect large context/background blocks that could be summarized.
 */
function detectSummarizableContext(text: string): CompressionTechnique | null {
  const lines = text.split('\n');
  let contextTokens = 0;
  let inContextBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^(context|background|system|reference|note|here\s+is)/i.test(trimmed)) {
      inContextBlock = true;
    }
    if (/^(task|request|question|please|now|action|do|create|implement|fix|write)/i.test(trimmed)) {
      inContextBlock = false;
    }

    if (inContextBlock) {
      contextTokens += countTokens(line);
    }
  }

  // Only suggest summarization if context block is substantial
  if (contextTokens < 30) return null;

  // Estimate ~50% compression for context summarization
  const savedTokens = Math.round(contextTokens * 0.5);

  return {
    name: 'summarize_context',
    tokensSaved: savedTokens,
    description: 'Large context/background block could be summarized to reduce token usage.',
  };
}

/**
 * Analyze a prompt or conversation for compression opportunities.
 *
 * Uses heuristics to detect repeated instructions, verbose phrasing,
 * redundant context, and excessive examples.
 */
export function analyzeCompression(text: string): CompressionAnalysis {
  const originalTokens = countTokens(text);

  if (originalTokens === 0) {
    return {
      originalTokens: 0,
      compressedTokens: 0,
      reductionPercent: 0,
      techniques: [],
    };
  }

  const techniques: CompressionTechnique[] = [];

  const redundancy = detectRedundancy(text);
  if (redundancy) techniques.push(redundancy);

  const filler = detectFillerPhrases(text);
  if (filler) techniques.push(filler);

  const examples = detectExcessiveExamples(text);
  if (examples) techniques.push(examples);

  const context = detectSummarizableContext(text);
  if (context) techniques.push(context);

  const totalSaved = techniques.reduce((sum, t) => sum + t.tokensSaved, 0);
  // Never compress below zero
  const compressedTokens = Math.max(0, originalTokens - totalSaved);
  const reductionPercent =
    originalTokens > 0
      ? Math.round(((originalTokens - compressedTokens) / originalTokens) * 100)
      : 0;

  return {
    originalTokens,
    compressedTokens,
    reductionPercent,
    techniques,
  };
}

// ---------------------------------------------------------------------------
// Context Utilization Reporting (Issue #21)
// ---------------------------------------------------------------------------

/**
 * Query ZeroDB prompt_events to compute context utilization metrics
 * for the given time range.
 */
export async function getContextUtilization(
  timeRange: { start: string; end: string }
): Promise<ContextUtilization> {
  const client = getZeroDBClient();

  const result = await client.queryRows({
    tableName: TABLE_PROMPT_EVENTS,
    filters: {},
    orderBy: 'timestamp',
    order: 'asc',
    limit: 10_000,
  });

  const allRows = result?.rows ?? [];
  const rows = allRows.filter((r) => {
    const ts = r.timestamp ? String(r.timestamp) : '';
    if (!ts) return true;
    return ts >= timeRange.start && ts <= timeRange.end;
  });

  if (rows.length === 0) {
    return {
      avgContextSize: 0,
      avgUsefulContext: 0,
      wastePercent: 0,
      oversizedPrompts: 0,
      totalPrompts: 0,
      recommendations: [],
    };
  }

  let totalContextSize = 0;
  let totalUsefulContext = 0;
  let oversizedCount = 0;

  for (const row of rows) {
    const totalTokens = Number(row.total_tokens) || 0;
    const promptTokens = Number(row.prompt_tokens) || 0;
    const promptText = String(row.prompt ?? '');

    // Context size is the full prompt token count
    totalContextSize += totalTokens;

    // Useful context is estimated by running compression analysis on the prompt text
    // For efficiency, we use the prompt_tokens (actual input) minus an estimated waste
    const analysis = analyzeCompression(promptText);
    const usefulTokens = Math.max(0, promptTokens - (analysis.originalTokens - analysis.compressedTokens));
    totalUsefulContext += usefulTokens;

    if (totalTokens > OVERSIZED_THRESHOLD) {
      oversizedCount++;
    }
  }

  const avgContextSize = Math.round(totalContextSize / rows.length);
  const avgUsefulContext = Math.round(totalUsefulContext / rows.length);
  const wastePercent =
    totalContextSize > 0
      ? Math.round(((totalContextSize - totalUsefulContext) / totalContextSize) * 100)
      : 0;

  const recommendations = generateRecommendations(
    wastePercent,
    oversizedCount,
    rows.length
  );

  return {
    avgContextSize,
    avgUsefulContext,
    wastePercent,
    oversizedPrompts: oversizedCount,
    totalPrompts: rows.length,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Recommendation Generation
// ---------------------------------------------------------------------------

function generateRecommendations(
  wastePercent: number,
  oversizedCount: number,
  totalPrompts: number
): string[] {
  const recommendations: string[] = [];

  if (wastePercent > 30) {
    recommendations.push(
      'High context waste detected. Consider compressing context blocks before sending prompts.'
    );
  }

  if (wastePercent > 15) {
    recommendations.push(
      'Remove redundant instructions that appear in multiple prompts to reduce token spend.'
    );
  }

  if (oversizedCount > 0) {
    const pct = Math.round((oversizedCount / totalPrompts) * 100);
    recommendations.push(
      `${oversizedCount} prompt(s) (${pct}%) exceed the ${OVERSIZED_THRESHOLD}-token threshold. ` +
        'Summarize or trim context to reduce costs.'
    );
  }

  if (totalPrompts > 10 && wastePercent > 20) {
    recommendations.push(
      'Consider implementing prompt templates to standardize and compress frequently used patterns.'
    );
  }

  return recommendations;
}
