/**
 * Prompt Optimization Types for TokenOps
 *
 * Covers GitHub Issues:
 *  #14 — Prompt Analysis Agent
 *  #15 — Prompt Recommendation Engine
 */

import { Classification } from './telemetry';

// ---------------------------------------------------------------------------
// Analysis Types (Issue #14)
// ---------------------------------------------------------------------------

export interface RepeatedInstruction {
  /** The repeated text or pattern */
  text: string;
  /** Number of times it appears */
  count: number;
  /** Approximate token cost of the redundancy */
  wastedTokens: number;
}

export interface PromptAnalysis {
  /** Unique analysis ID */
  id: string;
  /** The original prompt text that was analyzed */
  originalPrompt: string;
  /** Approximate token count of the original prompt */
  tokenCount: number;
  /** 0-100: how verbose the prompt is relative to its intent */
  verbosityScore: number;
  /** 0-100: semantic similarity to recently analyzed prompts */
  duplicationScore: number;
  /** 0-100: ratio of context tokens that contribute to useful output */
  contextWasteScore: number;
  /** Detected repeated instruction patterns */
  repeatedInstructions: RepeatedInstruction[];
  /** 0-100: weighted composite of all scores (higher = more waste) */
  overallScore: number;
  /** Classification of the prompt's purpose */
  classification: Classification;
  /** ISO 8601 timestamp of the analysis */
  analyzedAt: string;
}

// ---------------------------------------------------------------------------
// Recommendation Types (Issue #15)
// ---------------------------------------------------------------------------

export interface PromptChange {
  /** Type of change applied */
  type:
    | 'remove_redundancy'
    | 'compress_context'
    | 'template_reuse'
    | 'batch_conversion'
    | 'shorten_instruction'
    | 'deduplicate';
  /** Human-readable description of the change */
  description: string;
  /** Estimated tokens saved by this specific change */
  tokensSaved: number;
}

export interface PromptRecommendation {
  /** The optimized prompt text */
  revisedPrompt: string;
  /** Absolute token reduction (original - revised) */
  tokenReduction: number;
  /** Percentage token reduction */
  tokenReductionPercent: number;
  /** Predicted quality score (0-100, higher is better) */
  performanceEstimate: number;
  /** List of specific changes applied */
  changes: PromptChange[];
}

// ---------------------------------------------------------------------------
// Composite Types
// ---------------------------------------------------------------------------

export interface PromptScorecard {
  analysis: PromptAnalysis;
  recommendation: PromptRecommendation;
}

export interface DuplicatePrompt {
  /** ID of the similar prompt in history */
  id: string;
  /** The similar prompt text */
  prompt: string;
  /** Similarity score (0.0-1.0) */
  similarity: number;
  /** When the duplicate was first seen */
  analyzedAt: string;
  /** Classification of the duplicate */
  classification: Classification;
  /** Token count of the duplicate */
  tokenCount: number;
}

// ---------------------------------------------------------------------------
// API Request / Response Shapes
// ---------------------------------------------------------------------------

export interface AnalyzePromptRequest {
  prompt: string;
}

export interface RecommendPromptRequest {
  prompt: string;
  analysis?: PromptAnalysis;
}

export interface DuplicateCheckRequest {
  prompt: string;
  threshold?: number;
}

export interface PromptHistoryEntry {
  id: string;
  promptPreview: string;
  tokenCount: number;
  overallScore: number;
  verbosityScore: number;
  duplicationScore: number;
  contextWasteScore: number;
  classification: Classification;
  tokenReduction: number;
  tokenReductionPercent: number;
  analyzedAt: string;
}
