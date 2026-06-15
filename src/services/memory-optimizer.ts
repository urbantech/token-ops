/**
 * Memory Optimization Service for TokenOps
 *
 * Ports deduplication and analytics patterns from the Python
 * ZeroDBMemoryService (core/src/backend/app/services/zerodb_memory_service.py)
 * and the JS MemoryManager (core/zerodb-memory-mcp/src/utils/memory-manager.js)
 * into a TypeScript service that the Next.js API routes consume.
 *
 * Covers GitHub Issues:
 *  #17 — Duplicate Request Detection
 *  #18 — Memory Reuse Recommendations
 */

import type {
  DuplicateDetectionResult,
  MemoryReuseRecommendation,
  MemoryStats,
  RepeatedQuery,
  RepeatedWorkflow,
  CategoryStat,
  SavingsProjectionItem,
  MemoryCategory,
} from '@/types/memory';

// ---------------------------------------------------------------------------
// ZeroDB vector-search response shapes (subset)
// ---------------------------------------------------------------------------

interface VectorSearchHit {
  id: string;
  content?: string;
  document?: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

interface VectorSearchResponse {
  results: VectorSearchHit[];
  count: number;
}

interface MemoryListItem {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// ZeroDB client interface (minimal contract for this service)
// ---------------------------------------------------------------------------

export interface ZeroDBMemoryClient {
  /** Semantic vector search */
  searchVectors(params: {
    text: string;
    limit?: number;
    filter?: Record<string, unknown> | null;
  }): Promise<VectorSearchResponse>;

  /** List all stored memories (paginated) */
  listMemories(params: {
    limit?: number;
    offset?: number;
  }): Promise<{ memories: MemoryListItem[]; total: number }>;

  /** Store a memory */
  storeMemory(params: {
    content: string;
    role?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MemoryOptimizerService {
  private client: ZeroDBMemoryClient;
  private defaultThreshold: number;

  constructor(client: ZeroDBMemoryClient, defaultThreshold = 0.85) {
    this.client = client;
    this.defaultThreshold = defaultThreshold;
  }

  // -----------------------------------------------------------------------
  // Issue #17 — Duplicate Request Detection
  // -----------------------------------------------------------------------

  /**
   * Determine whether `query` is a duplicate of an existing memory.
   *
   * Uses ZeroDB vector search to find the closest match and compares
   * the similarity score against the provided (or default) threshold.
   */
  async detectDuplicateRequests(
    query: string,
    threshold?: number
  ): Promise<DuplicateDetectionResult> {
    const effectiveThreshold = threshold ?? this.defaultThreshold;

    try {
      const response = await this.client.searchVectors({
        text: query,
        limit: 1,
        filter: null,
      });

      if (!response.results || response.results.length === 0) {
        return {
          isDuplicate: false,
          confidence: 0,
          priorAnswer: null,
          memoryReference: null,
          tokensSaved: 0,
        };
      }

      const topHit = response.results[0];
      const similarity = topHit.similarity ?? 0;
      const isDuplicate = similarity >= effectiveThreshold;

      const priorContent =
        topHit.content || topHit.document || null;

      // Estimate tokens saved: ~4 chars per token for both the prior
      // answer and the query that would have been re-processed.
      const tokensSaved = isDuplicate && priorContent
        ? Math.ceil(priorContent.length / 4) + Math.ceil(query.length / 4)
        : 0;

      return {
        isDuplicate,
        confidence: similarity,
        priorAnswer: isDuplicate ? priorContent : null,
        memoryReference: isDuplicate ? topHit.id : null,
        tokensSaved,
      };
    } catch {
      // On any ZeroDB error, fail open — treat as non-duplicate
      return {
        isDuplicate: false,
        confidence: 0,
        priorAnswer: null,
        memoryReference: null,
        tokensSaved: 0,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Issue #18 — Memory Reuse Recommendations
  // -----------------------------------------------------------------------

  /**
   * Analyze stored memories to identify duplicate queries, repeated
   * research topics, and repeated workflow patterns, and project
   * potential token savings.
   */
  async getMemoryReuseRecommendations(
    timeRange: '24h' | '7d' | '30d' | '90d' = '7d'
  ): Promise<MemoryReuseRecommendation> {
    try {
      const allMemories = await this.fetchMemoriesForRange(timeRange);

      // Cluster similar memories by content similarity
      const duplicateQueries = this.clusterDuplicateQueries(allMemories);
      const repeatedResearch = this.identifyRepeatedResearch(allMemories);
      const repeatedWorkflows = this.identifyRepeatedWorkflows(allMemories);

      const totalPotentialSavings =
        duplicateQueries.reduce((s, q) => s + q.potentialSavings, 0) +
        repeatedResearch.reduce((s, q) => s + q.potentialSavings, 0) +
        repeatedWorkflows.reduce(
          (s, w) => s + w.avgCost * Math.max(0, w.frequency - 1),
          0
        );

      return {
        duplicateQueries,
        repeatedResearch,
        repeatedWorkflows,
        totalPotentialSavings,
      };
    } catch {
      return {
        duplicateQueries: [],
        repeatedResearch: [],
        repeatedWorkflows: [],
        totalPotentialSavings: 0,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Memory Stats
  // -----------------------------------------------------------------------

  /**
   * Return high-level memory usage statistics.
   */
  async getMemoryStats(): Promise<MemoryStats> {
    try {
      const { memories, total } = await this.client.listMemories({
        limit: 10_000,
        offset: 0,
      });

      const categoryMap: Record<string, number> = {};
      let totalTokensConsumed = 0;
      let totalTokensSaved = 0;
      let duplicateCount = 0;
      let totalConfidence = 0;

      for (const mem of memories) {
        // Category counts
        const cat =
          (mem.metadata?.category as string) || 'conversation';
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;

        // Token accounting
        const tokens = Math.ceil(mem.content.length / 4);
        totalTokensConsumed += tokens;

        // Duplicate tracking from metadata
        if (mem.metadata?.is_duplicate) {
          duplicateCount += 1;
          totalTokensSaved += tokens;
          totalConfidence +=
            (mem.metadata?.duplicate_confidence as number) || 0;
        }
      }

      const reuseRate =
        total > 0 ? (duplicateCount / total) * 100 : 0;
      const avgConfidence =
        duplicateCount > 0 ? totalConfidence / duplicateCount : 0;

      const topCategories: CategoryStat[] = Object.entries(categoryMap)
        .map(([category, count]) => ({
          category: category as MemoryCategory,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      return {
        totalMemories: total,
        reuseRate: Math.round(reuseRate * 100) / 100,
        avgConfidence: Math.round(avgConfidence * 1000) / 1000,
        topCategories,
        totalTokensSaved,
        totalTokensConsumed,
      };
    } catch {
      return {
        totalMemories: 0,
        reuseRate: 0,
        avgConfidence: 0,
        topCategories: [],
        totalTokensSaved: 0,
        totalTokensConsumed: 0,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Savings Projection
  // -----------------------------------------------------------------------

  /**
   * Project per-category savings if all recommendations are implemented.
   */
  async getSavingsProjection(
    timeRange: '24h' | '7d' | '30d' | '90d' = '7d'
  ): Promise<SavingsProjectionItem[]> {
    const recs = await this.getMemoryReuseRecommendations(timeRange);

    const items: SavingsProjectionItem[] = [];

    if (recs.duplicateQueries.length > 0) {
      const wasted = recs.duplicateQueries.reduce(
        (s, q) => s + q.tokensConsumed,
        0
      );
      const saved = recs.duplicateQueries.reduce(
        (s, q) => s + q.potentialSavings,
        0
      );
      items.push({ label: 'Duplicate Queries', wasted, saved });
    }

    if (recs.repeatedResearch.length > 0) {
      const wasted = recs.repeatedResearch.reduce(
        (s, q) => s + q.tokensConsumed,
        0
      );
      const saved = recs.repeatedResearch.reduce(
        (s, q) => s + q.potentialSavings,
        0
      );
      items.push({ label: 'Repeated Research', wasted, saved });
    }

    if (recs.repeatedWorkflows.length > 0) {
      const wasted = recs.repeatedWorkflows.reduce(
        (s, w) => s + w.totalCost,
        0
      );
      const saved = recs.repeatedWorkflows.reduce(
        (s, w) => s + w.avgCost * Math.max(0, w.frequency - 1),
        0
      );
      items.push({ label: 'Repeated Workflows', wasted, saved });
    }

    return items;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Fetch memories that fall within the requested time range.
   */
  private async fetchMemoriesForRange(
    timeRange: '24h' | '7d' | '30d' | '90d'
  ): Promise<MemoryListItem[]> {
    const msMap: Record<string, number> = {
      '24h': 86_400_000,
      '7d': 604_800_000,
      '30d': 2_592_000_000,
      '90d': 7_776_000_000,
    };
    const cutoff = Date.now() - (msMap[timeRange] ?? msMap['7d']);

    const { memories } = await this.client.listMemories({
      limit: 10_000,
      offset: 0,
    });

    return memories.filter((m) => {
      if (!m.created_at) return true; // include if no timestamp
      return new Date(m.created_at).getTime() >= cutoff;
    });
  }

  /**
   * Cluster memories with identical or near-identical content.
   * Uses a simple content-hash clustering: exact duplicates are grouped,
   * then each group is scored.
   */
  private clusterDuplicateQueries(
    memories: MemoryListItem[]
  ): RepeatedQuery[] {
    const hashMap = new Map<string, MemoryListItem[]>();

    for (const mem of memories) {
      const normalized = mem.content.trim().toLowerCase();
      const key = normalized.slice(0, 200); // coarse grouping key
      const group = hashMap.get(key) || [];
      group.push(mem);
      hashMap.set(key, group);
    }

    const results: RepeatedQuery[] = [];

    for (const [, group] of hashMap) {
      if (group.length < 2) continue;

      const tokensPerItem = Math.ceil(group[0].content.length / 4);
      const tokensConsumed = tokensPerItem * group.length;
      // If cached, only the first invocation costs tokens
      const potentialSavings = tokensPerItem * (group.length - 1);

      results.push({
        query: group[0].content.slice(0, 120),
        frequency: group.length,
        tokensConsumed,
        potentialSavings,
        avgSimilarity: 1.0, // exact matches
      });
    }

    return results.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Identify topics researched multiple times by looking at
   * memories tagged as "knowledge" or "context".
   */
  private identifyRepeatedResearch(
    memories: MemoryListItem[]
  ): RepeatedQuery[] {
    const researchMemories = memories.filter((m) => {
      const cat = (m.metadata?.category as string) || '';
      return ['knowledge', 'context', 'summary'].includes(cat);
    });

    // Group by a coarse topic key (first 100 chars, lowercased)
    const topicMap = new Map<string, MemoryListItem[]>();
    for (const mem of researchMemories) {
      const key = mem.content.trim().toLowerCase().slice(0, 100);
      const group = topicMap.get(key) || [];
      group.push(mem);
      topicMap.set(key, group);
    }

    const results: RepeatedQuery[] = [];
    for (const [, group] of topicMap) {
      if (group.length < 2) continue;
      const tokensPerItem = Math.ceil(group[0].content.length / 4);
      results.push({
        query: group[0].content.slice(0, 120),
        frequency: group.length,
        tokensConsumed: tokensPerItem * group.length,
        potentialSavings: tokensPerItem * (group.length - 1),
        avgSimilarity: 0.92,
      });
    }

    return results.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Identify repeated workflow patterns by looking at memories with
   * "task" or "instruction" categories.
   */
  private identifyRepeatedWorkflows(
    memories: MemoryListItem[]
  ): RepeatedWorkflow[] {
    const taskMemories = memories.filter((m) => {
      const cat = (m.metadata?.category as string) || '';
      return ['task', 'instruction'].includes(cat);
    });

    const workflowMap = new Map<string, MemoryListItem[]>();
    for (const mem of taskMemories) {
      const key = mem.content.trim().toLowerCase().slice(0, 80);
      const group = workflowMap.get(key) || [];
      group.push(mem);
      workflowMap.set(key, group);
    }

    const results: RepeatedWorkflow[] = [];
    for (const [, group] of workflowMap) {
      if (group.length < 2) continue;
      const avgTokens = Math.ceil(
        group.reduce((s, m) => s + m.content.length / 4, 0) / group.length
      );
      results.push({
        workflowName: group[0].content.slice(0, 60),
        frequency: group.length,
        avgCost: avgTokens,
        totalCost: avgTokens * group.length,
      });
    }

    return results.sort((a, b) => b.totalCost - a.totalCost);
  }
}
