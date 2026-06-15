/**
 * Tests for GET /api/models/rules
 * Refs #24
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../../services/model-router', () => ({
  getRoutingRules: vi.fn(),
}));

import { GET } from '../route';
import { getRoutingRules } from '../../../../../services/model-router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000/api/models/rules';

function makeRequest(): NextRequest {
  return new NextRequest(BASE_URL, { method: 'GET' });
}

const MOCK_RULES = [
  {
    id: 'rule-code',
    name: 'Code Generation',
    classification: 'code',
    preferredModel: 'claude-sonnet-4-6',
    fallbackModel: 'gpt-4o',
    maxCostPer1kTokens: 0.02,
    enabled: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/models/rules', () => {
  it('returns 200 with rules array', async () => {
    vi.mocked(getRoutingRules).mockReturnValue(MOCK_RULES);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toEqual(MOCK_RULES);
  });

  it('calls getRoutingRules', async () => {
    vi.mocked(getRoutingRules).mockReturnValue([]);

    await GET(makeRequest());
    expect(getRoutingRules).toHaveBeenCalledOnce();
  });

  it('returns 200 with empty array when no rules', async () => {
    vi.mocked(getRoutingRules).mockReturnValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(getRoutingRules).mockImplementation(() => {
      throw new Error('Rules failure');
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Rules failure');
  });

  it('response includes a timestamp', async () => {
    vi.mocked(getRoutingRules).mockReturnValue(MOCK_RULES);

    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.timestamp).toBeTruthy();
  });
});
