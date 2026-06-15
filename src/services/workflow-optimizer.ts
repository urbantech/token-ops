/**
 * Workflow Optimization Service for TokenOps
 *
 * Analyzes agent workflow patterns from ZeroDB to identify
 * duplicated, inefficient, and tool-heavy workflows.
 *
 * Covers GitHub Issues:
 *  #27 — Workflow Optimization (Feature 8.2)
 */

import type {
  WorkflowAnalysis,
  DuplicatedWorkflow,
  InefficientWorkflow,
  ExcessiveToolCall,
  WorkflowEvent,
} from '@/types/workflow';

// ---------------------------------------------------------------------------
// Data client interface (abstracted for testability)
// ---------------------------------------------------------------------------

export interface WorkflowDataClient {
  queryAgentEvents(params: {
    eventType?: string;
    startTime: string;
    endTime: string;
    limit?: number;
  }): Promise<{ events: WorkflowEvent[]; total: number }>;
}

// ---------------------------------------------------------------------------
// Configuration thresholds
// ---------------------------------------------------------------------------

const HIGH_TOKEN_THRESHOLD = 25000;
const HIGH_DURATION_THRESHOLD = 30000; // 30 seconds
const EXCESSIVE_TOOL_CALL_THRESHOLD = 10;
const SIMILARITY_THRESHOLD = 0.5;
const ESTIMATED_WASTE_PER_DUPLICATE = 5000; // tokens

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WorkflowOptimizerService {
  constructor(private readonly client: WorkflowDataClient) {}

  /**
   * Analyze workflows within a time range for duplicates,
   * inefficiencies, and excessive tool usage.
   */
  async analyzeWorkflows(timeRange: {
    start: string;
    end: string;
  }): Promise<WorkflowAnalysis> {
    const { events } = await this.client.queryAgentEvents({
      eventType: 'agent_execution',
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: 1000,
    });

    if (events.length === 0) {
      return {
        totalWorkflows: 0,
        duplicatedWorkflows: [],
        inefficientWorkflows: [],
        excessiveToolCalls: [],
        recommendations: [],
      };
    }

    // Group events by workflow name
    const grouped = this.groupByWorkflow(events);
    const workflowNames = Object.keys(grouped);

    const duplicatedWorkflows = this.findDuplicates(workflowNames);
    const inefficientWorkflows = this.findInefficient(grouped);
    const excessiveToolCalls = this.findExcessiveToolCalls(grouped);
    const recommendations = this.generateRecommendations(
      duplicatedWorkflows,
      inefficientWorkflows,
      excessiveToolCalls
    );

    return {
      totalWorkflows: workflowNames.length,
      duplicatedWorkflows,
      inefficientWorkflows,
      excessiveToolCalls,
      recommendations,
    };
  }

  /**
   * Compare workflow names pairwise for similarity using
   * Levenshtein-based normalized distance.
   */
  findDuplicates(workflows: string[]): DuplicatedWorkflow[] {
    if (workflows.length < 2) return [];

    const results: DuplicatedWorkflow[] = [];

    for (let i = 0; i < workflows.length; i++) {
      for (let j = i + 1; j < workflows.length; j++) {
        const similarity = this.calculateSimilarity(
          workflows[i],
          workflows[j]
        );
        if (similarity >= SIMILARITY_THRESHOLD) {
          results.push({
            workflowA: workflows[i],
            workflowB: workflows[j],
            similarity,
            estimatedWaste: Math.round(
              similarity * ESTIMATED_WASTE_PER_DUPLICATE
            ),
          });
        }
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private groupByWorkflow(
    events: WorkflowEvent[]
  ): Record<string, WorkflowEvent[]> {
    const map: Record<string, WorkflowEvent[]> = {};
    for (const evt of events) {
      const key = evt.workflowName;
      if (!map[key]) map[key] = [];
      map[key].push(evt);
    }
    return map;
  }

  private findInefficient(
    grouped: Record<string, WorkflowEvent[]>
  ): InefficientWorkflow[] {
    const results: InefficientWorkflow[] = [];

    for (const [name, events] of Object.entries(grouped)) {
      const avgTokens = this.average(events.map((e) => e.totalTokens));
      const avgDuration = this.average(events.map((e) => e.durationMs));

      // Score: normalized sum of token and duration overages (0-100)
      const tokenScore = Math.min(
        (avgTokens / HIGH_TOKEN_THRESHOLD) * 50,
        50
      );
      const durationScore = Math.min(
        (avgDuration / HIGH_DURATION_THRESHOLD) * 50,
        50
      );
      const inefficiencyScore = Math.round(tokenScore + durationScore);

      if (inefficiencyScore > 50) {
        const suggestions: string[] = [];
        if (avgTokens > HIGH_TOKEN_THRESHOLD) {
          suggestions.push('Reduce prompt size or split into sub-workflows');
        }
        if (avgDuration > HIGH_DURATION_THRESHOLD) {
          suggestions.push('Optimize tool call chains to reduce latency');
        }

        results.push({
          workflow: name,
          avgTokens: Math.round(avgTokens),
          avgDuration: Math.round(avgDuration),
          inefficiencyScore,
          suggestion:
            suggestions.join('; ') ||
            'Consider reviewing workflow for optimization opportunities',
        });
      }
    }

    return results.sort((a, b) => b.inefficiencyScore - a.inefficiencyScore);
  }

  private findExcessiveToolCalls(
    grouped: Record<string, WorkflowEvent[]>
  ): ExcessiveToolCall[] {
    const results: ExcessiveToolCall[] = [];

    for (const [name, events] of Object.entries(grouped)) {
      const avgToolCount = this.average(
        events.map((e) => e.tools.length)
      );
      const avgTokens = this.average(events.map((e) => e.totalTokens));

      if (avgToolCount >= EXCESSIVE_TOOL_CALL_THRESHOLD) {
        results.push({
          workflow: name,
          toolCallCount: Math.round(avgToolCount),
          avgTokensPerCall:
            avgToolCount > 0
              ? Math.round(avgTokens / avgToolCount)
              : 0,
          suggestion: `Reduce tool calls from ${Math.round(avgToolCount)} to under ${EXCESSIVE_TOOL_CALL_THRESHOLD} by consolidating related operations`,
        });
      }
    }

    return results.sort((a, b) => b.toolCallCount - a.toolCallCount);
  }

  private generateRecommendations(
    duplicated: DuplicatedWorkflow[],
    inefficient: InefficientWorkflow[],
    excessive: ExcessiveToolCall[]
  ): string[] {
    const recs: string[] = [];

    if (duplicated.length > 0) {
      recs.push(
        `Consolidate ${duplicated.length} similar workflow pair(s) to eliminate redundant token usage`
      );
    }
    if (inefficient.length > 0) {
      recs.push(
        `Optimize ${inefficient.length} high-cost workflow(s) exceeding token/duration thresholds`
      );
    }
    if (excessive.length > 0) {
      recs.push(
        `Reduce tool call count in ${excessive.length} workflow(s) to lower per-call overhead`
      );
    }

    return recs;
  }

  /**
   * Normalized Levenshtein similarity (0 = totally different, 1 = identical).
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - this.levenshteinDistance(a, b) / maxLen;
  }

  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      Array(n + 1).fill(0)
    );

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[m][n];
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

import { getZeroDBClient } from '@/lib/zerodb-client';

let _service: WorkflowOptimizerService | null = null;

/**
 * Get (or create) the shared WorkflowOptimizerService instance.
 */
export function getWorkflowOptimizerService(): WorkflowOptimizerService {
  if (!_service) {
    const zerodb = getZeroDBClient();
    const client: WorkflowDataClient = {
      async queryAgentEvents(params) {
        const result = await zerodb.listEvents({
          eventType: params.eventType,
          startTime: params.startTime,
          endTime: params.endTime,
          limit: params.limit,
        });
        return {
          events: result.events.map((e) => ({
            id: e.id,
            workflowId: (e.payload.workflowId as string) ?? '',
            workflowName: (e.payload.workflowName as string) ?? '',
            agentId: (e.payload.agentId as string) ?? '',
            tools: (e.payload.tools as string[]) ?? [],
            durationMs: (e.payload.durationMs as number) ?? 0,
            totalTokens: (e.payload.totalTokens as number) ?? 0,
            promptTokens: (e.payload.promptTokens as number) ?? 0,
            completionTokens: (e.payload.completionTokens as number) ?? 0,
            status: (e.payload.status as 'success' | 'error' | 'timeout') ?? 'success',
            timestamp: e.createdAt,
          })),
          total: result.total,
        };
      },
    };
    _service = new WorkflowOptimizerService(client);
  }
  return _service;
}
