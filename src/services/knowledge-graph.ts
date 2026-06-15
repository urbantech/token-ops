/**
 * Knowledge Graph Service for TokenOps
 *
 * Manages knowledge entities and discovers insights by analyzing
 * relationships between people, projects, systems, prompts, and workflows.
 *
 * Covers GitHub Issues:
 *  #28 — Knowledge Entity Management
 *  #29 — Knowledge Insight Discovery
 *  #30 — Knowledge Entity Search
 */

import type {
  KnowledgeEntity,
  CreateEntityInput,
  KnowledgeInsight,
  KnowledgeEntityType,
} from '@/types/knowledge';

// ---------------------------------------------------------------------------
// Data client interface (abstracted for testability)
// ---------------------------------------------------------------------------

interface VectorSearchHit {
  id: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeGraphDataClient {
  queryEntities(params: {
    type?: string;
    limit?: number;
  }): Promise<{ rows: KnowledgeEntity[]; total: number }>;

  insertEntity(
    input: CreateEntityInput
  ): Promise<KnowledgeEntity>;

  searchEntities(params: {
    query: string;
    limit?: number;
  }): Promise<{ results: VectorSearchHit[]; count: number }>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SIMILARITY_THRESHOLD = 0.5;
const HIGH_CONNECTION_THRESHOLD = 4;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class KnowledgeGraphService {
  constructor(private readonly client: KnowledgeGraphDataClient) {}

  /**
   * List entities, optionally filtered by type.
   * Refs #28
   */
  async getEntities(type?: string): Promise<KnowledgeEntity[]> {
    const result = await this.client.queryEntities({
      type,
      limit: 500,
    });
    return result.rows;
  }

  /**
   * Create a new knowledge entity.
   * Refs #28
   */
  async addEntity(input: CreateEntityInput): Promise<KnowledgeEntity> {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Entity name is required');
    }
    return this.client.insertEntity(input);
  }

  /**
   * Analyze the knowledge graph for actionable insights:
   * duplicate work, hidden expertise, and workflow overlap.
   * Refs #29
   */
  async discoverInsights(): Promise<KnowledgeInsight[]> {
    const { rows: entities } = await this.client.queryEntities({ limit: 1000 });

    if (entities.length === 0) return [];

    const insights: KnowledgeInsight[] = [];

    // Partition by type
    const byType = this.partitionByType(entities);

    // 1. Detect duplicate work among projects
    const projectDuplicates = this.detectDuplicateWork(
      byType.project ?? []
    );
    insights.push(...projectDuplicates);

    // 2. Detect hidden expertise (people with many connections)
    const expertise = this.detectHiddenExpertise(
      byType.person ?? [],
      entities
    );
    insights.push(...expertise);

    // 3. Detect workflow overlap
    const overlap = this.detectWorkflowOverlap(byType.workflow ?? []);
    insights.push(...overlap);

    return insights;
  }

  /**
   * Semantic search across knowledge entities.
   * Refs #30
   */
  async searchEntities(query: string): Promise<KnowledgeEntity[]> {
    const result = await this.client.searchEntities({
      query,
      limit: 20,
    });

    return result.results.map((hit) => {
      const meta = hit.metadata as unknown as KnowledgeEntity | undefined;
      if (meta && meta.id) {
        return meta;
      }
      // Fallback: construct entity from hit
      return {
        id: hit.id,
        type: 'system' as KnowledgeEntityType,
        name: hit.content,
        metadata: hit.metadata ?? {},
        connections: [],
      };
    });
  }

  // -------------------------------------------------------------------------
  // Private insight detection
  // -------------------------------------------------------------------------

  private partitionByType(
    entities: KnowledgeEntity[]
  ): Partial<Record<KnowledgeEntityType, KnowledgeEntity[]>> {
    const map: Partial<Record<KnowledgeEntityType, KnowledgeEntity[]>> = {};
    for (const entity of entities) {
      if (!map[entity.type]) map[entity.type] = [];
      map[entity.type]!.push(entity);
    }
    return map;
  }

  private detectDuplicateWork(
    projects: KnowledgeEntity[]
  ): KnowledgeInsight[] {
    if (projects.length < 2) return [];

    const insights: KnowledgeInsight[] = [];

    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const similarity = this.nameSimilarity(
          projects[i].name,
          projects[j].name
        );
        if (similarity >= SIMILARITY_THRESHOLD) {
          insights.push({
            type: 'duplicate_work',
            title: `Similar projects detected: ${projects[i].name} / ${projects[j].name}`,
            description: `These projects share ${Math.round(similarity * 100)}% name similarity and may represent duplicated effort`,
            entities: [projects[i].id, projects[j].id],
            confidence: similarity,
            recommendation:
              'Review these projects for overlapping scope and consider merging',
          });
        }
      }
    }

    return insights;
  }

  private detectHiddenExpertise(
    people: KnowledgeEntity[],
    _allEntities: KnowledgeEntity[]
  ): KnowledgeInsight[] {
    const insights: KnowledgeInsight[] = [];

    for (const person of people) {
      if (person.connections.length >= HIGH_CONNECTION_THRESHOLD) {
        insights.push({
          type: 'hidden_expertise',
          title: `Unrecognized expert: ${person.name}`,
          description: `${person.name} connects to ${person.connections.length} entities across the knowledge graph`,
          entities: [person.id],
          confidence: Math.min(
            person.connections.length / (HIGH_CONNECTION_THRESHOLD * 2),
            1
          ),
          recommendation: `Leverage ${person.name} for cross-team knowledge sharing and mentorship`,
        });
      }
    }

    return insights;
  }

  private detectWorkflowOverlap(
    workflows: KnowledgeEntity[]
  ): KnowledgeInsight[] {
    if (workflows.length < 2) return [];

    const insights: KnowledgeInsight[] = [];

    for (let i = 0; i < workflows.length; i++) {
      for (let j = i + 1; j < workflows.length; j++) {
        const similarity = this.nameSimilarity(
          workflows[i].name,
          workflows[j].name
        );
        if (similarity >= SIMILARITY_THRESHOLD) {
          insights.push({
            type: 'workflow_overlap',
            title: `Workflow overlap: ${workflows[i].name} / ${workflows[j].name}`,
            description: `These workflows share ${Math.round(similarity * 100)}% similarity and may be consolidatable`,
            entities: [workflows[i].id, workflows[j].id],
            confidence: similarity,
            recommendation:
              'Consolidate overlapping workflows to reduce maintenance burden and token waste',
          });
        }
      }
    }

    return insights;
  }

  /**
   * Normalized Levenshtein similarity (0 = different, 1 = identical).
   */
  private nameSimilarity(a: string, b: string): number {
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
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

import { getZeroDBClient } from '@/lib/zerodb-client';

let _service: KnowledgeGraphService | null = null;

/**
 * Get (or create) the shared KnowledgeGraphService instance.
 */
export function getKnowledgeGraphService(): KnowledgeGraphService {
  if (!_service) {
    const zerodb = getZeroDBClient();
    const client: KnowledgeGraphDataClient = {
      async queryEntities(params) {
        const result = await zerodb.queryRows({
          tableName: 'knowledge_entities',
          filters: params.type ? { type: params.type } : {},
          limit: params.limit ?? 500,
        });
        return {
          rows: result.rows.map((r) => ({
            id: r.id as string,
            type: r.type as KnowledgeEntityType,
            name: r.name as string,
            metadata: (r.metadata as Record<string, unknown>) ?? {},
            connections: (r.connections as string[]) ?? [],
          })),
          total: result.total,
        };
      },
      async insertEntity(input) {
        const result = await zerodb.insertRows({
          tableName: 'knowledge_entities',
          rows: [
            {
              type: input.type,
              name: input.name,
              metadata: input.metadata,
              connections: input.connections,
            },
          ],
        });
        const id =
          (result as Record<string, unknown>).id as string | undefined;
        return {
          id: id ?? crypto.randomUUID(),
          ...input,
        };
      },
      async searchEntities(params) {
        // Use ZeroDB semantic search via vector table
        const result = await zerodb.queryRows({
          tableName: 'knowledge_entities',
          filters: { name_search: params.query },
          limit: params.limit ?? 20,
        });
        return {
          results: result.rows.map((r) => ({
            id: r.id as string,
            content: r.name as string,
            similarity: 1.0,
            metadata: r as Record<string, unknown>,
          })),
          count: result.total,
        };
      },
    };
    _service = new KnowledgeGraphService(client);
  }
  return _service;
}
