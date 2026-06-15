/**
 * Tests for Agent Management Service
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
import { agentsService } from '../agents'
import type { AgentMetrics, PaginatedResponse } from '@/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAgentMetrics(overrides: Partial<AgentMetrics> = {}): AgentMetrics {
  return {
    agentId: 'agent_001',
    name: 'Token Auditor',
    model: 'gpt-4',
    totalTokens: 10_000,
    totalCost: 0.25,
    requestCount: 42,
    avgLatencyMs: 1200,
    successRate: 0.98,
    lastActiveAt: '2026-06-14T10:00:00Z',
    classification: 'code',
    ...overrides,
  }
}

function makePaginatedResponse<T>(
  items: T[],
  overrides: Partial<PaginatedResponse<T>> = {}
): PaginatedResponse<T> {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 20,
    hasMore: false,
    ...overrides,
  }
}

const mockedGet = vi.mocked(apiClient.get)

// ---------------------------------------------------------------------------
// listAgents
// ---------------------------------------------------------------------------

describe('agentsService.listAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a paginated list of agent metrics', async () => {
    const agents = [makeAgentMetrics(), makeAgentMetrics({ agentId: 'agent_002', name: 'Prompt Architect' })]
    const response = makePaginatedResponse(agents)
    mockedGet.mockResolvedValueOnce({ data: response })

    const result = await agentsService.listAgents()

    expect(mockedGet).toHaveBeenCalledOnce()
    expect(mockedGet).toHaveBeenCalledWith('/v1/agents/metrics', { params: undefined })
    expect(result.items).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it('passes sort and pagination params to the API', async () => {
    mockedGet.mockResolvedValueOnce({ data: makePaginatedResponse([]) })

    await agentsService.listAgents({ page: 2, pageSize: 10, sortBy: 'cost', order: 'desc' })

    expect(mockedGet).toHaveBeenCalledWith('/v1/agents/metrics', {
      params: { page: 2, pageSize: 10, sortBy: 'cost', order: 'desc' },
    })
  })

  it('passes sort by tokens ascending', async () => {
    mockedGet.mockResolvedValueOnce({ data: makePaginatedResponse([]) })

    await agentsService.listAgents({ sortBy: 'tokens', order: 'asc' })

    const call = mockedGet.mock.calls[0]
    expect(call[1]?.params?.sortBy).toBe('tokens')
    expect(call[1]?.params?.order).toBe('asc')
  })

  it('passes sort by requests', async () => {
    mockedGet.mockResolvedValueOnce({ data: makePaginatedResponse([]) })

    await agentsService.listAgents({ sortBy: 'requests' })

    expect(mockedGet.mock.calls[0][1]?.params?.sortBy).toBe('requests')
  })

  it('passes sort by latency', async () => {
    mockedGet.mockResolvedValueOnce({ data: makePaginatedResponse([]) })

    await agentsService.listAgents({ sortBy: 'latency' })

    expect(mockedGet.mock.calls[0][1]?.params?.sortBy).toBe('latency')
  })

  it('returns an empty items array when no agents exist', async () => {
    mockedGet.mockResolvedValueOnce({ data: makePaginatedResponse([]) })

    const result = await agentsService.listAgents()

    expect(result.items).toHaveLength(0)
    expect(result.hasMore).toBe(false)
  })

  it('propagates API errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Service unavailable'))

    await expect(agentsService.listAgents()).rejects.toThrow('Service unavailable')
  })
})

// ---------------------------------------------------------------------------
// getAgent
// ---------------------------------------------------------------------------

describe('agentsService.getAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns metrics for the requested agent', async () => {
    const agent = makeAgentMetrics({ agentId: 'agent_007' })
    mockedGet.mockResolvedValueOnce({ data: agent })

    const result = await agentsService.getAgent('agent_007')

    expect(mockedGet).toHaveBeenCalledWith('/v1/agents/agent_007/metrics')
    expect(result.agentId).toBe('agent_007')
    expect(result.name).toBe('Token Auditor')
  })

  it('includes all metric fields in the returned object', async () => {
    const agent = makeAgentMetrics({ totalCost: 1.5, successRate: 0.95 })
    mockedGet.mockResolvedValueOnce({ data: agent })

    const result = await agentsService.getAgent('agent_001')

    expect(result.totalCost).toBe(1.5)
    expect(result.successRate).toBe(0.95)
    expect(result.avgLatencyMs).toBe(1200)
  })

  it('propagates 404 errors when agent is not found', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Not found'))

    await expect(agentsService.getAgent('nonexistent')).rejects.toThrow('Not found')
  })

  it('uses the agentId verbatim in the URL path', async () => {
    mockedGet.mockResolvedValueOnce({ data: makeAgentMetrics() })

    await agentsService.getAgent('agt-uuid-1234')

    expect(mockedGet).toHaveBeenCalledWith('/v1/agents/agt-uuid-1234/metrics')
  })
})

// ---------------------------------------------------------------------------
// getLeaderboard
// ---------------------------------------------------------------------------

describe('agentsService.getLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an ordered list of agent metrics', async () => {
    const agents = [
      makeAgentMetrics({ agentId: 'a1', totalCost: 5.0 }),
      makeAgentMetrics({ agentId: 'a2', totalCost: 3.0 }),
      makeAgentMetrics({ agentId: 'a3', totalCost: 1.0 }),
    ]
    mockedGet.mockResolvedValueOnce({ data: agents })

    const result = await agentsService.getLeaderboard()

    expect(mockedGet).toHaveBeenCalledWith('/v1/agents/leaderboard', { params: undefined })
    expect(result).toHaveLength(3)
    expect(result[0].totalCost).toBe(5.0)
  })

  it('passes limit and period params to the API', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    await agentsService.getLeaderboard({ limit: 5, period: '7d' })

    expect(mockedGet).toHaveBeenCalledWith('/v1/agents/leaderboard', {
      params: { limit: 5, period: '7d' },
    })
  })

  it('accepts today as a valid period', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    await agentsService.getLeaderboard({ period: 'today' })

    expect(mockedGet.mock.calls[0][1]?.params?.period).toBe('today')
  })

  it('accepts 30d as a valid period', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    await agentsService.getLeaderboard({ period: '30d' })

    expect(mockedGet.mock.calls[0][1]?.params?.period).toBe('30d')
  })

  it('returns an empty array when no agents qualify', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    const result = await agentsService.getLeaderboard({ limit: 10 })

    expect(result).toEqual([])
  })

  it('propagates network errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Network timeout'))

    await expect(agentsService.getLeaderboard()).rejects.toThrow('Network timeout')
  })
})

// ---------------------------------------------------------------------------
// getRoutingRecommendations
// ---------------------------------------------------------------------------

describe('agentsService.getRoutingRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns routing recommendations for an agent', async () => {
    const recommendations = [
      {
        currentModel: 'gpt-4',
        suggestedModel: 'gpt-3.5-turbo',
        estimatedSavingsPercent: 75,
        qualityImpact: 'minimal' as const,
      },
      {
        currentModel: 'claude-3-opus',
        suggestedModel: 'claude-3-haiku',
        estimatedSavingsPercent: 60,
        qualityImpact: 'none' as const,
      },
    ]
    mockedGet.mockResolvedValueOnce({ data: recommendations })

    const result = await agentsService.getRoutingRecommendations('agent_001')

    expect(mockedGet).toHaveBeenCalledWith('/v1/agents/agent_001/routing-recommendations')
    expect(result).toHaveLength(2)
    expect(result[0].estimatedSavingsPercent).toBe(75)
    expect(result[0].qualityImpact).toBe('minimal')
  })

  it('returns an empty array when no recommendations are available', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    const result = await agentsService.getRoutingRecommendations('agent_002')

    expect(result).toEqual([])
  })

  it('includes all quality impact values in responses', async () => {
    const recommendations = [
      {
        currentModel: 'gpt-4',
        suggestedModel: 'gpt-3.5-turbo',
        estimatedSavingsPercent: 50,
        qualityImpact: 'moderate' as const,
      },
    ]
    mockedGet.mockResolvedValueOnce({ data: recommendations })

    const result = await agentsService.getRoutingRecommendations('agent_003')

    expect(result[0].qualityImpact).toBe('moderate')
  })

  it('uses the agentId verbatim in the URL path', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    await agentsService.getRoutingRecommendations('agt-special-id')

    expect(mockedGet).toHaveBeenCalledWith('/v1/agents/agt-special-id/routing-recommendations')
  })

  it('propagates errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Forbidden'))

    await expect(agentsService.getRoutingRecommendations('agent_001')).rejects.toThrow('Forbidden')
  })
})
