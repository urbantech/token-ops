/**
 * Consultant Workspace Service (EPIC 11)
 *
 * Surfaces customer insights, generates action plans,
 * and tracks remediation progress.
 */

import { getZeroDBClient, ZeroDBClient } from '../lib/zerodb-client';
import {
  ActionPlan,
  ActionPlanItem,
  ConsultantAlert,
  ConsultantRecommendation,
  CustomerInsight,
} from '../types/consultant';
import { getMaturityAssessor } from './maturity-assessor';

export class ConsultantService {
  private client: ZeroDBClient;

  constructor(client?: ZeroDBClient) {
    this.client = client ?? getZeroDBClient();
  }

  async getCustomerInsights(period: { start: string; end: string }): Promise<CustomerInsight> {
    const [alerts, recommendations] = await Promise.all([
      this.generateAlerts(period),
      this.generateRecommendations(period),
    ]);

    const assessor = getMaturityAssessor();
    const report = await assessor.generateReport(period);

    return {
      alerts,
      recommendations,
      risks: report.risks,
      opportunities: report.highlights.map(
        (h) => `Leverage strength: ${h}`
      ),
    };
  }

  async generateAlerts(period: { start: string; end: string }): Promise<ConsultantAlert[]> {
    const alerts: ConsultantAlert[] = [];

    try {
      const costRows = await this.queryTable('cost_events', period);
      const totalCost = costRows.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
      const eventCount = costRows.length;

      // High spend alert
      if (totalCost > 100) {
        alerts.push({
          id: 'alert-high-spend',
          severity: 'critical',
          title: 'High AI Spend Detected',
          description: `Total spend of $${totalCost.toFixed(2)} exceeds $100 threshold`,
          metric: 'total_cost',
          currentValue: totalCost,
          threshold: 100,
          createdAt: new Date().toISOString(),
        });
      } else if (totalCost > 50) {
        alerts.push({
          id: 'alert-moderate-spend',
          severity: 'warning',
          title: 'Moderate AI Spend',
          description: `Total spend of $${totalCost.toFixed(2)} approaching budget limit`,
          metric: 'total_cost',
          currentValue: totalCost,
          threshold: 50,
          createdAt: new Date().toISOString(),
        });
      }

      // High volume alert
      if (eventCount > 1000) {
        alerts.push({
          id: 'alert-high-volume',
          severity: 'warning',
          title: 'High Request Volume',
          description: `${eventCount} events recorded — review for optimization opportunities`,
          metric: 'event_count',
          currentValue: eventCount,
          threshold: 1000,
          createdAt: new Date().toISOString(),
        });
      }

      // Single model usage alert
      const models = new Set(costRows.map((r) => r.model));
      if (models.size === 1 && eventCount > 10) {
        alerts.push({
          id: 'alert-single-model',
          severity: 'info',
          title: 'Single Model Usage',
          description: 'Only one model in use — consider model routing for cost optimization',
          metric: 'model_diversity',
          currentValue: 1,
          threshold: 2,
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      // Return empty alerts on error
    }

    return alerts;
  }

  async generateRecommendations(period: { start: string; end: string }): Promise<ConsultantRecommendation[]> {
    const recommendations: ConsultantRecommendation[] = [];

    try {
      const costRows = await this.queryTable('cost_events', period);
      const totalCost = costRows.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);

      // Model downgrade recommendation
      const expensiveModels = costRows.filter(
        (r) => String(r.model).includes('opus') || String(r.model).includes('gpt-4o')
      );
      if (expensiveModels.length > 0) {
        const expensiveCost = expensiveModels.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
        recommendations.push({
          id: 'rec-model-downgrade',
          category: 'Model Optimization',
          title: 'Downgrade expensive models for routine tasks',
          description: `${expensiveModels.length} requests used premium models. Route simple tasks to Haiku/Mini.`,
          estimatedSavings: expensiveCost * 0.6,
          effort: 'low',
          priority: 9,
        });
      }

      // Memory caching recommendation
      const promptRows = await this.queryTable('prompt_events', period);
      const prompts = promptRows.map((r) => String(r.prompt ?? '').slice(0, 100));
      const uniquePrompts = new Set(prompts);
      const duplicationRate = prompts.length > 0 ? 1 - uniquePrompts.size / prompts.length : 0;

      if (duplicationRate > 0.15) {
        recommendations.push({
          id: 'rec-memory-cache',
          category: 'Memory Optimization',
          title: 'Enable semantic caching for duplicate prompts',
          description: `${(duplicationRate * 100).toFixed(0)}% of prompts are duplicates. Caching could eliminate most.`,
          estimatedSavings: totalCost * duplicationRate * 0.8,
          effort: 'medium',
          priority: 8,
        });
      }

      // Batch automation recommendation
      const batchCount = promptRows.filter((r) => r.classification === 'batch_commands').length;
      if (batchCount > 10) {
        recommendations.push({
          id: 'rec-batch-automation',
          category: 'Automation',
          title: 'Convert repetitive commands to scripts',
          description: `${batchCount} batch-type commands detected. Automating these saves per-call overhead.`,
          estimatedSavings: batchCount * 0.05,
          effort: 'low',
          priority: 7,
        });
      }

      // Governance recommendation
      const hasTeams = costRows.some((r) => r.team_id != null);
      if (!hasTeams && costRows.length > 20) {
        recommendations.push({
          id: 'rec-governance',
          category: 'Governance',
          title: 'Implement team-level cost attribution',
          description: 'No team attribution detected. Assign spend to teams for accountability.',
          estimatedSavings: 0,
          effort: 'medium',
          priority: 6,
        });
      }
    } catch {
      // Return empty on error
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  async createActionPlan(title: string, recommendations: ConsultantRecommendation[]): Promise<ActionPlan> {
    const items: ActionPlanItem[] = recommendations.map((rec, i) => ({
      id: `item-${i + 1}`,
      title: rec.title,
      description: rec.description,
      status: 'pending' as const,
      expectedSavings: rec.estimatedSavings,
      effort: rec.effort,
    }));

    const plan: ActionPlan = {
      id: `plan-${Date.now()}`,
      title,
      status: 'draft',
      items,
      totalExpectedSavings: items.reduce((s, i) => s + i.expectedSavings, 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return plan;
  }

  private async queryTable(table: string, period: { start: string; end: string }): Promise<Record<string, unknown>[]> {
    try {
      const result = await this.client.queryRows({
        tableName: table,
        filters: {
          timestamp_gte: period.start,
          timestamp_lte: period.end,
        },
        limit: 10_000,
      });
      return result?.rows ?? [];
    } catch {
      return [];
    }
  }
}

let _service: ConsultantService | null = null;

export function getConsultantService(): ConsultantService {
  if (!_service) _service = new ConsultantService();
  return _service;
}
