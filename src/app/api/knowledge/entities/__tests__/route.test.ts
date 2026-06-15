/**
 * Tests for GET/POST /api/knowledge/entities route handler
 * Refs #28 #30
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../../services/knowledge-graph', () => ({
  getKnowledgeGraphService: vi.fn(),
}));

import { GET, POST } from '../route';
import { getKnowledgeGraphService } from '../../../../../services/knowledge-graph';
import type { KnowledgeEntity } from '../../../../../types/knowledge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(queryParams: Record<string, string> = {}): NextRequest {
  const params = new URLSearchParams(queryParams).toString();
  const url = params
    ? `http://localhost:3000/api/knowledge/entities?${params}`
    : 'http://localhost:3000/api/knowledge/entities';
  return new NextRequest(url, { method: 'GET' });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/knowledge/entities', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const MOCK_ENTITIES: KnowledgeEntity[] = [
  {
    id: 'ent-1',
    type: 'person',
    name: 'Alice',
    metadata: { role: 'engineer' },
    connections: [],
  },
  {
    id: 'ent-2',
    type: 'project',
    name: 'Project Alpha',
    metadata: {},
    connections: ['ent-1'],
  },
];

// ---------------------------------------------------------------------------
// GET Tests
// ---------------------------------------------------------------------------

describe('GET /api/knowledge/entities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with all entities when no type filter', async () => {
    const mockService = {
      getEntities: vi.fn().mockResolvedValue(MOCK_ENTITIES),
      addEntity: vi.fn(),
      discoverInsights: vi.fn(),
      searchEntities: vi.fn(),
    };
    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockService as never);

    const req = makeGetRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  it('passes type filter to service', async () => {
    const mockService = {
      getEntities: vi.fn().mockResolvedValue([MOCK_ENTITIES[0]]),
      addEntity: vi.fn(),
      discoverInsights: vi.fn(),
      searchEntities: vi.fn(),
    };
    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockService as never);

    const req = makeGetRequest({ type: 'person' });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(mockService.getEntities).toHaveBeenCalledWith('person');
  });

  it('returns 400 for invalid type filter', async () => {
    const req = makeGetRequest({ type: 'invalid-type' });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 500 when service throws', async () => {
    const mockService = {
      getEntities: vi.fn().mockRejectedValue(new Error('DB error')),
      addEntity: vi.fn(),
      discoverInsights: vi.fn(),
      searchEntities: vi.fn(),
    };
    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockService as never);

    const req = makeGetRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST Tests
// ---------------------------------------------------------------------------

describe('POST /api/knowledge/entities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 201 with created entity', async () => {
    const createdEntity: KnowledgeEntity = {
      id: 'ent-new',
      type: 'person',
      name: 'Charlie',
      metadata: { role: 'designer' },
      connections: [],
    };
    const mockService = {
      getEntities: vi.fn(),
      addEntity: vi.fn().mockResolvedValue(createdEntity),
      discoverInsights: vi.fn(),
      searchEntities: vi.fn(),
    };
    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockService as never);

    const req = makePostRequest({
      type: 'person',
      name: 'Charlie',
      metadata: { role: 'designer' },
      connections: [],
    });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('ent-new');
    expect(body.data.name).toBe('Charlie');
  });

  it('returns 400 when name is missing', async () => {
    const req = makePostRequest({
      type: 'person',
      metadata: {},
      connections: [],
    });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Validation failed');
  });

  it('returns 400 when type is invalid', async () => {
    const req = makePostRequest({
      type: 'invalid',
      name: 'Test',
      metadata: {},
      connections: [],
    });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('defaults metadata and connections when not provided', async () => {
    const createdEntity: KnowledgeEntity = {
      id: 'ent-new',
      type: 'system',
      name: 'Auth Service',
      metadata: {},
      connections: [],
    };
    const mockService = {
      getEntities: vi.fn(),
      addEntity: vi.fn().mockResolvedValue(createdEntity),
      discoverInsights: vi.fn(),
      searchEntities: vi.fn(),
    };
    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockService as never);

    const req = makePostRequest({ type: 'system', name: 'Auth Service' });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.metadata).toEqual({});
    expect(body.data.connections).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    const mockService = {
      getEntities: vi.fn(),
      addEntity: vi.fn().mockRejectedValue(new Error('Insert failed')),
      discoverInsights: vi.fn(),
      searchEntities: vi.fn(),
    };
    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockService as never);

    const req = makePostRequest({
      type: 'person',
      name: 'Charlie',
    });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
