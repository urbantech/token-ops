/**
 * Tests for Knowledge Graph Service
 * Refs #28 #29 #30
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  KnowledgeGraphService,
  KnowledgeGraphDataClient,
} from '../knowledge-graph';
import type {
  KnowledgeEntity,
  CreateEntityInput,
  KnowledgeInsight,
} from '../../types/knowledge';

// ---------------------------------------------------------------------------
// Mock client factory
// ---------------------------------------------------------------------------

function createMockClient(
  overrides?: Partial<KnowledgeGraphDataClient>
): KnowledgeGraphDataClient {
  return {
    queryEntities: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    insertEntity: vi.fn().mockResolvedValue({
      id: 'ent-new',
      type: 'person',
      name: 'Alice',
      metadata: {},
      connections: [],
    }),
    searchEntities: vi.fn().mockResolvedValue({ results: [], count: 0 }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Sample entities
// ---------------------------------------------------------------------------

const ALICE: KnowledgeEntity = {
  id: 'ent-1',
  type: 'person',
  name: 'Alice',
  metadata: { role: 'engineer' },
  connections: ['ent-2'],
};

const BOB: KnowledgeEntity = {
  id: 'ent-2',
  type: 'person',
  name: 'Bob',
  metadata: { role: 'engineer' },
  connections: ['ent-1'],
};

const PROJECT_A: KnowledgeEntity = {
  id: 'ent-3',
  type: 'project',
  name: 'Project Alpha',
  metadata: { status: 'active' },
  connections: ['ent-1', 'ent-2'],
};

const PROJECT_B: KnowledgeEntity = {
  id: 'ent-4',
  type: 'project',
  name: 'Project Alpha Clone',
  metadata: { status: 'active' },
  connections: ['ent-2'],
};

const WORKFLOW_A: KnowledgeEntity = {
  id: 'ent-5',
  type: 'workflow',
  name: 'deploy-pipeline',
  metadata: {},
  connections: ['ent-3'],
};

const WORKFLOW_B: KnowledgeEntity = {
  id: 'ent-6',
  type: 'workflow',
  name: 'deploy-pipeline-v2',
  metadata: {},
  connections: ['ent-4'],
};

// ---------------------------------------------------------------------------
// getEntities (Issue #28)
// ---------------------------------------------------------------------------

describe('KnowledgeGraphService.getEntities', () => {
  it('returns empty array when no entities exist', async () => {
    const client = createMockClient();
    const service = new KnowledgeGraphService(client);

    const result = await service.getEntities();

    expect(result).toEqual([]);
  });

  it('returns all entities when no type filter is given', async () => {
    const client = createMockClient({
      queryEntities: vi.fn().mockResolvedValue({
        rows: [ALICE, BOB, PROJECT_A],
        total: 3,
      }),
    });
    const service = new KnowledgeGraphService(client);

    const result = await service.getEntities();

    expect(result).toHaveLength(3);
  });

  it('passes type filter to the data client', async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValue({ rows: [ALICE, BOB], total: 2 });
    const client = createMockClient({ queryEntities: queryFn });
    const service = new KnowledgeGraphService(client);

    await service.getEntities('person');

    expect(queryFn).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'person' })
    );
  });
});

// ---------------------------------------------------------------------------
// addEntity (Issue #28)
// ---------------------------------------------------------------------------

describe('KnowledgeGraphService.addEntity', () => {
  it('creates an entity and returns it with an id', async () => {
    const insertFn = vi.fn().mockResolvedValue({
      id: 'ent-new',
      type: 'person',
      name: 'Charlie',
      metadata: { role: 'designer' },
      connections: [],
    });
    const client = createMockClient({ insertEntity: insertFn });
    const service = new KnowledgeGraphService(client);

    const input: CreateEntityInput = {
      type: 'person',
      name: 'Charlie',
      metadata: { role: 'designer' },
      connections: [],
    };

    const result = await service.addEntity(input);

    expect(result.id).toBe('ent-new');
    expect(result.name).toBe('Charlie');
    expect(result.type).toBe('person');
    expect(insertFn).toHaveBeenCalledWith(input);
  });

  it('validates entity input has required fields', async () => {
    const client = createMockClient();
    const service = new KnowledgeGraphService(client);

    // Missing name should throw
    await expect(
      service.addEntity({
        type: 'person',
        name: '',
        metadata: {},
        connections: [],
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// discoverInsights (Issue #29)
// ---------------------------------------------------------------------------

describe('KnowledgeGraphService.discoverInsights', () => {
  it('returns empty insights when no entities exist', async () => {
    const client = createMockClient();
    const service = new KnowledgeGraphService(client);

    const result = await service.discoverInsights();

    expect(result).toEqual([]);
  });

  it('detects duplicate work among projects with similar names', async () => {
    const client = createMockClient({
      queryEntities: vi.fn().mockResolvedValue({
        rows: [ALICE, BOB, PROJECT_A, PROJECT_B, WORKFLOW_A, WORKFLOW_B],
        total: 6,
      }),
    });
    const service = new KnowledgeGraphService(client);

    const result = await service.discoverInsights();

    const duplicateInsight = result.find(
      (i) => i.type === 'duplicate_work'
    );
    expect(duplicateInsight).toBeDefined();
    expect(duplicateInsight!.confidence).toBeGreaterThan(0);
    expect(duplicateInsight!.recommendation).toBeTruthy();
  });

  it('detects hidden expertise from connection patterns', async () => {
    // Bob connects to many entities but is not explicitly recognized
    const busyBob: KnowledgeEntity = {
      ...BOB,
      connections: ['ent-1', 'ent-3', 'ent-4', 'ent-5', 'ent-6'],
    };
    const client = createMockClient({
      queryEntities: vi.fn().mockResolvedValue({
        rows: [ALICE, busyBob, PROJECT_A, PROJECT_B, WORKFLOW_A, WORKFLOW_B],
        total: 6,
      }),
    });
    const service = new KnowledgeGraphService(client);

    const result = await service.discoverInsights();

    const expertiseInsight = result.find(
      (i) => i.type === 'hidden_expertise'
    );
    expect(expertiseInsight).toBeDefined();
    expect(expertiseInsight!.entities).toContain('ent-2');
  });

  it('detects workflow overlap', async () => {
    const client = createMockClient({
      queryEntities: vi.fn().mockResolvedValue({
        rows: [WORKFLOW_A, WORKFLOW_B],
        total: 2,
      }),
    });
    const service = new KnowledgeGraphService(client);

    const result = await service.discoverInsights();

    const overlapInsight = result.find(
      (i) => i.type === 'workflow_overlap'
    );
    expect(overlapInsight).toBeDefined();
    expect(overlapInsight!.entities).toContain('ent-5');
    expect(overlapInsight!.entities).toContain('ent-6');
  });
});

// ---------------------------------------------------------------------------
// searchEntities (Issue #30)
// ---------------------------------------------------------------------------

describe('KnowledgeGraphService.searchEntities', () => {
  it('returns empty array for no search results', async () => {
    const client = createMockClient();
    const service = new KnowledgeGraphService(client);

    const result = await service.searchEntities('nonexistent');

    expect(result).toEqual([]);
  });

  it('returns matching entities from semantic search', async () => {
    const client = createMockClient({
      searchEntities: vi.fn().mockResolvedValue({
        results: [
          { id: 'ent-1', content: 'Alice', similarity: 0.95, metadata: ALICE },
        ],
        count: 1,
      }),
    });
    const service = new KnowledgeGraphService(client);

    const result = await service.searchEntities('Alice');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  it('passes query string to the search client', async () => {
    const searchFn = vi
      .fn()
      .mockResolvedValue({ results: [], count: 0 });
    const client = createMockClient({ searchEntities: searchFn });
    const service = new KnowledgeGraphService(client);

    await service.searchEntities('deploy pipeline');

    expect(searchFn).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'deploy pipeline' })
    );
  });
});
