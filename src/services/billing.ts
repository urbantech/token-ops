import apiClient from '@/lib/api-client'
import type { CostBreakdown, BudgetPolicy, SavingsOpportunity } from '@/types'

export const billingService = {
  /**
   * Fetch detailed cost breakdown for a period
   */
  async getCostBreakdown(params: {
    startDate: string
    endDate: string
  }): Promise<CostBreakdown> {
    const { data } = await apiClient.get('/v1/billing/cost-breakdown', {
      params,
    })
    return data
  },

  /**
   * Fetch current credit balance and usage
   */
  async getCredits(): Promise<{
    balance: number
    used: number
    limit: number
    resetDate: string
  }> {
    const { data } = await apiClient.get('/v1/billing/credits')
    return data
  },

  /**
   * Fetch savings opportunities identified by analysis
   */
  async getSavingsOpportunities(): Promise<SavingsOpportunity[]> {
    const { data } = await apiClient.get('/v1/billing/savings-opportunities')
    return data
  },

  /**
   * Fetch all budget policies
   */
  async getBudgetPolicies(): Promise<BudgetPolicy[]> {
    const { data } = await apiClient.get('/v1/billing/budget-policies')
    return data
  },

  /**
   * Create or update a budget policy
   */
  async upsertBudgetPolicy(
    policy: Omit<BudgetPolicy, 'id' | 'currentSpendUsd' | 'status'> & {
      id?: string
    }
  ): Promise<BudgetPolicy> {
    const { data } = await apiClient.post('/v1/billing/budget-policies', policy)
    return data
  },

  /**
   * Delete a budget policy
   */
  async deleteBudgetPolicy(id: string): Promise<void> {
    await apiClient.delete(`/v1/billing/budget-policies/${id}`)
  },
}
