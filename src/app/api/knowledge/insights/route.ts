/**
 * GET /api/knowledge/insights — discover knowledge graph insights
 *
 * Refs #29
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeGraphService } from '../../../../services/knowledge-graph';
import type { KnowledgeInsight } from '../../../../types/knowledge';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export async function GET(
  _request: NextRequest
): Promise<NextResponse<ApiResponse<KnowledgeInsight[]>>> {
  try {
    const service = getKnowledgeGraphService();
    const insights = await service.discoverInsights();

    return NextResponse.json({
      success: true,
      data: insights,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
