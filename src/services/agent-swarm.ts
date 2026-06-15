/**
 * Agent Swarm Operations Service (EPIC 12)
 *
 * Manages a swarm of specialized AI agents that continuously
 * analyze and optimize AI operations.
 */

import { getZeroDBClient, ZeroDBClient } from '../lib/zerodb-client';
import {
  AgentDefinition,
  AgentFinding,
  AgentReport,
  SwarmStatus,
} from '../types/agents';

const SWARM_AGENTS: AgentDefinition[] = [
  {
    id: 'agent-token-auditor',
    name: 'Token Auditor',
    role: 'Cost Analysis',
    description: 'Continuously analyzes AI spend to surface cost findings and savings estimates',
    capabilities: ['cost_analysis', 'savings_detection', 'batch_pattern_alerts'],
    status: 'active',
  },
  {
    id: 'agent-prompt-architect',
    name: 'Prompt Architect',
    role: 'Prompt Optimization',
    description: 'Optimizes prompts to reduce token consumption while maintaining quality',
    capabilities: ['prompt_scoring', 'verbosity_detection', 'optimization_suggestions'],
    status: 'active',
  },
  {
    id: 'agent-memory-architect',
    name: 'Memory Architect',
    role: 'Memory Optimization',
    description: 'Optimizes memory utilization to maximize context reuse',
    capabilities: ['duplicate_detection', 'reuse_recommendations', 'cache_optimization'],
    status: 'active',
  },
  {
    id: 'agent-governance',
    name: 'Governance Agent',
    role: 'Compliance Monitoring',
    description: 'Monitors AI operations for compliance and policy adherence',
    capabilities: ['policy_monitoring', 'compliance_checking', 'risk_detection'],
    status: 'active',
  },
  {
    id: 'agent-executive-report',
    name: 'Executive Report Agent',
    role: 'Report Generation',
    description: 'Composes insights from all agents into board-ready reports',
    capabilities: ['report_generation', 'insight_synthesis', 'trend_analysis'],
    status: 'active',
  },
];

export class AgentSwarmService {
  private client: ZeroDBClient;

  constructor(client?: ZeroDBClient) {
    this.client = client ?? getZeroDBClient();
  }

  getAgents(): AgentDefinition[] {
    return SWARM_AGENTS;
  }

  async getStatus(): Promise<SwarmStatus> {
    const findings = await this.getAllFindings();
    const criticalFindings = findings.filter((f) => f.severity === 'critical').length;

    return {
      agents: SWARM_AGENTS,
      totalFindings: findings.length,
      criticalFindings,
      lastRunAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() + 3600_000).toISOString(),
    };
  }

  async runTokenAuditor(period: { start: string; end: string }): Promise<AgentReport> {
    const findings: AgentFinding[] = [];
    const rows = await this.queryTable('cost_events', period);
    const totalCost = rows.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);

    // Check for expensive model usage
    const modelCosts = new Map<string, number>();
    for (const row of rows) {
      const model = String(row.model ?? 'unknown');
      modelCosts.set(model, (modelCosts.get(model) ?? 0) + (Number(row.total_cost) || 0));
    }

    for (const [model, cost] of modelCosts) {
      if (cost > totalCost * 0.4 && (model.includes('opus') || model.includes('gpt-4o'))) {
        findings.push({
          agentId: 'agent-token-auditor',
          agentName: 'Token Auditor',
          type: 'cost',
          severity: 'warning',
          title: `High spend on ${model}`,
          description: `$${cost.toFixed(2)} (${((cost / totalCost) * 100).toFixed(0)}% of total) spent on ${model}`,
          recommendation: `Consider routing simpler tasks to a cheaper model variant`,
          estimatedImpact: cost * 0.5,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Check for classification patterns
    const classifications = new Map<string, number>();
    for (const row of rows) {
      const cls = String(row.classification ?? 'unknown');
      classifications.set(cls, (classifications.get(cls) ?? 0) + 1);
    }

    for (const [cls, count] of classifications) {
      if (count > rows.length * 0.3) {
        findings.push({
          agentId: 'agent-token-auditor',
          agentName: 'Token Auditor',
          type: 'cost',
          severity: 'info',
          title: `High concentration in ${cls.replace(/_/g, ' ')}`,
          description: `${count} events (${((count / rows.length) * 100).toFixed(0)}%) classified as ${cls}`,
          recommendation: `Review if ${cls} tasks can be optimized or automated`,
          estimatedImpact: 0,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (findings.length === 0) {
      findings.push({
        agentId: 'agent-token-auditor',
        agentName: 'Token Auditor',
        type: 'cost',
        severity: 'info',
        title: 'Cost profile looks healthy',
        description: `$${totalCost.toFixed(2)} total spend across ${rows.length} events`,
        recommendation: 'Continue monitoring — no immediate action needed',
        estimatedImpact: 0,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      agentId: 'agent-token-auditor',
      agentName: 'Token Auditor',
      findings,
      summary: `Analyzed ${rows.length} cost events totaling $${totalCost.toFixed(2)}. Found ${findings.length} item(s).`,
      generatedAt: new Date().toISOString(),
    };
  }

  async runPromptArchitect(period: { start: string; end: string }): Promise<AgentReport> {
    const findings: AgentFinding[] = [];
    const rows = await this.queryTable('prompt_events', period);

    // Detect verbose prompts
    const longPrompts = rows.filter((r) => (Number(r.token_count) || 0) > 2000);
    if (longPrompts.length > 0) {
      findings.push({
        agentId: 'agent-prompt-architect',
        agentName: 'Prompt Architect',
        type: 'optimization',
        severity: longPrompts.length > 10 ? 'warning' : 'info',
        title: `${longPrompts.length} verbose prompts detected`,
        description: `Prompts exceeding 2000 tokens may contain redundant context`,
        recommendation: 'Run prompt analysis to identify compression opportunities',
        estimatedImpact: longPrompts.reduce((s, r) => s + (Number(r.token_count) || 0) * 0.3, 0),
        createdAt: new Date().toISOString(),
      });
    }

    // Detect repetitive patterns
    const promptPrefixes = rows.map((r) => String(r.prompt ?? '').slice(0, 50));
    const prefixCounts = new Map<string, number>();
    for (const p of promptPrefixes) {
      if (p.length > 10) {
        prefixCounts.set(p, (prefixCounts.get(p) ?? 0) + 1);
      }
    }

    const repeatedCount = [...prefixCounts.values()].filter((c) => c > 3).length;
    if (repeatedCount > 0) {
      findings.push({
        agentId: 'agent-prompt-architect',
        agentName: 'Prompt Architect',
        type: 'optimization',
        severity: 'warning',
        title: `${repeatedCount} repeated prompt patterns found`,
        description: 'Multiple prompts share identical prefixes — template candidates',
        recommendation: 'Create prompt templates for common patterns to reduce token overhead',
        estimatedImpact: repeatedCount * 500,
        createdAt: new Date().toISOString(),
      });
    }

    if (findings.length === 0) {
      findings.push({
        agentId: 'agent-prompt-architect',
        agentName: 'Prompt Architect',
        type: 'optimization',
        severity: 'info',
        title: 'Prompts look well-structured',
        description: `Analyzed ${rows.length} prompts — no major issues detected`,
        recommendation: 'Continue monitoring prompt quality',
        estimatedImpact: 0,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      agentId: 'agent-prompt-architect',
      agentName: 'Prompt Architect',
      findings,
      summary: `Analyzed ${rows.length} prompts. Found ${findings.length} optimization opportunity(ies).`,
      generatedAt: new Date().toISOString(),
    };
  }

  async runMemoryArchitect(period: { start: string; end: string }): Promise<AgentReport> {
    const findings: AgentFinding[] = [];
    const rows = await this.queryTable('prompt_events', period);

    const prompts = rows.map((r) => String(r.prompt ?? '').slice(0, 100));
    const unique = new Set(prompts);
    const duplicationRate = prompts.length > 0 ? 1 - unique.size / prompts.length : 0;

    if (duplicationRate > 0.2) {
      findings.push({
        agentId: 'agent-memory-architect',
        agentName: 'Memory Architect',
        type: 'memory',
        severity: 'warning',
        title: `${(duplicationRate * 100).toFixed(0)}% prompt duplication rate`,
        description: `${prompts.length - unique.size} duplicate prompts could be served from cache`,
        recommendation: 'Enable ZeroMemory semantic cache to eliminate repeated context loads',
        estimatedImpact: (prompts.length - unique.size) * 0.02,
        createdAt: new Date().toISOString(),
      });
    }

    if (findings.length === 0) {
      findings.push({
        agentId: 'agent-memory-architect',
        agentName: 'Memory Architect',
        type: 'memory',
        severity: 'info',
        title: 'Memory utilization is healthy',
        description: `Low duplication rate (${(duplicationRate * 100).toFixed(1)}%) across ${prompts.length} prompts`,
        recommendation: 'Consider expanding cache to new use cases',
        estimatedImpact: 0,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      agentId: 'agent-memory-architect',
      agentName: 'Memory Architect',
      findings,
      summary: `Analyzed ${prompts.length} prompts. Duplication rate: ${(duplicationRate * 100).toFixed(1)}%.`,
      generatedAt: new Date().toISOString(),
    };
  }

  async runGovernanceAgent(period: { start: string; end: string }): Promise<AgentReport> {
    const findings: AgentFinding[] = [];
    const rows = await this.queryTable('cost_events', period);

    const hasClassification = rows.some((r) => r.classification != null);
    const hasTeamAttribution = rows.some((r) => r.team_id != null);

    if (!hasClassification && rows.length > 10) {
      findings.push({
        agentId: 'agent-governance',
        agentName: 'Governance Agent',
        type: 'compliance',
        severity: 'warning',
        title: 'Spend classification not configured',
        description: 'AI spend is not classified — makes governance reporting incomplete',
        recommendation: 'Enable automatic spend classification via the TokenOps classifier',
        estimatedImpact: 0,
        createdAt: new Date().toISOString(),
      });
    }

    if (!hasTeamAttribution && rows.length > 10) {
      findings.push({
        agentId: 'agent-governance',
        agentName: 'Governance Agent',
        type: 'compliance',
        severity: 'info',
        title: 'No team cost attribution',
        description: 'Cost events lack team_id — unable to produce per-team reports',
        recommendation: 'Configure team tagging in telemetry integration',
        estimatedImpact: 0,
        createdAt: new Date().toISOString(),
      });
    }

    if (findings.length === 0) {
      findings.push({
        agentId: 'agent-governance',
        agentName: 'Governance Agent',
        type: 'compliance',
        severity: 'info',
        title: 'Governance posture is healthy',
        description: 'Classification and team attribution are configured',
        recommendation: 'Continue monitoring policy compliance',
        estimatedImpact: 0,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      agentId: 'agent-governance',
      agentName: 'Governance Agent',
      findings,
      summary: `Reviewed ${rows.length} events. ${findings.length} governance finding(s).`,
      generatedAt: new Date().toISOString(),
    };
  }

  async runExecutiveReportAgent(period: { start: string; end: string }): Promise<AgentReport> {
    // Compose insights from all other agents
    const [tokenAudit, promptAudit, memoryAudit, governanceAudit] = await Promise.all([
      this.runTokenAuditor(period),
      this.runPromptArchitect(period),
      this.runMemoryArchitect(period),
      this.runGovernanceAgent(period),
    ]);

    const allFindings = [
      ...tokenAudit.findings,
      ...promptAudit.findings,
      ...memoryAudit.findings,
      ...governanceAudit.findings,
    ];

    const critical = allFindings.filter((f) => f.severity === 'critical');
    const warnings = allFindings.filter((f) => f.severity === 'warning');
    const totalImpact = allFindings.reduce((s, f) => s + f.estimatedImpact, 0);

    const executiveFindings: AgentFinding[] = [
      {
        agentId: 'agent-executive-report',
        agentName: 'Executive Report Agent',
        type: 'report',
        severity: critical.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'info',
        title: 'Executive Summary',
        description: [
          `${allFindings.length} findings across 4 agents`,
          critical.length > 0 ? `${critical.length} critical issue(s)` : null,
          warnings.length > 0 ? `${warnings.length} warning(s)` : null,
          totalImpact > 0 ? `Estimated optimization potential: $${totalImpact.toFixed(2)}` : null,
        ].filter(Boolean).join('. '),
        recommendation: critical.length > 0
          ? 'Address critical findings immediately'
          : warnings.length > 0
            ? 'Review and prioritize warnings'
            : 'Operations are healthy — maintain current practices',
        estimatedImpact: totalImpact,
        createdAt: new Date().toISOString(),
      },
    ];

    return {
      agentId: 'agent-executive-report',
      agentName: 'Executive Report Agent',
      findings: executiveFindings,
      summary: [
        tokenAudit.summary,
        promptAudit.summary,
        memoryAudit.summary,
        governanceAudit.summary,
      ].join(' | '),
      generatedAt: new Date().toISOString(),
    };
  }

  async getAllFindings(): Promise<AgentFinding[]> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600_000);
    const period = {
      start: thirtyDaysAgo.toISOString(),
      end: now.toISOString(),
    };

    const reports = await Promise.all([
      this.runTokenAuditor(period),
      this.runPromptArchitect(period),
      this.runMemoryArchitect(period),
      this.runGovernanceAgent(period),
    ]);

    return reports.flatMap((r) => r.findings);
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
        if (!ts) return true; // include rows without timestamp
        return ts >= period.start && ts <= period.end;
      });
    } catch {
      return [];
    }
  }
}

let _service: AgentSwarmService | null = null;

export function getAgentSwarmService(): AgentSwarmService {
  if (!_service) _service = new AgentSwarmService();
  return _service;
}
