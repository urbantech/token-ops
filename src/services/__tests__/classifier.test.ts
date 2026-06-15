import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyTokenEvent,
  resetPromptHistory,
  getDetectedBatchPatterns,
} from '../classifier';
import { Classification } from '@/types/telemetry';

// Refs #11

describe('classifyTokenEvent', () => {
  beforeEach(() => {
    resetPromptHistory();
  });

  // --- FIXING_ISSUES ---
  it('classifies bug fix prompts as FIXING_ISSUES', () => {
    const result = classifyTokenEvent('Fix the bug in the login handler');
    expect(result.classification).toBe(Classification.FIXING_ISSUES);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('classifies debug prompts as FIXING_ISSUES', () => {
    const result = classifyTokenEvent('Debugging the authentication flow');
    expect(result.classification).toBe(Classification.FIXING_ISSUES);
  });

  it('classifies troubleshoot prompts as FIXING_ISSUES', () => {
    const result = classifyTokenEvent('Troubleshoot why the API returns 500');
    expect(result.classification).toBe(Classification.FIXING_ISSUES);
  });

  it('classifies stack trace analysis as FIXING_ISSUES', () => {
    const result = classifyTokenEvent('Analyze this stack trace and find the root cause');
    expect(result.classification).toBe(Classification.FIXING_ISSUES);
  });

  // --- UPDATING_CODE ---
  it('classifies implementation prompts as UPDATING_CODE', () => {
    const result = classifyTokenEvent('Implement a new REST endpoint for user profiles');
    expect(result.classification).toBe(Classification.UPDATING_CODE);
  });

  it('classifies refactoring prompts as UPDATING_CODE', () => {
    const result = classifyTokenEvent('Refactor the payment module');
    expect(result.classification).toBe(Classification.UPDATING_CODE);
  });

  it('classifies component creation as UPDATING_CODE', () => {
    const result = classifyTokenEvent('Create a new React component for the settings page');
    expect(result.classification).toBe(Classification.UPDATING_CODE);
  });

  it('classifies deploy prompts as UPDATING_CODE', () => {
    const result = classifyTokenEvent('Deploy the latest build to staging');
    expect(result.classification).toBe(Classification.UPDATING_CODE);
  });

  // --- UPDATING_SPECS ---
  it('classifies documentation prompts as UPDATING_SPECS', () => {
    const result = classifyTokenEvent('Update the README with the new API changes');
    expect(result.classification).toBe(Classification.UPDATING_SPECS);
  });

  it('classifies PRD creation as UPDATING_SPECS', () => {
    const result = classifyTokenEvent('Create a PRD for the billing feature');
    expect(result.classification).toBe(Classification.UPDATING_SPECS);
  });

  it('classifies user story writing as UPDATING_SPECS', () => {
    const result = classifyTokenEvent('Write user stories for the onboarding flow');
    expect(result.classification).toBe(Classification.UPDATING_SPECS);
  });

  // --- BRAINSTORMING ---
  it('classifies brainstorming prompts as BRAINSTORMING', () => {
    const result = classifyTokenEvent('Brainstorm ideas for improving onboarding');
    expect(result.classification).toBe(Classification.BRAINSTORMING);
  });

  it('classifies exploration prompts as BRAINSTORMING', () => {
    const result = classifyTokenEvent('Explore options for the database migration');
    expect(result.classification).toBe(Classification.BRAINSTORMING);
  });

  it('classifies comparison prompts as BRAINSTORMING', () => {
    const result = classifyTokenEvent('Compare and contrast Redis vs Memcached');
    expect(result.classification).toBe(Classification.BRAINSTORMING);
  });

  it('classifies best practice questions as BRAINSTORMING', () => {
    const result = classifyTokenEvent('What are the best practices for error handling in Node?');
    expect(result.classification).toBe(Classification.BRAINSTORMING);
  });

  // --- BATCH_COMMANDS ---
  it('classifies batch processing prompts as BATCH_COMMANDS', () => {
    const result = classifyTokenEvent('Batch update all user records with the new field');
    expect(result.classification).toBe(Classification.BATCH_COMMANDS);
  });

  it('classifies bulk operations as BATCH_COMMANDS', () => {
    const result = classifyTokenEvent('Bulk delete all inactive accounts');
    expect(result.classification).toBe(Classification.BATCH_COMMANDS);
  });

  it('classifies repetitive patterns as BATCH_COMMANDS', () => {
    const result = classifyTokenEvent('Do the same for all other endpoints');
    expect(result.classification).toBe(Classification.BATCH_COMMANDS);
  });

  // --- DEFAULT ---
  it('defaults to BRAINSTORMING for unrecognized prompts', () => {
    const result = classifyTokenEvent('Hello, how are you today?');
    expect(result.classification).toBe(Classification.BRAINSTORMING);
    expect(result.matchedPatterns).toContain('default_fallback');
  });

  // --- CONFIDENCE ---
  it('returns higher confidence for stronger pattern matches', () => {
    const weakResult = classifyTokenEvent('Hello world');
    const strongResult = classifyTokenEvent('Fix the bug crash in the error handling debug');
    expect(strongResult.confidence).toBeGreaterThan(weakResult.confidence);
  });

  it('caps confidence at 1.0', () => {
    const result = classifyTokenEvent(
      'Fix bug error crash debug troubleshoot stack trace failing test broken hotfix'
    );
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  // --- BATCH PATTERN DETECTION ---
  it('detects batch patterns after threshold repetitions', () => {
    const prompt = 'Run the test suite and report failures';
    classifyTokenEvent(prompt);
    classifyTokenEvent(prompt);
    const result = classifyTokenEvent(prompt);
    expect(result.isBatchCandidate).toBe(true);
  });

  it('does not flag as batch candidate below threshold', () => {
    const result = classifyTokenEvent('Run the test suite and report failures');
    expect(result.isBatchCandidate).toBe(false);
  });

  it('returns matched patterns array', () => {
    const result = classifyTokenEvent('Debug the authentication bug');
    expect(result.matchedPatterns.length).toBeGreaterThan(0);
  });
});

describe('getDetectedBatchPatterns', () => {
  beforeEach(() => {
    resetPromptHistory();
  });

  it('returns empty array when no patterns exist', () => {
    const patterns = getDetectedBatchPatterns();
    expect(patterns).toEqual([]);
  });

  it('detects patterns that meet threshold', () => {
    const prompt = 'Run lint and fix all issues';
    classifyTokenEvent(prompt);
    classifyTokenEvent(prompt);
    classifyTokenEvent(prompt);

    const patterns = getDetectedBatchPatterns(3);
    expect(patterns.length).toBe(1);
    expect(patterns[0].count).toBe(3);
  });

  it('sorts by count descending', () => {
    for (let i = 0; i < 5; i++) classifyTokenEvent('frequent pattern');
    for (let i = 0; i < 3; i++) classifyTokenEvent('less frequent pattern');

    const patterns = getDetectedBatchPatterns(3);
    expect(patterns.length).toBe(2);
    expect(patterns[0].count).toBeGreaterThanOrEqual(patterns[1].count);
  });
});

describe('resetPromptHistory', () => {
  it('clears the history', () => {
    classifyTokenEvent('test prompt');
    classifyTokenEvent('test prompt');
    classifyTokenEvent('test prompt');
    resetPromptHistory();
    const patterns = getDetectedBatchPatterns(1);
    expect(patterns).toEqual([]);
  });
});
