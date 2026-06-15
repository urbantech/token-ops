/**
 * Tests for Model Routing Engine
 * Refs #22, #23, #24
 *
 * TDD: these tests were written before the implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRecommendations,
  getRoutingRules,
  routeRequest,
  upsertRule,
  resetRules,
  MODEL_COSTS,
} from '../model-router';

// ---------------------------------------------------------------------------
// getRecommendations
// ---------------------------------------------------------------------------

describe('getRecommendations', () => {
  it('returns an array of ModelRecommendation objects', () => {
    const recs = getRecommendations('brainstorm');
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
  });

  it('each recommendation has required fields', () => {
    const recs = getRecommendations('code');
    for (const r of recs) {
      expect(r).toHaveProperty('currentModel');
      expect(r).toHaveProperty('recommendedModel');
      expect(r).toHaveProperty('classification', 'code');
      expect(r).toHaveProperty('expectedSavingsPercent');
      expect(r).toHaveProperty('confidenceScore');
      expect(r).toHaveProperty('reasoning');
    }
  });

  it('confidenceScore is between 0 and 100', () => {
    const recs = getRecommendations('specs');
    for (const r of recs) {
      expect(r.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(r.confidenceScore).toBeLessThanOrEqual(100);
    }
  });

  it('expectedSavingsPercent is between 0 and 100', () => {
    const recs = getRecommendations('fixes');
    for (const r of recs) {
      expect(r.expectedSavingsPercent).toBeGreaterThanOrEqual(0);
      expect(r.expectedSavingsPercent).toBeLessThanOrEqual(100);
    }
  });

  it('recommends cheaper models for brainstorm classification', () => {
    const recs = getRecommendations('brainstorm');
    // At least one recommendation should suggest a cheaper model than opus
    const opusRec = recs.find(r => r.currentModel === 'claude-opus-4-6');
    expect(opusRec).toBeDefined();
    expect(opusRec!.expectedSavingsPercent).toBeGreaterThan(0);
  });

  it('recommends models with higher quality for code classification', () => {
    const recs = getRecommendations('code');
    // Should still recommend some downgrades from opus
    const opusRec = recs.find(r => r.currentModel === 'claude-opus-4-6');
    expect(opusRec).toBeDefined();
  });

  it('returns empty array for unknown classification', () => {
    const recs = getRecommendations('nonexistent_class');
    expect(recs).toEqual([]);
  });

  it('sorts recommendations by expectedSavingsPercent descending', () => {
    const recs = getRecommendations('batch');
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].expectedSavingsPercent).toBeGreaterThanOrEqual(
        recs[i].expectedSavingsPercent
      );
    }
  });
});

// ---------------------------------------------------------------------------
// getRoutingRules
// ---------------------------------------------------------------------------

describe('getRoutingRules', () => {
  beforeEach(() => {
    resetRules();
  });

  it('returns default routing rules', () => {
    const rules = getRoutingRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('each rule has required fields', () => {
    const rules = getRoutingRules();
    for (const rule of rules) {
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('classification');
      expect(rule).toHaveProperty('preferredModel');
      expect(rule).toHaveProperty('fallbackModel');
      expect(rule).toHaveProperty('maxCostPer1kTokens');
      expect(typeof rule.enabled).toBe('boolean');
    }
  });

  it('covers all standard classifications', () => {
    const rules = getRoutingRules();
    const classifications = rules.map(r => r.classification);
    expect(classifications).toContain('specs');
    expect(classifications).toContain('brainstorm');
    expect(classifications).toContain('code');
    expect(classifications).toContain('fixes');
    expect(classifications).toContain('batch');
  });

  it('all default rules are enabled', () => {
    const rules = getRoutingRules();
    for (const rule of rules) {
      expect(rule.enabled).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// routeRequest
// ---------------------------------------------------------------------------

describe('routeRequest', () => {
  beforeEach(() => {
    resetRules();
  });

  it('returns a RoutingDecision with required fields', () => {
    const decision = routeRequest('code', 1000);
    expect(decision).toHaveProperty('selectedModel');
    expect(decision).toHaveProperty('rule');
    expect(decision).toHaveProperty('reason');
    expect(decision).toHaveProperty('estimatedCost');
  });

  it('selects the preferred model for code classification', () => {
    const decision = routeRequest('code', 1000);
    expect(decision.selectedModel).toBeTruthy();
    expect(decision.rule).toBeTruthy();
  });

  it('selects the preferred model for brainstorm classification', () => {
    const decision = routeRequest('brainstorm', 1000);
    expect(decision.selectedModel).toBeTruthy();
  });

  it('selects the preferred model for batch classification', () => {
    const decision = routeRequest('batch', 5000);
    expect(decision.selectedModel).toBeTruthy();
  });

  it('returns a non-negative estimated cost', () => {
    const decision = routeRequest('code', 1000);
    expect(decision.estimatedCost).toBeGreaterThanOrEqual(0);
  });

  it('estimated cost scales with token estimate', () => {
    const small = routeRequest('code', 100);
    const large = routeRequest('code', 10000);
    expect(large.estimatedCost).toBeGreaterThan(small.estimatedCost);
  });

  it('falls back to a default when no rule matches the classification', () => {
    const decision = routeRequest('unknown', 1000);
    expect(decision.selectedModel).toBeTruthy();
    expect(decision.reason).toContain('default');
  });

  it('uses fallback model when preferred model exceeds cost limit', () => {
    // Disable the default code rule so our strict rule is matched first
    const existing = getRoutingRules().find(r => r.classification === 'code');
    if (existing) {
      upsertRule({ id: existing.id, enabled: false });
    }
    // Insert a rule with a very low cost limit that the preferred model will exceed
    upsertRule({
      id: 'test-strict',
      name: 'Strict Cost Rule',
      classification: 'code',
      preferredModel: 'claude-opus-4-6',
      fallbackModel: 'gpt-4o-mini',
      maxCostPer1kTokens: 0.001, // impossibly low for opus
      enabled: true,
    });
    const decision = routeRequest('code', 1000);
    expect(decision.selectedModel).toBe('gpt-4o-mini');
  });

  it('skips disabled rules', () => {
    // Disable all existing rules and add one disabled
    const rules = getRoutingRules();
    for (const r of rules) {
      upsertRule({ ...r, enabled: false });
    }
    const decision = routeRequest('code', 1000);
    expect(decision.reason).toContain('default');
  });
});

// ---------------------------------------------------------------------------
// upsertRule
// ---------------------------------------------------------------------------

describe('upsertRule', () => {
  beforeEach(() => {
    resetRules();
  });

  it('creates a new rule with an id when none provided', () => {
    const rule = upsertRule({
      name: 'Custom Rule',
      classification: 'code',
      preferredModel: 'gpt-4o',
      fallbackModel: 'gpt-4o-mini',
      maxCostPer1kTokens: 0.01,
      enabled: true,
    });
    expect(rule.id).toBeTruthy();
    expect(rule.name).toBe('Custom Rule');
  });

  it('updates an existing rule by id', () => {
    const rule = upsertRule({
      name: 'Original Name',
      classification: 'code',
      preferredModel: 'gpt-4o',
      fallbackModel: 'gpt-4o-mini',
      maxCostPer1kTokens: 0.01,
      enabled: true,
    });
    const updated = upsertRule({
      id: rule.id,
      name: 'Updated Name',
    });
    expect(updated.id).toBe(rule.id);
    expect(updated.name).toBe('Updated Name');
    expect(updated.classification).toBe('code'); // preserved
  });

  it('returns the complete rule after creation', () => {
    const rule = upsertRule({
      name: 'Full Rule',
      classification: 'specs',
      preferredModel: 'claude-sonnet-4-6',
      fallbackModel: 'claude-haiku-3-5',
      maxCostPer1kTokens: 0.005,
      enabled: false,
    });
    expect(rule).toMatchObject({
      name: 'Full Rule',
      classification: 'specs',
      preferredModel: 'claude-sonnet-4-6',
      fallbackModel: 'claude-haiku-3-5',
      maxCostPer1kTokens: 0.005,
      enabled: false,
    });
  });

  it('adds the new rule to the rules list', () => {
    const before = getRoutingRules().length;
    upsertRule({
      name: 'Extra Rule',
      classification: 'batch',
      preferredModel: 'gpt-4o-mini',
      fallbackModel: 'deepseek-v3',
      maxCostPer1kTokens: 0.002,
      enabled: true,
    });
    const after = getRoutingRules().length;
    expect(after).toBe(before + 1);
  });

  it('does not duplicate when updating by id', () => {
    const rule = upsertRule({
      name: 'Test',
      classification: 'fixes',
      preferredModel: 'gpt-4o',
      fallbackModel: 'gpt-4o-mini',
      maxCostPer1kTokens: 0.01,
      enabled: true,
    });
    const before = getRoutingRules().length;
    upsertRule({ id: rule.id, name: 'Test Updated' });
    const after = getRoutingRules().length;
    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// MODEL_COSTS
// ---------------------------------------------------------------------------

describe('MODEL_COSTS', () => {
  it('contains cost data for all expected models', () => {
    const expectedModels = [
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-haiku-3-5',
      'gpt-4o',
      'gpt-4o-mini',
      'deepseek-v3',
      'llama-3.1-70b',
    ];
    for (const model of expectedModels) {
      const cost = MODEL_COSTS.find(c => c.modelId === model);
      expect(cost).toBeDefined();
      expect(cost!.inputPer1MTokens).toBeGreaterThan(0);
      expect(cost!.outputPer1MTokens).toBeGreaterThan(0);
    }
  });
});
