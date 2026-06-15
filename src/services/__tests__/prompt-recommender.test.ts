/**
 * Tests for Prompt Recommendation Engine
 * Refs #15
 */

import { describe, it, expect } from 'vitest';
import { generateRecommendation } from '../prompt-recommender';
import { analyzePrompt } from '../prompt-analyzer';
import { Classification } from '../../types/telemetry';
import type { PromptAnalysis } from '../../types/prompt';

// ---------------------------------------------------------------------------
// Helper: create a minimal analysis object for testing
// ---------------------------------------------------------------------------

function makeAnalysis(overrides: Partial<PromptAnalysis> = {}): PromptAnalysis {
  return {
    id: 'pa_test',
    originalPrompt: '',
    tokenCount: 10,
    verbosityScore: 0,
    duplicationScore: 0,
    contextWasteScore: 0,
    repeatedInstructions: [],
    overallScore: 0,
    classification: Classification.UPDATING_CODE,
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Filler phrase removal
// ---------------------------------------------------------------------------

describe('generateRecommendation — filler removal', () => {
  it('removes filler phrases and reports token savings', async () => {
    const prompt =
      'I would like you to implement the auth service. Can you please add error handling. Please make sure to validate all inputs.';
    const analysis = await analyzePrompt(prompt);
    const rec = generateRecommendation(prompt, analysis);

    expect(rec.revisedPrompt).not.toContain('I would like you to');
    expect(rec.revisedPrompt).not.toContain('Can you please');
    expect(rec.revisedPrompt).not.toContain('Please make sure to');
    expect(rec.tokenReduction).toBeGreaterThan(0);
    expect(rec.tokenReductionPercent).toBeGreaterThan(0);
  });

  it('returns zero savings for prompts without filler', () => {
    const prompt = 'Implement auth service. Add error handling. Validate inputs.';
    const analysis = makeAnalysis({ originalPrompt: prompt, tokenCount: 15 });
    const rec = generateRecommendation(prompt, analysis);

    const fillerChange = rec.changes.find((c) => c.type === 'remove_redundancy');
    // Should either not exist or have 0 savings
    if (fillerChange) {
      expect(fillerChange.tokensSaved).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('generateRecommendation — deduplication', () => {
  it('removes duplicate instructions and reports savings', () => {
    const repeatedText = 'Always validate the user input before processing the request';
    const prompt = `${repeatedText}. Do some work. ${repeatedText}. More work. ${repeatedText}.`;
    const analysis = makeAnalysis({
      originalPrompt: prompt,
      tokenCount: 50,
      repeatedInstructions: [
        { text: repeatedText, count: 3, wastedTokens: 30 },
      ],
    });

    const rec = generateRecommendation(prompt, analysis);

    const dedupChange = rec.changes.find((c) => c.type === 'deduplicate');
    expect(dedupChange).toBeDefined();
    expect(dedupChange!.tokensSaved).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Context compression
// ---------------------------------------------------------------------------

describe('generateRecommendation — context compression', () => {
  it('compresses large code blocks', () => {
    const codeLines = Array.from({ length: 60 }, (_, i) => `  const line${i} = ${i};`);
    const codeBlock = '```typescript\n' + codeLines.join('\n') + '\n```';
    const prompt = `Fix this code:\n\n${codeBlock}\n\nThe bug is on line 42.`;

    const analysis = makeAnalysis({
      originalPrompt: prompt,
      tokenCount: 500,
    });

    const rec = generateRecommendation(prompt, analysis);

    const compressChange = rec.changes.find((c) => c.type === 'compress_context');
    expect(compressChange).toBeDefined();
    expect(compressChange!.tokensSaved).toBeGreaterThan(0);
  });

  it('does not compress small code blocks', () => {
    const prompt = 'Fix this:\n\n```js\nconst x = 1;\n```\n\nBug here.';
    const analysis = makeAnalysis({ originalPrompt: prompt, tokenCount: 20 });
    const rec = generateRecommendation(prompt, analysis);

    const compressChange = rec.changes.find((c) => c.type === 'compress_context');
    expect(compressChange).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Classification-specific recommendations
// ---------------------------------------------------------------------------

describe('generateRecommendation — classification hints', () => {
  it('adds template_reuse suggestion for UPDATING_SPECS classification', () => {
    const prompt = 'Update the API spec with new endpoints';
    const analysis = makeAnalysis({
      originalPrompt: prompt,
      classification: Classification.UPDATING_SPECS,
    });

    const rec = generateRecommendation(prompt, analysis);

    const templateChange = rec.changes.find((c) => c.type === 'template_reuse');
    expect(templateChange).toBeDefined();
    expect(templateChange!.description).toContain('template');
  });

  it('adds batch_conversion suggestion for BATCH_COMMANDS classification', () => {
    const prompt = 'Batch process all files in the directory';
    const analysis = makeAnalysis({
      originalPrompt: prompt,
      classification: Classification.BATCH_COMMANDS,
    });

    const rec = generateRecommendation(prompt, analysis);

    const batchChange = rec.changes.find((c) => c.type === 'batch_conversion');
    expect(batchChange).toBeDefined();
    expect(batchChange!.description).toContain('script');
  });

  it('does not add template/batch hints for FIXING_ISSUES', () => {
    const prompt = 'Fix the login bug';
    const analysis = makeAnalysis({
      originalPrompt: prompt,
      classification: Classification.FIXING_ISSUES,
    });

    const rec = generateRecommendation(prompt, analysis);

    expect(rec.changes.find((c) => c.type === 'template_reuse')).toBeUndefined();
    expect(rec.changes.find((c) => c.type === 'batch_conversion')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

describe('generateRecommendation — metrics', () => {
  it('returns non-negative tokenReduction', async () => {
    const prompt = 'Implement auth service';
    const analysis = await analyzePrompt(prompt);
    const rec = generateRecommendation(prompt, analysis);

    expect(rec.tokenReduction).toBeGreaterThanOrEqual(0);
  });

  it('returns tokenReductionPercent between 0 and 100', async () => {
    const prompt =
      'I would like you to please make sure to implement the auth service carefully. ' +
      'Can you please add comprehensive error handling to every function.';
    const analysis = await analyzePrompt(prompt);
    const rec = generateRecommendation(prompt, analysis);

    expect(rec.tokenReductionPercent).toBeGreaterThanOrEqual(0);
    expect(rec.tokenReductionPercent).toBeLessThanOrEqual(100);
  });

  it('returns performanceEstimate between 70 and 100', async () => {
    const prompt = 'Fix the login bug';
    const analysis = await analyzePrompt(prompt);
    const rec = generateRecommendation(prompt, analysis);

    expect(rec.performanceEstimate).toBeGreaterThanOrEqual(70);
    expect(rec.performanceEstimate).toBeLessThanOrEqual(100);
  });

  it('returns a well-formed PromptRecommendation', async () => {
    const prompt = 'Implement the user management module';
    const analysis = await analyzePrompt(prompt);
    const rec = generateRecommendation(prompt, analysis);

    expect(rec).toHaveProperty('revisedPrompt');
    expect(rec).toHaveProperty('tokenReduction');
    expect(rec).toHaveProperty('tokenReductionPercent');
    expect(rec).toHaveProperty('performanceEstimate');
    expect(rec).toHaveProperty('changes');
    expect(Array.isArray(rec.changes)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Whitespace cleanup
// ---------------------------------------------------------------------------

describe('generateRecommendation — whitespace cleanup', () => {
  it('collapses multiple blank lines after removals', async () => {
    const prompt =
      'I would like you to implement auth.\n\n\n\nI would like you to add tests.\n\n\n\nDone.';
    const analysis = await analyzePrompt(prompt);
    const rec = generateRecommendation(prompt, analysis);

    // Should not contain 3+ consecutive newlines
    expect(rec.revisedPrompt).not.toMatch(/\n{3,}/);
  });

  it('trims leading/trailing whitespace', async () => {
    const prompt = '   I would like you to implement the feature.   ';
    const analysis = await analyzePrompt(prompt);
    const rec = generateRecommendation(prompt, analysis);

    expect(rec.revisedPrompt).toBe(rec.revisedPrompt.trim());
  });
});
