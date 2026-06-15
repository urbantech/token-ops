/**
 * ZeroDB TypeScript Client for TokenOps
 *
 * Communicates with the AINative ZeroDB API for structured data storage.
 * Modeled after core/zerodb-memory-mcp/src/client/zerodb-client.js but
 * focused on the NoSQL table and event APIs needed for telemetry.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZeroDBClientConfig {
  apiUrl?: string;
  apiKey?: string;
  projectId?: string;
}

export interface TableColumn {
  name: string;
  type: 'string' | 'integer' | 'float' | 'boolean' | 'json' | 'timestamp';
  nullable?: boolean;
  default?: unknown;
}

export interface CreateTableParams {
  tableName: string;
  columns: TableColumn[];
}

export interface InsertRowsParams {
  tableName: string;
  rows: Record<string, unknown>[];
}

export interface QueryRowsParams {
  tableName: string;
  filters?: Record<string, unknown>;
  orderBy?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface QueryRowsResponse {
  rows: Record<string, unknown>[];
  total: number;
}

export interface CreateEventParams {
  eventType: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ListEventsParams {
  eventType?: string;
  limit?: number;
  offset?: number;
  startTime?: string;
  endTime?: string;
}

export interface ZeroDBEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ZeroDBClient {
  private apiUrl: string;
  private apiKey: string;
  private projectId: string;
  private http: AxiosInstance;

  constructor(config: ZeroDBClientConfig = {}) {
    this.apiUrl = config.apiUrl || process.env.AINATIVE_API_URL || 'https://api.ainative.studio';
    this.apiKey = config.apiKey || process.env.AINATIVE_API_KEY || '';
    this.projectId = config.projectId || process.env.ZERODB_PROJECT_ID || '';

    if (!this.apiKey) {
      throw new Error(
        'ZeroDB client requires an API key. Set AINATIVE_API_KEY environment variable or pass apiKey in config.'
      );
    }

    this.http = axios.create({
      baseURL: this.apiUrl,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...(this.projectId ? { 'X-Project-ID': this.projectId } : {}),
      },
    });
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Execute an authenticated request with automatic retry on 401.
   */
  private async request<T = unknown>(
    method: string,
    path: string,
    data?: unknown
  ): Promise<T> {
    const config: AxiosRequestConfig & { _retried?: boolean } = {
      method,
      url: path,
      ...(data !== undefined ? { data } : {}),
    };

    try {
      const response = await this.http.request<T>(config);
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const detail = error.response?.data?.detail;
        const message =
          typeof detail === 'object'
            ? JSON.stringify(detail)
            : detail || error.message;

        // Surface a clear error
        throw new Error(
          `ZeroDB API error (${status ?? 'network'}): ${message}`
        );
      }
      throw error;
    }
  }

  private get basePath(): string {
    return `/api/v1/projects/${this.projectId}/database`;
  }

  // -----------------------------------------------------------------------
  // Table operations
  // -----------------------------------------------------------------------

  /**
   * Create a table in the project database.
   */
  async createTable(params: CreateTableParams): Promise<Record<string, unknown>> {
    return this.request('POST', `${this.basePath}/tables`, {
      table_name: params.tableName,
      columns: params.columns.map((col) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable ?? true,
        default: col.default ?? null,
      })),
    });
  }

  /**
   * Insert one or more rows into a table.
   * ZeroDB API accepts one row at a time via `row_data` (dict),
   * so we iterate if multiple rows are provided.
   */
  async insertRows(params: InsertRowsParams): Promise<Record<string, unknown>> {
    let lastResult: Record<string, unknown> = {};
    for (const row of params.rows) {
      lastResult = await this.request('POST', `${this.basePath}/tables/${params.tableName}/rows`, {
        row_data: row,
      });
    }
    return lastResult;
  }

  /**
   * Query rows from a table with optional filters, ordering, and pagination.
   * ZeroDB returns { data: [{ row_data: {...} }], total }, we normalize to { rows, total }.
   */
  async queryRows(params: QueryRowsParams): Promise<QueryRowsResponse> {
    const raw = await this.request<{
      data?: { row_data: Record<string, unknown> }[];
      rows?: Record<string, unknown>[];
      total?: number;
    }>('POST', `${this.basePath}/tables/${params.tableName}/query`, {
      filters: params.filters ?? {},
      order_by: params.orderBy,
      order: params.order ?? 'desc',
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    });

    // Normalize: ZeroDB wraps each row in { row_data: ... }
    const rows = raw.data
      ? raw.data.map((item) => item.row_data ?? item)
      : raw.rows ?? [];

    return { rows, total: raw.total ?? rows.length };
  }

  // -----------------------------------------------------------------------
  // Event operations
  // -----------------------------------------------------------------------

  /**
   * Create a timestamped event in ZeroDB.
   */
  async createEvent(params: CreateEventParams): Promise<ZeroDBEvent> {
    return this.request('POST', `${this.basePath}/events`, {
      event_type: params.eventType,
      payload: params.payload,
      metadata: params.metadata ?? {},
    });
  }

  /**
   * List events with optional filtering.
   */
  async listEvents(params: ListEventsParams = {}): Promise<{ events: ZeroDBEvent[]; total: number }> {
    return this.request('POST', `${this.basePath}/events/query`, {
      event_type: params.eventType,
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
      start_time: params.startTime,
      end_time: params.endTime,
    });
  }

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  /**
   * Lightweight health check against the API.
   */
  async healthCheck(): Promise<{ status: string }> {
    try {
      const response = await axios.get(`${this.apiUrl}/health`, { timeout: 5_000 });
      return response.data;
    } catch {
      return { status: 'unhealthy' };
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _client: ZeroDBClient | null = null;

/**
 * Get (or create) the shared ZeroDB client instance.
 * Safe to call from hot-reloaded Next.js API routes.
 */
export function getZeroDBClient(config?: ZeroDBClientConfig): ZeroDBClient {
  if (!_client) {
    _client = new ZeroDBClient(config);
  }
  return _client;
}
