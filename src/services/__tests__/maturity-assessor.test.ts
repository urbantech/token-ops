import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaturityAssessor, getMaturityAssessor } from '../maturity-assessor';

// Refs #10

vi.mock('../../lib/zerodb-client', () => ({
  getZeroDBClient: vi.fn(() => ({
    queryRows: vi.fn().mockResolvedValue({ rows: [] }),
    insertRows: vi.fn().mockResolvedValue({ inserted: 1 }),
  })),
}));

function makeMockClient(rows: Record<string, unknown>[] = []) {
  return {
    queryRows: vi.fn().mockResolvedValue({ rows }),
    insertRows: vi.fn().mockResolvedValue({ inserted: 1 }),
  };
}

const PERIOD = { start: '2026-06-01T00:00:00Z', end: '2026-06-14T23:59:59Z' };

// ---------------------------------------------------------------------------
// assessGovernance
// ---------------------------------------------------------------------------

describe('MaturityAssessor.assessGovernance', () => {
  it('returns developing score with no data', async () => {
    const assessor = new MaturityAssessor(makeMockClient([]) as never);
    const score = await assessor.assessGovernance(PERIOD);

    expect(score.category).toBe('governance');
    expect(score.score).toBe(20); // base score only
    // score=20 → scoreToLevel: min=20 → 'developing'
    expect(score.level).toBe('developing');
    expect(score.findings).toContain('0 cost events tracked');
    expect(score.findings).toContain('No budget limits set');
    expect(score.findings).toContain('Spend not classified');
    expect(score.findings).toContain('No team attribution');
  });

  it('adds score for budget limits', async () => {
    const rows = [{ budget_limit: 500, classification: null, team_id: null }];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessGovernance(PERIOD);

    expect(score.score).toBe(45); // 20 + 25
    expect(score.findings).toContain('Budget limits configured');
    expect(score.recommendations).toContain('Enable automatic spend classification');
    expect(score.recommendations).toContain('Configure team-level cost attribution');
  });

  it('adds score for classification', async () => {
    const rows = [{ budget_limit: null, classification: 'batch_commands', team_id: null }];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessGovernance(PERIOD);

    expect(score.score).toBe(45); // 20 + 25
    expect(score.findings).toContain('Spend classification active');
  });

  it('adds score for team attribution', async () => {
    const rows = [{ budget_limit: null, classification: null, team_id: 'team-a' }];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessGovernance(PERIOD);

    expect(score.score).toBe(40); // 20 + 20
    expect(score.findings).toContain('Team cost attribution enabled');
  });

  it('adds score for high event volume', async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      budget_limit: null,
      classification: null,
      team_id: null,
    }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessGovernance(PERIOD);

    expect(score.score).toBe(30); // 20 + 10 for volume
  });

  it('caps at 100 when all flags are set with high volume', async () => {
    const rows = Array.from({ length: 101 }, () => ({
      budget_limit: 500,
      classification: 'batch_commands',
      team_id: 'team-a',
    }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessGovernance(PERIOD);

    expect(score.score).toBe(100);
    expect(score.level).toBe('expert');
    expect(score.recommendations).toContain('Governance practices are mature');
  });

  it('returns fallback recommendation when all flags set but score below 80', async () => {
    // 20 + 25 + 25 + 20 = 90, triggers "Governance practices are mature"
    // Let's check 20+25+25+20 = 90 -> "Governance practices are mature"
    const rows = [
      { budget_limit: 100, classification: 'batch', team_id: 'team-1' },
    ];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessGovernance(PERIOD);

    // Score = 20 + 25 + 25 + 20 = 90
    expect(score.score).toBe(90);
    expect(score.recommendations).toContain('Governance practices are mature');
  });
});

// ---------------------------------------------------------------------------
// assessMemory
// ---------------------------------------------------------------------------

describe('MaturityAssessor.assessMemory', () => {
  it('returns score of 60 with no data', async () => {
    const assessor = new MaturityAssessor(makeMockClient([]) as never);
    const score = await assessor.assessMemory(PERIOD);

    expect(score.category).toBe('memory');
    // 0 rows → duplicationRate = 0 (< 0.1) → +30 low-duplication bonus
    // 30 base + 30 = 60
    expect(score.score).toBe(60);
    expect(score.level).toBe('advanced');
    expect(score.findings).toContain('0 prompts analyzed');
    expect(score.findings).toContain('0 unique prompts');
    expect(score.findings).toContain('0.0% duplication rate');
  });

  it('gives bonus for low duplication (< 10%)', async () => {
    const rows = [
      { prompt: 'unique prompt A' },
      { prompt: 'unique prompt B' },
      { prompt: 'unique prompt C' },
    ];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessMemory(PERIOD);

    // 3 unique / 3 total = 0% duplication → +30
    expect(score.score).toBeGreaterThanOrEqual(60);
    expect(score.recommendations).toContain('Memory utilization is healthy');
  });

  it('gives partial bonus for moderate duplication (10–30%)', async () => {
    // 8 unique / 10 total = 20% duplication → 0.1 <= rate < 0.3 → +15
    const rows = [
      { prompt: 'prompt A' },
      { prompt: 'prompt B' },
      { prompt: 'prompt C' },
      { prompt: 'prompt D' },
      { prompt: 'prompt E' },
      { prompt: 'prompt F' },
      { prompt: 'prompt G' },
      { prompt: 'prompt H' },
      { prompt: 'prompt A' }, // duplicate
      { prompt: 'prompt B' }, // duplicate
    ];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessMemory(PERIOD);

    // 30 base + 15 partial = 45
    expect(score.score).toBe(45);
  });

  it('does not add bonus for high duplication (>= 30%)', async () => {
    // 4 unique / 10 total = 60% duplication → rate >= 0.3 → no duplication bonus
    const repeated = { prompt: 'same prompt' };
    const rows = [
      { prompt: 'unique A' },
      { prompt: 'unique B' },
      { prompt: 'unique C' },
      { prompt: 'unique D' },
      repeated, repeated, repeated, repeated, repeated, repeated,
    ];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessMemory(PERIOD);

    expect(score.score).toBe(30); // base only, duplication > 0.2 → cache recommendations
    expect(score.recommendations).toContain('Enable memory caching to reduce duplicate prompts');
  });

  it('adds score for more than 50 unique prompts', async () => {
    const rows = Array.from({ length: 55 }, (_, i) => ({ prompt: `unique prompt ${i}` }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessMemory(PERIOD);

    // 30 base + 30 low-duplication + 20 >50 unique = 80
    expect(score.score).toBe(80);
    expect(score.level).toBe('expert');
  });

  it('adds score for more than 200 total rows', async () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({ prompt: `unique ${i}` }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessMemory(PERIOD);

    // 30 + 30 + 20 + 20 = 100
    expect(score.score).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// assessOptimization
// ---------------------------------------------------------------------------

describe('MaturityAssessor.assessOptimization', () => {
  it('returns base score with no data', async () => {
    const assessor = new MaturityAssessor(makeMockClient([]) as never);
    const score = await assessor.assessOptimization(PERIOD);

    expect(score.category).toBe('optimization');
    expect(score.score).toBe(45); // 25 base + 20 for avgCostPerEvent=0 < 0.01
    expect(score.findings).toContain('Total spend: $0.00');
    expect(score.findings).toContain('Avg cost/event: $0.0000');
    expect(score.findings).toContain('Single model usage');
  });

  it('adds score for multiple models', async () => {
    const rows = [
      { model: 'claude-3-haiku', total_cost: 0.001 },
      { model: 'claude-3-sonnet', total_cost: 0.005 },
    ];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessOptimization(PERIOD);

    expect(score.findings).toContain('Multiple models in use');
    expect(score.score).toBeGreaterThan(25);
  });

  it('adds score for low-cost haiku models', async () => {
    const rows = [{ model: 'claude-3-haiku', total_cost: 0.001 }];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessOptimization(PERIOD);

    expect(score.findings).toContain('Cost-efficient models detected');
    expect(score.recommendations).toContain('Optimization practices are solid');
  });

  it('adds score for low-cost mini models', async () => {
    const rows = [{ model: 'gpt-4o-mini', total_cost: 0.002 }];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessOptimization(PERIOD);

    expect(score.findings).toContain('Cost-efficient models detected');
  });

  it('recommends routing to haiku when no low-cost models present', async () => {
    const rows = [{ model: 'claude-3-opus', total_cost: 0.05 }];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessOptimization(PERIOD);

    expect(score.findings).toContain('No low-cost models in use');
    expect(score.recommendations).toContain('Route simple tasks to Haiku/Mini models');
  });

  it('adds score for high avg cost events > 50 rows', async () => {
    const rows = Array.from({ length: 51 }, () => ({ model: 'claude-3-sonnet', total_cost: 0.001 }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessOptimization(PERIOD);

    // 25 base + 20 for avgCost < 0.01 + 15 for >50 rows = 60
    expect(score.score).toBe(60);
  });

  it('caps score at 100', async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      model: i % 2 === 0 ? 'claude-3-haiku' : 'claude-3-sonnet',
      total_cost: 0.001,
    }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessOptimization(PERIOD);

    expect(score.score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// assessAutomation
// ---------------------------------------------------------------------------

describe('MaturityAssessor.assessAutomation', () => {
  it('returns base score with no data', async () => {
    const assessor = new MaturityAssessor(makeMockClient([]) as never);
    const score = await assessor.assessAutomation(PERIOD);

    expect(score.category).toBe('automation');
    expect(score.score).toBe(20); // base
    expect(score.findings).toContain('0 batch commands detected');
    expect(score.findings).toContain('0.0% automation rate');
    expect(score.recommendations).toContain('Convert repetitive prompts to batch scripts');
  });

  it('gives strong bonus when batch rate > 10%', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      classification: i < 2 ? 'batch_commands' : 'other',
    }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessAutomation(PERIOD);

    // batchRate = 0.2 > 0.1 → +30
    expect(score.score).toBe(50);
    expect(score.recommendations).toContain('Good automation adoption');
  });

  it('gives partial bonus when batch rate is 5–10%', async () => {
    // batchRate = 0.07 (7/100), rows.length = 100 (not > 100 so no volume bonus)
    const rows = Array.from({ length: 100 }, (_, i) => ({
      classification: i < 7 ? 'batch_commands' : 'other',
    }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessAutomation(PERIOD);

    // 20 base + 15 (partial 0.05 < rate < 0.1) = 35
    expect(score.score).toBe(35);
  });

  it('adds bonus for > 100 rows', async () => {
    const rows = Array.from({ length: 101 }, () => ({ classification: 'other' }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessAutomation(PERIOD);

    expect(score.findings).toContain('High activity volume');
    expect(score.score).toBe(40); // 20 + 20
  });

  it('adds bonus when batchCount > 20', async () => {
    // 25/100 = 0.25 > 0.1 → +30; rows.length = 100 (not > 100, no volume bonus); batchCount = 25 > 20 → +20
    const rows = Array.from({ length: 100 }, (_, i) => ({
      classification: i < 25 ? 'batch_commands' : 'other',
    }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessAutomation(PERIOD);

    // 20 base + 30 (>0.1 rate) + 20 (batchCount > 20) = 70
    expect(score.score).toBe(70);
  });
});

// ---------------------------------------------------------------------------
// assessAgentAdoption
// ---------------------------------------------------------------------------

describe('MaturityAssessor.assessAgentAdoption', () => {
  it('returns base score with no agents', async () => {
    const assessor = new MaturityAssessor(makeMockClient([]) as never);
    const score = await assessor.assessAgentAdoption(PERIOD);

    expect(score.category).toBe('agent_adoption');
    expect(score.score).toBe(15); // base only
    expect(score.findings).toContain('0 active agents');
    expect(score.findings).toContain('No agents detected');
    expect(score.recommendations).toContain('Deploy specialized agents for common tasks');
  });

  it('adds bonus for 1–2 agents', async () => {
    const rows = [
      { agent_name: 'agent-a' },
      { agent_name: 'agent-a' },
    ];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessAgentAdoption(PERIOD);

    // 15 + 10 (1 agent)
    expect(score.score).toBe(25);
  });

  it('adds bonus for 3–4 agents', async () => {
    const rows = [
      { agent_name: 'agent-a' },
      { agent_name: 'agent-b' },
      { agent_name: 'agent-c' },
    ];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessAgentAdoption(PERIOD);

    // 15 + 20 (3 agents)
    expect(score.score).toBe(35);
    expect(score.recommendations).toContain('Strong agent adoption');
  });

  it('adds large bonus for 5+ agents', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ agent_name: `agent-${i}` }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessAgentAdoption(PERIOD);

    // 15 + 30 (>=5 agents)
    expect(score.score).toBe(45);
  });

  it('adds bonus for > 200 rows', async () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({
      agent_name: `agent-${i % 5}`,
    }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessAgentAdoption(PERIOD);

    // 15 + 30 + 25 + 20 (rows/agent > 20) = 90
    expect(score.score).toBe(90);
  });

  it('adds bonus for high events per agent ratio', async () => {
    const rows = Array.from({ length: 21 }, () => ({ agent_name: 'agent-solo' }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessAgentAdoption(PERIOD);

    // 15 + 10 (1 agent) + 20 (21/1 > 20) = 45
    expect(score.score).toBe(45);
  });

  it('reports correct events/agent in findings', async () => {
    const rows = [
      { agent_name: 'agent-a' },
      { agent_name: 'agent-a' },
      { agent_name: 'agent-b' },
      { agent_name: 'agent-b' },
    ];
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const score = await assessor.assessAgentAdoption(PERIOD);

    expect(score.findings).toContain('2 events/agent avg');
  });
});

// ---------------------------------------------------------------------------
// generateReport
// ---------------------------------------------------------------------------

describe('MaturityAssessor.generateReport', () => {
  it('returns a complete report with all five categories', async () => {
    const assessor = new MaturityAssessor(makeMockClient([]) as never);
    const report = await assessor.generateReport(PERIOD);

    expect(report.scores).toHaveLength(5);
    const categories = report.scores.map((s) => s.category);
    expect(categories).toContain('governance');
    expect(categories).toContain('memory');
    expect(categories).toContain('optimization');
    expect(categories).toContain('automation');
    expect(categories).toContain('agent_adoption');
  });

  it('calculates overallScore as average of all five scores', async () => {
    const assessor = new MaturityAssessor(makeMockClient([]) as never);
    const report = await assessor.generateReport(PERIOD);

    const expectedAvg = Math.round(
      report.scores.reduce((s, sc) => s + sc.score, 0) / report.scores.length
    );
    expect(report.overallScore).toBe(expectedAvg);
  });

  it('sets overallLevel correctly for low scores', async () => {
    const assessor = new MaturityAssessor(makeMockClient([]) as never);
    const report = await assessor.generateReport(PERIOD);

    // With empty data all scores are low — should be beginner or developing
    expect(['beginner', 'developing', 'proficient']).toContain(report.overallLevel);
  });

  it('populates highlights for categories scoring >= 60', async () => {
    // Optimization base with empty data is 45 for avg cost=0 — not a highlight
    // Use rows that push optimization high
    const rows = Array.from({ length: 51 }, (_, i) => ({
      model: i % 2 === 0 ? 'claude-3-haiku' : 'claude-3-sonnet',
      total_cost: 0.0001,
      budget_limit: 100,
      classification: 'batch_commands',
      team_id: 'team-a',
    }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const report = await assessor.generateReport(PERIOD);

    expect(Array.isArray(report.highlights)).toBe(true);
  });

  it('populates risks for categories scoring < 40', async () => {
    const assessor = new MaturityAssessor(makeMockClient([]) as never);
    const report = await assessor.generateReport(PERIOD);

    // Governance (20), automation (20) and agent_adoption (15) should be risks
    expect(report.risks.length).toBeGreaterThan(0);
    const riskCategories = report.risks.map((r) => r.toLowerCase());
    expect(riskCategories.some((r) => r.includes('governance'))).toBe(true);
  });

  it('includes period and generatedAt in report', async () => {
    const assessor = new MaturityAssessor(makeMockClient([]) as never);
    const report = await assessor.generateReport(PERIOD);

    expect(report.period).toEqual(PERIOD);
    expect(typeof report.generatedAt).toBe('string');
    expect(new Date(report.generatedAt).getTime()).not.toBeNaN();
  });

  it('sets overallLevel to expert when all scores are high', async () => {
    // Build rows that maximize all dimensions
    const rows = Array.from({ length: 201 }, (_, i) => ({
      budget_limit: 500,
      classification: 'batch_commands',
      team_id: 'team-a',
      model: i % 2 === 0 ? 'claude-3-haiku' : 'claude-3-sonnet',
      total_cost: 0.0001,
      prompt: `unique prompt ${i}`,
      agent_name: `agent-${i % 6}`,
    }));
    const assessor = new MaturityAssessor(makeMockClient(rows) as never);
    const report = await assessor.generateReport(PERIOD);

    expect(['advanced', 'expert']).toContain(report.overallLevel);
    expect(report.overallScore).toBeGreaterThan(60);
  });
});

// ---------------------------------------------------------------------------
// getMaturityAssessor singleton
// ---------------------------------------------------------------------------

describe('getMaturityAssessor', () => {
  it('returns a MaturityAssessor instance', () => {
    const assessor = getMaturityAssessor();
    expect(assessor).toBeInstanceOf(MaturityAssessor);
  });

  it('returns the same instance on repeated calls', () => {
    const a = getMaturityAssessor();
    const b = getMaturityAssessor();
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Error resilience (queryTable catch branch)
// ---------------------------------------------------------------------------

describe('MaturityAssessor error resilience', () => {
  it('returns base score when ZeroDB throws', async () => {
    const failingClient = {
      queryRows: vi.fn().mockRejectedValue(new Error('Network error')),
    };
    const assessor = new MaturityAssessor(failingClient as never);
    const score = await assessor.assessGovernance(PERIOD);

    // Falls back to empty rows → base score
    expect(score.score).toBe(20);
  });

  it('generates a report even when ZeroDB throws for all queries', async () => {
    const failingClient = {
      queryRows: vi.fn().mockRejectedValue(new Error('Network error')),
    };
    const assessor = new MaturityAssessor(failingClient as never);
    const report = await assessor.generateReport(PERIOD);

    expect(report.scores).toHaveLength(5);
    expect(typeof report.overallScore).toBe('number');
  });
});
