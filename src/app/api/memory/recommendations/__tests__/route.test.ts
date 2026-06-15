/**
 * Tests for GET /api/memory/recommendations route handler
 * Refs #18
 */

import { describe, it, expect } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(timeRange?: string): NextRequest {
  const url = timeRange
    ? `http://localhost:3000/api/memory/recommendations?timeRange=${timeRange}`
    : 'http://localhost:3000/api/memory/recommendations';
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/memory/recommendations', () => {
  it('returns 200 with default timeRange (7d)', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('duplicateQueries');
    expect(data).toHaveProperty('repeatedResearch');
    expect(data).toHaveProperty('repeatedWorkflows');
    expect(data).toHaveProperty('totalPotentialSavings');
    expect(Array.isArray(data.duplicateQueries)).toBe(true);
    expect(Array.isArray(data.repeatedResearch)).toBe(true);
    expect(Array.isArray(data.repeatedWorkflows)).toBe(true);
    expect(typeof data.totalPotentialSavings).toBe('number');
  });

  it('accepts valid timeRange values', async () => {
    for (const range of ['24h', '7d', '30d', '90d']) {
      const res = await GET(makeRequest(range));
      expect(res.status).toBe(200);
    }
  });

  it('returns 400 for invalid timeRange', async () => {
    const res = await GET(makeRequest('1y'));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('scales data based on timeRange', async () => {
    const res24h = await GET(makeRequest('24h'));
    const res90d = await GET(makeRequest('90d'));

    const data24h = await res24h.json();
    const data90d = await res90d.json();

    // 90d should have larger totals than 24h
    expect(data90d.totalPotentialSavings).toBeGreaterThan(data24h.totalPotentialSavings);
  });

  it('returns well-formed duplicate query objects', async () => {
    const res = await GET(makeRequest('7d'));
    const data = await res.json();

    for (const q of data.duplicateQueries) {
      expect(q).toHaveProperty('query');
      expect(q).toHaveProperty('frequency');
      expect(q).toHaveProperty('tokensConsumed');
      expect(q).toHaveProperty('potentialSavings');
      expect(q).toHaveProperty('avgSimilarity');
      expect(typeof q.query).toBe('string');
      expect(typeof q.frequency).toBe('number');
    }
  });

  it('returns well-formed workflow objects', async () => {
    const res = await GET(makeRequest('7d'));
    const data = await res.json();

    for (const w of data.repeatedWorkflows) {
      expect(w).toHaveProperty('workflowName');
      expect(w).toHaveProperty('frequency');
      expect(w).toHaveProperty('avgCost');
      expect(w).toHaveProperty('totalCost');
    }
  });
});
