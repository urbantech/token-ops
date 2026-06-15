/**
 * Tests for GET /api/knowledge/insights route handler
 * Refs #29
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../../services/knowledge-graph', () => ({
  getKnowledgeGraphService: vi.fn(),
}));

import { GET } from '../route';
import { getKnowledgeGraphService } from '../../../../../services/knowledge-graph';
import type { KnowledgeInsight } from '../../../../../types/knowledge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/knowledge/insights', {
    method: 'GET',
  });
}

const MOCK_INSIGHTS: KnowledgeInsight[] = [
  {
    type: 'duplicate_work',
    title: 'Similar projects detected',
    description: 'Project Alpha and Project Alpha Clone share 85% overlap',
    entities: ['ent-3', 'ent-4'],
    confidence: 0.85,
    recommendation: 'Consider merging these projects',
  },
  {
    type: 'hidden_expertise',
    title: 'Unrecognized expert: Bob',
    description: 'Bob connects to 5 entities across different domains',
    entities: ['ent-2'],
    confidence: 0.78,
    recommendation: 'Leverage Bob for cross-team knowledge sharing',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/knowledge/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with insights data', async () => {
    const mockService = {
      getEntities: vi.fn(),
      addEntity: vi.fn(),
      discoverInsights: vi.fn().mockResolvedValue(MOCK_INSIGHTS),
      searchEntities: vi.fn(),
    };
    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockService as never);

    const req = makeRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].type).toBe('duplicate_work');
    expect(body.data[1].type).toBe('hidden_expertise');
  });

  it('returns 200 with empty array when no insights', async () => {
    const mockService = {
      getEntities: vi.fn(),
      addEntity: vi.fn(),
      discoverInsights: vi.fn().mockResolvedValue([]),
      searchEntities: vi.fn(),
    };
    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockService as never);

    const req = makeRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    const mockService = {
      getEntities: vi.fn(),
      addEntity: vi.fn(),
      discoverInsights: vi.fn().mockRejectedValue(new Error('Analysis failed')),
      searchEntities: vi.fn(),
    };
    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockService as never);

    const req = makeRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });
});
