/**
 * POST /api/telemetry/agent
 * Record an agent execution event (Issue #8).
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentExecutionSchema } from '../../../../lib/validation';
import { getTelemetryService } from '../../../../services/telemetry';
import { TelemetryResponse, AgentExecution } from '../../../../types/telemetry';

export async function POST(request: NextRequest): Promise<NextResponse<TelemetryResponse<AgentExecution>>> {
  try {
    const body = await request.json();
    const parsed = agentExecutionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation failed: ${parsed.error.issues.map((i: { path: (string | number)[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const service = getTelemetryService();
    const result = await service.recordAgentExecution(parsed.data);

    return NextResponse.json(
      {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('POST /api/telemetry/agent error:', message);

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
