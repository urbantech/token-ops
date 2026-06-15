/**
 * Model Routing Engine
 * Refs #22, #23, #24
 *
 * Provides model recommendations, routing rules, and automatic request
 * routing to optimize token spend by classification type.
 */

import {
  ModelCost,
  ModelRecommendation,
  RoutingRule,
  RoutingDecision,
} from '../types/routing';

// ---------------------------------------------------------------------------
// Model Cost Catalog
// ---------------------------------------------------------------------------

export const MODEL_COSTS: ModelCost[] = [
  { modelId: 'claude-opus-4-6', provider: 'anthropic', inputPer1MTokens: 15, outputPer1MTokens: 75 },
  { modelId: 'claude-sonnet-4-6', provider: 'anthropic', inputPer1MTokens: 3, outputPer1MTokens: 15 },
  { modelId: 'claude-haiku-3-5', provider: 'anthropic', inputPer1MTokens: 0.25, outputPer1MTokens: 1.25 },
  { modelId: 'gpt-4o', provider: 'openai', inputPer1MTokens: 2.5, outputPer1MTokens: 10 },
  { modelId: 'gpt-4o-mini', provider: 'openai', inputPer1MTokens: 0.15, outputPer1MTokens: 0.60 },
  { modelId: 'deepseek-v3', provider: 'deepseek', inputPer1MTokens: 0.27, outputPer1MTokens: 1.10 },
  { modelId: 'llama-3.1-70b', provider: 'meta', inputPer1MTokens: 0.88, outputPer1MTokens: 0.88 },
];

// ---------------------------------------------------------------------------
// Classification-to-quality mapping
// ---------------------------------------------------------------------------

/**
 * Maps each classification to a quality tier and the recommended set of models.
 * Higher-quality tasks (code, fixes) need stronger models; lower-quality
 * tasks (brainstorm, batch, specs) can use cheaper ones.
 */
interface ClassificationProfile {
  qualityTier: 'high' | 'medium' | 'low';
  /** Models suitable for this classification, ordered best to cheapest */
  suitableModels: string[];
  /** The most expensive model typically used */
  defaultExpensiveModel: string;
}

const CLASSIFICATION_PROFILES: Record<string, ClassificationProfile> = {
  code: {
    qualityTier: 'high',
    suitableModels: ['claude-sonnet-4-6', 'gpt-4o', 'claude-opus-4-6'],
    defaultExpensiveModel: 'claude-opus-4-6',
  },
  fixes: {
    qualityTier: 'high',
    suitableModels: ['claude-sonnet-4-6', 'gpt-4o', 'claude-opus-4-6'],
    defaultExpensiveModel: 'claude-opus-4-6',
  },
  specs: {
    qualityTier: 'medium',
    suitableModels: ['claude-sonnet-4-6', 'gpt-4o', 'claude-haiku-3-5'],
    defaultExpensiveModel: 'claude-opus-4-6',
  },
  brainstorm: {
    qualityTier: 'low',
    suitableModels: ['claude-haiku-3-5', 'gpt-4o-mini', 'deepseek-v3', 'llama-3.1-70b'],
    defaultExpensiveModel: 'claude-opus-4-6',
  },
  batch: {
    qualityTier: 'low',
    suitableModels: ['gpt-4o-mini', 'deepseek-v3', 'claude-haiku-3-5', 'llama-3.1-70b'],
    defaultExpensiveModel: 'claude-opus-4-6',
  },
};

// ---------------------------------------------------------------------------
// Default Routing Rules
// ---------------------------------------------------------------------------

const DEFAULT_RULES: RoutingRule[] = [
  {
    id: 'rule-code',
    name: 'Code Generation',
    classification: 'code',
    preferredModel: 'claude-sonnet-4-6',
    fallbackModel: 'gpt-4o',
    maxCostPer1kTokens: 0.02,
    enabled: true,
  },
  {
    id: 'rule-fixes',
    name: 'Bug Fixes',
    classification: 'fixes',
    preferredModel: 'claude-sonnet-4-6',
    fallbackModel: 'gpt-4o',
    maxCostPer1kTokens: 0.02,
    enabled: true,
  },
  {
    id: 'rule-specs',
    name: 'Spec Writing',
    classification: 'specs',
    preferredModel: 'claude-haiku-3-5',
    fallbackModel: 'gpt-4o-mini',
    maxCostPer1kTokens: 0.005,
    enabled: true,
  },
  {
    id: 'rule-brainstorm',
    name: 'Brainstorming',
    classification: 'brainstorm',
    preferredModel: 'claude-haiku-3-5',
    fallbackModel: 'gpt-4o-mini',
    maxCostPer1kTokens: 0.003,
    enabled: true,
  },
  {
    id: 'rule-batch',
    name: 'Batch Commands',
    classification: 'batch',
    preferredModel: 'gpt-4o-mini',
    fallbackModel: 'deepseek-v3',
    maxCostPer1kTokens: 0.002,
    enabled: true,
  },
];

// In-memory rule store (deep copy of defaults)
let rules: RoutingRule[] = structuredClone(DEFAULT_RULES);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCost(modelId: string): ModelCost | undefined {
  return MODEL_COSTS.find(c => c.modelId === modelId);
}

/**
 * Compute the average cost per 1k tokens for a model.
 * Uses a 50/50 input/output split as a rough estimate.
 */
function avgCostPer1kTokens(modelId: string): number {
  const cost = getCost(modelId);
  if (!cost) return Infinity;
  const inputPer1k = cost.inputPer1MTokens / 1000;
  const outputPer1k = cost.outputPer1MTokens / 1000;
  return (inputPer1k + outputPer1k) / 2;
}

/**
 * Calculate the savings percentage when switching from one model to another.
 */
function savingsPercent(fromModel: string, toModel: string): number {
  const fromCost = avgCostPer1kTokens(fromModel);
  const toCost = avgCostPer1kTokens(toModel);
  if (fromCost <= 0 || fromCost === Infinity) return 0;
  const savings = ((fromCost - toCost) / fromCost) * 100;
  return Math.max(0, Math.round(savings * 100) / 100);
}

function generateId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get model recommendations for a given classification.
 * Returns cheaper-model suggestions sorted by expected savings (descending).
 */
export function getRecommendations(classification: string): ModelRecommendation[] {
  const profile = CLASSIFICATION_PROFILES[classification];
  if (!profile) return [];

  const recommendations: ModelRecommendation[] = [];

  // For each expensive model, recommend each suitable cheaper model
  const expensiveModels = MODEL_COSTS.filter(
    m => !profile.suitableModels.includes(m.modelId) || m.modelId === profile.defaultExpensiveModel
  );

  for (const expensive of expensiveModels) {
    for (const suitableId of profile.suitableModels) {
      if (suitableId === expensive.modelId) continue;

      const savings = savingsPercent(expensive.modelId, suitableId);
      if (savings <= 0) continue;

      // Confidence: higher for low-quality tasks, lower for high-quality tasks
      // when recommending a big downgrade
      const qualityPenalty = profile.qualityTier === 'high' ? 10 : profile.qualityTier === 'medium' ? 5 : 0;
      const costRatio = avgCostPer1kTokens(suitableId) / avgCostPer1kTokens(expensive.modelId);
      const baseConfidence = 85;
      const confidence = Math.min(
        100,
        Math.max(0, Math.round(baseConfidence - qualityPenalty - costRatio * 10))
      );

      recommendations.push({
        currentModel: expensive.modelId,
        recommendedModel: suitableId,
        classification,
        expectedSavingsPercent: savings,
        confidenceScore: confidence,
        reasoning: `Switch from ${expensive.modelId} to ${suitableId} for ${classification} tasks to save ~${savings}% on token costs.`,
      });
    }
  }

  // Sort by savings descending
  recommendations.sort((a, b) => b.expectedSavingsPercent - a.expectedSavingsPercent);

  return recommendations;
}

/**
 * Get all current routing rules.
 */
export function getRoutingRules(): RoutingRule[] {
  return structuredClone(rules);
}

/**
 * Route a request to the optimal model based on classification and token estimate.
 */
export function routeRequest(classification: string, tokenEstimate: number): RoutingDecision {
  // Find the first enabled rule matching this classification
  const matchingRule = rules.find(r => r.classification === classification && r.enabled);

  if (!matchingRule) {
    // Default fallback
    const defaultModel = 'claude-sonnet-4-6';
    const costPer1k = avgCostPer1kTokens(defaultModel);
    return {
      selectedModel: defaultModel,
      rule: 'default',
      reason: `No matching enabled rule for classification "${classification}"; using default model.`,
      estimatedCost: (tokenEstimate / 1000) * costPer1k,
    };
  }

  // Check if the preferred model is within the cost limit
  const preferredCostPer1k = avgCostPer1kTokens(matchingRule.preferredModel);

  if (preferredCostPer1k <= matchingRule.maxCostPer1kTokens) {
    return {
      selectedModel: matchingRule.preferredModel,
      rule: matchingRule.id,
      reason: `Preferred model "${matchingRule.preferredModel}" is within cost limit for rule "${matchingRule.name}".`,
      estimatedCost: (tokenEstimate / 1000) * preferredCostPer1k,
    };
  }

  // Fall back to the fallback model
  const fallbackCostPer1k = avgCostPer1kTokens(matchingRule.fallbackModel);
  return {
    selectedModel: matchingRule.fallbackModel,
    rule: matchingRule.id,
    reason: `Preferred model "${matchingRule.preferredModel}" exceeds cost limit (${preferredCostPer1k.toFixed(6)} > ${matchingRule.maxCostPer1kTokens}); using fallback "${matchingRule.fallbackModel}".`,
    estimatedCost: (tokenEstimate / 1000) * fallbackCostPer1k,
  };
}

/**
 * Create or update a routing rule. If `rule.id` matches an existing rule,
 * it is updated (merged). Otherwise a new rule is created.
 */
export function upsertRule(partial: Partial<RoutingRule>): RoutingRule {
  const existingIndex = partial.id ? rules.findIndex(r => r.id === partial.id) : -1;

  if (existingIndex >= 0) {
    // Merge with existing
    rules[existingIndex] = { ...rules[existingIndex], ...partial } as RoutingRule;
    return structuredClone(rules[existingIndex]);
  }

  // Create new
  const newRule: RoutingRule = {
    id: partial.id ?? generateId(),
    name: partial.name ?? 'Unnamed Rule',
    classification: partial.classification ?? 'unknown',
    preferredModel: partial.preferredModel ?? 'claude-sonnet-4-6',
    fallbackModel: partial.fallbackModel ?? 'gpt-4o-mini',
    maxCostPer1kTokens: partial.maxCostPer1kTokens ?? 0.01,
    enabled: partial.enabled ?? true,
  };

  rules.push(newRule);
  return structuredClone(newRule);
}

/**
 * Reset rules to defaults. Used in testing.
 */
export function resetRules(): void {
  rules = structuredClone(DEFAULT_RULES);
}
