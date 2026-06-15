/**
 * Tests for Billing / Cost Calculation Service
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
import { billingService } from '../billing'
import type { CostBreakdown, BudgetPolicy, SavingsOpportunity } from '@/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCostBreakdown(overrides: Partial<CostBreakdown> = {}): CostBreakdown {
  return {
    total: 12.50,
    byClassification: {
      specs: 1.0,
      brainstorm: 2.0,
      code: 5.0,
      fixes: 3.0,
      batch: 1.0,
      unknown: 0.5,
    },
    byModel: { 'gpt-4': 8.0, 'gpt-3.5-turbo': 4.5 },
    byProvider: { openai: 12.5 },
    byAgent: { agent_001: 7.0, agent_002: 5.5 },
    period: { start: '2026-06-01', end: '2026-06-14' },
    ...overrides,
  }
}

function makeBudgetPolicy(overrides: Partial<BudgetPolicy> = {}): BudgetPolicy {
  return {
    id: 'policy_001',
    name: 'Team Alpha Budget',
    targetType: 'team',
    targetId: 'team_alpha',
    monthlyLimitUsd: 500,
    alertThresholdPercent: 80,
    currentSpendUsd: 320,
    status: 'ok',
    ...overrides,
  }
}

function makeSavingsOpportunity(overrides: Partial<SavingsOpportunity> = {}): SavingsOpportunity {
  return {
    id: 'opp_001',
    type: 'model_downgrade',
    title: 'Switch to GPT-3.5 Turbo',
    description: 'Tasks classified as brainstorm can use a cheaper model',
    estimatedMonthlySavingsUsd: 45.0,
    effortLevel: 'low',
    affectedAgents: ['agent_001'],
    affectedModels: ['gpt-4'],
    priority: 'high',
    ...overrides,
  }
}

const mockedGet = vi.mocked(apiClient.get)
const mockedPost = vi.mocked(apiClient.post)
const mockedDelete = vi.mocked(apiClient.delete)

// ---------------------------------------------------------------------------
// getCostBreakdown
// ---------------------------------------------------------------------------

describe('billingService.getCostBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns cost breakdown for the requested period', async () => {
    const breakdown = makeCostBreakdown()
    mockedGet.mockResolvedValueOnce({ data: breakdown })

    const result = await billingService.getCostBreakdown({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
    })

    expect(mockedGet).toHaveBeenCalledWith('/v1/billing/cost-breakdown', {
      params: { startDate: '2026-06-01', endDate: '2026-06-14' },
    })
    expect(result.total).toBe(12.5)
    expect(result.period.start).toBe('2026-06-01')
    expect(result.period.end).toBe('2026-06-14')
  })

  it('returns a breakdown with data for all classification categories', async () => {
    mockedGet.mockResolvedValueOnce({ data: makeCostBreakdown() })

    const result = await billingService.getCostBreakdown({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
    })

    expect(result.byClassification).toHaveProperty('specs')
    expect(result.byClassification).toHaveProperty('brainstorm')
    expect(result.byClassification).toHaveProperty('code')
    expect(result.byClassification).toHaveProperty('fixes')
    expect(result.byClassification).toHaveProperty('batch')
    expect(result.byClassification).toHaveProperty('unknown')
  })

  it('returns per-model and per-provider breakdowns', async () => {
    mockedGet.mockResolvedValueOnce({ data: makeCostBreakdown() })

    const result = await billingService.getCostBreakdown({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
    })

    expect(result.byModel['gpt-4']).toBe(8.0)
    expect(result.byProvider['openai']).toBe(12.5)
  })

  it('propagates API errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Unauthorized'))

    await expect(
      billingService.getCostBreakdown({ startDate: '2026-06-01', endDate: '2026-06-14' })
    ).rejects.toThrow('Unauthorized')
  })
})

// ---------------------------------------------------------------------------
// getCredits
// ---------------------------------------------------------------------------

describe('billingService.getCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns current credit balance, usage, limit, and reset date', async () => {
    const credits = { balance: 75.0, used: 25.0, limit: 100.0, resetDate: '2026-07-01' }
    mockedGet.mockResolvedValueOnce({ data: credits })

    const result = await billingService.getCredits()

    expect(mockedGet).toHaveBeenCalledWith('/v1/billing/credits')
    expect(result.balance).toBe(75.0)
    expect(result.used).toBe(25.0)
    expect(result.limit).toBe(100.0)
    expect(result.resetDate).toBe('2026-07-01')
  })

  it('returns zero balance when all credits are consumed', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { balance: 0, used: 100.0, limit: 100.0, resetDate: '2026-07-01' },
    })

    const result = await billingService.getCredits()

    expect(result.balance).toBe(0)
    expect(result.used).toBe(100.0)
  })

  it('propagates server errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Internal server error'))

    await expect(billingService.getCredits()).rejects.toThrow('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// getSavingsOpportunities
// ---------------------------------------------------------------------------

describe('billingService.getSavingsOpportunities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a list of savings opportunities', async () => {
    const opportunities = [
      makeSavingsOpportunity({ id: 'opp_001', type: 'model_downgrade' }),
      makeSavingsOpportunity({ id: 'opp_002', type: 'prompt_compression', estimatedMonthlySavingsUsd: 20 }),
    ]
    mockedGet.mockResolvedValueOnce({ data: opportunities })

    const result = await billingService.getSavingsOpportunities()

    expect(mockedGet).toHaveBeenCalledWith('/v1/billing/savings-opportunities')
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('model_downgrade')
    expect(result[1].estimatedMonthlySavingsUsd).toBe(20)
  })

  it('returns an empty array when no savings are identified', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    const result = await billingService.getSavingsOpportunities()

    expect(result).toEqual([])
  })

  it('includes all opportunity type fields in responses', async () => {
    const opp = makeSavingsOpportunity({ type: 'caching', effortLevel: 'medium', priority: 'critical' })
    mockedGet.mockResolvedValueOnce({ data: [opp] })

    const result = await billingService.getSavingsOpportunities()

    expect(result[0].effortLevel).toBe('medium')
    expect(result[0].priority).toBe('critical')
    expect(result[0].affectedAgents).toEqual(['agent_001'])
  })

  it('propagates errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Service unavailable'))

    await expect(billingService.getSavingsOpportunities()).rejects.toThrow('Service unavailable')
  })
})

// ---------------------------------------------------------------------------
// getBudgetPolicies
// ---------------------------------------------------------------------------

describe('billingService.getBudgetPolicies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all budget policies', async () => {
    const policies = [
      makeBudgetPolicy({ id: 'policy_001' }),
      makeBudgetPolicy({ id: 'policy_002', targetType: 'agent', status: 'warning' }),
    ]
    mockedGet.mockResolvedValueOnce({ data: policies })

    const result = await billingService.getBudgetPolicies()

    expect(mockedGet).toHaveBeenCalledWith('/v1/billing/budget-policies')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('policy_001')
    expect(result[1].status).toBe('warning')
  })

  it('returns an empty array when no policies exist', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    const result = await billingService.getBudgetPolicies()

    expect(result).toEqual([])
  })

  it('propagates errors to the caller', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Not found'))

    await expect(billingService.getBudgetPolicies()).rejects.toThrow('Not found')
  })
})

// ---------------------------------------------------------------------------
// upsertBudgetPolicy
// ---------------------------------------------------------------------------

describe('billingService.upsertBudgetPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new budget policy and returns it with server-assigned fields', async () => {
    const serverPolicy = makeBudgetPolicy({ id: 'policy_new', currentSpendUsd: 0, status: 'ok' })
    mockedPost.mockResolvedValueOnce({ data: serverPolicy })

    const payload = {
      name: 'Team Alpha Budget',
      targetType: 'team' as const,
      targetId: 'team_alpha',
      monthlyLimitUsd: 500,
      alertThresholdPercent: 80,
    }
    const result = await billingService.upsertBudgetPolicy(payload)

    expect(mockedPost).toHaveBeenCalledWith('/v1/billing/budget-policies', payload)
    expect(result.id).toBe('policy_new')
    expect(result.currentSpendUsd).toBe(0)
  })

  it('updates an existing policy when an id is provided', async () => {
    const updatedPolicy = makeBudgetPolicy({ id: 'policy_001', monthlyLimitUsd: 750 })
    mockedPost.mockResolvedValueOnce({ data: updatedPolicy })

    const payload = {
      id: 'policy_001',
      name: 'Team Alpha Budget',
      targetType: 'team' as const,
      targetId: 'team_alpha',
      monthlyLimitUsd: 750,
      alertThresholdPercent: 80,
    }
    const result = await billingService.upsertBudgetPolicy(payload)

    expect(mockedPost).toHaveBeenCalledWith('/v1/billing/budget-policies', payload)
    expect(result.monthlyLimitUsd).toBe(750)
  })

  it('accepts all target types', async () => {
    const types: Array<BudgetPolicy['targetType']> = ['agent', 'team', 'project', 'classification']

    for (const targetType of types) {
      mockedPost.mockResolvedValueOnce({ data: makeBudgetPolicy({ targetType }) })

      const result = await billingService.upsertBudgetPolicy({
        name: 'Policy',
        targetType,
        targetId: 'target_1',
        monthlyLimitUsd: 100,
        alertThresholdPercent: 90,
      })

      expect(result.targetType).toBe(targetType)
    }
  })

  it('propagates validation errors from the API', async () => {
    mockedPost.mockRejectedValueOnce(new Error('monthlyLimitUsd must be positive'))

    await expect(
      billingService.upsertBudgetPolicy({
        name: 'Bad Policy',
        targetType: 'team',
        targetId: 'team_1',
        monthlyLimitUsd: -50,
        alertThresholdPercent: 80,
      })
    ).rejects.toThrow('monthlyLimitUsd must be positive')
  })
})

// ---------------------------------------------------------------------------
// deleteBudgetPolicy
// ---------------------------------------------------------------------------

describe('billingService.deleteBudgetPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls DELETE with the correct policy id path', async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined })

    await billingService.deleteBudgetPolicy('policy_001')

    expect(mockedDelete).toHaveBeenCalledWith('/v1/billing/budget-policies/policy_001')
  })

  it('resolves without a return value on success', async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined })

    const result = await billingService.deleteBudgetPolicy('policy_001')

    expect(result).toBeUndefined()
  })

  it('uses the policy id verbatim in the URL path', async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined })

    await billingService.deleteBudgetPolicy('policy-uuid-9999')

    expect(mockedDelete).toHaveBeenCalledWith('/v1/billing/budget-policies/policy-uuid-9999')
  })

  it('propagates 404 errors when the policy does not exist', async () => {
    mockedDelete.mockRejectedValueOnce(new Error('Not found'))

    await expect(billingService.deleteBudgetPolicy('nonexistent')).rejects.toThrow('Not found')
  })

  it('propagates authorization errors', async () => {
    mockedDelete.mockRejectedValueOnce(new Error('Forbidden'))

    await expect(billingService.deleteBudgetPolicy('policy_001')).rejects.toThrow('Forbidden')
  })
})
