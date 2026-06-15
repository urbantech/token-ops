/**
 * Tests for Memory Optimization Service
 * Refs #17 #18
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryOptimizerService, ZeroDBMemoryClient } from '../memory-optimizer';

// ---------------------------------------------------------------------------
// Mock client factory
// ---------------------------------------------------------------------------

function createMockClient(overrides?: Partial<ZeroDBMemoryClient>): ZeroDBMemoryClient {
  return {
    searchVectors: vi.fn().mockResolvedValue({ results: [], count: 0 }),
    listMemories: vi.fn().mockResolvedValue({ memories: [], total: 0 }),
    storeMemory: vi.fn().mockResolvedValue({ id: 'mem-001' }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectDuplicateRequests (Issue #17)
// ---------------------------------------------------------------------------

describe('MemoryOptimizerService.detectDuplicateRequests', () => {
  it('returns non-duplicate when no results from vector search', async () => {
    const client = createMockClient();
    const service = new MemoryOptimizerService(client);

    const result = await service.detectDuplicateRequests('How do I deploy?');

    expect(result.isDuplicate).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.priorAnswer).toBeNull();
    expect(result.memoryReference).toBeNull();
    expect(result.tokensSaved).toBe(0);
  });

  it('returns non-duplicate when similarity is below threshold', async () => {
    const client = createMockClient({
      searchVectors: vi.fn().mockResolvedValue({
        results: [{ id: 'vec-1', content: 'Prior answer', similarity: 0.5 }],
        count: 1,
      }),
    });
    const service = new MemoryOptimizerService(client, 0.85);

    const result = await service.detectDuplicateRequests('How do I deploy?');

    expect(result.isDuplicate).toBe(false);
    expect(result.confidence).toBe(0.5);
  });

  it('returns duplicate when similarity exceeds threshold', async () => {
    const priorContent = 'Use the deploy command with the --prod flag to deploy to production.';
    const client = createMockClient({
      searchVectors: vi.fn().mockResolvedValue({
        results: [{ id: 'vec-2', content: priorContent, similarity: 0.92 }],
        count: 1,
      }),
    });
    const service = new MemoryOptimizerService(client, 0.85);

    const result = await service.detectDuplicateRequests('How do I deploy to production?');

    expect(result.isDuplicate).toBe(true);
    expect(result.confidence).toBe(0.92);
    expect(result.priorAnswer).toBe(priorContent);
    expect(result.memoryReference).toBe('vec-2');
    expect(result.tokensSaved).toBeGreaterThan(0);
  });

  it('uses custom threshold when provided', async () => {
    const client = createMockClient({
      searchVectors: vi.fn().mockResolvedValue({
        results: [{ id: 'vec-3', content: 'answer', similarity: 0.70 }],
        count: 1,
      }),
    });
    const service = new MemoryOptimizerService(client, 0.85);

    // With default threshold (0.85), not a duplicate
    const result1 = await service.detectDuplicateRequests('query');
    expect(result1.isDuplicate).toBe(false);

    // With custom threshold (0.60), is a duplicate
    const result2 = await service.detectDuplicateRequests('query', 0.60);
    expect(result2.isDuplicate).toBe(true);
  });

  it('fails open on client error', async () => {
    const client = createMockClient({
      searchVectors: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const service = new MemoryOptimizerService(client);

    const result = await service.detectDuplicateRequests('query');

    expect(result.isDuplicate).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('falls back to document field when content is missing', async () => {
    const client = createMockClient({
      searchVectors: vi.fn().mockResolvedValue({
        results: [{ id: 'vec-4', document: 'doc content', similarity: 0.95 }],
        count: 1,
      }),
    });
    const service = new MemoryOptimizerService(client, 0.85);

    const result = await service.detectDuplicateRequests('query');
    expect(result.priorAnswer).toBe('doc content');
  });
});

// ---------------------------------------------------------------------------
// getMemoryReuseRecommendations (Issue #18)
// ---------------------------------------------------------------------------

describe('MemoryOptimizerService.getMemoryReuseRecommendations', () => {
  it('returns empty recommendations when no memories exist', async () => {
    const client = createMockClient();
    const service = new MemoryOptimizerService(client);

    const result = await service.getMemoryReuseRecommendations('7d');

    expect(result.duplicateQueries).toEqual([]);
    expect(result.repeatedResearch).toEqual([]);
    expect(result.repeatedWorkflows).toEqual([]);
    expect(result.totalPotentialSavings).toBe(0);
  });

  it('identifies duplicate queries from identical content', async () => {
    const memories = [
      { id: '1', content: 'How do I set up the database?', metadata: {} },
      { id: '2', content: 'How do I set up the database?', metadata: {} },
      { id: '3', content: 'How do I set up the database?', metadata: {} },
    ];
    const client = createMockClient({
      listMemories: vi.fn().mockResolvedValue({ memories, total: 3 }),
    });
    const service = new MemoryOptimizerService(client);

    const result = await service.getMemoryReuseRecommendations('7d');

    expect(result.duplicateQueries.length).toBeGreaterThanOrEqual(1);
    expect(result.duplicateQueries[0].frequency).toBe(3);
    expect(result.totalPotentialSavings).toBeGreaterThan(0);
  });

  it('identifies repeated research from knowledge-category memories', async () => {
    const memories = [
      { id: '1', content: 'Research on rate limiting approaches for API gateway services in production environments', metadata: { category: 'knowledge' } },
      { id: '2', content: 'Research on rate limiting approaches for API gateway services in production environments', metadata: { category: 'knowledge' } },
    ];
    const client = createMockClient({
      listMemories: vi.fn().mockResolvedValue({ memories, total: 2 }),
    });
    const service = new MemoryOptimizerService(client);

    const result = await service.getMemoryReuseRecommendations('7d');

    expect(result.repeatedResearch.length).toBeGreaterThanOrEqual(1);
  });

  it('identifies repeated workflows from task-category memories', async () => {
    const memories = [
      { id: '1', content: 'Deploy the staging environment and run smoke tests after deployment completes', metadata: { category: 'task' } },
      { id: '2', content: 'Deploy the staging environment and run smoke tests after deployment completes', metadata: { category: 'task' } },
      { id: '3', content: 'Deploy the staging environment and run smoke tests after deployment completes', metadata: { category: 'task' } },
    ];
    const client = createMockClient({
      listMemories: vi.fn().mockResolvedValue({ memories, total: 3 }),
    });
    const service = new MemoryOptimizerService(client);

    const result = await service.getMemoryReuseRecommendations('7d');

    expect(result.repeatedWorkflows.length).toBeGreaterThanOrEqual(1);
    expect(result.repeatedWorkflows[0].frequency).toBe(3);
  });

  it('handles client error gracefully', async () => {
    const client = createMockClient({
      listMemories: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const service = new MemoryOptimizerService(client);

    const result = await service.getMemoryReuseRecommendations('7d');

    expect(result.duplicateQueries).toEqual([]);
    expect(result.totalPotentialSavings).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getMemoryStats
// ---------------------------------------------------------------------------

describe('MemoryOptimizerService.getMemoryStats', () => {
  it('returns zero stats when no memories exist', async () => {
    const client = createMockClient();
    const service = new MemoryOptimizerService(client);

    const stats = await service.getMemoryStats();

    expect(stats.totalMemories).toBe(0);
    expect(stats.reuseRate).toBe(0);
    expect(stats.avgConfidence).toBe(0);
    expect(stats.topCategories).toEqual([]);
    expect(stats.totalTokensSaved).toBe(0);
    expect(stats.totalTokensConsumed).toBe(0);
  });

  it('computes category breakdowns correctly', async () => {
    const memories = [
      { id: '1', content: 'test memory content one', metadata: { category: 'conversation' } },
      { id: '2', content: 'test memory content two', metadata: { category: 'conversation' } },
      { id: '3', content: 'test memory content three', metadata: { category: 'knowledge' } },
    ];
    const client = createMockClient({
      listMemories: vi.fn().mockResolvedValue({ memories, total: 3 }),
    });
    const service = new MemoryOptimizerService(client);

    const stats = await service.getMemoryStats();

    expect(stats.totalMemories).toBe(3);
    expect(stats.topCategories.length).toBe(2);
    const conversationCat = stats.topCategories.find((c) => c.category === 'conversation');
    expect(conversationCat?.count).toBe(2);
  });

  it('tracks duplicate memories and tokens saved', async () => {
    const memories = [
      {
        id: '1',
        content: 'duplicate content that was reused from cache',
        metadata: { is_duplicate: true, duplicate_confidence: 0.95 },
      },
      {
        id: '2',
        content: 'unique content',
        metadata: {},
      },
    ];
    const client = createMockClient({
      listMemories: vi.fn().mockResolvedValue({ memories, total: 2 }),
    });
    const service = new MemoryOptimizerService(client);

    const stats = await service.getMemoryStats();

    expect(stats.reuseRate).toBeGreaterThan(0);
    expect(stats.avgConfidence).toBeCloseTo(0.95, 1);
    expect(stats.totalTokensSaved).toBeGreaterThan(0);
  });

  it('handles client error gracefully', async () => {
    const client = createMockClient({
      listMemories: vi.fn().mockRejectedValue(new Error('Timeout')),
    });
    const service = new MemoryOptimizerService(client);

    const stats = await service.getMemoryStats();

    expect(stats.totalMemories).toBe(0);
  });
});
