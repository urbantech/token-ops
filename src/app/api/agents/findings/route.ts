/**
 * GET /api/agents/findings
 * Returns all findings from the agent swarm (last 30 days).
 */

import { NextResponse } from 'next/server';
import { getAgentSwarmService } from '../../../../services/agent-swarm';

export async function GET() {
  try {
    const service = getAgentSwarmService();
    const findings = await service.getAllFindings();

    return NextResponse.json({ success: true, data: findings, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
