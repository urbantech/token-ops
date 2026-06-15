/**
 * Tests for POST /api/prompts/recommend route handler
 * Refs #15
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/prompt-analyzer', () => ({
  analyzePrompt: vi.fn(),
}));

vi.mock('@/services/prompt-recommender', () => ({
  generateRecommendation: vi.fn(),
}));

import { POST } from '../route';
import { analyzePrompt } from '@/services/prompt-analyzer';
import { generateRecommendation } from '@/services/prompt-recommender';
import { Classification } from '@/types/telemetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000/api/prompts/recommend';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SAMPLE_PROMPT =
  'Can you please implement a login form component? ' +
  'Please make sure to handle validation. ' +
  'It is important that you add error messages.';

const MOCK_ANALYSIS = {
  id: 'pa_test_001',
  originalPrompt: SAMPLE_PROMPT,
  tokenCount: 38,
  verbosityScore: 55,
  duplicationScore: 0,
  contextWasteScore: 0,
  repeatedInstructions: [],
  overallScore: 30,
  classification: Classification.UPDATING_CODE,
  analyzedAt: '2026-06-14T10:00:00.000Z',
};

const MOCK_RECOMMENDATION = {
  revisedPrompt: 'Implement a login form component with validation and error messages.',
  tokenReduction: 18,
  tokenReductionPercent: 47,
  performanceEstimate: 84,
  changes: [
    {
      type: 'remove_redundancy',
      description: 'Removed filler phrases and polite padding',
      tokensSaved: 18,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(analyzePrompt).mockResolvedValue(MOCK_ANALYSIS);
  vi.mocked(generateRecommendation).mockReturnValue(MOCK_RECOMMENDATION);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/prompts/recommend', () => {
  describe('validation', () => {
    it('returns 400 when body is missing the prompt field', async () => {
      const res = await POST(makeRequest({}));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      // Zod emits "Required" when the field is absent; "Prompt must not be empty"
      // fires when the field is present but empty — either is a valid 400.
      expect(data.error).toBeTruthy();
    });

    it('returns 400 when prompt is an empty string', async () => {
      const res = await POST(makeRequest({ prompt: '' }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when prompt exceeds 100 000 characters', async () => {
      const res = await POST(makeRequest({ prompt: 'z'.repeat(100_001) }));

      expect(res.status).toBe(400);
    });
  });

  describe('when no analysis is provided (computed on the fly)', () => {
    it('returns 200 with success=true and recommendation data', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        revisedPrompt: MOCK_RECOMMENDATION.revisedPrompt,
        tokenReduction: MOCK_RECOMMENDATION.tokenReduction,
        tokenReductionPercent: MOCK_RECOMMENDATION.tokenReductionPercent,
        performanceEstimate: MOCK_RECOMMENDATION.performanceEstimate,
      });
    });

    it('calls analyzePrompt when no analysis is supplied', async () => {
      await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(analyzePrompt).toHaveBeenCalledOnce();
      expect(analyzePrompt).toHaveBeenCalledWith(SAMPLE_PROMPT);
    });

    it('calls generateRecommendation with the prompt and fresh analysis', async () => {
      await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(generateRecommendation).toHaveBeenCalledOnce();
      const [prompt, analysis] = vi.mocked(generateRecommendation).mock.calls[0];
      expect(prompt).toBe(SAMPLE_PROMPT);
      expect(analysis).toMatchObject({ id: MOCK_ANALYSIS.id });
    });
  });

  describe('when a pre-computed analysis is provided', () => {
    it('skips calling analyzePrompt and uses the provided analysis', async () => {
      const res = await POST(
        makeRequest({ prompt: SAMPLE_PROMPT, analysis: MOCK_ANALYSIS })
      );

      expect(res.status).toBe(200);
      expect(analyzePrompt).not.toHaveBeenCalled();
    });

    it('calls generateRecommendation with the provided analysis', async () => {
      await POST(
        makeRequest({ prompt: SAMPLE_PROMPT, analysis: MOCK_ANALYSIS })
      );

      expect(generateRecommendation).toHaveBeenCalledOnce();
      const [, analysis] = vi.mocked(generateRecommendation).mock.calls[0];
      expect(analysis).toMatchObject({ id: MOCK_ANALYSIS.id });
    });
  });

  describe('response structure', () => {
    it('response data includes all required recommendation fields', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));
      const data = await res.json();
      const rec = data.data;

      expect(rec).toHaveProperty('revisedPrompt');
      expect(rec).toHaveProperty('tokenReduction');
      expect(rec).toHaveProperty('tokenReductionPercent');
      expect(rec).toHaveProperty('performanceEstimate');
      expect(rec).toHaveProperty('changes');
      expect(Array.isArray(rec.changes)).toBe(true);
    });

    it('each change object has type, description, and tokensSaved', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));
      const data = await res.json();

      for (const change of data.data.changes) {
        expect(change).toHaveProperty('type');
        expect(change).toHaveProperty('description');
        expect(change).toHaveProperty('tokensSaved');
      }
    });

    it('response includes an ISO timestamp', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));
      const data = await res.json();

      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });

  describe('error handling', () => {
    it('returns 500 when analyzePrompt throws', async () => {
      vi.mocked(analyzePrompt).mockRejectedValue(new Error('Tokenizer error'));

      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Tokenizer error');
    });

    it('returns 500 when generateRecommendation throws', async () => {
      vi.mocked(generateRecommendation).mockImplementation(() => {
        throw new Error('Recommendation engine failure');
      });

      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Recommendation engine failure');
    });

    it('returns 500 with a fallback message when a non-Error is thrown', async () => {
      vi.mocked(analyzePrompt).mockRejectedValue('crash');

      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});
