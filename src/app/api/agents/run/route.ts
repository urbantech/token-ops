/**
 * POST /api/agents/run
 * Run a specific agent or all agents.
 * Body: { agentId?: string, start: string, end: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentSwarmService } from '../../../../services/agent-swarm';

const AGENT_RUNNERS: Record<string, string> = {
  'agent-token-auditor': 'runTokenAuditor',
  'agent-prompt-architect': 'runPromptArchitect',
  'agent-memory-architect': 'runMemoryArchitect',
  'agent-governance': 'runGovernanceAgent',
  'agent-executive-report': 'runExecutiveReportAgent',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, start, end } = body;

    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: 'start and end required' },
        { status: 400 }
      );
    }

    const service = getAgentSwarmService();
    const period = { start, end };

    if (agentId && AGENT_RUNNERS[agentId]) {
      const method = AGENT_RUNNERS[agentId] as keyof typeof service;
      const report = await (service[method] as (p: typeof period) => Promise<unknown>)(period);
      return NextResponse.json({ success: true, data: report, timestamp: new Date().toISOString() });
    }

    // Run all agents
    const reports = await Promise.all([
      service.runTokenAuditor(period),
      service.runPromptArchitect(period),
      service.runMemoryArchitect(period),
      service.runGovernanceAgent(period),
      service.runExecutiveReportAgent(period),
    ]);

    return NextResponse.json({
      success: true,
      data: reports,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
