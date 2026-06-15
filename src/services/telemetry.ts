/**
 * Telemetry Collection Service
 *
 * Issues:
 *  #7  — Prompt Event Collection
 *  #8  — Agent Execution Collection
 *  #9  — Cost Event Collection
 *
 * All events are stored in ZeroDB tables via the zerodb-client.
 * Each event is also emitted as a ZeroDB event for real-time consumers.
 */

import { randomUUID } from 'crypto';
import { getZeroDBClient, ZeroDBClient } from '../lib/zerodb-client';
import { classifyTokenEvent } from './classifier';
import {
  PromptEvent,
  AgentExecution,
  CostEvent,
  Classification,
} from '../types/telemetry';

// ---------------------------------------------------------------------------
// Table names
// ---------------------------------------------------------------------------

const TABLE_PROMPT_EVENTS = 'prompt_events';
const TABLE_AGENT_EXECUTIONS = 'agent_executions';
const TABLE_COST_EVENTS = 'cost_events';

// ---------------------------------------------------------------------------
// Table schema initialization
// ---------------------------------------------------------------------------

let tablesInitialized = false;

async function ensureTables(client: ZeroDBClient): Promise<void> {
  if (tablesInitialized) return;

  try {
    await Promise.all([
      client.createTable({
        tableName: TABLE_PROMPT_EVENTS,
        columns: [
          { name: 'id', type: 'string', nullable: false },
          { name: 'prompt', type: 'string', nullable: false },
          { name: 'model', type: 'string', nullable: false },
          { name: 'provider', type: 'string', nullable: false },
          { name: 'prompt_tokens', type: 'integer', nullable: false },
          { name: 'completion_tokens', type: 'integer', nullable: false },
          { name: 'total_tokens', type: 'integer', nullable: false },
          { name: 'user_id', type: 'string', nullable: false },
          { name: 'team_id', type: 'string', nullable: true },
          { name: 'agent_id', type: 'string', nullable: true },
          { name: 'session_id', type: 'string', nullable: true },
          { name: 'classification', type: 'string', nullable: true },
          { name: 'cost_usd', type: 'float', nullable: true },
          { name: 'latency_ms', type: 'integer', nullable: true },
          { name: 'metadata', type: 'json', nullable: true },
          { name: 'timestamp', type: 'timestamp', nullable: false },
        ],
      }),
      client.createTable({
        tableName: TABLE_AGENT_EXECUTIONS,
        columns: [
          { name: 'id', type: 'string', nullable: false },
          { name: 'agent_id', type: 'string', nullable: false },
          { name: 'agent_name', type: 'string', nullable: false },
          { name: 'workflow_id', type: 'string', nullable: true },
          { name: 'workflow_name', type: 'string', nullable: true },
          { name: 'tools', type: 'json', nullable: true },
          { name: 'duration_ms', type: 'integer', nullable: false },
          { name: 'output_size_bytes', type: 'integer', nullable: false },
          { name: 'token_cost', type: 'float', nullable: false },
          { name: 'prompt_tokens', type: 'integer', nullable: false },
          { name: 'completion_tokens', type: 'integer', nullable: false },
          { name: 'total_tokens', type: 'integer', nullable: false },
          { name: 'model', type: 'string', nullable: false },
          { name: 'provider', type: 'string', nullable: false },
          { name: 'user_id', type: 'string', nullable: false },
          { name: 'team_id', type: 'string', nullable: true },
          { name: 'parent_execution_id', type: 'string', nullable: true },
          { name: 'status', type: 'string', nullable: false },
          { name: 'error', type: 'string', nullable: true },
          { name: 'metadata', type: 'json', nullable: true },
          { name: 'timestamp', type: 'timestamp', nullable: false },
        ],
      }),
      client.createTable({
        tableName: TABLE_COST_EVENTS,
        columns: [
          { name: 'id', type: 'string', nullable: false },
          { name: 'model_cost', type: 'float', nullable: false },
          { name: 'provider_cost', type: 'float', nullable: false },
          { name: 'workflow_cost', type: 'float', nullable: false },
          { name: 'team_cost', type: 'float', nullable: false },
          { name: 'total_cost', type: 'float', nullable: false },
          { name: 'currency', type: 'string', nullable: false },
          { name: 'model', type: 'string', nullable: false },
          { name: 'provider', type: 'string', nullable: false },
          { name: 'user_id', type: 'string', nullable: false },
          { name: 'team_id', type: 'string', nullable: true },
          { name: 'agent_id', type: 'string', nullable: true },
          { name: 'workflow_id', type: 'string', nullable: true },
          { name: 'prompt_tokens', type: 'integer', nullable: false },
          { name: 'completion_tokens', type: 'integer', nullable: false },
          { name: 'total_tokens', type: 'integer', nullable: false },
          { name: 'classification', type: 'string', nullable: true },
          { name: 'metadata', type: 'json', nullable: true },
          { name: 'timestamp', type: 'timestamp', nullable: false },
        ],
      }),
    ]);

    tablesInitialized = true;
  } catch (error: unknown) {
    // Tables may already exist — that is acceptable
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('already exists')) {
      console.error('Failed to initialize telemetry tables:', message);
      throw error;
    }
    tablesInitialized = true;
  }
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class TelemetryService {
  private client: ZeroDBClient;

  constructor(client?: ZeroDBClient) {
    this.client = client ?? getZeroDBClient();
  }

  /**
   * Ensure the backing tables exist. Idempotent.
   */
  async initialize(): Promise<void> {
    await ensureTables(this.client);
  }

  // -----------------------------------------------------------------------
  // Prompt Events (Issue #7)
  // -----------------------------------------------------------------------

  async recordPromptEvent(event: PromptEvent): Promise<PromptEvent> {
    await this.initialize();

    const id = event.id ?? randomUUID();
    const timestamp = event.timestamp ?? new Date().toISOString();

    // Auto-classify if not already classified
    const classification =
      event.classification ?? classifyTokenEvent(event.prompt).classification;

    const row: Record<string, unknown> = {
      id,
      prompt: event.prompt,
      model: event.model,
      provider: event.provider,
      prompt_tokens: event.promptTokens,
      completion_tokens: event.completionTokens,
      total_tokens: event.totalTokens,
      user_id: event.userId,
      team_id: event.teamId ?? null,
      agent_id: event.agentId ?? null,
      session_id: event.sessionId ?? null,
      classification,
      cost_usd: event.costUsd ?? null,
      latency_ms: event.latencyMs ?? null,
      metadata: event.metadata ?? null,
      timestamp,
    };

    // Persist to table
    await this.client.insertRows({
      tableName: TABLE_PROMPT_EVENTS,
      rows: [row],
    });

    // Emit event for real-time consumers
    await this.client.createEvent({
      eventType: 'telemetry.prompt',
      payload: row,
      metadata: { classification, model: event.model },
    });

    return { ...event, id, timestamp, classification };
  }

  // -----------------------------------------------------------------------
  // Agent Executions (Issue #8)
  // -----------------------------------------------------------------------

  async recordAgentExecution(event: AgentExecution): Promise<AgentExecution> {
    await this.initialize();

    const id = event.id ?? randomUUID();
    const timestamp = event.timestamp ?? new Date().toISOString();

    const row: Record<string, unknown> = {
      id,
      agent_id: event.agentId,
      agent_name: event.agentName,
      workflow_id: event.workflowId ?? null,
      workflow_name: event.workflowName ?? null,
      tools: event.tools,
      duration_ms: event.durationMs,
      output_size_bytes: event.outputSizeBytes,
      token_cost: event.tokenCost,
      prompt_tokens: event.promptTokens,
      completion_tokens: event.completionTokens,
      total_tokens: event.totalTokens,
      model: event.model,
      provider: event.provider,
      user_id: event.userId,
      team_id: event.teamId ?? null,
      parent_execution_id: event.parentExecutionId ?? null,
      status: event.status,
      error: event.error ?? null,
      metadata: event.metadata ?? null,
      timestamp,
    };

    await this.client.insertRows({
      tableName: TABLE_AGENT_EXECUTIONS,
      rows: [row],
    });

    await this.client.createEvent({
      eventType: 'telemetry.agent_execution',
      payload: row,
      metadata: { agentId: event.agentId, status: event.status },
    });

    return { ...event, id, timestamp };
  }

  // -----------------------------------------------------------------------
  // Cost Events (Issue #9)
  // -----------------------------------------------------------------------

  async recordCostEvent(event: CostEvent): Promise<CostEvent> {
    await this.initialize();

    const id = event.id ?? randomUUID();
    const timestamp = event.timestamp ?? new Date().toISOString();
    const classification = event.classification ?? Classification.BRAINSTORMING;

    const row: Record<string, unknown> = {
      id,
      model_cost: event.modelCost,
      provider_cost: event.providerCost,
      workflow_cost: event.workflowCost,
      team_cost: event.teamCost,
      total_cost: event.totalCost,
      currency: event.currency,
      model: event.model,
      provider: event.provider,
      user_id: event.userId,
      team_id: event.teamId ?? null,
      agent_id: event.agentId ?? null,
      workflow_id: event.workflowId ?? null,
      prompt_tokens: event.promptTokens,
      completion_tokens: event.completionTokens,
      total_tokens: event.totalTokens,
      classification,
      metadata: event.metadata ?? null,
      timestamp,
    };

    await this.client.insertRows({
      tableName: TABLE_COST_EVENTS,
      rows: [row],
    });

    await this.client.createEvent({
      eventType: 'telemetry.cost',
      payload: row,
      metadata: { totalCost: event.totalCost, model: event.model },
    });

    return { ...event, id, timestamp, classification };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _service: TelemetryService | null = null;

export function getTelemetryService(): TelemetryService {
  if (!_service) {
    _service = new TelemetryService();
  }
  return _service;
}

/**
 * Reset the module-level table initialization flag.
 * Exposed only for test isolation — do not call in production code.
 */
export function _resetTablesInitialized(): void {
  tablesInitialized = false;
}
