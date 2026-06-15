/**
 * GET /api/agents/status
 * Returns the current swarm status (agents, findings count, schedule).
 */

import { NextResponse } from 'next/server';
import { getAgentSwarmService } from '../../../../services/agent-swarm';

export async function GET() {
  try {
    const service = getAgentSwarmService();
    const status = await service.getStatus();

    return NextResponse.json({ success: true, data: status, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
