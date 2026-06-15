/**
 * Tests for POST /api/memory/detect-duplicate route handler
 * Refs #17
 */

import { describe, it, expect } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/memory/detect-duplicate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/memory/detect-duplicate', () => {
  it('returns 400 when query is missing', async () => {
    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('returns 400 when query is empty string', async () => {
    const req = makeRequest({ query: '' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 200 with detection result for valid query', async () => {
    const req = makeRequest({ query: 'How do I deploy?' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('isDuplicate');
    expect(data).toHaveProperty('confidence');
    expect(data).toHaveProperty('priorAnswer');
    expect(data).toHaveProperty('memoryReference');
    expect(data).toHaveProperty('tokensSaved');
    expect(typeof data.isDuplicate).toBe('boolean');
    expect(typeof data.confidence).toBe('number');
  });

  it('returns duplicate for known trigger phrases', async () => {
    const req = makeRequest({ query: 'How to rate limit an API?' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isDuplicate).toBe(true);
    expect(data.confidence).toBeGreaterThan(0.8);
    expect(data.tokensSaved).toBeGreaterThan(0);
    expect(data.priorAnswer).toBeTruthy();
  });

  it('returns non-duplicate for unknown queries', async () => {
    const req = makeRequest({ query: 'xyzzy_unique_never_seen_12345' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isDuplicate).toBe(false);
  });

  it('returns 400 for excessively long query', async () => {
    const req = makeRequest({ query: 'x'.repeat(10_001) });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('accepts an optional threshold parameter', async () => {
    const req = makeRequest({ query: 'test query', threshold: 0.5 });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it('returns 400 for threshold out of range', async () => {
    const req = makeRequest({ query: 'test', threshold: 1.5 });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
