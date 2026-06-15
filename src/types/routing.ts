/**
 * Model Routing Engine Types
 * Refs #22, #23, #24
 */

// ---------------------------------------------------------------------------
// Model Cost Catalog
// ---------------------------------------------------------------------------

export interface ModelCost {
  modelId: string;
  provider: string;
  inputPer1MTokens: number;
  outputPer1MTokens: number;
}

// ---------------------------------------------------------------------------
// Model Recommendation (Issue #23)
// ---------------------------------------------------------------------------

export interface ModelRecommendation {
  currentModel: string;
  recommendedModel: string;
  classification: string;
  expectedSavingsPercent: number;
  confidenceScore: number; // 0-100
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Routing Rules (Issue #24)
// ---------------------------------------------------------------------------

export interface RoutingRule {
  id: string;
  name: string;
  classification: string;
  preferredModel: string;
  fallbackModel: string;
  maxCostPer1kTokens: number;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Routing Decision (Issue #24)
// ---------------------------------------------------------------------------

export interface RoutingDecision {
  selectedModel: string;
  rule: string;
  reason: string;
  estimatedCost: number;
}
