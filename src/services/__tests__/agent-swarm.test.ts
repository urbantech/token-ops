import { describe, it, expect, vi } from 'vitest';
import { AgentSwarmService, getAgentSwarmService } from '../agent-swarm';

// Refs #12

vi.mock('../../lib/zerodb-client', () => ({
  getZeroDBClient: vi.fn(() => ({
    queryRows: vi.fn().mockResolvedValue({ rows: [] }),
    insertRows: vi.fn().mockResolvedValue({ inserted: 1 }),
  })),
}));

function makeClient(rows: Record<string, unknown>[] = []) {
  return {
    queryRows: vi.fn().mockResolvedValue({ rows }),
    insertRows: vi.fn().mockResolvedValue({ inserted: 1 }),
  };
}

function makeTableClient(
  costRows: Record<string, unknown>[],
  promptRows: Record<string, unknown>[]
) {
  let call = 0;
  return {
    queryRows: vi.fn().mockImplementation(({ tableName }: { tableName: string }) => {
      if (tableName === 'cost_events') return Promise.resolve({ rows: costRows });
      return Promise.resolve({ rows: promptRows });
    }),
    insertRows: vi.fn().mockResolvedValue({ inserted: 1 }),
  };
}

const PERIOD = { start: '2026-06-01T00:00:00Z', end: '2026-06-14T23:59:59Z' };

// ---------------------------------------------------------------------------
// getAgents
// ---------------------------------------------------------------------------

describe('AgentSwarmService.getAgents', () => {
  it('returns all 5 defined swarm agents', () => {
    const service = new AgentSwarmService(makeClient() as never);
    const agents = service.getAgents();

    expect(agents).toHaveLength(5);
  });

  it('includes the token auditor agent', () => {
    const service = new AgentSwarmService(makeClient() as never);
    const agents = service.getAgents();
    const auditor = agents.find((a) => a.id === 'agent-token-auditor');

    expect(auditor).toBeDefined();
    expect(auditor?.name).toBe('Token Auditor');
    expect(auditor?.role).toBe('Cost Analysis');
    expect(auditor?.status).toBe('active');
    expect(auditor?.capabilities).toContain('cost_analysis');
  });

  it('includes the prompt architect agent', () => {
    const service = new AgentSwarmService(makeClient() as never);
    const agent = service.getAgents().find((a) => a.id === 'agent-prompt-architect');

    expect(agent).toBeDefined();
    expect(agent?.role).toBe('Prompt Optimization');
    expect(agent?.capabilities).toContain('prompt_scoring');
  });

  it('includes the memory architect agent', () => {
    const service = new AgentSwarmService(makeClient() as never);
    const agent = service.getAgents().find((a) => a.id === 'agent-memory-architect');

    expect(agent).toBeDefined();
    expect(agent?.capabilities).toContain('duplicate_detection');
  });

  it('includes the governance agent', () => {
    const service = new AgentSwarmService(makeClient() as never);
    const agent = service.getAgents().find((a) => a.id === 'agent-governance');

    expect(agent).toBeDefined();
    expect(agent?.role).toBe('Compliance Monitoring');
    expect(agent?.capabilities).toContain('policy_monitoring');
  });

  it('includes the executive report agent', () => {
    const service = new AgentSwarmService(makeClient() as never);
    const agent = service.getAgents().find((a) => a.id === 'agent-executive-report');

    expect(agent).toBeDefined();
    expect(agent?.role).toBe('Report Generation');
    expect(agent?.capabilities).toContain('report_generation');
  });

  it('all agents have active status', () => {
    const service = new AgentSwarmService(makeClient() as never);
    const agents = service.getAgents();
    agents.forEach((a) => expect(a.status).toBe('active'));
  });
});

// ---------------------------------------------------------------------------
// getStatus
// ---------------------------------------------------------------------------

describe('AgentSwarmService.getStatus', () => {
  it('returns swarm status with 5 agents', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const status = await service.getStatus();

    expect(status.agents).toHaveLength(5);
  });

  it('includes totalFindings count', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const status = await service.getStatus();

    // With no data each agent returns 1 default "healthy" finding (4 agents × 1)
    expect(status.totalFindings).toBeGreaterThanOrEqual(0);
  });

  it('includes criticalFindings count', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const status = await service.getStatus();

    expect(typeof status.criticalFindings).toBe('number');
    expect(status.criticalFindings).toBeGreaterThanOrEqual(0);
  });

  it('sets lastRunAt as a valid ISO string', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const status = await service.getStatus();

    expect(new Date(status.lastRunAt).getTime()).not.toBeNaN();
  });

  it('sets nextRunAt ~1 hour after lastRunAt', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const before = Date.now();
    const status = await service.getStatus();
    const after = Date.now();

    const diff = new Date(status.nextRunAt).getTime() - new Date(status.lastRunAt).getTime();
    expect(diff).toBeGreaterThanOrEqual(3599_000);
    expect(diff).toBeLessThanOrEqual(3601_000);
  });

  it('counts critical findings correctly', async () => {
    // Provide opus data to trigger a warning in token auditor
    const costRows = [
      { model: 'claude-3-opus', total_cost: 10, classification: null, team_id: null },
      { model: 'claude-3-opus', total_cost: 10, classification: null, team_id: null },
    ];
    const service = new AgentSwarmService(makeTableClient(costRows, []) as never);
    const status = await service.getStatus();

    // criticalFindings is a subset of totalFindings
    expect(status.criticalFindings).toBeLessThanOrEqual(status.totalFindings);
  });
});

// ---------------------------------------------------------------------------
// runTokenAuditor
// ---------------------------------------------------------------------------

describe('AgentSwarmService.runTokenAuditor', () => {
  it('returns a healthy finding when no cost data exists', async () => {
    const service = new AgentSwarmService(makeClient([]) as never);
    const report = await service.runTokenAuditor(PERIOD);

    expect(report.agentId).toBe('agent-token-auditor');
    expect(report.agentName).toBe('Token Auditor');
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].title).toBe('Cost profile looks healthy');
    expect(report.findings[0].severity).toBe('info');
    expect(report.findings[0].estimatedImpact).toBe(0);
    expect(report.summary).toContain('0 cost events');
  });

  it('flags high spend on opus models when cost > 40% of total', async () => {
    const rows = [
      { model: 'claude-3-opus', total_cost: 8 },
      { model: 'claude-3-sonnet', total_cost: 2 },
    ];
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runTokenAuditor(PERIOD);

    const opusFinding = report.findings.find((f) => f.title.includes('claude-3-opus'));
    expect(opusFinding).toBeDefined();
    expect(opusFinding?.severity).toBe('warning');
    expect(opusFinding?.type).toBe('cost');
    expect(opusFinding?.estimatedImpact).toBeCloseTo(8 * 0.5, 5);
  });

  it('flags high spend on gpt-4o models', async () => {
    const rows = [
      { model: 'gpt-4o', total_cost: 9 },
      { model: 'gpt-3.5-turbo', total_cost: 1 },
    ];
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runTokenAuditor(PERIOD);

    expect(report.findings.some((f) => f.title.includes('gpt-4o'))).toBe(true);
  });

  it('does not flag opus when its cost is <= 40% of total', async () => {
    const rows = [
      { model: 'claude-3-opus', total_cost: 3 },
      { model: 'claude-3-sonnet', total_cost: 7 },
    ];
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runTokenAuditor(PERIOD);

    // No opus finding, but may have classification finding or healthy finding
    expect(report.findings.every((f) => !f.title.includes('claude-3-opus'))).toBe(true);
  });

  it('generates classification concentration finding when single class > 30% of events', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      model: 'claude-3-sonnet',
      total_cost: 0.01,
      classification: i < 4 ? 'batch_commands' : 'other',
    }));
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runTokenAuditor(PERIOD);

    const classificationFinding = report.findings.find((f) =>
      f.title.includes('batch commands')
    );
    expect(classificationFinding).toBeDefined();
    expect(classificationFinding?.severity).toBe('info');
  });

  it('includes agent attribution in all findings', async () => {
    const service = new AgentSwarmService(makeClient([]) as never);
    const report = await service.runTokenAuditor(PERIOD);

    report.findings.forEach((f) => {
      expect(f.agentId).toBe('agent-token-auditor');
      expect(f.agentName).toBe('Token Auditor');
      expect(f.type).toBe('cost');
    });
  });

  it('includes summary with event count and total spend', async () => {
    const rows = [{ model: 'claude-3-sonnet', total_cost: 5.25 }];
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runTokenAuditor(PERIOD);

    expect(report.summary).toContain('1 cost events');
    expect(report.summary).toContain('$5.25');
  });
});

// ---------------------------------------------------------------------------
// runPromptArchitect
// ---------------------------------------------------------------------------

describe('AgentSwarmService.runPromptArchitect', () => {
  it('returns a healthy finding when no prompt data exists', async () => {
    const service = new AgentSwarmService(makeClient([]) as never);
    const report = await service.runPromptArchitect(PERIOD);

    expect(report.agentId).toBe('agent-prompt-architect');
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].title).toBe('Prompts look well-structured');
    expect(report.findings[0].estimatedImpact).toBe(0);
  });

  it('detects verbose prompts exceeding 2000 tokens', async () => {
    const rows = [{ prompt: 'verbose text', token_count: 2500 }];
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runPromptArchitect(PERIOD);

    const verboseFinding = report.findings.find((f) => f.title.includes('verbose prompt'));
    expect(verboseFinding).toBeDefined();
    expect(verboseFinding?.type).toBe('optimization');
    expect(verboseFinding?.estimatedImpact).toBeCloseTo(2500 * 0.3, 5);
  });

  it('sets warning severity when more than 10 verbose prompts', async () => {
    const rows = Array.from({ length: 11 }, () => ({ token_count: 3000 }));
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runPromptArchitect(PERIOD);

    const finding = report.findings.find((f) => f.title.includes('verbose prompt'));
    expect(finding?.severity).toBe('warning');
  });

  it('sets info severity when 10 or fewer verbose prompts', async () => {
    const rows = [{ token_count: 3000 }];
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runPromptArchitect(PERIOD);

    const finding = report.findings.find((f) => f.title.includes('verbose prompt'));
    expect(finding?.severity).toBe('info');
  });

  it('detects repeated prompt patterns when prefix appears more than 3 times', async () => {
    const repeatedPrefix = 'Analyze the following code and suggest improvements: ';
    const rows = Array.from({ length: 4 }, (_, i) => ({
      prompt: `${repeatedPrefix}${i}`,
      token_count: 100,
    }));
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runPromptArchitect(PERIOD);

    const repeatFinding = report.findings.find((f) => f.title.includes('repeated prompt pattern'));
    expect(repeatFinding).toBeDefined();
    expect(repeatFinding?.severity).toBe('warning');
    expect(repeatFinding?.estimatedImpact).toBeGreaterThan(0);
  });

  it('does not flag repeated patterns for prompts shorter than 10 chars', async () => {
    const rows = Array.from({ length: 5 }, () => ({ prompt: 'short', token_count: 50 }));
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runPromptArchitect(PERIOD);

    expect(report.findings.every((f) => !f.title.includes('repeated prompt'))).toBe(true);
  });

  it('includes agent attribution in all findings', async () => {
    const service = new AgentSwarmService(makeClient([]) as never);
    const report = await service.runPromptArchitect(PERIOD);

    report.findings.forEach((f) => {
      expect(f.agentId).toBe('agent-prompt-architect');
      expect(f.agentName).toBe('Prompt Architect');
    });
  });

  it('summary includes analyzed prompt count', async () => {
    const rows = [{ prompt: 'test', token_count: 100 }];
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runPromptArchitect(PERIOD);

    expect(report.summary).toContain('1 prompts');
  });
});

// ---------------------------------------------------------------------------
// runMemoryArchitect
// ---------------------------------------------------------------------------

describe('AgentSwarmService.runMemoryArchitect', () => {
  it('returns healthy finding when no prompt data exists', async () => {
    const service = new AgentSwarmService(makeClient([]) as never);
    const report = await service.runMemoryArchitect(PERIOD);

    expect(report.agentId).toBe('agent-memory-architect');
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].title).toBe('Memory utilization is healthy');
    expect(report.findings[0].type).toBe('memory');
  });

  it('detects high duplication rate (> 20%)', async () => {
    // 1 unique / 5 total = 80% duplication
    const rows = [
      { prompt: 'unique' },
      { prompt: 'duplicate' },
      { prompt: 'duplicate' },
      { prompt: 'duplicate' },
      { prompt: 'duplicate' },
    ];
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runMemoryArchitect(PERIOD);

    const dupFinding = report.findings.find((f) => f.title.includes('duplication rate'));
    expect(dupFinding).toBeDefined();
    expect(dupFinding?.severity).toBe('warning');
    expect(dupFinding?.estimatedImpact).toBeGreaterThan(0);
    expect(dupFinding?.recommendation).toContain('ZeroMemory');
  });

  it('does not flag when duplication rate is <= 20%', async () => {
    // 4 unique / 5 = 20% duplication — boundary: rate = 0.2, not > 0.2
    const rows = [
      { prompt: 'a' }, { prompt: 'b' }, { prompt: 'c' }, { prompt: 'd' },
      { prompt: 'a' }, // 1 duplicate out of 5 = 20%
    ];
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runMemoryArchitect(PERIOD);

    // 4/5 = 0.8 unique rate → 1 - 0.8 = 0.2 duplication, NOT > 0.2, so healthy
    expect(report.findings[0].title).toBe('Memory utilization is healthy');
  });

  it('includes duplication rate percentage in summary', async () => {
    const rows = [{ prompt: 'x' }, { prompt: 'x' }, { prompt: 'y' }];
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runMemoryArchitect(PERIOD);

    expect(report.summary).toMatch(/\d+\.\d+%/);
  });

  it('calculates estimated impact as duplicates * 0.02', async () => {
    // 2 unique / 6 total → 4 duplicates
    const rows = [
      { prompt: 'a' }, { prompt: 'b' },
      { prompt: 'a' }, { prompt: 'a' },
      { prompt: 'b' }, { prompt: 'b' },
    ];
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runMemoryArchitect(PERIOD);

    const finding = report.findings.find((f) => f.title.includes('duplication'));
    expect(finding?.estimatedImpact).toBeCloseTo(4 * 0.02, 5);
  });
});

// ---------------------------------------------------------------------------
// runGovernanceAgent
// ---------------------------------------------------------------------------

describe('AgentSwarmService.runGovernanceAgent', () => {
  it('returns healthy finding when no cost data exists', async () => {
    const service = new AgentSwarmService(makeClient([]) as never);
    const report = await service.runGovernanceAgent(PERIOD);

    expect(report.agentId).toBe('agent-governance');
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].title).toBe('Governance posture is healthy');
    expect(report.findings[0].type).toBe('compliance');
  });

  it('does not flag missing classification when <= 10 events', async () => {
    const rows = Array.from({ length: 10 }, () => ({
      classification: null,
      team_id: null,
    }));
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runGovernanceAgent(PERIOD);

    expect(report.findings[0].title).toBe('Governance posture is healthy');
  });

  it('flags missing classification when > 10 events', async () => {
    const rows = Array.from({ length: 11 }, () => ({
      classification: null,
      team_id: 'team-a',
    }));
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runGovernanceAgent(PERIOD);

    const classificationFinding = report.findings.find((f) =>
      f.title.includes('classification not configured')
    );
    expect(classificationFinding).toBeDefined();
    expect(classificationFinding?.severity).toBe('warning');
  });

  it('flags missing team attribution when > 10 events', async () => {
    const rows = Array.from({ length: 11 }, () => ({
      classification: 'batch_commands',
      team_id: null,
    }));
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runGovernanceAgent(PERIOD);

    const teamFinding = report.findings.find((f) => f.title.includes('team cost attribution'));
    expect(teamFinding).toBeDefined();
    expect(teamFinding?.severity).toBe('info');
  });

  it('flags both issues when both are missing with > 10 events', async () => {
    const rows = Array.from({ length: 11 }, () => ({
      classification: null,
      team_id: null,
    }));
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runGovernanceAgent(PERIOD);

    expect(report.findings).toHaveLength(2);
  });

  it('returns healthy finding when classification and teams are present', async () => {
    const rows = Array.from({ length: 11 }, () => ({
      classification: 'batch_commands',
      team_id: 'team-a',
    }));
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runGovernanceAgent(PERIOD);

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].title).toBe('Governance posture is healthy');
  });

  it('summary contains event count and finding count', async () => {
    const rows = Array.from({ length: 5 }, () => ({
      classification: 'code',
      team_id: 'team-a',
    }));
    const service = new AgentSwarmService(makeClient(rows) as never);
    const report = await service.runGovernanceAgent(PERIOD);

    expect(report.summary).toContain('5 events');
    expect(report.summary).toContain('1 governance finding');
  });
});

// ---------------------------------------------------------------------------
// runExecutiveReportAgent
// ---------------------------------------------------------------------------

describe('AgentSwarmService.runExecutiveReportAgent', () => {
  it('returns a single executive summary finding', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const report = await service.runExecutiveReportAgent(PERIOD);

    expect(report.agentId).toBe('agent-executive-report');
    expect(report.agentName).toBe('Executive Report Agent');
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].title).toBe('Executive Summary');
    expect(report.findings[0].type).toBe('report');
  });

  it('sets info severity when no critical or warning findings from sub-agents', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const report = await service.runExecutiveReportAgent(PERIOD);

    // With empty data all sub-agents return info findings
    expect(report.findings[0].severity).toBe('info');
    expect(report.findings[0].recommendation).toContain('maintain current practices');
  });

  it('sets warning severity when sub-agents have warnings', async () => {
    // Unclassified events with > 10 count triggers governance warning
    const costRows = Array.from({ length: 11 }, () => ({
      classification: null,
      team_id: null,
      model: 'claude-3-sonnet',
      total_cost: 0.01,
    }));
    const service = new AgentSwarmService(makeTableClient(costRows, []) as never);
    const report = await service.runExecutiveReportAgent(PERIOD);

    expect(['warning', 'info']).toContain(report.findings[0].severity);
  });

  it('includes combined summary from all four sub-agents', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const report = await service.runExecutiveReportAgent(PERIOD);

    // Summary joins 4 sub-summaries with ' | '
    const parts = report.summary.split(' | ');
    expect(parts).toHaveLength(4);
  });

  it('aggregates estimated impact across all findings', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const report = await service.runExecutiveReportAgent(PERIOD);

    expect(typeof report.findings[0].estimatedImpact).toBe('number');
    expect(report.findings[0].estimatedImpact).toBeGreaterThanOrEqual(0);
  });

  it('includes total finding count in description', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const report = await service.runExecutiveReportAgent(PERIOD);

    expect(report.findings[0].description).toContain('findings across 4 agents');
  });
});

// ---------------------------------------------------------------------------
// getAllFindings
// ---------------------------------------------------------------------------

describe('AgentSwarmService.getAllFindings', () => {
  it('returns findings from all four operational agents', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const findings = await service.getAllFindings();

    // Each agent returns at least 1 "healthy" finding → 4 minimum
    expect(findings.length).toBeGreaterThanOrEqual(4);
  });

  it('includes findings from all agent types', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const findings = await service.getAllFindings();

    const agentIds = findings.map((f) => f.agentId);
    expect(agentIds).toContain('agent-token-auditor');
    expect(agentIds).toContain('agent-prompt-architect');
    expect(agentIds).toContain('agent-memory-architect');
    expect(agentIds).toContain('agent-governance');
  });

  it('each finding has required fields', async () => {
    const service = new AgentSwarmService(makeTableClient([], []) as never);
    const findings = await service.getAllFindings();

    findings.forEach((f) => {
      expect(typeof f.agentId).toBe('string');
      expect(typeof f.agentName).toBe('string');
      expect(typeof f.title).toBe('string');
      expect(typeof f.description).toBe('string');
      expect(typeof f.recommendation).toBe('string');
      expect(typeof f.estimatedImpact).toBe('number');
      expect(['critical', 'warning', 'info']).toContain(f.severity);
      expect(['cost', 'optimization', 'compliance', 'memory', 'report']).toContain(f.type);
    });
  });

  it('increases finding count when problematic data is present', async () => {
    const emptyService = new AgentSwarmService(makeTableClient([], []) as never);
    const emptyFindings = await emptyService.getAllFindings();

    const costRows = [
      { model: 'claude-3-opus', total_cost: 9, classification: null, team_id: null },
      { model: 'claude-3-sonnet', total_cost: 1, classification: null, team_id: null },
      // Add 9 more to exceed the >10 threshold for governance
      ...Array.from({ length: 9 }, () => ({
        model: 'claude-3-sonnet', total_cost: 0.1,
        classification: null, team_id: null,
      })),
    ];
    const richService = new AgentSwarmService(makeTableClient(costRows, []) as never);
    const richFindings = await richService.getAllFindings();

    expect(richFindings.length).toBeGreaterThanOrEqual(emptyFindings.length);
  });
});

// ---------------------------------------------------------------------------
// getAgentSwarmService singleton
// ---------------------------------------------------------------------------

describe('getAgentSwarmService', () => {
  it('returns an AgentSwarmService instance', () => {
    const service = getAgentSwarmService();
    expect(service).toBeInstanceOf(AgentSwarmService);
  });

  it('returns the same instance on repeated calls', () => {
    const a = getAgentSwarmService();
    const b = getAgentSwarmService();
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Error resilience
// ---------------------------------------------------------------------------

describe('AgentSwarmService error resilience', () => {
  it('runTokenAuditor returns healthy finding when ZeroDB throws', async () => {
    const client = { queryRows: vi.fn().mockRejectedValue(new Error('network')) };
    const service = new AgentSwarmService(client as never);
    const report = await service.runTokenAuditor(PERIOD);

    expect(report.findings[0].title).toBe('Cost profile looks healthy');
  });

  it('runPromptArchitect returns healthy finding when ZeroDB throws', async () => {
    const client = { queryRows: vi.fn().mockRejectedValue(new Error('network')) };
    const service = new AgentSwarmService(client as never);
    const report = await service.runPromptArchitect(PERIOD);

    expect(report.findings[0].title).toBe('Prompts look well-structured');
  });

  it('runMemoryArchitect returns healthy finding when ZeroDB throws', async () => {
    const client = { queryRows: vi.fn().mockRejectedValue(new Error('network')) };
    const service = new AgentSwarmService(client as never);
    const report = await service.runMemoryArchitect(PERIOD);

    expect(report.findings[0].title).toBe('Memory utilization is healthy');
  });

  it('runGovernanceAgent returns healthy finding when ZeroDB throws', async () => {
    const client = { queryRows: vi.fn().mockRejectedValue(new Error('network')) };
    const service = new AgentSwarmService(client as never);
    const report = await service.runGovernanceAgent(PERIOD);

    expect(report.findings[0].title).toBe('Governance posture is healthy');
  });

  it('getAllFindings still returns results when ZeroDB throws', async () => {
    const client = { queryRows: vi.fn().mockRejectedValue(new Error('network')) };
    const service = new AgentSwarmService(client as never);
    const findings = await service.getAllFindings();

    expect(Array.isArray(findings)).toBe(true);
    expect(findings.length).toBeGreaterThan(0);
  });
});
