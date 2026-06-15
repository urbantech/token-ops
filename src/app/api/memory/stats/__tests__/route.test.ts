/**
 * Tests for GET /api/memory/stats route handler
 * Refs #17, Refs #18
 */

import { describe, it, expect } from 'vitest';
import { GET } from '../route';

describe('GET /api/memory/stats', () => {
  it('returns 200 with stats object', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('totalMemories');
    expect(data).toHaveProperty('reuseRate');
    expect(data).toHaveProperty('avgConfidence');
    expect(data).toHaveProperty('topCategories');
    expect(data).toHaveProperty('totalTokensSaved');
    expect(data).toHaveProperty('totalTokensConsumed');
  });

  it('returns numeric values for all stats', async () => {
    const res = await GET();
    const data = await res.json();

    expect(typeof data.totalMemories).toBe('number');
    expect(typeof data.reuseRate).toBe('number');
    expect(typeof data.avgConfidence).toBe('number');
    expect(typeof data.totalTokensSaved).toBe('number');
    expect(typeof data.totalTokensConsumed).toBe('number');
  });

  it('returns topCategories as a sorted array', async () => {
    const res = await GET();
    const data = await res.json();

    expect(Array.isArray(data.topCategories)).toBe(true);
    expect(data.topCategories.length).toBeGreaterThan(0);

    // Verify each category has the expected shape
    for (const cat of data.topCategories) {
      expect(cat).toHaveProperty('category');
      expect(cat).toHaveProperty('count');
      expect(cat).toHaveProperty('percentage');
      expect(typeof cat.category).toBe('string');
      expect(typeof cat.count).toBe('number');
      expect(typeof cat.percentage).toBe('number');
    }
  });

  it('returns categories sorted by count descending', async () => {
    const res = await GET();
    const data = await res.json();

    for (let i = 1; i < data.topCategories.length; i++) {
      expect(data.topCategories[i - 1].count).toBeGreaterThanOrEqual(
        data.topCategories[i].count
      );
    }
  });

  it('returns reuseRate between 0 and 100', async () => {
    const res = await GET();
    const data = await res.json();

    expect(data.reuseRate).toBeGreaterThanOrEqual(0);
    expect(data.reuseRate).toBeLessThanOrEqual(100);
  });

  it('returns avgConfidence between 0 and 1', async () => {
    const res = await GET();
    const data = await res.json();

    expect(data.avgConfidence).toBeGreaterThanOrEqual(0);
    expect(data.avgConfidence).toBeLessThanOrEqual(1);
  });

  it('returns totalTokensSaved less than or equal to totalTokensConsumed', async () => {
    const res = await GET();
    const data = await res.json();

    expect(data.totalTokensSaved).toBeLessThanOrEqual(data.totalTokensConsumed);
  });
});
