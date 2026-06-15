import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsultantService, getConsultantService } from '../consultant';
import type { ConsultantRecommendation } from '../../types/consultant';

// Refs #11

vi.mock('../../lib/zerodb-client', () => ({
  getZeroDBClient: vi.fn(() => ({
    queryRows: vi.fn().mockResolvedValue({ rows: [] }),
    insertRows: vi.fn().mockResolvedValue({ inserted: 1 }),
  })),
}));

// Mock the maturity assessor so consultant tests stay isolated
vi.mock('../maturity-assessor', () => ({
  getMaturityAssessor: vi.fn(() => ({
    generateReport: vi.fn().mockResolvedValue({
      overallScore: 55,
      overallLevel: 'proficient',
      scores: [],
      generatedAt: new Date().toISOString(),
      period: { start: '2026-06-01T00:00:00Z', end: '2026-06-14T23:59:59Z' },
      highlights: ['Optimization: advanced (75/100)'],
      risks: ['Governance maturity is low (30/100) — needs attention'],
    }),
  })),
}));

function makeMockClient(
  costRows: Record<string, unknown>[] = [],
  promptRows: Record<string, unknown>[] = []
) {
  // queryRows is called with tableName; first call = cost_events, second = prompt_events
  let callIndex = 0;
  return {
    queryRows: vi.fn().mockImplementation(() => {
      const result = callIndex === 0 ? costRows : promptRows;
      callIndex++;
      return Promise.resolve({ rows: result });
    }),
    insertRows: vi.fn().mockResolvedValue({ inserted: 1 }),
  };
}

const PERIOD = { start: '2026-06-01T00:00:00Z', end: '2026-06-14T23:59:59Z' };

// ---------------------------------------------------------------------------
// generateAlerts
// ---------------------------------------------------------------------------

describe('ConsultantService.generateAlerts', () => {
  it('returns empty alerts when no data exists', async () => {
    const client = {
      queryRows: vi.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new ConsultantService(client as never);
    const alerts = await service.generateAlerts(PERIOD);

    expect(alerts).toEqual([]);
  });

  it('generates critical alert when total spend > $100', async () => {
    const rows = [
      { total_cost: 60, model: 'claude-3-sonnet' },
      { total_cost: 50, model: 'claude-3-sonnet' },
    ];
    const client = { queryRows: vi.fn().mockResolvedValue({ rows }) };
    const service = new ConsultantService(client as never);
    const alerts = await service.generateAlerts(PERIOD);

    const critical = alerts.find((a) => a.id === 'alert-high-spend');
    expect(critical).toBeDefined();
    expect(critical?.severity).toBe('critical');
    expect(critical?.threshold).toBe(100);
    expect(critical?.currentValue).toBe(110);
    expect(typeof critical?.createdAt).toBe('string');
  });

  it('generates warning alert when total spend is $50–$100', async () => {
    const rows = [{ total_cost: 75, model: 'claude-3-sonnet' }];
    const client = { queryRows: vi.fn().mockResolvedValue({ rows }) };
    const service = new ConsultantService(client as never);
    const alerts = await service.generateAlerts(PERIOD);

    const warning = alerts.find((a) => a.id === 'alert-moderate-spend');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('warning');
    expect(warning?.currentValue).toBe(75);
  });

  it('does not generate spend alerts when cost is below $50', async () => {
    const rows = [{ total_cost: 10, model: 'claude-3-haiku' }];
    const client = { queryRows: vi.fn().mockResolvedValue({ rows }) };
    const service = new ConsultantService(client as never);
    const alerts = await service.generateAlerts(PERIOD);

    expect(alerts.find((a) => a.id === 'alert-high-spend')).toBeUndefined();
    expect(alerts.find((a) => a.id === 'alert-moderate-spend')).toBeUndefined();
  });

  it('generates high volume alert when event count > 1000', async () => {
    const rows = Array.from({ length: 1001 }, () => ({ total_cost: 0.01, model: 'model-a' }));
    const client = { queryRows: vi.fn().mockResolvedValue({ rows }) };
    const service = new ConsultantService(client as never);
    const alerts = await service.generateAlerts(PERIOD);

    const volumeAlert = alerts.find((a) => a.id === 'alert-high-volume');
    expect(volumeAlert).toBeDefined();
    expect(volumeAlert?.severity).toBe('warning');
    expect(volumeAlert?.currentValue).toBe(1001);
  });

  it('generates single model alert when only one model and > 10 events', async () => {
    const rows = Array.from({ length: 11 }, () => ({
      total_cost: 0.01,
      model: 'claude-3-sonnet',
    }));
    const client = { queryRows: vi.fn().mockResolvedValue({ rows }) };
    const service = new ConsultantService(client as never);
    const alerts = await service.generateAlerts(PERIOD);

    const modelAlert = alerts.find((a) => a.id === 'alert-single-model');
    expect(modelAlert).toBeDefined();
    expect(modelAlert?.severity).toBe('info');
    expect(modelAlert?.metric).toBe('model_diversity');
  });

  it('does not generate single model alert when multiple models in use', async () => {
    const rows = [
      { total_cost: 0.01, model: 'claude-3-haiku' },
      { total_cost: 0.02, model: 'claude-3-sonnet' },
    ];
    const client = { queryRows: vi.fn().mockResolvedValue({ rows }) };
    const service = new ConsultantService(client as never);
    const alerts = await service.generateAlerts(PERIOD);

    expect(alerts.find((a) => a.id === 'alert-single-model')).toBeUndefined();
  });

  it('does not generate single model alert when event count <= 10', async () => {
    const rows = Array.from({ length: 10 }, () => ({
      total_cost: 0.01,
      model: 'claude-3-sonnet',
    }));
    const client = { queryRows: vi.fn().mockResolvedValue({ rows }) };
    const service = new ConsultantService(client as never);
    const alerts = await service.generateAlerts(PERIOD);

    expect(alerts.find((a) => a.id === 'alert-single-model')).toBeUndefined();
  });

  it('returns empty alerts when ZeroDB throws', async () => {
    const client = {
      queryRows: vi.fn().mockRejectedValue(new Error('network failure')),
    };
    const service = new ConsultantService(client as never);
    const alerts = await service.generateAlerts(PERIOD);

    expect(alerts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateRecommendations
// ---------------------------------------------------------------------------

describe('ConsultantService.generateRecommendations', () => {
  it('returns empty recommendations when no data exists', async () => {
    const client = {
      queryRows: vi.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new ConsultantService(client as never);
    const recs = await service.generateRecommendations(PERIOD);

    expect(recs).toEqual([]);
  });

  it('recommends model downgrade when expensive models are used', async () => {
    // First query (cost_events) returns opus usage; second (prompt_events) empty
    let call = 0;
    const client = {
      queryRows: vi.fn().mockImplementation(() => {
        if (call++ === 0) {
          return Promise.resolve({
            rows: [{ model: 'claude-3-opus', total_cost: 0.5 }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    };
    const service = new ConsultantService(client as never);
    const recs = await service.generateRecommendations(PERIOD);

    const downgrade = recs.find((r) => r.id === 'rec-model-downgrade');
    expect(downgrade).toBeDefined();
    expect(downgrade?.category).toBe('Model Optimization');
    expect(downgrade?.effort).toBe('low');
    expect(downgrade?.priority).toBe(9);
    expect(downgrade?.estimatedSavings).toBeCloseTo(0.5 * 0.6, 5);
  });

  it('recommends model downgrade for gpt-4o usage', async () => {
    let call = 0;
    const client = {
      queryRows: vi.fn().mockImplementation(() => {
        if (call++ === 0) {
          return Promise.resolve({
            rows: [{ model: 'gpt-4o', total_cost: 1.0 }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    };
    const service = new ConsultantService(client as never);
    const recs = await service.generateRecommendations(PERIOD);

    expect(recs.find((r) => r.id === 'rec-model-downgrade')).toBeDefined();
  });

  it('does not recommend model downgrade for haiku usage', async () => {
    let call = 0;
    const client = {
      queryRows: vi.fn().mockImplementation(() => {
        if (call++ === 0) {
          return Promise.resolve({
            rows: [{ model: 'claude-3-haiku', total_cost: 0.01 }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    };
    const service = new ConsultantService(client as never);
    const recs = await service.generateRecommendations(PERIOD);

    expect(recs.find((r) => r.id === 'rec-model-downgrade')).toBeUndefined();
  });

  it('recommends memory cache when duplication rate > 15%', async () => {
    // 2 unique / 10 prompts = 80% duplication
    let call = 0;
    const client = {
      queryRows: vi.fn().mockImplementation(() => {
        if (call++ === 0) {
          return Promise.resolve({ rows: [{ model: 'claude-3-sonnet', total_cost: 10 }] });
        }
        const repeated = { prompt: 'same prompt again' };
        return Promise.resolve({
          rows: [
            { prompt: 'unique prompt' },
            repeated, repeated, repeated, repeated,
            repeated, repeated, repeated, repeated, repeated,
          ],
        });
      }),
    };
    const service = new ConsultantService(client as never);
    const recs = await service.generateRecommendations(PERIOD);

    const cacheRec = recs.find((r) => r.id === 'rec-memory-cache');
    expect(cacheRec).toBeDefined();
    expect(cacheRec?.category).toBe('Memory Optimization');
    expect(cacheRec?.estimatedSavings).toBeGreaterThan(0);
  });

  it('does not recommend memory cache when duplication rate <= 15%', async () => {
    // 9 unique / 10 = 10% duplication
    let call = 0;
    const client = {
      queryRows: vi.fn().mockImplementation(() => {
        if (call++ === 0) {
          return Promise.resolve({ rows: [{ model: 'claude-3-sonnet', total_cost: 1 }] });
        }
        return Promise.resolve({
          rows: [
            { prompt: 'a' }, { prompt: 'b' }, { prompt: 'c' }, { prompt: 'd' },
            { prompt: 'e' }, { prompt: 'f' }, { prompt: 'g' }, { prompt: 'h' },
            { prompt: 'i' }, { prompt: 'a' }, // 1 duplicate = 10%
          ],
        });
      }),
    };
    const service = new ConsultantService(client as never);
    const recs = await service.generateRecommendations(PERIOD);

    expect(recs.find((r) => r.id === 'rec-memory-cache')).toBeUndefined();
  });

  it('recommends batch automation when batch count > 10', async () => {
    let call = 0;
    const client = {
      queryRows: vi.fn().mockImplementation(() => {
        if (call++ === 0) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({
          rows: Array.from({ length: 11 }, () => ({ classification: 'batch_commands' })),
        });
      }),
    };
    const service = new ConsultantService(client as never);
    const recs = await service.generateRecommendations(PERIOD);

    const batchRec = recs.find((r) => r.id === 'rec-batch-automation');
    expect(batchRec).toBeDefined();
    expect(batchRec?.category).toBe('Automation');
    expect(batchRec?.estimatedSavings).toBeCloseTo(11 * 0.05, 5);
  });

  it('recommends governance when no team attribution and > 20 events', async () => {
    let call = 0;
    const client = {
      queryRows: vi.fn().mockImplementation(() => {
        if (call++ === 0) {
          return Promise.resolve({
            rows: Array.from({ length: 21 }, () => ({
              model: 'claude-3-sonnet',
              total_cost: 0.01,
              team_id: null,
            })),
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    };
    const service = new ConsultantService(client as never);
    const recs = await service.generateRecommendations(PERIOD);

    const govRec = recs.find((r) => r.id === 'rec-governance');
    expect(govRec).toBeDefined();
    expect(govRec?.estimatedSavings).toBe(0);
    expect(govRec?.effort).toBe('medium');
  });

  it('does not recommend governance when team attribution exists', async () => {
    let call = 0;
    const client = {
      queryRows: vi.fn().mockImplementation(() => {
        if (call++ === 0) {
          return Promise.resolve({
            rows: Array.from({ length: 21 }, () => ({
              model: 'claude-3-sonnet',
              total_cost: 0.01,
              team_id: 'team-a',
            })),
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    };
    const service = new ConsultantService(client as never);
    const recs = await service.generateRecommendations(PERIOD);

    expect(recs.find((r) => r.id === 'rec-governance')).toBeUndefined();
  });

  it('returns recommendations sorted by priority descending', async () => {
    // Set up data that triggers multiple recommendations
    let call = 0;
    const client = {
      queryRows: vi.fn().mockImplementation(() => {
        if (call++ === 0) {
          return Promise.resolve({
            rows: Array.from({ length: 21 }, () => ({
              model: 'claude-3-opus',
              total_cost: 0.5,
              team_id: null,
            })),
          });
        }
        return Promise.resolve({
          rows: Array.from({ length: 11 }, () => ({ classification: 'batch_commands', prompt: 'x' })),
        });
      }),
    };
    const service = new ConsultantService(client as never);
    const recs = await service.generateRecommendations(PERIOD);

    for (let i = 0; i < recs.length - 1; i++) {
      expect(recs[i].priority).toBeGreaterThanOrEqual(recs[i + 1].priority);
    }
  });

  it('returns empty array when ZeroDB throws', async () => {
    const client = {
      queryRows: vi.fn().mockRejectedValue(new Error('db error')),
    };
    const service = new ConsultantService(client as never);
    const recs = await service.generateRecommendations(PERIOD);

    expect(recs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createActionPlan
// ---------------------------------------------------------------------------

describe('ConsultantService.createActionPlan', () => {
  it('creates a draft action plan with items from recommendations', async () => {
    const client = { queryRows: vi.fn().mockResolvedValue({ rows: [] }) };
    const service = new ConsultantService(client as never);

    const recs: ConsultantRecommendation[] = [
      {
        id: 'rec-1',
        category: 'Model Optimization',
        title: 'Downgrade expensive models',
        description: 'Use haiku for simple tasks',
        estimatedSavings: 50,
        effort: 'low',
        priority: 9,
      },
      {
        id: 'rec-2',
        category: 'Governance',
        title: 'Enable team attribution',
        description: 'Assign cost per team',
        estimatedSavings: 0,
        effort: 'medium',
        priority: 6,
      },
    ];

    const plan = await service.createActionPlan('Q2 Optimization Plan', recs);

    expect(plan.title).toBe('Q2 Optimization Plan');
    expect(plan.status).toBe('draft');
    expect(plan.items).toHaveLength(2);
    expect(plan.items[0].id).toBe('item-1');
    expect(plan.items[0].title).toBe('Downgrade expensive models');
    expect(plan.items[0].status).toBe('pending');
    expect(plan.items[0].effort).toBe('low');
    expect(plan.items[1].id).toBe('item-2');
  });

  it('calculates totalExpectedSavings correctly', async () => {
    const client = { queryRows: vi.fn().mockResolvedValue({ rows: [] }) };
    const service = new ConsultantService(client as never);

    const recs: ConsultantRecommendation[] = [
      {
        id: 'rec-1', category: 'A', title: 'T1', description: 'D1',
        estimatedSavings: 30, effort: 'low', priority: 9,
      },
      {
        id: 'rec-2', category: 'B', title: 'T2', description: 'D2',
        estimatedSavings: 70, effort: 'medium', priority: 6,
      },
    ];

    const plan = await service.createActionPlan('Test Plan', recs);

    expect(plan.totalExpectedSavings).toBe(100);
  });

  it('creates an empty plan when given zero recommendations', async () => {
    const client = { queryRows: vi.fn().mockResolvedValue({ rows: [] }) };
    const service = new ConsultantService(client as never);

    const plan = await service.createActionPlan('Empty Plan', []);

    expect(plan.items).toHaveLength(0);
    expect(plan.totalExpectedSavings).toBe(0);
    expect(plan.status).toBe('draft');
  });

  it('generates plan ids prefixed with plan-', async () => {
    const client = { queryRows: vi.fn().mockResolvedValue({ rows: [] }) };
    const service = new ConsultantService(client as never);

    const plan = await service.createActionPlan('Plan A', []);

    expect(plan.id).toMatch(/^plan-\d+$/);
  });

  it('sets createdAt and updatedAt as ISO strings', async () => {
    const client = { queryRows: vi.fn().mockResolvedValue({ rows: [] }) };
    const service = new ConsultantService(client as never);

    const plan = await service.createActionPlan('Plan', []);

    expect(new Date(plan.createdAt).getTime()).not.toBeNaN();
    expect(new Date(plan.updatedAt).getTime()).not.toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// getCustomerInsights
// ---------------------------------------------------------------------------

describe('ConsultantService.getCustomerInsights', () => {
  it('returns alerts, recommendations, risks, and opportunities', async () => {
    const client = { queryRows: vi.fn().mockResolvedValue({ rows: [] }) };
    const service = new ConsultantService(client as never);
    const insights = await service.getCustomerInsights(PERIOD);

    expect(Array.isArray(insights.alerts)).toBe(true);
    expect(Array.isArray(insights.recommendations)).toBe(true);
    expect(Array.isArray(insights.risks)).toBe(true);
    expect(Array.isArray(insights.opportunities)).toBe(true);
  });

  it('maps maturity report highlights to opportunities', async () => {
    const client = { queryRows: vi.fn().mockResolvedValue({ rows: [] }) };
    const service = new ConsultantService(client as never);
    const insights = await service.getCustomerInsights(PERIOD);

    // The mock assessor returns one highlight
    expect(insights.opportunities).toHaveLength(1);
    expect(insights.opportunities[0]).toContain('Leverage strength:');
    expect(insights.opportunities[0]).toContain('Optimization: advanced (75/100)');
  });

  it('surfaces risks from the maturity report', async () => {
    const client = { queryRows: vi.fn().mockResolvedValue({ rows: [] }) };
    const service = new ConsultantService(client as never);
    const insights = await service.getCustomerInsights(PERIOD);

    expect(insights.risks).toContain('Governance maturity is low (30/100) — needs attention');
  });
});

// ---------------------------------------------------------------------------
// getConsultantService singleton
// ---------------------------------------------------------------------------

describe('getConsultantService', () => {
  it('returns a ConsultantService instance', () => {
    const service = getConsultantService();
    expect(service).toBeInstanceOf(ConsultantService);
  });

  it('returns the same instance on repeated calls', () => {
    const a = getConsultantService();
    const b = getConsultantService();
    expect(a).toBe(b);
  });
});
