/**
 * GET /api/memory/recommendations
 *
 * Returns memory reuse recommendations: duplicate queries, repeated research,
 * repeated workflows, and total potential token savings.
 *
 * Issue #18 — Memory Reuse Recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { MemoryReuseRecommendation } from '@/types/memory';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const QuerySchema = z.object({
  timeRange: z
    .enum(['24h', '7d', '30d', '90d'])
    .optional()
    .default('7d'),
});

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function getMockRecommendations(
  timeRange: string
): MemoryReuseRecommendation {
  const multiplier =
    timeRange === '24h' ? 0.3 : timeRange === '30d' ? 2.5 : timeRange === '90d' ? 6 : 1;

  return {
    duplicateQueries: [
      {
        query: 'How to implement rate limiting for API endpoints?',
        frequency: Math.round(12 * multiplier),
        tokensConsumed: Math.round(14_400 * multiplier),
        potentialSavings: Math.round(13_200 * multiplier),
        avgSimilarity: 0.96,
      },
      {
        query: 'What is the token budget allocation strategy?',
        frequency: Math.round(8 * multiplier),
        tokensConsumed: Math.round(9_600 * multiplier),
        potentialSavings: Math.round(8_400 * multiplier),
        avgSimilarity: 0.93,
      },
      {
        query: 'Explain the agent memory persistence architecture',
        frequency: Math.round(6 * multiplier),
        tokensConsumed: Math.round(7_200 * multiplier),
        potentialSavings: Math.round(6_000 * multiplier),
        avgSimilarity: 0.91,
      },
      {
        query: 'How to configure ZeroDB vector indexes?',
        frequency: Math.round(5 * multiplier),
        tokensConsumed: Math.round(6_000 * multiplier),
        potentialSavings: Math.round(4_800 * multiplier),
        avgSimilarity: 0.89,
      },
      {
        query: 'Best practices for prompt engineering with Claude',
        frequency: Math.round(4 * multiplier),
        tokensConsumed: Math.round(5_200 * multiplier),
        potentialSavings: Math.round(3_900 * multiplier),
        avgSimilarity: 0.87,
      },
    ],
    repeatedResearch: [
      {
        query: 'OAuth2 token refresh flow documentation',
        frequency: Math.round(7 * multiplier),
        tokensConsumed: Math.round(8_400 * multiplier),
        potentialSavings: Math.round(7_200 * multiplier),
        avgSimilarity: 0.92,
      },
      {
        query: 'ZeroDB encryption-at-rest configuration',
        frequency: Math.round(5 * multiplier),
        tokensConsumed: Math.round(6_000 * multiplier),
        potentialSavings: Math.round(4_800 * multiplier),
        avgSimilarity: 0.88,
      },
      {
        query: 'Next.js 14 App Router caching strategies',
        frequency: Math.round(4 * multiplier),
        tokensConsumed: Math.round(4_800 * multiplier),
        potentialSavings: Math.round(3_600 * multiplier),
        avgSimilarity: 0.90,
      },
    ],
    repeatedWorkflows: [
      {
        workflowName: 'Generate API documentation from OpenAPI spec',
        frequency: Math.round(9 * multiplier),
        avgCost: 2_400,
        totalCost: Math.round(21_600 * multiplier),
      },
      {
        workflowName: 'Run security audit on endpoint handlers',
        frequency: Math.round(6 * multiplier),
        avgCost: 3_100,
        totalCost: Math.round(18_600 * multiplier),
      },
      {
        workflowName: 'Generate unit tests for service layer',
        frequency: Math.round(5 * multiplier),
        avgCost: 1_800,
        totalCost: Math.round(9_000 * multiplier),
      },
    ],
    totalPotentialSavings: Math.round(51_900 * multiplier),
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const rawTimeRange = url.searchParams.get('timeRange') || '7d';
    const parsed = QuerySchema.safeParse({ timeRange: rawTimeRange });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // TODO: Replace mock with real MemoryOptimizerService call:
    //
    // const client = getZeroDBClient();
    // const service = new MemoryOptimizerService(client);
    // const result = await service.getMemoryReuseRecommendations(parsed.data.timeRange);

    const result = getMockRecommendations(parsed.data.timeRange);

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
