/**
 * Workflow Optimization Types for TokenOps
 *
 * Covers GitHub Issues:
 *  #27 — Workflow Optimization (Feature 8.2)
 */

// ---------------------------------------------------------------------------
// Workflow Analysis
// ---------------------------------------------------------------------------

export interface WorkflowAnalysis {
  totalWorkflows: number;
  duplicatedWorkflows: DuplicatedWorkflow[];
  inefficientWorkflows: InefficientWorkflow[];
  excessiveToolCalls: ExcessiveToolCall[];
  recommendations: string[];
}

export interface DuplicatedWorkflow {
  workflowA: string;
  workflowB: string;
  similarity: number; // 0-1
  estimatedWaste: number; // tokens
}

export interface InefficientWorkflow {
  workflow: string;
  avgTokens: number;
  avgDuration: number;
  inefficiencyScore: number; // 0-100
  suggestion: string;
}

export interface ExcessiveToolCall {
  workflow: string;
  toolCallCount: number;
  avgTokensPerCall: number;
  suggestion: string;
}

// ---------------------------------------------------------------------------
// Raw workflow event shape from ZeroDB
// ---------------------------------------------------------------------------

export interface WorkflowEvent {
  id: string;
  workflowId: string;
  workflowName: string;
  agentId: string;
  tools: string[];
  durationMs: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  status: 'success' | 'error' | 'timeout';
  timestamp: string;
}
