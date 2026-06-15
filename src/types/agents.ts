/**
 * Types for Agent Swarm Operations (EPIC 12)
 */

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  status: 'active' | 'idle' | 'disabled';
}

export interface AgentFinding {
  agentId: string;
  agentName: string;
  type: 'cost' | 'optimization' | 'compliance' | 'memory' | 'report';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation: string;
  estimatedImpact: number;
  createdAt: string;
}

export interface AgentReport {
  agentId: string;
  agentName: string;
  findings: AgentFinding[];
  summary: string;
  generatedAt: string;
}

export interface SwarmStatus {
  agents: AgentDefinition[];
  totalFindings: number;
  criticalFindings: number;
  lastRunAt: string;
  nextRunAt: string;
}
