/**
 * Tests for Memory Storage Service
 * Refs #3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClient from '@/lib/api-client'
import { memoryService } from '../memory'
import type { MemoryMetrics } from '@/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMemoryMetrics(overrides: Partial<MemoryMetrics> = {}): MemoryMetrics {
  return {
    totalMemories: 1200,
    episodicCount: 800,
    semanticCount: 400,
    duplicateCount: 45,
    staleBytesEstimate: 204_800,
    tokenOverheadEstimate: 3_500,
    potentialSavingsTokens: 2_100,
    lastConsolidatedAt: '2026-06-13T08:00:00Z',
    ...overrides,
  }
}

const mockedGet = vi.mocked(apiClient.get)
const mockedPost = vi.mocked(apiClient.post)

// ---------------------------------------------------------------------------
// getMetrics
// ---------------------------------------------------------------------------

describe('memoryService.getMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns global memory metrics when no agentId is provided', async () => {
    const metrics = makeMemoryMetrics()
    mockedGet.mockResolvedValueOnce({ data: metrics })

    const result = await memoryService.getMetrics()

    expect(mockedGet).toHaveBeenCalledWith('/v1/memory/metrics', { params: undefined })
    expect(result.totalMemories).toBe(1200)
    expect(result.episodicCount).toBe(800)
    expect(result.semanticCount).toBe(400)
  })

  it('passes agent_id param when an agentId is provided', async () => {
    mockedGet.mockResolvedValueOnce({ data: makeMemoryMetrics({ totalMemories: 300 }) })

    const result = await memoryService.getMetrics('agent_001')

    expect(mockedGet).toHaveBeenCalledWith('/v1/memory/metrics', {
      params: { agent_id: 'agent_001' },
    })
    expect(result.totalMemories).toBe(300)
  })

  it('does not send params when agentId is undefined', async () => {
    mockedGet.mockResolvedValueOnce({ data: makeMemoryMetrics() })

    await memoryService.getMetrics(undefined)

    const call = mockedGet.mock.calls[0]
    expect(call[1]?.params).toBeUndefined()
  })

  it('includes duplicate and stale byte estimates in the result', async () => {
    mockedGet.mockResolvedValueOnce({ data: makeMemoryMetrics() })

    const result = await memoryService.getMetrics()

    expect(result.duplicateCount).toBe(45)
    expect(result.staleBytesEstimate).toBe(204_800)
    expect(result.potentialSavingsTokens).toBe(2_100)
  })

  it('returns zero-value metrics for a new agent', async () => {
    const zeroMetrics = makeMemoryMetrics({
      totalMemories: 0,
      episodicCount: 0,
      semanticCount: 0,
      duplicateCount: 0,
      staleBytesEstimate: 0,
      tokenOverheadEstimate: 0,
      potentialSavingsTokens: 0,
    })
    mockedGet.mockResolvedValueOnce({ data: zeroMetrics })

    const result = await memoryService.getMetrics('agent_new')

    expect(result.totalMemories).toBe(0)
    expect(result.potentialSavingsTokens).toBe(0)
  })

  it('propagates API errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Service unavailable'))

    await expect(memoryService.getMetrics()).rejects.toThrow('Service unavailable')
  })
})

// ---------------------------------------------------------------------------
// triggerConsolidation
// ---------------------------------------------------------------------------

describe('memoryService.triggerConsolidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts to the consolidate endpoint and returns a job id', async () => {
    mockedPost.mockResolvedValueOnce({ data: { jobId: 'job_abc123' } })

    const result = await memoryService.triggerConsolidation('entity_001')

    expect(mockedPost).toHaveBeenCalledWith('/v1/memory/consolidate', {
      entity_id: 'entity_001',
    })
    expect(result.jobId).toBe('job_abc123')
  })

  it('uses the entityId verbatim in the request body', async () => {
    mockedPost.mockResolvedValueOnce({ data: { jobId: 'job_xyz' } })

    await memoryService.triggerConsolidation('ent-uuid-9999')

    expect(mockedPost.mock.calls[0][1]).toEqual({ entity_id: 'ent-uuid-9999' })
  })

  it('returns the jobId string from the response', async () => {
    mockedPost.mockResolvedValueOnce({ data: { jobId: 'consolidation-job-42' } })

    const result = await memoryService.triggerConsolidation('entity_002')

    expect(typeof result.jobId).toBe('string')
    expect(result.jobId).toBe('consolidation-job-42')
  })

  it('propagates errors when the consolidation request fails', async () => {
    mockedPost.mockRejectedValueOnce(new Error('Entity not found'))

    await expect(memoryService.triggerConsolidation('missing_entity')).rejects.toThrow(
      'Entity not found'
    )
  })
})

// ---------------------------------------------------------------------------
// findDuplicates
// ---------------------------------------------------------------------------

describe('memoryService.findDuplicates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns duplicate groups without params', async () => {
    const duplicates = [
      { groupId: 'grp_1', entries: ['mem_a', 'mem_b'], potentialSavingsTokens: 500 },
      { groupId: 'grp_2', entries: ['mem_c', 'mem_d', 'mem_e'], potentialSavingsTokens: 800 },
    ]
    mockedGet.mockResolvedValueOnce({ data: duplicates })

    const result = await memoryService.findDuplicates()

    expect(mockedGet).toHaveBeenCalledWith('/v1/memory/duplicates', { params: undefined })
    expect(result).toHaveLength(2)
    expect(result[0].groupId).toBe('grp_1')
    expect(result[0].entries).toEqual(['mem_a', 'mem_b'])
    expect(result[0].potentialSavingsTokens).toBe(500)
  })

  it('passes threshold and agentId params to the API', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    await memoryService.findDuplicates({ threshold: 0.9, agentId: 'agent_001' })

    expect(mockedGet).toHaveBeenCalledWith('/v1/memory/duplicates', {
      params: { threshold: 0.9, agentId: 'agent_001' },
    })
  })

  it('passes only threshold when agentId is omitted', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    await memoryService.findDuplicates({ threshold: 0.75 })

    expect(mockedGet.mock.calls[0][1]?.params?.threshold).toBe(0.75)
    expect(mockedGet.mock.calls[0][1]?.params?.agentId).toBeUndefined()
  })

  it('returns an empty array when no duplicates are found', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    const result = await memoryService.findDuplicates({ threshold: 0.95 })

    expect(result).toEqual([])
  })

  it('propagates errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Threshold must be between 0 and 1'))

    await expect(memoryService.findDuplicates({ threshold: 2.0 })).rejects.toThrow(
      'Threshold must be between 0 and 1'
    )
  })
})

// ---------------------------------------------------------------------------
// pruneStale
// ---------------------------------------------------------------------------

describe('memoryService.pruneStale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts prune params and returns the count of pruned entries and tokens saved', async () => {
    mockedPost.mockResolvedValueOnce({ data: { pruned: 120, tokensSaved: 3_200 } })

    const result = await memoryService.pruneStale({ olderThanDays: 30 })

    expect(mockedPost).toHaveBeenCalledWith('/v1/memory/prune', { olderThanDays: 30 })
    expect(result.pruned).toBe(120)
    expect(result.tokensSaved).toBe(3_200)
  })

  it('passes optional agentId and dryRun to the API', async () => {
    mockedPost.mockResolvedValueOnce({ data: { pruned: 0, tokensSaved: 0 } })

    await memoryService.pruneStale({ olderThanDays: 14, agentId: 'agent_001', dryRun: true })

    expect(mockedPost).toHaveBeenCalledWith('/v1/memory/prune', {
      olderThanDays: 14,
      agentId: 'agent_001',
      dryRun: true,
    })
  })

  it('returns zero counts when there is nothing to prune', async () => {
    mockedPost.mockResolvedValueOnce({ data: { pruned: 0, tokensSaved: 0 } })

    const result = await memoryService.pruneStale({ olderThanDays: 90 })

    expect(result.pruned).toBe(0)
    expect(result.tokensSaved).toBe(0)
  })

  it('dry-run returns estimated counts without deleting', async () => {
    mockedPost.mockResolvedValueOnce({ data: { pruned: 50, tokensSaved: 1_500 } })

    const result = await memoryService.pruneStale({ olderThanDays: 7, dryRun: true })

    expect(result.pruned).toBe(50)
    expect(result.tokensSaved).toBe(1_500)
    expect(mockedPost.mock.calls[0][1]).toMatchObject({ dryRun: true })
  })

  it('propagates errors when the prune operation fails', async () => {
    mockedPost.mockRejectedValueOnce(new Error('olderThanDays must be positive'))

    await expect(memoryService.pruneStale({ olderThanDays: -1 })).rejects.toThrow(
      'olderThanDays must be positive'
    )
  })
})
