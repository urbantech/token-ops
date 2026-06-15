/**
 * Tests for POST /api/prompts/duplicates route handler
 * Refs #14
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/prompt-analyzer', () => ({
  detectDuplicates: vi.fn(),
}));

import { POST } from '../route';
import { detectDuplicates } from '@/services/prompt-analyzer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000/api/prompts/duplicates';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SAMPLE_PROMPT = 'How do I implement rate limiting in an Express.js API?';

const MOCK_DUPLICATES = [
  {
    id: 'dp_001',
    originalPrompt: SAMPLE_PROMPT,
    similarity: 0.92,
    cachedResponse: 'Use express-rate-limit middleware.',
    tokensSaved: 800,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(detectDuplicates).mockResolvedValue(MOCK_DUPLICATES as ReturnType<typeof detectDuplicates> extends Promise<infer T> ? T : never);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/prompts/duplicates', () => {
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
      const res = await POST(makeRequest({ prompt: 'y'.repeat(100_001) }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when threshold is below 0', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT, threshold: -0.1 }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when threshold is above 1', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT, threshold: 1.5 }));

      expect(res.status).toBe(400);
    });
  });

  describe('successful duplicate detection', () => {
    it('returns 200 with success=true and a duplicates array', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('duplicates');
      expect(data.data).toHaveProperty('count');
      expect(data.data).toHaveProperty('threshold');
      expect(Array.isArray(data.data.duplicates)).toBe(true);
    });

    it('calls detectDuplicates with the prompt and default threshold of 0.8', async () => {
      await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(detectDuplicates).toHaveBeenCalledOnce();
      expect(detectDuplicates).toHaveBeenCalledWith(SAMPLE_PROMPT, 0.8);
    });

    it('calls detectDuplicates with a custom threshold when provided', async () => {
      await POST(makeRequest({ prompt: SAMPLE_PROMPT, threshold: 0.6 }));

      expect(detectDuplicates).toHaveBeenCalledWith(SAMPLE_PROMPT, 0.6);
    });

    it('returns the count matching the length of the duplicates array', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));
      const data = await res.json();

      expect(data.data.count).toBe(data.data.duplicates.length);
    });

    it('returns count of 0 and empty array when no duplicates are found', async () => {
      vi.mocked(detectDuplicates).mockResolvedValue([]);

      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));
      const data = await res.json();

      expect(data.data.count).toBe(0);
      expect(data.data.duplicates).toEqual([]);
    });

    it('echoes back the threshold in the response data', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT, threshold: 0.75 }));
      const data = await res.json();

      expect(data.data.threshold).toBe(0.75);
    });

    it('response includes an ISO timestamp', async () => {
      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));
      const data = await res.json();

      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('accepts threshold values at the boundaries 0 and 1', async () => {
      for (const threshold of [0, 1]) {
        const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT, threshold }));
        expect(res.status).toBe(200);
      }
    });
  });

  describe('error handling', () => {
    it('returns 500 when detectDuplicates throws an Error', async () => {
      vi.mocked(detectDuplicates).mockRejectedValue(new Error('Semantic search failed'));

      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Semantic search failed');
    });

    it('returns 500 with a fallback message when a non-Error is thrown', async () => {
      vi.mocked(detectDuplicates).mockRejectedValue({ code: 503 });

      const res = await POST(makeRequest({ prompt: SAMPLE_PROMPT }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});
