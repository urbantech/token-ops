/**
 * Prompt Analysis Service for TokenOps
 *
 * Port of core/src/backend/app/services/agent/prompt_optimizer.py to TypeScript.
 * Analyzes prompts for verbosity, duplication, context waste, and repeated
 * instructions. Uses ZeroDB semantic search to detect duplicates.
 *
 * Refs #14
 */

import { Classification } from '@/types/telemetry';
import type {
  PromptAnalysis,
  RepeatedInstruction,
  DuplicatePrompt,
} from '@/types/prompt';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Approximate characters per token (conservative, matches Python TokenCounter) */
const CHARS_PER_TOKEN = 4;

/** Similarity threshold above which two prompts are considered duplicates */
const DEFAULT_DUPLICATE_THRESHOLD = 0.80;

/** Weight vector for the composite overallScore */
const WEIGHTS = {
  verbosity: 0.35,
  duplication: 0.30,
  contextWaste: 0.35,
} as const;

// Classification patterns — mirrors the Python classifier
const CLASSIFICATION_PATTERNS: Record<Classification, RegExp[]> = {
  [Classification.UPDATING_SPECS]: [
    /update.*spec/i,
    /revise.*requirement/i,
    /change.*document/i,
    /modify.*design/i,
    /edit.*prd/i,
    /spec.*update/i,
  ],
  [Classification.BRAINSTORMING]: [
    /brainstorm/i,
    /ideas?\s+for/i,
    /suggest/i,
    /what\s+if/i,
    /how\s+about/i,
    /explore.*option/i,
    /creative/i,
    /alternatives/i,
  ],
  [Classification.UPDATING_CODE]: [
    /implement/i,
    /code/i,
    /function/i,
    /class/i,
    /component/i,
    /refactor/i,
    /write.*code/i,
    /add.*feature/i,
    /create.*endpoint/i,
    /build/i,
  ],
  [Classification.FIXING_ISSUES]: [
    /fix/i,
    /bug/i,
    /error/i,
    /issue/i,
    /broken/i,
    /doesn.t work/i,
    /not working/i,
    /debug/i,
    /patch/i,
    /resolve/i,
  ],
  [Classification.BATCH_COMMANDS]: [
    /batch/i,
    /bulk/i,
    /multiple.*files/i,
    /for\s+each/i,
    /all\s+of\s+the/i,
    /repeat.*for/i,
    /do\s+the\s+same/i,
    /every\s+file/i,
  ],
};

// Common filler / redundant phrases that inflate prompts
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
// Token Counting
// ---------------------------------------------------------------------------

/**
 * Approximate token count using the 1-token ~ 4-character heuristic.
 * Matches the Python `TokenCounter.count_tokens` implementation.
 */
export function countTokens(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return Math.ceil(normalized.length / CHARS_PER_TOKEN);
}

// ---------------------------------------------------------------------------
// Core Analysis
// ---------------------------------------------------------------------------

/**
 * Classify a prompt by matching against known pattern sets.
 * Returns the classification with the most pattern matches, falling back
 * to UPDATING_CODE if nothing matches strongly.
 */
export function classifyPrompt(prompt: string): Classification {
  let bestMatch: Classification = Classification.UPDATING_CODE;
  let bestCount = 0;

  for (const [classification, patterns] of Object.entries(CLASSIFICATION_PATTERNS)) {
    const matchCount = patterns.filter((re) => re.test(prompt)).length;
    if (matchCount > bestCount) {
      bestCount = matchCount;
      bestMatch = classification as Classification;
    }
  }

  return bestMatch;
}

/**
 * Detect repeated instruction patterns in a prompt.
 *
 * Strategy:
 * 1. Split into sentences.
 * 2. For each sentence, check if a substantially similar sentence appears
 *    later (simple Jaccard on word-sets).
 * 3. Group repeats and report wasted tokens.
 */
export function detectRepeatedInstructions(prompt: string): RepeatedInstruction[] {
  const sentences = prompt
    .split(/[.!?\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20); // skip trivially short fragments

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

  return Array.from(seen.values())
    .filter((entry) => entry.count > 1)
    .map((entry) => ({
      text: entry.text,
      count: entry.count,
      wastedTokens: countTokens(entry.text) * (entry.count - 1),
    }));
}

/**
 * Calculate verbosity score (0-100).
 *
 * Measures: filler phrase density, average sentence length, and
 * overall length relative to unique-content density.
 */
export function calculateVerbosityScore(prompt: string): number {
  const tokens = countTokens(prompt);
  if (tokens === 0) return 0;

  // Filler phrase density
  let fillerTokens = 0;
  for (const pattern of FILLER_PHRASES) {
    const matches = prompt.match(pattern);
    if (matches) {
      for (const match of matches) {
        fillerTokens += countTokens(match);
      }
    }
  }
  const fillerRatio = fillerTokens / tokens;

  // Average sentence length (longer = more verbose)
  const sentences = prompt.split(/[.!?\n]/).filter((s) => s.trim().length > 0);
  const avgSentenceTokens =
    sentences.length > 0
      ? sentences.reduce((sum, s) => sum + countTokens(s), 0) / sentences.length
      : 0;
  const sentenceLengthPenalty = Math.min(avgSentenceTokens / 100, 1);

  // Unique word ratio (lower = more repetitive)
  const words = prompt.toLowerCase().split(/\s+/);
  const uniqueRatio = words.length > 0 ? new Set(words).size / words.length : 1;
  const repetitionPenalty = 1 - uniqueRatio;

  const raw =
    fillerRatio * 40 + sentenceLengthPenalty * 30 + repetitionPenalty * 30;

  return Math.round(Math.min(100, Math.max(0, raw)));
}

/**
 * Calculate context waste score (0-100).
 *
 * Estimates how much of the prompt is "context" (system instructions,
 * pasted documents, etc.) vs actionable request. High context-to-request
 * ratio => high waste score.
 */
export function calculateContextWasteScore(prompt: string): number {
  const tokens = countTokens(prompt);
  if (tokens < 20) return 0;

  // Heuristic: lines starting with common context indicators
  const lines = prompt.split('\n');
  let contextTokens = 0;
  let inContextBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect context block boundaries
    if (/^(context|background|system|reference|note|here\s+is)/i.test(trimmed)) {
      inContextBlock = true;
    }
    if (/^(task|request|question|please|now|action|do|create|implement|fix|write)/i.test(trimmed)) {
      inContextBlock = false;
    }

    // Code blocks and pasted content are context
    if (trimmed.startsWith('```') || trimmed.startsWith('---') || trimmed.startsWith('|||')) {
      inContextBlock = !inContextBlock;
    }

    if (inContextBlock) {
      contextTokens += countTokens(line);
    }
  }

  // Also count quoted content
  const quotedMatches = prompt.match(/"[^"]{50,}"/g) || [];
  for (const match of quotedMatches) {
    contextTokens += countTokens(match);
  }

  const wasteRatio = tokens > 0 ? contextTokens / tokens : 0;
  return Math.round(Math.min(100, Math.max(0, wasteRatio * 100)));
}

/**
 * Analyze a prompt and return a full PromptAnalysis scorecard.
 *
 * This is the main entry point for prompt analysis — equivalent to the
 * Python `maybe_refine_agent_prompt` pipeline but focused on scoring
 * rather than automatic refinement.
 */
export async function analyzePrompt(prompt: string): Promise<PromptAnalysis> {
  const tokenCount = countTokens(prompt);
  const verbosityScore = calculateVerbosityScore(prompt);
  const contextWasteScore = calculateContextWasteScore(prompt);
  const repeatedInstructions = detectRepeatedInstructions(prompt);
  const classification = classifyPrompt(prompt);

  // Duplication score: in a full deployment this would call ZeroDB semantic
  // search. For the MVP we compute a local self-similarity approximation
  // based on repeated-instruction density.
  const repeatedTokens = repeatedInstructions.reduce(
    (sum, r) => sum + r.wastedTokens,
    0
  );
  const duplicationScore =
    tokenCount > 0
      ? Math.round(Math.min(100, (repeatedTokens / tokenCount) * 200))
      : 0;

  const overallScore = Math.round(
    verbosityScore * WEIGHTS.verbosity +
      duplicationScore * WEIGHTS.duplication +
      contextWasteScore * WEIGHTS.contextWaste
  );

  return {
    id: generateId(),
    originalPrompt: prompt,
    tokenCount,
    verbosityScore,
    duplicationScore,
    contextWasteScore,
    repeatedInstructions,
    overallScore,
    classification,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Find similar previously-analyzed prompts via ZeroDB semantic search.
 *
 * In the MVP this returns an empty array since we do not yet persist
 * prompt history to ZeroDB. The function signature is ready for
 * integration once the memory store is wired up.
 */
export async function detectDuplicates(
  prompt: string,
  threshold: number = DEFAULT_DUPLICATE_THRESHOLD
): Promise<DuplicatePrompt[]> {
  // TODO: wire up ZeroDB semantic search via:
  //   const client = getZeroDBClient();
  //   const results = await client.queryRows({ tableName: 'prompt_history', ... });
  //
  // For now return empty — the API route returns this so consumers know the
  // contract, and integration is a single swap.

  void prompt;
  void threshold;
  return [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `pa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
