/**
 * Knowledge Graph Types for TokenOps
 *
 * Covers GitHub Issues:
 *  #28 — Knowledge Entity Management
 *  #29 — Knowledge Insight Discovery
 *  #30 — Knowledge Entity Search
 */

// ---------------------------------------------------------------------------
// Entity Types
// ---------------------------------------------------------------------------

export type KnowledgeEntityType =
  | 'person'
  | 'project'
  | 'system'
  | 'prompt'
  | 'workflow';

export interface KnowledgeEntity {
  id: string;
  type: KnowledgeEntityType;
  name: string;
  metadata: Record<string, unknown>;
  connections: string[]; // entity IDs
}

export type CreateEntityInput = Omit<KnowledgeEntity, 'id'>;

// ---------------------------------------------------------------------------
// Insight Types
// ---------------------------------------------------------------------------

export type InsightType =
  | 'duplicate_work'
  | 'hidden_expertise'
  | 'workflow_overlap';

export interface KnowledgeInsight {
  type: InsightType;
  title: string;
  description: string;
  entities: string[];
  confidence: number;
  recommendation: string;
}
