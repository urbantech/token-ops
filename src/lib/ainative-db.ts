/**
 * AINative Core Database Client
 *
 * Direct read-only access to the production AINative postgres database
 * for real AI usage data (llm_token_usage, credit_transactions, etc.)
 */

import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.AINATIVE_DATABASE_URL;
    if (!connectionString) {
      throw new Error('AINATIVE_DATABASE_URL environment variable is required');
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: connectionString.includes('sslmode=')
        ? { rejectUnauthorized: false }
        : false,
    });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}

/**
 * Spend breakdown by model for a given time range.
 */
export async function getSpendByModel(start: string, end: string) {
  return query<{
    model: string;
    provider: string;
    total_cost: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    event_count: number;
  }>(`
    SELECT
      model,
      provider,
      COALESCE(SUM(cost_usd), 0)::float as total_cost,
      COALESCE(SUM(total_tokens), 0)::float as total_tokens,
      COALESCE(SUM(prompt_tokens), 0)::float as prompt_tokens,
      COALESCE(SUM(completion_tokens), 0)::float as completion_tokens,
      COUNT(*)::int as event_count
    FROM llm_token_usage
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY model, provider
    ORDER BY total_cost DESC
  `, [start, end]);
}

/**
 * Spend breakdown by provider for a given time range.
 */
export async function getSpendByProvider(start: string, end: string) {
  return query<{
    provider: string;
    total_cost: number;
    total_tokens: number;
    event_count: number;
  }>(`
    SELECT
      provider,
      COALESCE(SUM(cost_usd), 0)::float as total_cost,
      COALESCE(SUM(total_tokens), 0)::float as total_tokens,
      COUNT(*)::int as event_count
    FROM llm_token_usage
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY provider
    ORDER BY total_cost DESC
  `, [start, end]);
}

/**
 * Daily/weekly/monthly spend trend.
 */
export async function getSpendTrend(
  start: string,
  end: string,
  granularity: 'hour' | 'day' | 'week' | 'month'
) {
  const truncFn = granularity === 'hour' ? 'hour'
    : granularity === 'day' ? 'day'
    : granularity === 'week' ? 'week'
    : 'month';

  return query<{
    bucket: string;
    total_cost: number;
    total_tokens: number;
    event_count: number;
  }>(`
    SELECT
      DATE_TRUNC($3, created_at)::text as bucket,
      COALESCE(SUM(cost_usd), 0)::float as total_cost,
      COALESCE(SUM(total_tokens), 0)::float as total_tokens,
      COUNT(*)::int as event_count
    FROM llm_token_usage
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY bucket
    ORDER BY bucket ASC
  `, [start, end, truncFn]);
}

/**
 * Total spend summary for a time range.
 */
export async function getSpendSummary(start: string, end: string) {
  const rows = await query<{
    total_cost: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    event_count: number;
    unique_models: number;
    unique_providers: number;
  }>(`
    SELECT
      COALESCE(SUM(cost_usd), 0)::float as total_cost,
      COALESCE(SUM(total_tokens), 0)::float as total_tokens,
      COALESCE(SUM(prompt_tokens), 0)::float as prompt_tokens,
      COALESCE(SUM(completion_tokens), 0)::float as completion_tokens,
      COUNT(*)::int as event_count,
      COUNT(DISTINCT model)::int as unique_models,
      COUNT(DISTINCT provider)::int as unique_providers
    FROM llm_token_usage
    WHERE created_at >= $1 AND created_at <= $2
  `, [start, end]);
  return rows[0];
}

/**
 * Top models by spend.
 */
export async function getTopModels(start: string, end: string, limit = 10) {
  return query<{
    model: string;
    provider: string;
    total_cost: number;
    total_tokens: number;
    event_count: number;
    avg_tokens_per_request: number;
  }>(`
    SELECT
      model,
      provider,
      COALESCE(SUM(cost_usd), 0)::float as total_cost,
      COALESCE(SUM(total_tokens), 0)::float as total_tokens,
      COUNT(*)::int as event_count,
      COALESCE(AVG(total_tokens), 0)::int as avg_tokens_per_request
    FROM llm_token_usage
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY model, provider
    ORDER BY total_cost DESC
    LIMIT $3
  `, [start, end, limit]);
}
