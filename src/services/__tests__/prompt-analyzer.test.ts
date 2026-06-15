/**
 * Tests for Prompt Analysis Service
 * Refs #14
 */

import { describe, it, expect } from 'vitest';
import {
  countTokens,
  classifyPrompt,
  detectRepeatedInstructions,
  calculateVerbosityScore,
  calculateContextWasteScore,
  analyzePrompt,
} from '../prompt-analyzer';
import { Classification } from '../../types/telemetry';

// ---------------------------------------------------------------------------
// countTokens
// ---------------------------------------------------------------------------

describe('countTokens', () => {
  it('returns 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('counts ~1 token per 4 characters', () => {
    // 20 chars -> ceil(20/4) = 5 tokens
    expect(countTokens('abcdefghijklmnopqrst')).toBe(5);
  });

  it('normalizes whitespace before counting', () => {
    const withSpaces = 'hello    world   test';
    const normalized = 'hello world test';
    expect(countTokens(withSpaces)).toBe(countTokens(normalized));
  });

  it('rounds up fractional token counts', () => {
    // 5 chars -> ceil(5/4) = 2
    expect(countTokens('hello')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// classifyPrompt
// ---------------------------------------------------------------------------

describe('classifyPrompt', () => {
  it('classifies bug fixing prompts', () => {
    expect(classifyPrompt('Fix the bug in the user service')).toBe(
      Classification.FIXING_ISSUES
    );
  });

  it('classifies code implementation prompts', () => {
    expect(classifyPrompt('Implement a new REST endpoint for orders')).toBe(
      Classification.UPDATING_CODE
    );
  });

  it('classifies brainstorming prompts', () => {
    expect(classifyPrompt('Brainstorm ideas for a new caching layer')).toBe(
      Classification.BRAINSTORMING
    );
  });

  it('classifies spec/documentation prompts', () => {
    expect(classifyPrompt('Update spec with new requirements for v2')).toBe(
      Classification.UPDATING_SPECS
    );
  });

  it('classifies batch operation prompts', () => {
    expect(classifyPrompt('Batch process all the uploaded files')).toBe(
      Classification.BATCH_COMMANDS
    );
  });

  it('defaults to UPDATING_CODE for unrecognized prompts', () => {
    expect(classifyPrompt('xyz random unrelated text')).toBe(
      Classification.UPDATING_CODE
    );
  });
});

// ---------------------------------------------------------------------------
// detectRepeatedInstructions
// ---------------------------------------------------------------------------

describe('detectRepeatedInstructions', () => {
  it('returns empty array when no repetitions exist', () => {
    const result = detectRepeatedInstructions(
      'Create a new user endpoint. Add validation for email fields.'
    );
    expect(result).toEqual([]);
  });

  it('detects repeated instructions with high word overlap', () => {
    const prompt = [
      'Make sure you validate the user email address before saving.',
      'Do not forget to check error handling.',
      'Make sure you validate the user email address field before saving to the database.',
    ].join('\n');

    const result = detectRepeatedInstructions(prompt);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].count).toBeGreaterThan(1);
    expect(result[0].wastedTokens).toBeGreaterThan(0);
  });

  it('ignores short fragments under 20 chars', () => {
    const prompt = 'Do this. Do this. Do this again.';
    const result = detectRepeatedInstructions(prompt);
    // All fragments are under 20 chars, so should be empty
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// calculateVerbosityScore
// ---------------------------------------------------------------------------

describe('calculateVerbosityScore', () => {
  it('returns 0 for empty prompt', () => {
    expect(calculateVerbosityScore('')).toBe(0);
  });

  it('returns low score for concise prompts', () => {
    const score = calculateVerbosityScore('Fix the login bug.');
    expect(score).toBeLessThan(30);
  });

  it('returns higher score for verbose prompts with filler', () => {
    const verbose =
      'I would like you to please make sure to carefully review the code. ' +
      'Can you please implement the feature. ' +
      'It is important that you remember to always validate inputs. ' +
      'Please make sure to handle all edge cases. ' +
      'I would like you to also add comprehensive error handling.';

    const concise = 'Review code, implement feature, validate inputs, handle edge cases, add error handling.';

    const verboseScore = calculateVerbosityScore(verbose);
    const conciseScore = calculateVerbosityScore(concise);

    expect(verboseScore).toBeGreaterThan(conciseScore);
  });

  it('returns a score between 0 and 100', () => {
    const score = calculateVerbosityScore(
      'Please make sure to implement this feature carefully and ensure everything works properly.'
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// calculateContextWasteScore
// ---------------------------------------------------------------------------

describe('calculateContextWasteScore', () => {
  it('returns 0 for very short prompts', () => {
    expect(calculateContextWasteScore('Fix bug')).toBe(0);
  });

  it('returns 0 for prompts without context blocks', () => {
    const score = calculateContextWasteScore(
      'Create a new REST endpoint that accepts POST requests and validates the payload with Zod schemas.'
    );
    expect(score).toBeLessThanOrEqual(20);
  });

  it('detects context blocks and scores them', () => {
    const prompt = [
      'Context: here is the full error log from the production server',
      'ERROR: connection refused at port 5432',
      'Stack trace: line 42 in database.ts',
      'More error details follow here with additional information',
      'Task: fix the database connection issue',
    ].join('\n');

    const score = calculateContextWasteScore(prompt);
    expect(score).toBeGreaterThan(0);
  });

  it('returns a score between 0 and 100', () => {
    const prompt = [
      'Background: we have a microservices architecture with 12 services',
      'Each service connects to its own PostgreSQL database',
      'The auth service handles JWT token generation and validation',
      'Please implement a health check endpoint.',
    ].join('\n');
    const score = calculateContextWasteScore(prompt);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// analyzePrompt (integration)
// ---------------------------------------------------------------------------

describe('analyzePrompt', () => {
  it('returns a complete PromptAnalysis object', async () => {
    const analysis = await analyzePrompt('Implement user authentication endpoint');

    expect(analysis).toHaveProperty('id');
    expect(analysis).toHaveProperty('originalPrompt');
    expect(analysis).toHaveProperty('tokenCount');
    expect(analysis).toHaveProperty('verbosityScore');
    expect(analysis).toHaveProperty('duplicationScore');
    expect(analysis).toHaveProperty('contextWasteScore');
    expect(analysis).toHaveProperty('repeatedInstructions');
    expect(analysis).toHaveProperty('overallScore');
    expect(analysis).toHaveProperty('classification');
    expect(analysis).toHaveProperty('analyzedAt');
  });

  it('generates a unique id prefixed with pa_', async () => {
    const analysis = await analyzePrompt('Fix the login page');
    expect(analysis.id).toMatch(/^pa_/);
  });

  it('preserves the original prompt text', async () => {
    const prompt = 'Refactor the billing module';
    const analysis = await analyzePrompt(prompt);
    expect(analysis.originalPrompt).toBe(prompt);
  });

  it('scores are all between 0 and 100', async () => {
    const analysis = await analyzePrompt(
      'Please make sure to implement a comprehensive user management system with full CRUD operations.'
    );

    expect(analysis.verbosityScore).toBeGreaterThanOrEqual(0);
    expect(analysis.verbosityScore).toBeLessThanOrEqual(100);
    expect(analysis.duplicationScore).toBeGreaterThanOrEqual(0);
    expect(analysis.duplicationScore).toBeLessThanOrEqual(100);
    expect(analysis.contextWasteScore).toBeGreaterThanOrEqual(0);
    expect(analysis.contextWasteScore).toBeLessThanOrEqual(100);
    expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
    expect(analysis.overallScore).toBeLessThanOrEqual(100);
  });

  it('correctly classifies the prompt', async () => {
    const analysis = await analyzePrompt('Debug the memory leak in worker threads');
    expect(analysis.classification).toBe(Classification.FIXING_ISSUES);
  });

  it('sets analyzedAt as an ISO timestamp', async () => {
    const analysis = await analyzePrompt('Test prompt');
    expect(() => new Date(analysis.analyzedAt).toISOString()).not.toThrow();
  });
});
