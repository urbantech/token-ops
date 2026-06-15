/**
 * Tests for POST /api/context/compress route handler
 *
 * Refs #19, #20
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/context-compression', () => ({
  analyzeCompression: vi.fn(),
}));

import { POST } from '../route';
import { analyzeCompression } from '@/services/context-compression';
import type { CompressionAnalysis } from '@/types/context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000/api/context/compress';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const MOCK_ANALYSIS: CompressionAnalysis = {
  originalTokens: 120,
  compressedTokens: 80,
  reductionPercent: 33,
  techniques: [
    {
      name: 'remove_redundancy',
      tokensSaved: 25,
      description: 'Removed repeated instruction patterns.',
    },
    {
      name: 'deduplicate_instructions',
      tokensSaved: 15,
      description: 'Removed verbose filler phrases.',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(analyzeCompression).mockReturnValue(MOCK_ANALYSIS);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/context/compress', () => {
  describe('validation', () => {
    it('returns 400 when body is missing the text field', async () => {
      const res = await POST(makeRequest({}));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('returns 400 when text is an empty string', async () => {
      const res = await POST(makeRequest({ text: '' }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when text exceeds 200 000 characters', async () => {
      const res = await POST(makeRequest({ text: 'x'.repeat(200_001) }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/200.?000/);
    });

    it('returns 400 when text is not a string', async () => {
      const res = await POST(makeRequest({ text: 42 }));

      expect(res.status).toBe(400);
    });
  });

  describe('successful compression analysis', () => {
    it('returns 200 with compression analysis data', async () => {
      const res = await POST(makeRequest({ text: 'Implement a REST API endpoint.' }));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        originalTokens: 120,
        compressedTokens: 80,
        reductionPercent: 33,
      });
      expect(data.data.techniques).toHaveLength(2);
    });

    it('calls analyzeCompression with the text string', async () => {
      const text = 'Please implement a new feature.';
      await POST(makeRequest({ text }));

      expect(analyzeCompression).toHaveBeenCalledOnce();
      expect(analyzeCompression).toHaveBeenCalledWith(text);
    });

    it('response includes an ISO timestamp', async () => {
      const res = await POST(makeRequest({ text: 'Test text.' }));
      const data = await res.json();

      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('response data includes all required CompressionAnalysis fields', async () => {
      const res = await POST(makeRequest({ text: 'Test text.' }));
      const data = await res.json();
      const analysis = data.data;

      expect(analysis).toHaveProperty('originalTokens');
      expect(analysis).toHaveProperty('compressedTokens');
      expect(analysis).toHaveProperty('reductionPercent');
      expect(analysis).toHaveProperty('techniques');
    });
  });

  describe('error handling', () => {
    it('returns 500 when analyzeCompression throws', async () => {
      vi.mocked(analyzeCompression).mockImplementation(() => {
        throw new Error('Compression analysis failed');
      });

      const res = await POST(makeRequest({ text: 'Test.' }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Compression analysis failed');
    });

    it('returns 500 with fallback message for non-Error throws', async () => {
      vi.mocked(analyzeCompression).mockImplementation(() => {
        throw 'unexpected';
      });

      const res = await POST(makeRequest({ text: 'Test.' }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});
