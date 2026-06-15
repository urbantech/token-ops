/**
 * Tests for GET /api/workflows/analysis route handler
 * Refs #27
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../../services/workflow-optimizer', () => ({
  getWorkflowOptimizerService: vi.fn(),
}));

import { GET } from '../route';
import { getWorkflowOptimizerService } from '../../../../../services/workflow-optimizer';
import type { WorkflowAnalysis } from '../../../../../types/workflow';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const START = '2026-06-01T00:00:00.000Z';
const END = '2026-06-14T23:59:59.000Z';

function makeRequest(queryParams: Record<string, string>): NextRequest {
  const params = new URLSearchParams(queryParams).toString();
  return new NextRequest(
    `http://localhost:3000/api/workflows/analysis?${params}`,
    { method: 'GET' }
  );
}

const MOCK_ANALYSIS: WorkflowAnalysis = {
  totalWorkflows: 3,
  duplicatedWorkflows: [
    {
      workflowA: 'deploy-pipeline',
      workflowB: 'deploy-pipeline-v2',
      similarity: 0.85,
      estimatedWaste: 5000,
    },
  ],
  inefficientWorkflows: [
    {
      workflow: 'heavy-workflow',
      avgTokens: 50000,
      avgDuration: 65000,
      inefficiencyScore: 72,
      suggestion: 'Consider splitting into smaller workflows',
    },
  ],
  excessiveToolCalls: [],
  recommendations: ['Consolidate similar deploy workflows'],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/workflows/analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when start param is missing', async () => {
    const req = makeRequest({ end: END });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Validation failed');
  });

  it('returns 400 when end param is missing', async () => {
    const req = makeRequest({ start: START });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 400 for invalid date format', async () => {
    const req = makeRequest({ start: 'not-a-date', end: END });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 200 with workflow analysis data', async () => {
    const mockService = {
      analyzeWorkflows: vi.fn().mockResolvedValue(MOCK_ANALYSIS),
      findDuplicates: vi.fn(),
    };
    vi.mocked(getWorkflowOptimizerService).mockReturnValue(mockService as never);

    const req = makeRequest({ start: START, end: END });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.totalWorkflows).toBe(3);
    expect(body.data.duplicatedWorkflows).toHaveLength(1);
    expect(body.data.inefficientWorkflows).toHaveLength(1);
    expect(body.data.recommendations).toHaveLength(1);
  });

  it('returns 500 when service throws', async () => {
    const mockService = {
      analyzeWorkflows: vi.fn().mockRejectedValue(new Error('DB error')),
      findDuplicates: vi.fn(),
    };
    vi.mocked(getWorkflowOptimizerService).mockReturnValue(mockService as never);

    const req = makeRequest({ start: START, end: END });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });
});
