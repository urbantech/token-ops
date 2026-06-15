/**
 * AI Maturity Assessment Service (EPIC 10.2)
 *
 * Scores an organization across five AI maturity dimensions
 * using data from telemetry, memory, and prompt analysis.
 */

import { getZeroDBClient, ZeroDBClient } from '../lib/zerodb-client';
import {
  MaturityCategory,
  MaturityReport,
  MaturityScore,
} from '../types/maturity';

const LEVEL_THRESHOLDS: { min: number; level: MaturityScore['level'] }[] = [
  { min: 80, level: 'expert' },
  { min: 60, level: 'advanced' },
  { min: 40, level: 'proficient' },
  { min: 20, level: 'developing' },
  { min: 0, level: 'beginner' },
];

function scoreToLevel(score: number): MaturityScore['level'] {
  for (const t of LEVEL_THRESHOLDS) {
    if (score >= t.min) return t.level;
  }
  return 'beginner';
}

export class MaturityAssessor {
  private client: ZeroDBClient;

  constructor(client?: ZeroDBClient) {
    this.client = client ?? getZeroDBClient();
  }

  async generateReport(period: { start: string; end: string }): Promise<MaturityReport> {
    const scores = await Promise.all([
      this.assessGovernance(period),
      this.assessMemory(period),
      this.assessOptimization(period),
      this.assessAutomation(period),
      this.assessAgentAdoption(period),
    ]);

    const overallScore = Math.round(
      scores.reduce((s, sc) => s + sc.score, 0) / scores.length
    );

    const highlights = scores
      .filter((s) => s.score >= 60)
      .map((s) => `${capitalize(s.category)}: ${s.level} (${s.score}/100)`);

    const risks = scores
      .filter((s) => s.score < 40)
      .map((s) => `${capitalize(s.category)} maturity is low (${s.score}/100) — ${s.recommendations[0] ?? 'needs attention'}`);

    return {
      overallScore,
      overallLevel: scoreToLevel(overallScore),
      scores,
      generatedAt: new Date().toISOString(),
      period,
      highlights,
      risks,
    };
  }

  async assessGovernance(period: { start: string; end: string }): Promise<MaturityScore> {
    const rows = await this.queryTable('cost_events', period);
    const hasBudgets = rows.some((r) => r.budget_limit != null);
    const hasClassification = rows.some((r) => r.classification != null);
    const hasTeamAttribution = rows.some((r) => r.team_id != null);

    let score = 20; // base
    if (hasBudgets) score += 25;
    if (hasClassification) score += 25;
    if (hasTeamAttribution) score += 20;
    if (rows.length > 100) score += 10;

    score = Math.min(score, 100);

    return {
      category: 'governance',
      score,
      level: scoreToLevel(score),
      findings: [
        `${rows.length} cost events tracked`,
        hasBudgets ? 'Budget limits configured' : 'No budget limits set',
        hasClassification ? 'Spend classification active' : 'Spend not classified',
        hasTeamAttribution ? 'Team cost attribution enabled' : 'No team attribution',
      ],
      recommendations: this.governanceRecommendations(score, { hasBudgets, hasClassification, hasTeamAttribution }),
    };
  }

  async assessMemory(period: { start: string; end: string }): Promise<MaturityScore> {
    const rows = await this.queryTable('prompt_events', period);
    const uniquePrompts = new Set(rows.map((r) => String(r.prompt ?? '').slice(0, 100)));
    const duplicationRate = rows.length > 0
      ? 1 - uniquePrompts.size / rows.length
      : 0;

    let score = 30;
    if (duplicationRate < 0.1) score += 30; // low duplication = good memory reuse
    else if (duplicationRate < 0.3) score += 15;
    if (uniquePrompts.size > 50) score += 20;
    if (rows.length > 200) score += 20;

    score = Math.min(score, 100);

    return {
      category: 'memory',
      score,
      level: scoreToLevel(score),
      findings: [
        `${rows.length} prompts analyzed`,
        `${uniquePrompts.size} unique prompts`,
        `${(duplicationRate * 100).toFixed(1)}% duplication rate`,
      ],
      recommendations: duplicationRate > 0.2
        ? ['Enable memory caching to reduce duplicate prompts', 'Configure ZeroMemory semantic deduplication']
        : ['Memory utilization is healthy', 'Consider expanding cache coverage'],
    };
  }

  async assessOptimization(period: { start: string; end: string }): Promise<MaturityScore> {
    const rows = await this.queryTable('cost_events', period);
    const totalCost = rows.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
    const avgCostPerEvent = rows.length > 0 ? totalCost / rows.length : 0;

    const usesMultipleModels = new Set(rows.map((r) => r.model)).size > 1;
    const hasLowCostModels = rows.some((r) => String(r.model).includes('haiku') || String(r.model).includes('mini'));

    let score = 25;
    if (usesMultipleModels) score += 20;
    if (hasLowCostModels) score += 20;
    if (avgCostPerEvent < 0.01) score += 20;
    if (rows.length > 50) score += 15;

    score = Math.min(score, 100);

    return {
      category: 'optimization',
      score,
      level: scoreToLevel(score),
      findings: [
        `Total spend: $${totalCost.toFixed(2)}`,
        `Avg cost/event: $${avgCostPerEvent.toFixed(4)}`,
        usesMultipleModels ? 'Multiple models in use' : 'Single model usage',
        hasLowCostModels ? 'Cost-efficient models detected' : 'No low-cost models in use',
      ],
      recommendations: !hasLowCostModels
        ? ['Route simple tasks to Haiku/Mini models', 'Enable automatic model routing']
        : ['Optimization practices are solid', 'Review batch pattern automation opportunities'],
    };
  }

  async assessAutomation(period: { start: string; end: string }): Promise<MaturityScore> {
    const rows = await this.queryTable('prompt_events', period);
    const batchCount = rows.filter((r) => r.classification === 'batch_commands').length;
    const batchRate = rows.length > 0 ? batchCount / rows.length : 0;

    let score = 20;
    if (batchRate > 0.1) score += 30;
    else if (batchRate > 0.05) score += 15;
    if (rows.length > 100) score += 20;
    if (batchCount > 20) score += 20;

    score = Math.min(score, 100);

    return {
      category: 'automation',
      score,
      level: scoreToLevel(score),
      findings: [
        `${batchCount} batch commands detected`,
        `${(batchRate * 100).toFixed(1)}% automation rate`,
        rows.length > 100 ? 'High activity volume' : 'Low activity volume',
      ],
      recommendations: batchRate < 0.1
        ? ['Convert repetitive prompts to batch scripts', 'Implement CI/CD automation for common tasks']
        : ['Good automation adoption', 'Explore advanced workflow orchestration'],
    };
  }

  async assessAgentAdoption(period: { start: string; end: string }): Promise<MaturityScore> {
    const rows = await this.queryTable('prompt_events', period);
    const agents = new Set(rows.map((r) => r.agent_name).filter(Boolean));
    const agentCount = agents.size;

    let score = 15;
    if (agentCount >= 5) score += 30;
    else if (agentCount >= 3) score += 20;
    else if (agentCount >= 1) score += 10;
    if (rows.length > 200) score += 25;
    if (agentCount > 0 && rows.length / agentCount > 20) score += 20;

    score = Math.min(score, 100);

    return {
      category: 'agent_adoption',
      score,
      level: scoreToLevel(score),
      findings: [
        `${agentCount} active agents`,
        `${rows.length} total events`,
        agentCount > 0 ? `${Math.round(rows.length / agentCount)} events/agent avg` : 'No agents detected',
      ],
      recommendations: agentCount < 3
        ? ['Deploy specialized agents for common tasks', 'Consider code review and testing agents']
        : ['Strong agent adoption', 'Optimize agent-to-task routing for efficiency'],
    };
  }

  private async queryTable(table: string, period: { start: string; end: string }): Promise<Record<string, unknown>[]> {
    try {
      const result = await this.client.queryRows({
        tableName: table,
        filters: {},
        limit: 10_000,
      });
      const rows = result?.rows ?? [];
      return rows.filter((r) => {
        const ts = r.timestamp ? String(r.timestamp) : '';
        if (!ts) return true;
        return ts >= period.start && ts <= period.end;
      });
    } catch {
      return [];
    }
  }

  private governanceRecommendations(
    score: number,
    flags: { hasBudgets: boolean; hasClassification: boolean; hasTeamAttribution: boolean }
  ): string[] {
    const recs: string[] = [];
    if (!flags.hasBudgets) recs.push('Set budget limits per team and project');
    if (!flags.hasClassification) recs.push('Enable automatic spend classification');
    if (!flags.hasTeamAttribution) recs.push('Configure team-level cost attribution');
    if (score >= 80) recs.push('Governance practices are mature');
    return recs.length > 0 ? recs : ['Continue monitoring governance metrics'];
  }
}

function capitalize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

let _service: MaturityAssessor | null = null;

export function getMaturityAssessor(): MaturityAssessor {
  if (!_service) _service = new MaturityAssessor();
  return _service;
}
