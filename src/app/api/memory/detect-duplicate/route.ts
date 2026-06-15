/**
 * POST /api/memory/detect-duplicate
 *
 * Checks whether a given query is a duplicate of an existing memory entry.
 * Returns similarity confidence and the cached prior answer when available.
 *
 * Issue #17 — Duplicate Request Detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { DuplicateDetectionResult } from '@/types/memory';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const DetectDuplicateSchema = z.object({
  query: z
    .string()
    .min(1, 'query is required')
    .max(10_000, 'query must be under 10 000 characters'),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.85),
});

// ---------------------------------------------------------------------------
// Mock data — used until ZeroDB client is wired in
// ---------------------------------------------------------------------------

const MOCK_RESULTS: Record<string, DuplicateDetectionResult> = {
  default_duplicate: {
    isDuplicate: true,
    confidence: 0.94,
    priorAnswer:
      'The recommended approach for token rate limiting is to use a sliding window counter with a 60-second window and burst allowance of 1.5x the base rate.',
    memoryReference: 'mem_a8f3c21d',
    tokensSaved: 1_240,
  },
  default_unique: {
    isDuplicate: false,
    confidence: 0.31,
    priorAnswer: null,
    memoryReference: null,
    tokensSaved: 0,
  },
};

function getMockResult(query: string): DuplicateDetectionResult {
  // Deterministic mock: queries containing "rate limit" or "token budget"
  // are treated as duplicates.
  const lower = query.toLowerCase();
  if (
    lower.includes('rate limit') ||
    lower.includes('token budget') ||
    lower.includes('how to') ||
    lower.includes('what is')
  ) {
    return {
      ...MOCK_RESULTS.default_duplicate,
      confidence: 0.88 + Math.random() * 0.1,
      tokensSaved: Math.ceil(query.length / 4) + 800,
    };
  }
  return {
    ...MOCK_RESULTS.default_unique,
    confidence: Math.random() * 0.4,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = DetectDuplicateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { query } = parsed.data;

    // TODO: Replace mock with real MemoryOptimizerService call:
    //
    // const client = getZeroDBClient();
    // const service = new MemoryOptimizerService(client);
    // const result = await service.detectDuplicateRequests(query, threshold);

    const result = getMockResult(query);

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
