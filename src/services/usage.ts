import apiClient from '@/lib/api-client'
import type {
  TokenEvent,
  UsageSummary,
  SpendDataPoint,
  PaginatedResponse,
  Classification,
} from '@/types'

export interface UsageQueryParams {
  startDate?: string
  endDate?: string
  provider?: string
  model?: string
  classification?: Classification
  agentId?: string
  page?: number
  pageSize?: number
}

export const usageService = {
  /**
   * Fetch paginated token usage events
   */
  async getEvents(
    params: UsageQueryParams = {}
  ): Promise<PaginatedResponse<TokenEvent>> {
    const { data } = await apiClient.get('/v1/usage/events', { params })
    return data
  },

  /**
   * Fetch aggregated usage summary for a date range
   */
  async getSummary(params: {
    startDate: string
    endDate: string
    groupBy?: 'day' | 'week' | 'month'
  }): Promise<UsageSummary> {
    const { data } = await apiClient.get('/v1/usage/summary', { params })
    return data
  },

  /**
   * Fetch spend trend data points for charting
   */
  async getSpendTrend(params: {
    startDate: string
    endDate: string
    granularity?: 'hour' | 'day' | 'week'
  }): Promise<SpendDataPoint[]> {
    const { data } = await apiClient.get('/v1/usage/spend-trend', { params })
    return data
  },

  /**
   * Export usage data as CSV
   */
  async exportCsv(params: UsageQueryParams): Promise<Blob> {
    const { data } = await apiClient.get('/v1/usage/export', {
      params,
      responseType: 'blob',
    })
    return data
  },

  /**
   * Get top models by cost in a date range
   */
  async getTopModels(params: {
    startDate: string
    endDate: string
    limit?: number
  }): Promise<Array<{ model: string; totalCost: number; totalTokens: number }>> {
    const { data } = await apiClient.get('/v1/usage/top-models', { params })
    return data
  },
}
