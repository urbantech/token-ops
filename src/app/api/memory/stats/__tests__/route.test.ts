/**
 * Tests for GET /api/memory/stats route handler
 * Now powered by AINative Core postgres
 * Refs #17, Refs #18
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../../lib/ainative-db', () => ({
  query: vi.fn(),
}));

import { GET } from '../route';
import * as db from '../../../../../lib/ainative-db';

beforeEach(() => {
  vi.clearAllMocks();

  // Default mock responses for the 5 parallel queries
  const mockQuery = vi.mocked(db.query);

  mockQuery
    // 1. vectorStats
    .mockResolvedValueOnce([{ total_vectors: 36000, unique_namespaces: 150, unique_projects: 60 }])
    // 2. namespaces
    .mockResolvedValueOnce([
      { namespace: 'members_v2', count: 10000 },
      { namespace: 'sensors', count: 8000 },
      { namespace: 'default', count: 4000 },
    ])
    // 3. memoryRecords
    .mockResolvedValueOnce([{ total_memories: 488, unique_agents: 126, unique_sessions: 157 }])
    // 4. roleBreakdown
    .mockResolvedValueOnce([
      { role: 'user', count: 243 },
      { role: 'assistant', count: 175 },
      { role: 'system', count: 54 },
    ])
    // 5. tokenStats
    .mockResolvedValueOnce([{
      total_requests: 320000,
      unique_endpoints: 9,
      total_tokens: 500000000,
      total_prompt_tokens: 480000000,
    }]);
});

describe('GET /api/memory/stats', () => {
  it('returns 200 with stats object', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('totalMemories');
    expect(data).toHaveProperty('reuseRate');
    expect(data).toHaveProperty('topCategories');
    expect(data).toHaveProperty('totalTokensSaved');
    expect(data).toHaveProperty('totalTokensConsumed');
  });

  it('returns numeric values for all stats', async () => {
    const res = await GET();
    const data = await res.json();
    expect(typeof data.totalMemories).toBe('number');
    expect(typeof data.reuseRate).toBe('number');
    expect(typeof data.totalTokensSaved).toBe('number');
    expect(typeof data.totalTokensConsumed).toBe('number');
  });

  it('totalMemories is vectors + memory records', async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.totalMemories).toBe(36000 + 488);
  });

  it('returns topCategories from real namespace breakdown', async () => {
    const res = await GET();
    const data = await res.json();
    expect(Array.isArray(data.topCategories)).toBe(true);
    expect(data.topCategories.length).toBe(3);
    expect(data.topCategories[0].category).toBe('members_v2');
    expect(data.topCategories[0].count).toBe(10000);
  });

  it('returns real vector/project/agent counts', async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.vectorCount).toBe(36000);
    expect(data.namespaceCount).toBe(150);
    expect(data.projectCount).toBe(60);
    expect(data.activeAgents).toBe(126);
  });

  it('returns 500 when database throws', async () => {
    vi.mocked(db.query).mockReset().mockRejectedValue(new Error('connection refused'));
    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('connection refused');
  });
});
