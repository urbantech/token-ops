/**
 * Tests for GET /api/models/recommendations
 * Refs #23
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../../services/model-router', () => ({
  getRecommendations: vi.fn(),
}));

import { GET } from '../route';
import { getRecommendations } from '../../../../../services/model-router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000/api/models/recommendations';

function makeRequest(query?: string): NextRequest {
  const url = query ? `${BASE_URL}?${query}` : BASE_URL;
  return new NextRequest(url, { method: 'GET' });
}

const MOCK_RECOMMENDATIONS = [
  {
    currentModel: 'claude-opus-4-6',
    recommendedModel: 'claude-haiku-3-5',
    classification: 'brainstorm',
    expectedSavingsPercent: 98,
    confidenceScore: 85,
    reasoning: 'Switch to a cheaper model for brainstorm tasks.',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/models/recommendations', () => {
  it('returns 400 when classification query param is missing', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/classification/i);
  });

  it('returns 400 when classification is empty', async () => {
    const res = await GET(makeRequest('classification='));
    expect(res.status).toBe(400);
  });

  it('returns 200 with recommendations for valid classification', async () => {
    vi.mocked(getRecommendations).mockReturnValue(MOCK_RECOMMENDATIONS);

    const res = await GET(makeRequest('classification=brainstorm'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toEqual(MOCK_RECOMMENDATIONS);
  });

  it('calls getRecommendations with the classification param', async () => {
    vi.mocked(getRecommendations).mockReturnValue([]);

    await GET(makeRequest('classification=code'));
    expect(getRecommendations).toHaveBeenCalledWith('code');
  });

  it('returns 200 with empty array when no recommendations exist', async () => {
    vi.mocked(getRecommendations).mockReturnValue([]);

    const res = await GET(makeRequest('classification=nonexistent'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(getRecommendations).mockImplementation(() => {
      throw new Error('Service failure');
    });

    const res = await GET(makeRequest('classification=code'));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Service failure');
  });

  it('response includes a timestamp', async () => {
    vi.mocked(getRecommendations).mockReturnValue([]);

    const res = await GET(makeRequest('classification=code'));
    const data = await res.json();
    expect(data.timestamp).toBeTruthy();
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });
});
