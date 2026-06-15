import apiClient from '@/lib/api-client'
import type { AgentMetrics, PaginatedResponse } from '@/types'

export const agentsService = {
  /**
   * Fetch metrics for all agents
   */
  async listAgents(params?: {
    page?: number
    pageSize?: number
    sortBy?: 'cost' | 'tokens' | 'requests' | 'latency'
    order?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<AgentMetrics>> {
    const { data } = await apiClient.get('/v1/agents/metrics', { params })
    return data
  },

  /**
   * Get detailed metrics for a single agent
   */
  async getAgent(agentId: string): Promise<AgentMetrics> {
    const { data } = await apiClient.get(`/v1/agents/${agentId}/metrics`)
    return data
  },

  /**
   * Get cost leaderboard (top N most expensive agents)
   */
  async getLeaderboard(params?: {
    limit?: number
    period?: 'today' | '7d' | '30d'
  }): Promise<AgentMetrics[]> {
    const { data } = await apiClient.get('/v1/agents/leaderboard', { params })
    return data
  },

  /**
   * Get model routing recommendations for an agent
   */
  async getRoutingRecommendations(agentId: string): Promise<
    Array<{
      currentModel: string
      suggestedModel: string
      estimatedSavingsPercent: number
      qualityImpact: 'none' | 'minimal' | 'moderate'
    }>
  > {
    const { data } = await apiClient.get(
      `/v1/agents/${agentId}/routing-recommendations`
    )
    return data
  },
}
