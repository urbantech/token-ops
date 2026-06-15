/**
 * Context Compression Engine Types
 *
 * Covers GitHub Issues:
 *  #19 — Context Compression Engine (Epic)
 *  #20 — Conversation Compression
 *  #21 — Context Utilization Reporting
 */

// ---------------------------------------------------------------------------
// Compression Analysis Types (Issue #20)
// ---------------------------------------------------------------------------

export interface CompressionTechnique {
  /** Technique identifier, e.g. 'remove_redundancy', 'summarize_context' */
  name: string;
  /** Estimated tokens saved by applying this technique */
  tokensSaved: number;
  /** Human-readable description of what the technique does */
  description: string;
}

export interface CompressionAnalysis {
  /** Token count of the original input */
  originalTokens: number;
  /** Estimated token count after compression */
  compressedTokens: number;
  /** Percentage reduction (0-100) */
  reductionPercent: number;
  /** Techniques identified and their individual savings */
  techniques: CompressionTechnique[];
}

// ---------------------------------------------------------------------------
// Context Utilization Types (Issue #21)
// ---------------------------------------------------------------------------

export interface ContextUtilization {
  /** Average context window size across prompts (tokens) */
  avgContextSize: number;
  /** Average useful/actionable context (tokens) */
  avgUsefulContext: number;
  /** Percentage of context that is wasted (0-100) */
  wastePercent: number;
  /** Number of prompts exceeding a sensible context threshold */
  oversizedPrompts: number;
  /** Total prompts analyzed in the time range */
  totalPrompts: number;
  /** Actionable recommendations for reducing waste */
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// API Request / Response Shapes
// ---------------------------------------------------------------------------

export interface CompressRequest {
  text: string;
}

export interface ContextUtilizationQuery {
  start: string;
  end: string;
}
