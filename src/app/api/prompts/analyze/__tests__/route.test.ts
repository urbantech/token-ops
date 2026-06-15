/**
 * Tests for POST /api/prompts/analyze route handler
 * Refs #14
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the prompt-analyzer service so tests do not depend on its internals.
vi.mock('@/services/prompt-analyzer', () => ({
  analyzePrompt: vi.fn(),
}));

import { POST } from '../route';
import { analyzePrompt } from '@/services/prompt-analyzer';
import { Classification } from '@/types/telemetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000/api/prompts/analyze';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SAMPLE_PROMPT =
  'Please make sure to implement a function that validates JWT tokens. ' +
  'It is important that you handle expiry. Please note that we use HS256.';

const MOCK_ANALYSIS = {
  id: 'pa_test_001',
  originalPrompt: SAMPLE_PROMPT,
  tokenCount: 42,
  verbosityScore: 35,
  duplicationScore: 10,
  contextWasteScore: 5,
  repeatedInstructions: [],
  overallScore: 18,
  classification: Classification.UPDATING_CODE,
  analyzedAt: '2026-06-14T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(analyzePrompt).mockResolvedValue(MOCK_ANALYSIS);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/prompts/analyze', () => {
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
      const res = await POST(makeRequest({ prompt: 'x'.repeat(100_001) }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/100 000/);
    });

    it('returns 400 when prompt is not a string', async () => {
      const res = await POST(makeRequest({ prompt: 42 }));

      expect(res.status).toBe(400);
    });
  });

  describe('successful analysis', () => {
    it('returns 200 with success=true and analysis data for a valid prompt', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        tokenCount: MOCK_ANALYSIS.tokenCount,
        verbosityScore: MOCK_ANALYSIS.verbosityScore,
        overallScore: MOCK_ANALYSIS.overallScore,
        classification: Classification.UPDATING_CODE,
      });
      expect(data.timestamp).toBeTruthy();
    });

    it('calls analyzePrompt with the prompt string', async () => {
      await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(analyzePrompt).toHaveBeenCalledOnce();
      expect(analyzePrompt).toHaveBeenCalledWith(SAMPLE_PROMPT);
    });

    it('response data includes all required PromptAnalysis fields', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));
      const data = await res.json();
      const analysis = data.data;

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

    it('accepts a prompt at exactly 1 character', async () => {
      const res = await POST(makeRequest({ prompt: 'A' }));

      expect(res.status).toBe(200);
    });

    it('accepts a prompt at exactly 100 000 characters', async () => {
      const res = await POST(makeRequest({ prompt: 'a'.repeat(100_000) }));

      expect(res.status).toBe(200);
    });

    it('response includes an ISO timestamp', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));
      const data = await res.json();

      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });

  describe('error handling', () => {
    it('returns 500 when analyzePrompt throws an Error', async () => {
      vi.mocked(analyzePrompt).mockRejectedValue(new Error('Analysis pipeline failed'));

      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Analysis pipeline failed');
    });

    it('returns 500 with a fallback message when a non-Error is thrown', async () => {
      vi.mocked(analyzePrompt).mockRejectedValue('unexpected');

      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});
