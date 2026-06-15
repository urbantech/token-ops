/**
 * GET /api/workflows/analysis
 * Analyze workflows for duplicates, inefficiencies, and excessive tool calls.
 *
 * Query params:
 *   start — ISO 8601 start of range (required)
 *   end   — ISO 8601 end of range (required)
 *
 * Refs #27
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowAnalysisQuerySchema } from '../../../../lib/validation';
import { getWorkflowOptimizerService } from '../../../../services/workflow-optimizer';
import type { WorkflowAnalysis } from '../../../../types/workflow';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<WorkflowAnalysis>>> {
  try {
    const { searchParams } = request.nextUrl;

    const params = {
      start: searchParams.get('start') ?? '',
      end: searchParams.get('end') ?? '',
    };

    const parsed = workflowAnalysisQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation failed: ${parsed.error.issues
            .map(
              (i: { path: (string | number)[]; message: string }) =>
                `${i.path.join('.')}: ${i.message}`
            )
            .join('; ')}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { start, end } = parsed.data;
    const service = getWorkflowOptimizerService();
    const analysis = await service.analyzeWorkflows({ start, end });

    return NextResponse.json({
      success: true,
      data: analysis,
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
