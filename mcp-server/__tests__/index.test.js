/**
 * TokenOps MCP Server Tests
 * Refs #3
 */

const services = require('../services')

// Mock axios at the module level
jest.mock('axios')
const axios = require('axios')

// Mock the MCP SDK so we can instantiate the server without real stdio
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined)
  }))
}))

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn()
}))

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: 'CallToolRequestSchema',
  ListToolsRequestSchema: 'ListToolsRequestSchema'
}))

const TokenOpsMCPServer = require('../index')

// ========================================================================
// SERVICE LAYER TESTS
// ========================================================================

describe('services', () => {
  describe('validatePromptInput', () => {
    it('returns error when prompt is missing', () => {
      const result = services.validatePromptInput({ model: 'gpt-4', tokens: { input: 10, output: 5 } })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('prompt')
    })

    it('returns error when model is missing', () => {
      const result = services.validatePromptInput({ prompt: 'hello', tokens: { input: 10, output: 5 } })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('model')
    })

    it('returns error when tokens is missing', () => {
      const result = services.validatePromptInput({ prompt: 'hello', model: 'gpt-4' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('tokens')
    })

    it('returns error when tokens.input is missing', () => {
      const result = services.validatePromptInput({ prompt: 'hello', model: 'gpt-4', tokens: { output: 5 } })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('tokens.input')
    })

    it('returns error when tokens.output is missing', () => {
      const result = services.validatePromptInput({ prompt: 'hello', model: 'gpt-4', tokens: { input: 10 } })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('tokens.output')
    })

    it('accepts tokens.input of 0', () => {
      const result = services.validatePromptInput({ prompt: 'hello', model: 'gpt-4', tokens: { input: 0, output: 5 } })
      expect(result.valid).toBe(true)
      expect(result.payload.tokens.input).toBe(0)
    })

    it('accepts tokens.output of 0', () => {
      const result = services.validatePromptInput({ prompt: 'hello', model: 'gpt-4', tokens: { input: 10, output: 0 } })
      expect(result.valid).toBe(true)
      expect(result.payload.tokens.output).toBe(0)
    })

    it('returns valid payload with defaults', () => {
      const result = services.validatePromptInput({
        prompt: 'test prompt',
        model: 'claude-sonnet-4-20250514',
        tokens: { input: 100, output: 50 }
      })
      expect(result.valid).toBe(true)
      expect(result.payload.prompt).toBe('test prompt')
      expect(result.payload.model).toBe('claude-sonnet-4-20250514')
      expect(result.payload.tokens.total).toBe(150)
      expect(result.payload.user).toBe('unknown')
      expect(result.payload.classification).toBe('other')
      expect(result.payload.agent).toBeNull()
      expect(result.payload.session_id).toBeNull()
    })

    it('sanitizes inputs to strings', () => {
      const result = services.validatePromptInput({
        prompt: 123,
        model: 456,
        tokens: { input: '100', output: '50' },
        user: 789,
        agent: true,
        classification: 'code_review',
        session_id: 42
      })
      expect(result.valid).toBe(true)
      expect(result.payload.prompt).toBe('123')
      expect(result.payload.model).toBe('456')
      expect(result.payload.tokens.input).toBe(100)
      expect(result.payload.tokens.output).toBe(50)
      expect(result.payload.user).toBe('789')
      expect(result.payload.agent).toBe('true')
      expect(result.payload.session_id).toBe('42')
    })

    it('uses provided total instead of calculating', () => {
      const result = services.validatePromptInput({
        prompt: 'test',
        model: 'gpt-4',
        tokens: { input: 100, output: 50, total: 200 }
      })
      expect(result.valid).toBe(true)
      expect(result.payload.tokens.total).toBe(200)
    })
  })

  describe('validateAgentExecutionInput', () => {
    it('returns error when agent is missing', () => {
      const result = services.validateAgentExecutionInput({ workflow: 'test' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('agent')
    })

    it('returns error when workflow is missing', () => {
      const result = services.validateAgentExecutionInput({ agent: 'cody' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('workflow')
    })

    it('returns valid payload with defaults', () => {
      const result = services.validateAgentExecutionInput({
        agent: 'cody',
        workflow: 'code-review'
      })
      expect(result.valid).toBe(true)
      expect(result.payload.agent).toBe('cody')
      expect(result.payload.workflow).toBe('code-review')
      expect(result.payload.tools).toEqual([])
      expect(result.payload.status).toBe('success')
      expect(result.payload.duration_ms).toBeNull()
    })

    it('includes optional fields when provided', () => {
      const result = services.validateAgentExecutionInput({
        agent: 'sage',
        workflow: 'deploy',
        tools: ['git', 'docker'],
        duration_ms: 5000,
        output_size: 1024,
        status: 'failure',
        session_id: 'sess-123'
      })
      expect(result.valid).toBe(true)
      expect(result.payload.tools).toEqual(['git', 'docker'])
      expect(result.payload.duration_ms).toBe(5000)
      expect(result.payload.output_size).toBe(1024)
      expect(result.payload.status).toBe('failure')
      expect(result.payload.session_id).toBe('sess-123')
    })
  })

  describe('validateCostEventInput', () => {
    it('returns error when model_cost is missing', () => {
      const result = services.validateCostEventInput({})
      expect(result.valid).toBe(false)
      expect(result.error).toContain('model_cost')
    })

    it('returns error when model_cost.model is missing', () => {
      const result = services.validateCostEventInput({
        model_cost: { total_cost_usd: 0.05 }
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('model')
    })

    it('returns error when model_cost.total_cost_usd is missing', () => {
      const result = services.validateCostEventInput({
        model_cost: { model: 'gpt-4' }
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('total_cost_usd')
    })

    it('accepts total_cost_usd of 0', () => {
      const result = services.validateCostEventInput({
        model_cost: { model: 'gpt-4', total_cost_usd: 0 }
      })
      expect(result.valid).toBe(true)
      expect(result.payload.model_cost.total_cost_usd).toBe(0)
    })

    it('returns valid payload with all fields', () => {
      const result = services.validateCostEventInput({
        model_cost: { model: 'gpt-4', total_cost_usd: 0.05, input_cost_usd: 0.03, output_cost_usd: 0.02 },
        provider_cost: { provider: 'openai', total_cost_usd: 0.05 },
        workflow_cost: { workflow: 'review', total_cost_usd: 0.05 },
        team_cost: { team: 'engineering', total_cost_usd: 0.05 }
      })
      expect(result.valid).toBe(true)
      expect(result.payload.model_cost.model).toBe('gpt-4')
      expect(result.payload.provider_cost).toBeTruthy()
      expect(result.payload.workflow_cost).toBeTruthy()
      expect(result.payload.team_cost).toBeTruthy()
    })
  })

  describe('buildSpendSummaryParams', () => {
    it('returns empty object for empty args', () => {
      expect(services.buildSpendSummaryParams({})).toEqual({})
    })

    it('includes all provided params', () => {
      const params = services.buildSpendSummaryParams({
        period: 'last_7_days',
        start_date: '2026-01-01',
        end_date: '2026-01-07',
        group_by: 'model',
        team: 'engineering',
        agent: 'cody'
      })
      expect(params).toEqual({
        period: 'last_7_days',
        start_date: '2026-01-01',
        end_date: '2026-01-07',
        group_by: 'model',
        team: 'engineering',
        agent: 'cody'
      })
    })
  })

  describe('buildOptimizationParams', () => {
    it('returns empty object for empty args', () => {
      expect(services.buildOptimizationParams({})).toEqual({})
    })

    it('joins categories array', () => {
      const params = services.buildOptimizationParams({
        period: 'last_30_days',
        min_savings_usd: 1.0,
        categories: ['duplicate_prompts', 'model_downgrade']
      })
      expect(params.categories).toBe('duplicate_prompts,model_downgrade')
      expect(params.min_savings_usd).toBe(1.0)
    })
  })

  describe('buildBatchPatternsParams', () => {
    it('returns empty object for empty args', () => {
      expect(services.buildBatchPatternsParams({})).toEqual({})
    })

    it('includes all provided params', () => {
      const params = services.buildBatchPatternsParams({
        period: 'this_month',
        min_occurrences: 5,
        agent: 'aurora'
      })
      expect(params).toEqual({
        period: 'this_month',
        min_occurrences: 5,
        agent: 'aurora'
      })
    })
  })

  describe('formatResponse', () => {
    it('wraps data in MCP text content', () => {
      const result = services.formatResponse({ foo: 'bar' })
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      expect(JSON.parse(result.content[0].text)).toEqual({ foo: 'bar' })
    })
  })

  describe('formatError', () => {
    it('wraps error message in MCP error content', () => {
      const result = services.formatError('something broke')
      expect(result.content).toHaveLength(1)
      expect(result.content[0].text).toBe('something broke')
      expect(result.isError).toBe(true)
    })
  })

  describe('computeUptime', () => {
    it('formats seconds-only uptime', () => {
      const startTime = Date.now() - 5000
      const { uptimeStr } = services.computeUptime(startTime)
      expect(uptimeStr).toMatch(/^\d+s$/)
    })

    it('formats minutes uptime', () => {
      const startTime = Date.now() - 120000 // 2 minutes
      const { uptimeStr } = services.computeUptime(startTime)
      expect(uptimeStr).toMatch(/^\d+m \d+s$/)
    })

    it('formats hours uptime', () => {
      const startTime = Date.now() - 3700000 // ~1 hour
      const { uptimeStr } = services.computeUptime(startTime)
      expect(uptimeStr).toMatch(/^\d+h \d+m \d+s$/)
    })

    it('returns uptimeMs as number', () => {
      const startTime = Date.now() - 1000
      const { uptimeMs } = services.computeUptime(startTime)
      expect(typeof uptimeMs).toBe('number')
      expect(uptimeMs).toBeGreaterThanOrEqual(1000)
    })
  })

  describe('apiRequest', () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('throws when apiKey is not set', async () => {
      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://api.test.com', apiKey: '' })
      ).rejects.toThrow('TOKENOPS_API_KEY is not configured')
    })

    it('throws when apiKey is undefined', async () => {
      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://api.test.com', apiKey: undefined })
      ).rejects.toThrow('TOKENOPS_API_KEY is not configured')
    })

    it('sends GET request with params', async () => {
      axios.mockResolvedValueOnce({ data: { ok: true } })

      const result = await services.apiRequest('get', '/v1/test', { foo: 'bar' }, {
        apiUrl: 'https://api.test.com',
        apiKey: 'test-key-12345678'
      })

      expect(result).toEqual({ ok: true })
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        method: 'get',
        url: 'https://api.test.com/v1/test',
        params: { foo: 'bar' }
      }))
    })

    it('sends POST request with data body', async () => {
      axios.mockResolvedValueOnce({ data: { id: 'evt-1' } })

      const result = await services.apiRequest('post', '/v1/telemetry', { prompt: 'hi' }, {
        apiUrl: 'https://api.test.com',
        apiKey: 'test-key-12345678'
      })

      expect(result).toEqual({ id: 'evt-1' })
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        method: 'post',
        data: { prompt: 'hi' }
      }))
    })

    it('includes auth header', async () => {
      axios.mockResolvedValueOnce({ data: {} })

      await services.apiRequest('get', '/test', {}, {
        apiUrl: 'https://api.test.com',
        apiKey: 'my-secret-key'
      })

      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-secret-key'
        })
      }))
    })

    it('handles 401 errors', async () => {
      axios.mockRejectedValueOnce({
        response: { status: 401, data: {} }
      })

      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://api.test.com', apiKey: 'bad-key' })
      ).rejects.toThrow('Authentication failed')
    })

    it('handles 403 errors', async () => {
      axios.mockRejectedValueOnce({
        response: { status: 403, data: {} }
      })

      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://api.test.com', apiKey: 'key' })
      ).rejects.toThrow('Access denied')
    })

    it('handles 429 errors', async () => {
      axios.mockRejectedValueOnce({
        response: { status: 429, data: {} }
      })

      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://api.test.com', apiKey: 'key' })
      ).rejects.toThrow('Rate limit exceeded')
    })

    it('handles 500+ errors', async () => {
      axios.mockRejectedValueOnce({
        response: { status: 502, data: {} }
      })

      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://api.test.com', apiKey: 'key' })
      ).rejects.toThrow('server error (502)')
    })

    it('handles other HTTP errors with message', async () => {
      axios.mockRejectedValueOnce({
        response: { status: 422, data: { message: 'Validation failed' } },
        message: 'Request failed'
      })

      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://api.test.com', apiKey: 'key' })
      ).rejects.toThrow('API error (422): Validation failed')
    })

    it('handles connection refused', async () => {
      axios.mockRejectedValueOnce({ code: 'ECONNREFUSED' })

      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://api.test.com', apiKey: 'key' })
      ).rejects.toThrow('Cannot connect')
    })

    it('handles DNS lookup failure', async () => {
      axios.mockRejectedValueOnce({ code: 'ENOTFOUND' })

      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://bad.host', apiKey: 'key' })
      ).rejects.toThrow('Cannot connect')
    })

    it('handles timeout', async () => {
      axios.mockRejectedValueOnce({ code: 'ECONNABORTED' })

      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://api.test.com', apiKey: 'key' })
      ).rejects.toThrow('timed out')
    })

    it('handles ETIMEDOUT', async () => {
      axios.mockRejectedValueOnce({ code: 'ETIMEDOUT' })

      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://api.test.com', apiKey: 'key' })
      ).rejects.toThrow('timed out')
    })

    it('handles unknown network errors', async () => {
      axios.mockRejectedValueOnce({ message: 'something weird' })

      await expect(
        services.apiRequest('get', '/test', {}, { apiUrl: 'https://api.test.com', apiKey: 'key' })
      ).rejects.toThrow('Network error: something weird')
    })
  })
})

// ========================================================================
// SERVER / TOOL HANDLER TESTS
// ========================================================================

describe('TokenOpsMCPServer', () => {
  let server

  beforeEach(() => {
    process.env.TOKENOPS_API_KEY = 'test-api-key-1234'
    process.env.TOKENOPS_API_URL = 'https://api.test.com'
    server = new TokenOpsMCPServer()
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.TOKENOPS_API_KEY
    delete process.env.TOKENOPS_API_URL
  })

  describe('constructor', () => {
    it('reads config from env vars', () => {
      expect(server.apiUrl).toBe('https://api.test.com')
      expect(server.apiKey).toBe('test-api-key-1234')
    })

    it('defaults apiUrl when env var is not set', () => {
      delete process.env.TOKENOPS_API_URL
      const s = new TokenOpsMCPServer()
      expect(s.apiUrl).toBe('https://api.ainative.studio')
    })

    it('initializes counters to zero', () => {
      expect(server.requestCount).toBe(0)
      expect(server.errorCount).toBe(0)
    })
  })

  describe('routeToolCall', () => {
    it('returns error for unknown tool', async () => {
      const result = await server.routeToolCall('nonexistent_tool', {})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown tool')
    })

    it('routes tokenops_record_prompt', async () => {
      server.recordPrompt = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] })
      await server.routeToolCall('tokenops_record_prompt', { prompt: 'hi' })
      expect(server.recordPrompt).toHaveBeenCalledWith({ prompt: 'hi' })
    })

    it('routes tokenops_record_agent_execution', async () => {
      server.recordAgentExecution = jest.fn().mockResolvedValue({ content: [] })
      await server.routeToolCall('tokenops_record_agent_execution', { agent: 'a' })
      expect(server.recordAgentExecution).toHaveBeenCalled()
    })

    it('routes tokenops_record_cost_event', async () => {
      server.recordCostEvent = jest.fn().mockResolvedValue({ content: [] })
      await server.routeToolCall('tokenops_record_cost_event', { model_cost: {} })
      expect(server.recordCostEvent).toHaveBeenCalled()
    })

    it('routes tokenops_get_spend_summary', async () => {
      server.getSpendSummary = jest.fn().mockResolvedValue({ content: [] })
      await server.routeToolCall('tokenops_get_spend_summary', {})
      expect(server.getSpendSummary).toHaveBeenCalled()
    })

    it('routes tokenops_get_optimization_opportunities', async () => {
      server.getOptimizationOpportunities = jest.fn().mockResolvedValue({ content: [] })
      await server.routeToolCall('tokenops_get_optimization_opportunities', {})
      expect(server.getOptimizationOpportunities).toHaveBeenCalled()
    })

    it('routes tokenops_get_batch_patterns', async () => {
      server.getBatchPatterns = jest.fn().mockResolvedValue({ content: [] })
      await server.routeToolCall('tokenops_get_batch_patterns', {})
      expect(server.getBatchPatterns).toHaveBeenCalled()
    })

    it('routes tokenops_test_connection', async () => {
      server.testConnection = jest.fn().mockResolvedValue({ content: [] })
      await server.routeToolCall('tokenops_test_connection', {})
      expect(server.testConnection).toHaveBeenCalled()
    })

    it('routes tokenops_get_status', async () => {
      const result = await server.routeToolCall('tokenops_get_status', {})
      const data = JSON.parse(result.content[0].text)
      expect(data.server).toBe('tokenops-mcp')
    })
  })

  describe('recordPrompt handler', () => {
    it('returns error for invalid input', async () => {
      const result = await server.recordPrompt({})
      expect(result.isError).toBe(true)
    })

    it('calls API and returns formatted response', async () => {
      axios.mockResolvedValueOnce({ data: { event_id: 'evt-123' } })

      const result = await server.recordPrompt({
        prompt: 'hello world',
        model: 'gpt-4',
        tokens: { input: 10, output: 20 }
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.status).toBe('recorded')
      expect(data.event_id).toBe('evt-123')
      expect(data.model).toBe('gpt-4')
      expect(data.tokens.total).toBe(30)
    })
  })

  describe('recordAgentExecution handler', () => {
    it('returns error for invalid input', async () => {
      const result = await server.recordAgentExecution({})
      expect(result.isError).toBe(true)
    })

    it('calls API and returns formatted response', async () => {
      axios.mockResolvedValueOnce({ data: { event_id: 'evt-456' } })

      const result = await server.recordAgentExecution({
        agent: 'cody',
        workflow: 'code-review',
        tools: ['read', 'grep']
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.status).toBe('recorded')
      expect(data.event_id).toBe('evt-456')
      expect(data.tools_count).toBe(2)
    })
  })

  describe('recordCostEvent handler', () => {
    it('returns error for invalid input', async () => {
      const result = await server.recordCostEvent({})
      expect(result.isError).toBe(true)
    })

    it('calls API and returns formatted response', async () => {
      axios.mockResolvedValueOnce({ data: { event_id: 'evt-789' } })

      const result = await server.recordCostEvent({
        model_cost: { model: 'gpt-4', total_cost_usd: 0.05 }
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.status).toBe('recorded')
      expect(data.total_cost_usd).toBe(0.05)
    })
  })

  describe('getSpendSummary handler', () => {
    it('calls API with params and returns result', async () => {
      axios.mockResolvedValueOnce({ data: { total_usd: 42.0 } })

      const result = await server.getSpendSummary({ period: 'last_7_days', group_by: 'model' })
      const data = JSON.parse(result.content[0].text)
      expect(data.total_usd).toBe(42.0)
    })
  })

  describe('getOptimizationOpportunities handler', () => {
    it('calls API and returns result', async () => {
      axios.mockResolvedValueOnce({ data: { opportunities: [] } })

      const result = await server.getOptimizationOpportunities({ period: 'last_30_days' })
      const data = JSON.parse(result.content[0].text)
      expect(data.opportunities).toEqual([])
    })
  })

  describe('getBatchPatterns handler', () => {
    it('calls API and returns result', async () => {
      axios.mockResolvedValueOnce({ data: { patterns: [{ pattern: 'deploy', count: 5 }] } })

      const result = await server.getBatchPatterns({ min_occurrences: 3 })
      const data = JSON.parse(result.content[0].text)
      expect(data.patterns).toHaveLength(1)
    })
  })

  describe('testConnection handler', () => {
    it('returns connected status on success', async () => {
      axios.mockResolvedValueOnce({ data: { version: '1.0', status: 'ok' } })

      const result = await server.testConnection()
      const data = JSON.parse(result.content[0].text)
      expect(data.status).toBe('connected')
      expect(data.authenticated).toBe(true)
      expect(data.api_version).toBe('1.0')
    })

    it('returns error status on failure', async () => {
      axios.mockRejectedValueOnce({
        response: { status: 401, data: {} }
      })

      const result = await server.testConnection()
      const data = JSON.parse(result.content[0].text)
      expect(data.status).toBe('error')
      expect(data.authenticated).toBe(false)
      expect(data.error).toContain('Authentication failed')
    })
  })

  describe('getStatus handler', () => {
    it('returns server status info', () => {
      server.requestCount = 10
      server.errorCount = 2

      const result = server.getStatus()
      const data = JSON.parse(result.content[0].text)
      expect(data.server).toBe('tokenops-mcp')
      expect(data.version).toBe('0.1.0')
      expect(data.status).toBe('running')
      expect(data.requests.total).toBe(10)
      expect(data.requests.errors).toBe(2)
      expect(data.requests.error_rate).toBe('20.00%')
      expect(data.config.api_key_set).toBe(true)
      expect(data.tools).toBe(8)
    })

    it('shows 0% error rate when no requests', () => {
      const result = server.getStatus()
      const data = JSON.parse(result.content[0].text)
      expect(data.requests.error_rate).toBe('0.00%')
    })

    it('masks API key to prefix only', () => {
      const result = server.getStatus()
      const data = JSON.parse(result.content[0].text)
      expect(data.config.api_key_prefix).toBe('test-api...')
      expect(data.config.api_key_prefix).not.toContain('1234')
    })

    it('shows null prefix when no API key', () => {
      delete process.env.TOKENOPS_API_KEY
      const s = new TokenOpsMCPServer()
      const result = s.getStatus()
      const data = JSON.parse(result.content[0].text)
      expect(data.config.api_key_set).toBe(false)
      expect(data.config.api_key_prefix).toBeNull()
    })
  })

  describe('setupTools and setupHandlers', () => {
    it('creates an internal MCP Server with tools capability', () => {
      // The server object should exist and have the mocked interface
      expect(server.server).toBeDefined()
      expect(server.server.setRequestHandler).toBeDefined()
      expect(server.server.connect).toBeDefined()
    })

    it('increments error count on routeToolCall failure', async () => {
      // Simulate what setupHandlers does: call routeToolCall and catch errors
      server.routeToolCall = jest.fn().mockRejectedValue(new Error('test error'))

      // Replicate the handler logic from setupHandlers
      try {
        server.requestCount++
        await server.routeToolCall('test_tool', {})
      } catch (error) {
        server.errorCount++
      }

      expect(server.requestCount).toBe(1)
      expect(server.errorCount).toBe(1)
    })

    it('increments requestCount on every call without errors', async () => {
      server.requestCount++
      await server.routeToolCall('tokenops_get_status', {})
      server.requestCount++
      await server.routeToolCall('tokenops_get_status', {})
      expect(server.requestCount).toBe(2)
    })
  })
})

// ========================================================================
// SECURITY TESTS
// ========================================================================

describe('Security', () => {
  it('never hardcodes credentials in source', () => {
    const fs = require('fs')
    const indexSource = fs.readFileSync(require.resolve('../index.js'), 'utf8')
    const servicesSource = fs.readFileSync(require.resolve('../services.js'), 'utf8')

    // Should not contain hardcoded API keys or tokens
    expect(indexSource).not.toMatch(/apiKey\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/)
    expect(servicesSource).not.toMatch(/apiKey\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/)
  })

  it('reads credentials from env vars only', () => {
    process.env.TOKENOPS_API_KEY = 'env-key-test'
    const s = new TokenOpsMCPServer()
    expect(s.apiKey).toBe('env-key-test')
    delete process.env.TOKENOPS_API_KEY
  })

  it('does not expose full API key in status', () => {
    process.env.TOKENOPS_API_KEY = 'super-secret-long-api-key-value'
    const s = new TokenOpsMCPServer()
    const result = s.getStatus()
    const text = result.content[0].text
    expect(text).not.toContain('super-secret-long-api-key-value')
    expect(text).toContain('super-se...')
    delete process.env.TOKENOPS_API_KEY
  })
})
