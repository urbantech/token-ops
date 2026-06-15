/**
 * GET /api/memory/stats
 *
 * Returns memory optimization statistics: total memories, reuse rate,
 * average confidence, top categories, and token savings.
 *
 * Issues #17 and #18
 */

import { NextResponse } from 'next/server';
import type { MemoryStats } from '@/types/memory';
import { MemoryCategory } from '@/types/memory';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function getMockStats(): MemoryStats {
  return {
    totalMemories: 12_847,
    reuseRate: 34.2,
    avgConfidence: 0.912,
    topCategories: [
      { category: MemoryCategory.CONVERSATION, count: 4_820, percentage: 37.5 },
      { category: MemoryCategory.KNOWLEDGE, count: 2_910, percentage: 22.6 },
      { category: MemoryCategory.TASK, count: 2_054, percentage: 16.0 },
      { category: MemoryCategory.CONTEXT, count: 1_285, percentage: 10.0 },
      { category: MemoryCategory.INSTRUCTION, count: 771, percentage: 6.0 },
      { category: MemoryCategory.SUMMARY, count: 514, percentage: 4.0 },
      { category: MemoryCategory.ERROR, count: 321, percentage: 2.5 },
      { category: MemoryCategory.FEEDBACK, count: 172, percentage: 1.4 },
    ],
    totalTokensSaved: 1_284_500,
    totalTokensConsumed: 3_756_200,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    // TODO: Replace mock with real MemoryOptimizerService call:
    //
    // const client = getZeroDBClient();
    // const service = new MemoryOptimizerService(client);
    // const stats = await service.getMemoryStats();

    const stats = getMockStats();

    return NextResponse.json(stats);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
