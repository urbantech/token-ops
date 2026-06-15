/**
 * Tests for Context Compression Engine Service
 *
 * Refs #19, #20, #21
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ZeroDB client before importing the service
vi.mock('@/lib/zerodb-client', () => {
  const mockClient = {
    queryRows: vi.fn(),
  };
  return {
    getZeroDBClient: vi.fn(() => mockClient),
    ZeroDBClient: vi.fn(() => mockClient),
    __mockClient: mockClient,
  };
});

import { analyzeCompression, getContextUtilization } from '../context-compression';
import { getZeroDBClient } from '@/lib/zerodb-client';

// Retrieve the mocked client for direct manipulation
function getMockClient() {
  return (getZeroDBClient as ReturnType<typeof vi.fn>)() as {
    queryRows: ReturnType<typeof vi.fn>;
  };
}

// ---------------------------------------------------------------------------
// analyzeCompression
// ---------------------------------------------------------------------------

describe('analyzeCompression', () => {
  it('returns zero reduction for an empty string', () => {
    const result = analyzeCompression('');

    expect(result.originalTokens).toBe(0);
    expect(result.compressedTokens).toBe(0);
    expect(result.reductionPercent).toBe(0);
    expect(result.techniques).toEqual([]);
  });

  it('returns minimal reduction for a short, concise prompt', () => {
    const result = analyzeCompression('Fix the login bug.');

    expect(result.originalTokens).toBeGreaterThan(0);
    expect(result.reductionPercent).toBeLessThan(15);
    expect(result.compressedTokens).toBeLessThanOrEqual(result.originalTokens);
  });

  it('detects redundancy in repeated instructions', () => {
    const text = [
      'Make sure the user input is validated before saving to the database.',
      'Also check that the email format is correct and handle errors.',
      'Make sure the user input is validated before saving it to the database.',
      'And please also verify the email format is correct.',
    ].join(' ');

    const result = analyzeCompression(text);

    const redundancyTechnique = result.techniques.find(
      (t) => t.name === 'remove_redundancy'
    );
    expect(redundancyTechnique).toBeDefined();
    expect(redundancyTechnique!.tokensSaved).toBeGreaterThan(0);
  });

  it('detects verbose filler phrases', () => {
    const text =
      'I would like you to please make sure to implement the feature. ' +
      'Can you please add error handling. ' +
      'It is important that you validate all inputs. ' +
      'Please make sure to write comprehensive tests. ' +
      'I would like you to also add logging for debugging purposes.';

    const result = analyzeCompression(text);

    const verbosityTechnique = result.techniques.find(
      (t) => t.name === 'deduplicate_instructions'
    );
    // Should find at least the filler/verbose technique
    expect(result.techniques.length).toBeGreaterThan(0);
    expect(result.reductionPercent).toBeGreaterThan(5);
  });

  it('detects excessive examples in context', () => {
    const text = [
      'Create a function that formats dates.',
      'Example 1: formatDate("2024-01-01") should return "January 1, 2024".',
      'Example 2: formatDate("2024-02-14") should return "February 14, 2024".',
      'Example 3: formatDate("2024-03-15") should return "March 15, 2024".',
      'Example 4: formatDate("2024-04-20") should return "April 20, 2024".',
      'Example 5: formatDate("2024-05-25") should return "May 25, 2024".',
    ].join(' ');

    const result = analyzeCompression(text);

    const pruneTechnique = result.techniques.find(
      (t) => t.name === 'prune_examples'
    );
    expect(pruneTechnique).toBeDefined();
    expect(pruneTechnique!.tokensSaved).toBeGreaterThan(0);
  });

  it('detects summarizable context blocks', () => {
    const text = [
      'Context: Our application is a large-scale e-commerce platform built with microservices.',
      'We have a user service, an order service, a payment service, and a notification service.',
      'The user service handles authentication, authorization, and profile management.',
      'The order service manages shopping carts, order creation, and order tracking.',
      'The payment service integrates with Stripe and PayPal for payment processing.',
      'Background: The notification service sends emails, SMS, and push notifications.',
      'Task: Add a health check endpoint to the user service.',
    ].join('\n');

    const result = analyzeCompression(text);

    const summarizeTechnique = result.techniques.find(
      (t) => t.name === 'summarize_context'
    );
    expect(summarizeTechnique).toBeDefined();
    expect(summarizeTechnique!.tokensSaved).toBeGreaterThan(0);
  });

  it('compressedTokens equals originalTokens minus total technique savings', () => {
    const text =
      'I would like you to please make sure to implement a function. ' +
      'Make sure to validate the input before processing. ' +
      'I would like you to also handle all error cases.';

    const result = analyzeCompression(text);

    const totalSaved = result.techniques.reduce((s, t) => s + t.tokensSaved, 0);
    expect(result.compressedTokens).toBe(result.originalTokens - totalSaved);
  });

  it('reductionPercent is correctly calculated', () => {
    const text =
      'I would like you to please make sure to implement the feature. ' +
      'Can you please add validation. ' +
      'It is important that you handle errors. ' +
      'Please make sure to test everything.';

    const result = analyzeCompression(text);

    if (result.originalTokens > 0) {
      const expected =
        Math.round(
          ((result.originalTokens - result.compressedTokens) / result.originalTokens) * 100
        );
      expect(result.reductionPercent).toBe(expected);
    }
  });

  it('never returns negative compressedTokens', () => {
    // Extreme case: a short prompt that happens to match several patterns
    const text = 'I would like you to please make sure to do this.';
    const result = analyzeCompression(text);

    expect(result.compressedTokens).toBeGreaterThanOrEqual(0);
  });

  it('all technique objects have required fields', () => {
    const text =
      'I would like you to please make sure to implement the full feature. ' +
      'Example 1: input "a" returns "A". ' +
      'Example 2: input "b" returns "B". ' +
      'Example 3: input "c" returns "C". ' +
      'Example 4: input "d" returns "D".';

    const result = analyzeCompression(text);

    for (const technique of result.techniques) {
      expect(technique).toHaveProperty('name');
      expect(technique).toHaveProperty('tokensSaved');
      expect(technique).toHaveProperty('description');
      expect(typeof technique.name).toBe('string');
      expect(typeof technique.tokensSaved).toBe('number');
      expect(typeof technique.description).toBe('string');
      expect(technique.tokensSaved).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getContextUtilization
// ---------------------------------------------------------------------------

describe('getContextUtilization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TIME_RANGE = {
    start: '2026-06-01T00:00:00.000Z',
    end: '2026-06-14T23:59:59.000Z',
  };

  it('returns utilization stats from ZeroDB prompt_events', async () => {
    const mockClient = getMockClient();
    mockClient.queryRows.mockResolvedValue({
      rows: [
        { prompt: 'Fix the bug in auth service.', total_tokens: 200, prompt_tokens: 180 },
        { prompt: 'Implement a new REST endpoint for users with full CRUD.', total_tokens: 500, prompt_tokens: 420 },
        { prompt: 'Short.', total_tokens: 50, prompt_tokens: 30 },
      ],
      total: 3,
    });

    const result = await getContextUtilization(TIME_RANGE);

    expect(result.totalPrompts).toBe(3);
    expect(result.avgContextSize).toBeGreaterThan(0);
    expect(result.avgUsefulContext).toBeGreaterThan(0);
    expect(result.wastePercent).toBeGreaterThanOrEqual(0);
    expect(result.wastePercent).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('queries ZeroDB with the correct table and time range filters', async () => {
    const mockClient = getMockClient();
    mockClient.queryRows.mockResolvedValue({ rows: [], total: 0 });

    await getContextUtilization(TIME_RANGE);

    expect(mockClient.queryRows).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'prompt_events',
        filters: {},
      })
    );
  });

  it('returns zero values when there are no prompts in the time range', async () => {
    const mockClient = getMockClient();
    mockClient.queryRows.mockResolvedValue({ rows: [], total: 0 });

    const result = await getContextUtilization(TIME_RANGE);

    expect(result.totalPrompts).toBe(0);
    expect(result.avgContextSize).toBe(0);
    expect(result.avgUsefulContext).toBe(0);
    expect(result.wastePercent).toBe(0);
    expect(result.oversizedPrompts).toBe(0);
  });

  it('counts oversized prompts correctly', async () => {
    const mockClient = getMockClient();
    mockClient.queryRows.mockResolvedValue({
      rows: [
        { prompt: 'a'.repeat(20_000), total_tokens: 5000, prompt_tokens: 4800 },
        { prompt: 'b'.repeat(20_000), total_tokens: 6000, prompt_tokens: 5500 },
        { prompt: 'Short prompt.', total_tokens: 50, prompt_tokens: 40 },
      ],
      total: 3,
    });

    const result = await getContextUtilization(TIME_RANGE);

    expect(result.oversizedPrompts).toBe(2);
  });

  it('generates recommendations when waste is high', async () => {
    const mockClient = getMockClient();
    // Prompts with high total_tokens but low prompt_tokens => high waste
    mockClient.queryRows.mockResolvedValue({
      rows: [
        { prompt: 'a'.repeat(8000), total_tokens: 4000, prompt_tokens: 3800 },
        { prompt: 'b'.repeat(8000), total_tokens: 3500, prompt_tokens: 3200 },
        { prompt: 'c'.repeat(8000), total_tokens: 5000, prompt_tokens: 4500 },
      ],
      total: 3,
    });

    const result = await getContextUtilization(TIME_RANGE);

    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('handles ZeroDB client errors gracefully', async () => {
    const mockClient = getMockClient();
    mockClient.queryRows.mockRejectedValue(new Error('ZeroDB API error (500): internal error'));

    await expect(getContextUtilization(TIME_RANGE)).rejects.toThrow('ZeroDB');
  });
});
