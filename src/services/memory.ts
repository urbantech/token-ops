import apiClient from '@/lib/api-client'
import type { MemoryMetrics } from '@/types'

export const memoryService = {
  /**
   * Fetch ZeroMemory usage metrics
   */
  async getMetrics(agentId?: string): Promise<MemoryMetrics> {
    const { data } = await apiClient.get('/v1/memory/metrics', {
      params: agentId ? { agent_id: agentId } : undefined,
    })
    return data
  },

  /**
   * Trigger memory consolidation (episodic → semantic)
   */
  async triggerConsolidation(entityId: string): Promise<{ jobId: string }> {
    const { data } = await apiClient.post('/v1/memory/consolidate', {
      entity_id: entityId,
    })
    return data
  },

  /**
   * Find and list duplicate memory entries
   */
  async findDuplicates(params?: {
    threshold?: number
    agentId?: string
  }): Promise<
    Array<{ groupId: string; entries: string[]; potentialSavingsTokens: number }>
  > {
    const { data } = await apiClient.get('/v1/memory/duplicates', { params })
    return data
  },

  /**
   * Prune stale or redundant memories
   */
  async pruneStale(params: {
    olderThanDays: number
    agentId?: string
    dryRun?: boolean
  }): Promise<{ pruned: number; tokensSaved: number }> {
    const { data } = await apiClient.post('/v1/memory/prune', params)
    return data
  },
}
