#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js')
const services = require('./services')

/**
 * TokenOps MCP Server v0.1.0
 *
 * AI Cost Optimization telemetry and analytics tools:
 * - Telemetry (3): record_prompt, record_agent_execution, record_cost_event
 * - Analytics (3): get_spend_summary, get_optimization_opportunities, get_batch_patterns
 * - Connection (2): test_connection, get_status
 */

const BANNER = `
  ╔════════════════════════════════════════════════╗
  ║                                                ║
  ║   ████████╗ ██████╗ ██╗  ██╗███████╗███╗   ██╗║
  ║   ╚══██╔══╝██╔═══██╗██║ ██╔╝██╔════╝████╗  ██║║
  ║      ██║   ██║   ██║█████╔╝ █████╗  ██╔██╗ ██║║
  ║      ██║   ██║   ██║██╔═██╗ ██╔══╝  ██║╚██╗██║║
  ║      ██║   ╚██████╔╝██║  ██╗███████╗██║ ╚████║║
  ║      ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝║
  ║          ██████╗ ██████╗ ███████╗               ║
  ║         ██╔═══██╗██╔══██╗██╔════╝               ║
  ║         ██║   ██║██████╔╝███████╗               ║
  ║         ██║   ██║██╔═══╝ ╚════██║               ║
  ║         ╚██████╔╝██║     ███████║               ║
  ║          ╚═════╝ ╚═╝     ╚══════╝               ║
  ║                                                ║
  ║   AI Cost Optimization Platform     v0.1.0     ║
  ║   https://ainative.studio/tokenops             ║
  ╚════════════════════════════════════════════════╝
`

class TokenOpsMCPServer {
  constructor () {
    this.apiUrl = process.env.TOKENOPS_API_URL || 'https://api.ainative.studio'
    this.apiKey = process.env.TOKENOPS_API_KEY
    this.startTime = Date.now()
    this.requestCount = 0
    this.errorCount = 0

    if (!this.apiKey) {
      console.error('')
      console.error('WARNING: TOKENOPS_API_KEY is not set.')
      console.error('The server will start but API calls will fail.')
      console.error('Get your API key at: https://ainative.studio/settings')
      console.error('')
    }

    this.server = new Server(
      {
        name: 'tokenops-mcp',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.setupTools()
    this.setupHandlers()
  }

  setupTools () {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // ==================== TELEMETRY TOOLS (3) ====================
        {
          name: 'tokenops_record_prompt',
          description: 'Record a prompt event with token usage and classification. Use after every LLM call to track cost and usage patterns. Classification helps identify optimization opportunities.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'The prompt text sent to the model'
              },
              model: {
                type: 'string',
                description: 'Model identifier (e.g., claude-sonnet-4-20250514, gpt-4o, claude-opus-4-20250514)'
              },
              tokens: {
                type: 'object',
                description: 'Token usage breakdown',
                properties: {
                  input: { type: 'number', description: 'Input/prompt tokens' },
                  output: { type: 'number', description: 'Output/completion tokens' },
                  total: { type: 'number', description: 'Total tokens (input + output)' }
                },
                required: ['input', 'output']
              },
              user: {
                type: 'string',
                description: 'User or agent identifier'
              },
              agent: {
                type: 'string',
                description: 'Agent name or identifier (e.g., cody, aurora, sage)'
              },
              timestamp: {
                type: 'string',
                description: 'ISO 8601 timestamp (defaults to now if omitted)'
              },
              classification: {
                type: 'string',
                enum: ['code_generation', 'code_review', 'debugging', 'documentation', 'refactoring', 'testing', 'planning', 'conversation', 'data_analysis', 'other'],
                description: 'Prompt classification for analytics grouping'
              },
              session_id: {
                type: 'string',
                description: 'Session identifier for grouping related prompts'
              }
            },
            required: ['prompt', 'model', 'tokens']
          }
        },
        {
          name: 'tokenops_record_agent_execution',
          description: 'Record an agent execution with workflow details, tool usage, and cost. Use to track agent runs for cost attribution and efficiency analysis.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
          inputSchema: {
            type: 'object',
            properties: {
              agent: {
                type: 'string',
                description: 'Agent name or identifier'
              },
              workflow: {
                type: 'string',
                description: 'Workflow or task name (e.g., code-review, bug-fix, deploy)'
              },
              tools: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of tools used during execution'
              },
              duration_ms: {
                type: 'number',
                description: 'Execution duration in milliseconds'
              },
              output_size: {
                type: 'number',
                description: 'Size of output in characters or tokens'
              },
              token_cost: {
                type: 'object',
                description: 'Token cost breakdown for the execution',
                properties: {
                  total_tokens: { type: 'number', description: 'Total tokens consumed' },
                  input_tokens: { type: 'number', description: 'Input tokens consumed' },
                  output_tokens: { type: 'number', description: 'Output tokens consumed' },
                  estimated_cost_usd: { type: 'number', description: 'Estimated cost in USD' }
                }
              },
              status: {
                type: 'string',
                enum: ['success', 'failure', 'partial', 'timeout'],
                description: 'Execution outcome status'
              },
              session_id: {
                type: 'string',
                description: 'Session identifier'
              }
            },
            required: ['agent', 'workflow']
          }
        },
        {
          name: 'tokenops_record_cost_event',
          description: 'Record a cost event with breakdown by model, provider, workflow, and team. Use for financial tracking and budget alerting.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
          inputSchema: {
            type: 'object',
            properties: {
              model_cost: {
                type: 'object',
                description: 'Cost attributed to the model',
                properties: {
                  model: { type: 'string', description: 'Model identifier' },
                  input_cost_usd: { type: 'number', description: 'Input token cost in USD' },
                  output_cost_usd: { type: 'number', description: 'Output token cost in USD' },
                  total_cost_usd: { type: 'number', description: 'Total cost in USD' }
                },
                required: ['model', 'total_cost_usd']
              },
              provider_cost: {
                type: 'object',
                description: 'Cost attributed to the provider',
                properties: {
                  provider: { type: 'string', description: 'Provider name (e.g., anthropic, openai, google)' },
                  total_cost_usd: { type: 'number', description: 'Total provider cost in USD' }
                }
              },
              workflow_cost: {
                type: 'object',
                description: 'Cost attributed to the workflow',
                properties: {
                  workflow: { type: 'string', description: 'Workflow name' },
                  total_cost_usd: { type: 'number', description: 'Total workflow cost in USD' }
                }
              },
              team_cost: {
                type: 'object',
                description: 'Cost attributed to the team',
                properties: {
                  team: { type: 'string', description: 'Team name or identifier' },
                  total_cost_usd: { type: 'number', description: 'Total team cost in USD' }
                }
              },
              timestamp: {
                type: 'string',
                description: 'ISO 8601 timestamp (defaults to now if omitted)'
              }
            },
            required: ['model_cost']
          }
        },

        // ==================== ANALYTICS TOOLS (3) ====================
        {
          name: 'tokenops_get_spend_summary',
          description: 'Get spend summary with totals by model, team, and classification. Returns cost breakdown for a given time period. Use to understand where token spend is going.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
          inputSchema: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['today', 'yesterday', 'last_7_days', 'last_30_days', 'this_month', 'last_month', 'custom'],
                description: 'Time period for the summary',
                default: 'last_7_days'
              },
              start_date: {
                type: 'string',
                description: 'Start date for custom period (ISO 8601)'
              },
              end_date: {
                type: 'string',
                description: 'End date for custom period (ISO 8601)'
              },
              group_by: {
                type: 'string',
                enum: ['model', 'team', 'classification', 'agent', 'workflow', 'provider'],
                description: 'Group results by this dimension'
              },
              team: {
                type: 'string',
                description: 'Filter by team name'
              },
              agent: {
                type: 'string',
                description: 'Filter by agent name'
              }
            }
          }
        },
        {
          name: 'tokenops_get_optimization_opportunities',
          description: 'Get savings opportunities including duplicate prompts, expensive model usage that could be downgraded, and batch-eligible patterns. Returns actionable recommendations with estimated savings.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
          inputSchema: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['last_7_days', 'last_30_days', 'this_month'],
                description: 'Time period to analyze',
                default: 'last_7_days'
              },
              min_savings_usd: {
                type: 'number',
                description: 'Minimum estimated savings to include (USD)',
                default: 0.01
              },
              categories: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['duplicate_prompts', 'model_downgrade', 'batch_eligible', 'cache_eligible', 'prompt_optimization']
                },
                description: 'Filter by optimization category'
              }
            }
          }
        },
        {
          name: 'tokenops_get_batch_patterns',
          description: 'Get detected batch command patterns that could become scripts or cached templates. Identifies repeated similar prompts that would benefit from automation.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
          inputSchema: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['last_7_days', 'last_30_days', 'this_month'],
                description: 'Time period to analyze',
                default: 'last_7_days'
              },
              min_occurrences: {
                type: 'number',
                description: 'Minimum number of occurrences to qualify as a pattern',
                default: 3
              },
              agent: {
                type: 'string',
                description: 'Filter by agent name'
              }
            }
          }
        },

        // ==================== CONNECTION TOOLS (2) ====================
        {
          name: 'tokenops_test_connection',
          description: 'Test connectivity to the TokenOps API. Returns connection status, latency, and API version. Use to verify the MCP server is properly configured.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'tokenops_get_status',
          description: 'Get MCP server status including uptime, request count, error rate, and configuration. Use for health monitoring and debugging.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    }))
  }

  setupHandlers () {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        this.requestCount++
        return await this.routeToolCall(name, args || {})
      } catch (error) {
        this.errorCount++
        console.error(`Error executing ${name}:`, error.message)
        return {
          content: [{
            type: 'text',
            text: `Error executing ${name}: ${error.message}`
          }],
          isError: true
        }
      }
    })
  }

  async routeToolCall (name, args) {
    switch (name) {
      // Telemetry tools
      case 'tokenops_record_prompt':
        return await this.recordPrompt(args)
      case 'tokenops_record_agent_execution':
        return await this.recordAgentExecution(args)
      case 'tokenops_record_cost_event':
        return await this.recordCostEvent(args)

      // Analytics tools
      case 'tokenops_get_spend_summary':
        return await this.getSpendSummary(args)
      case 'tokenops_get_optimization_opportunities':
        return await this.getOptimizationOpportunities(args)
      case 'tokenops_get_batch_patterns':
        return await this.getBatchPatterns(args)

      // Connection tools
      case 'tokenops_test_connection':
        return await this.testConnection()
      case 'tokenops_get_status':
        return this.getStatus()

      default:
        return {
          content: [{
            type: 'text',
            text: `Unknown tool: ${name}. Available tools: tokenops_record_prompt, tokenops_record_agent_execution, tokenops_record_cost_event, tokenops_get_spend_summary, tokenops_get_optimization_opportunities, tokenops_get_batch_patterns, tokenops_test_connection, tokenops_get_status`
          }],
          isError: true
        }
    }
  }

  // ==================== API REQUEST HELPER ====================

  async apiRequest (method, path, data) {
    return services.apiRequest(method, path, data, {
      apiUrl: this.apiUrl,
      apiKey: this.apiKey
    })
  }

  // ==================== TOOL HANDLERS ====================
  // Tool handlers ONLY validate input, call service functions, return response.

  async recordPrompt (args) {
    const validation = services.validatePromptInput(args)
    if (!validation.valid) {
      return services.formatError(validation.error)
    }

    const result = await this.apiRequest('post', '/v1/tokenops/telemetry/prompt', validation.payload)
    return services.formatResponse({
      status: 'recorded',
      event_id: result.event_id || result.id,
      model: validation.payload.model,
      tokens: validation.payload.tokens,
      classification: validation.payload.classification
    })
  }

  async recordAgentExecution (args) {
    const validation = services.validateAgentExecutionInput(args)
    if (!validation.valid) {
      return services.formatError(validation.error)
    }

    const result = await this.apiRequest('post', '/v1/tokenops/telemetry/agent-execution', validation.payload)
    return services.formatResponse({
      status: 'recorded',
      event_id: result.event_id || result.id,
      agent: validation.payload.agent,
      workflow: validation.payload.workflow,
      tools_count: validation.payload.tools.length,
      execution_status: validation.payload.status
    })
  }

  async recordCostEvent (args) {
    const validation = services.validateCostEventInput(args)
    if (!validation.valid) {
      return services.formatError(validation.error)
    }

    const result = await this.apiRequest('post', '/v1/tokenops/telemetry/cost-event', validation.payload)
    return services.formatResponse({
      status: 'recorded',
      event_id: result.event_id || result.id,
      model: validation.payload.model_cost.model,
      total_cost_usd: validation.payload.model_cost.total_cost_usd
    })
  }

  async getSpendSummary (args) {
    const params = services.buildSpendSummaryParams(args)
    const result = await this.apiRequest('get', '/v1/tokenops/analytics/spend-summary', params)
    return services.formatResponse(result)
  }

  async getOptimizationOpportunities (args) {
    const params = services.buildOptimizationParams(args)
    const result = await this.apiRequest('get', '/v1/tokenops/analytics/optimization-opportunities', params)
    return services.formatResponse(result)
  }

  async getBatchPatterns (args) {
    const params = services.buildBatchPatternsParams(args)
    const result = await this.apiRequest('get', '/v1/tokenops/analytics/batch-patterns', params)
    return services.formatResponse(result)
  }

  async testConnection () {
    const startTime = Date.now()

    try {
      const result = await this.apiRequest('get', '/v1/tokenops/health', {})
      const latencyMs = Date.now() - startTime

      return services.formatResponse({
        status: 'connected',
        latency_ms: latencyMs,
        api_url: this.apiUrl,
        api_version: result.version || 'unknown',
        server_status: result.status || 'ok',
        authenticated: true
      })
    } catch (error) {
      const latencyMs = Date.now() - startTime

      return services.formatResponse({
        status: 'error',
        latency_ms: latencyMs,
        api_url: this.apiUrl,
        error: error.message,
        authenticated: false
      })
    }
  }

  getStatus () {
    const { uptimeStr, uptimeMs } = services.computeUptime(this.startTime)

    const errorRate = this.requestCount > 0
      ? ((this.errorCount / this.requestCount) * 100).toFixed(2)
      : '0.00'

    return services.formatResponse({
      server: 'tokenops-mcp',
      version: '0.1.0',
      status: 'running',
      uptime: uptimeStr,
      uptime_ms: uptimeMs,
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        error_rate: `${errorRate}%`
      },
      config: {
        api_url: this.apiUrl,
        api_key_set: !!this.apiKey,
        api_key_prefix: this.apiKey ? this.apiKey.substring(0, 8) + '...' : null
      },
      tools: 8
    })
  }

  // ==================== SERVER STARTUP ====================

  async start () {
    try {
      console.error(BANNER)

      const transport = new StdioServerTransport()
      await this.server.connect(transport)

      console.error('TokenOps MCP Server v0.1.0 running on stdio')
      console.error(`API URL: ${this.apiUrl}`)
      console.error(`API Key: ${this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'NOT SET'}`)
      console.error('Tools: 8 (3 telemetry, 3 analytics, 2 connection)')
      console.error('')

      if (!this.apiKey) {
        console.error('WARNING: No API key configured. Set TOKENOPS_API_KEY to enable API calls.')
        console.error('Get your key at: https://ainative.studio/settings')
      } else {
        console.error('Ready to track token usage and optimize AI costs.')
      }
      console.error('')
    } catch (error) {
      console.error('Failed to start TokenOps MCP Server:', error.message)
      process.exit(1)
    }
  }
}

// Start the server
if (require.main === module) {
  const server = new TokenOpsMCPServer()
  server.start().catch(console.error)
}

module.exports = TokenOpsMCPServer
