/**
 * Tests for Usage Tracking Service
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
import { usageService } from '../usage'
import type { TokenEvent, UsageSummary, SpendDataPoint, PaginatedResponse } from '@/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTokenEvent(overrides: Partial<TokenEvent> = {}): TokenEvent {
  return {
    id: 'evt_001',
    timestamp: '2026-06-14T09:00:00Z',
    provider: 'openai',
    model: 'gpt-4',
    promptTokens: 200,
    completionTokens: 400,
    totalTokens: 600,
    latencyMs: 1100,
    costMillicents: 120,
    classification: 'code',
    agentId: 'agent_001',
    sessionId: 'session_001',
    userId: 'user_001',
    projectId: 'proj_001',
    tags: ['production'],
    ...overrides,
  }
}

function makeUsageSummary(overrides: Partial<UsageSummary> = {}): UsageSummary {
  return {
    totalTokens: 500_000,
    totalCostUsd: 15.75,
    totalRequests: 1_200,
    avgCostPerRequest: 0.013,
    avgTokensPerRequest: 416,
    topModel: 'gpt-4',
    topClassification: 'code',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-14',
    ...overrides,
  }
}

function makeSpendDataPoint(overrides: Partial<SpendDataPoint> = {}): SpendDataPoint {
  return {
    date: '2026-06-14',
    totalCost: 2.5,
    byClassification: { code: 1.5, fixes: 0.5, brainstorm: 0.5 },
    tokens: 80_000,
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
// getEvents
// ---------------------------------------------------------------------------

describe('usageService.getEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns paginated token events with no params', async () => {
    const events = [makeTokenEvent(), makeTokenEvent({ id: 'evt_002' })]
    mockedGet.mockResolvedValueOnce({ data: makePaginatedResponse(events) })

    const result = await usageService.getEvents()

    expect(mockedGet).toHaveBeenCalledWith('/v1/usage/events', { params: {} })
    expect(result.items).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it('passes all filter params to the API', async () => {
    mockedGet.mockResolvedValueOnce({ data: makePaginatedResponse([]) })

    await usageService.getEvents({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
      provider: 'openai',
      model: 'gpt-4',
      classification: 'code',
      agentId: 'agent_001',
      page: 2,
      pageSize: 50,
    })

    expect(mockedGet).toHaveBeenCalledWith('/v1/usage/events', {
      params: {
        startDate: '2026-06-01',
        endDate: '2026-06-14',
        provider: 'openai',
        model: 'gpt-4',
        classification: 'code',
        agentId: 'agent_001',
        page: 2,
        pageSize: 50,
      },
    })
  })

  it('returns hasMore true when there are additional pages', async () => {
    const events = Array.from({ length: 20 }, (_, i) => makeTokenEvent({ id: `evt_${i}` }))
    mockedGet.mockResolvedValueOnce({
      data: makePaginatedResponse(events, { total: 200, hasMore: true }),
    })

    const result = await usageService.getEvents({ page: 1, pageSize: 20 })

    expect(result.hasMore).toBe(true)
    expect(result.total).toBe(200)
  })

  it('filters by classification', async () => {
    mockedGet.mockResolvedValueOnce({ data: makePaginatedResponse([]) })

    await usageService.getEvents({ classification: 'fixes' })

    expect(mockedGet.mock.calls[0][1]?.params?.classification).toBe('fixes')
  })

  it('filters by provider', async () => {
    mockedGet.mockResolvedValueOnce({ data: makePaginatedResponse([]) })

    await usageService.getEvents({ provider: 'anthropic' })

    expect(mockedGet.mock.calls[0][1]?.params?.provider).toBe('anthropic')
  })

  it('returns an empty items list when no events match', async () => {
    mockedGet.mockResolvedValueOnce({ data: makePaginatedResponse([]) })

    const result = await usageService.getEvents({ startDate: '2020-01-01', endDate: '2020-01-02' })

    expect(result.items).toEqual([])
    expect(result.hasMore).toBe(false)
  })

  it('propagates API errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Unauthorized'))

    await expect(usageService.getEvents()).rejects.toThrow('Unauthorized')
  })
})

// ---------------------------------------------------------------------------
// getSummary
// ---------------------------------------------------------------------------

describe('usageService.getSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns aggregated usage summary for a date range', async () => {
    const summary = makeUsageSummary()
    mockedGet.mockResolvedValueOnce({ data: summary })

    const result = await usageService.getSummary({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
    })

    expect(mockedGet).toHaveBeenCalledWith('/v1/usage/summary', {
      params: { startDate: '2026-06-01', endDate: '2026-06-14' },
    })
    expect(result.totalTokens).toBe(500_000)
    expect(result.totalCostUsd).toBe(15.75)
    expect(result.topModel).toBe('gpt-4')
  })

  it('passes the groupBy param to the API', async () => {
    mockedGet.mockResolvedValueOnce({ data: makeUsageSummary() })

    await usageService.getSummary({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
      groupBy: 'week',
    })

    expect(mockedGet.mock.calls[0][1]?.params?.groupBy).toBe('week')
  })

  it('accepts day groupBy', async () => {
    mockedGet.mockResolvedValueOnce({ data: makeUsageSummary() })

    await usageService.getSummary({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
      groupBy: 'day',
    })

    expect(mockedGet.mock.calls[0][1]?.params?.groupBy).toBe('day')
  })

  it('accepts month groupBy', async () => {
    mockedGet.mockResolvedValueOnce({ data: makeUsageSummary() })

    await usageService.getSummary({
      startDate: '2026-01-01',
      endDate: '2026-06-14',
      groupBy: 'month',
    })

    expect(mockedGet.mock.calls[0][1]?.params?.groupBy).toBe('month')
  })

  it('includes averages and top classification in the result', async () => {
    mockedGet.mockResolvedValueOnce({ data: makeUsageSummary({ topClassification: 'brainstorm' }) })

    const result = await usageService.getSummary({ startDate: '2026-06-01', endDate: '2026-06-14' })

    expect(result.avgCostPerRequest).toBe(0.013)
    expect(result.avgTokensPerRequest).toBe(416)
    expect(result.topClassification).toBe('brainstorm')
  })

  it('propagates errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Bad request'))

    await expect(
      usageService.getSummary({ startDate: 'invalid', endDate: 'invalid' })
    ).rejects.toThrow('Bad request')
  })
})

// ---------------------------------------------------------------------------
// getSpendTrend
// ---------------------------------------------------------------------------

describe('usageService.getSpendTrend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns spend data points for charting', async () => {
    const points = [
      makeSpendDataPoint({ date: '2026-06-13', totalCost: 1.8 }),
      makeSpendDataPoint({ date: '2026-06-14', totalCost: 2.5 }),
    ]
    mockedGet.mockResolvedValueOnce({ data: points })

    const result = await usageService.getSpendTrend({
      startDate: '2026-06-13',
      endDate: '2026-06-14',
    })

    expect(mockedGet).toHaveBeenCalledWith('/v1/usage/spend-trend', {
      params: { startDate: '2026-06-13', endDate: '2026-06-14' },
    })
    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2026-06-13')
    expect(result[1].totalCost).toBe(2.5)
  })

  it('passes granularity to the API', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    await usageService.getSpendTrend({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
      granularity: 'hour',
    })

    expect(mockedGet.mock.calls[0][1]?.params?.granularity).toBe('hour')
  })

  it('accepts week granularity', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    await usageService.getSpendTrend({
      startDate: '2026-01-01',
      endDate: '2026-06-14',
      granularity: 'week',
    })

    expect(mockedGet.mock.calls[0][1]?.params?.granularity).toBe('week')
  })

  it('includes byClassification breakdown in each data point', async () => {
    const points = [makeSpendDataPoint()]
    mockedGet.mockResolvedValueOnce({ data: points })

    const result = await usageService.getSpendTrend({ startDate: '2026-06-14', endDate: '2026-06-14' })

    expect(result[0].byClassification).toHaveProperty('code')
    expect(result[0].byClassification.code).toBe(1.5)
    expect(result[0].tokens).toBe(80_000)
  })

  it('returns an empty array when no trend data exists', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    const result = await usageService.getSpendTrend({ startDate: '2020-01-01', endDate: '2020-01-02' })

    expect(result).toEqual([])
  })

  it('propagates errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Service unavailable'))

    await expect(
      usageService.getSpendTrend({ startDate: '2026-06-01', endDate: '2026-06-14' })
    ).rejects.toThrow('Service unavailable')
  })
})

// ---------------------------------------------------------------------------
// exportCsv
// ---------------------------------------------------------------------------

describe('usageService.exportCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls GET with responseType blob and returns a Blob', async () => {
    const blob = new Blob(['id,model,tokens\nevt_1,gpt-4,600'], { type: 'text/csv' })
    mockedGet.mockResolvedValueOnce({ data: blob })

    const result = await usageService.exportCsv({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
    })

    expect(mockedGet).toHaveBeenCalledWith('/v1/usage/export', {
      params: { startDate: '2026-06-01', endDate: '2026-06-14' },
      responseType: 'blob',
    })
    expect(result).toBeInstanceOf(Blob)
  })

  it('passes all UsageQueryParams filters to the export endpoint', async () => {
    const blob = new Blob([''], { type: 'text/csv' })
    mockedGet.mockResolvedValueOnce({ data: blob })

    await usageService.exportCsv({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
      provider: 'anthropic',
      model: 'claude-3-opus',
      classification: 'specs',
      agentId: 'agent_007',
    })

    const params = mockedGet.mock.calls[0][1]?.params
    expect(params?.provider).toBe('anthropic')
    expect(params?.model).toBe('claude-3-opus')
    expect(params?.classification).toBe('specs')
    expect(params?.agentId).toBe('agent_007')
  })

  it('sends responseType blob regardless of the params provided', async () => {
    mockedGet.mockResolvedValueOnce({ data: new Blob([]) })

    await usageService.exportCsv({})

    expect(mockedGet.mock.calls[0][1]?.responseType).toBe('blob')
  })

  it('propagates errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Export limit exceeded'))

    await expect(usageService.exportCsv({ startDate: '2026-01-01', endDate: '2026-06-14' })).rejects.toThrow(
      'Export limit exceeded'
    )
  })
})

// ---------------------------------------------------------------------------
// getTopModels
// ---------------------------------------------------------------------------

describe('usageService.getTopModels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns models ranked by cost', async () => {
    const models = [
      { model: 'gpt-4', totalCost: 10.5, totalTokens: 300_000 },
      { model: 'claude-3-opus', totalCost: 7.2, totalTokens: 200_000 },
      { model: 'gpt-3.5-turbo', totalCost: 2.1, totalTokens: 500_000 },
    ]
    mockedGet.mockResolvedValueOnce({ data: models })

    const result = await usageService.getTopModels({ startDate: '2026-06-01', endDate: '2026-06-14' })

    expect(mockedGet).toHaveBeenCalledWith('/v1/usage/top-models', {
      params: { startDate: '2026-06-01', endDate: '2026-06-14' },
    })
    expect(result).toHaveLength(3)
    expect(result[0].model).toBe('gpt-4')
    expect(result[0].totalCost).toBe(10.5)
    expect(result[0].totalTokens).toBe(300_000)
  })

  it('passes the limit param to the API', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    await usageService.getTopModels({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
      limit: 5,
    })

    expect(mockedGet.mock.calls[0][1]?.params?.limit).toBe(5)
  })

  it('returns an empty array when no usage data exists', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    const result = await usageService.getTopModels({ startDate: '2020-01-01', endDate: '2020-01-02' })

    expect(result).toEqual([])
  })

  it('returns a single model when limit is 1', async () => {
    const models = [{ model: 'gpt-4', totalCost: 10.5, totalTokens: 300_000 }]
    mockedGet.mockResolvedValueOnce({ data: models })

    const result = await usageService.getTopModels({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
      limit: 1,
    })

    expect(result).toHaveLength(1)
    expect(result[0].model).toBe('gpt-4')
  })

  it('propagates errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Rate limit exceeded'))

    await expect(
      usageService.getTopModels({ startDate: '2026-06-01', endDate: '2026-06-14' })
    ).rejects.toThrow('Rate limit exceeded')
  })
})
