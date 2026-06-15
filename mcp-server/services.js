/**
 * TokenOps Service Layer
 *
 * All business logic lives here. Tool handlers in index.js only
 * validate input, call these functions, and return the response.
 */

const axios = require('axios')

/**
 * Validate required fields and return an error message or null.
 */
function validateRequired (obj, fields) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      return `Missing required field: ${field}`
    }
  }
  return null
}

/**
 * Validate prompt recording input.
 * Returns { valid: true, payload } or { valid: false, error }.
 */
function validatePromptInput (args) {
  const { prompt, model, tokens } = args

  if (!prompt || !model || !tokens) {
    return { valid: false, error: 'Missing required fields: prompt, model, and tokens are required.' }
  }

  if (!tokens.input && tokens.input !== 0) {
    return { valid: false, error: 'tokens.input is required.' }
  }

  if (!tokens.output && tokens.output !== 0) {
    return { valid: false, error: 'tokens.output is required.' }
  }

  // Sanitize string inputs
  const payload = {
    prompt: String(prompt),
    model: String(model),
    tokens: {
      input: Number(tokens.input),
      output: Number(tokens.output),
      total: Number(tokens.total) || (Number(tokens.input) + Number(tokens.output))
    },
    user: args.user ? String(args.user) : 'unknown',
    agent: args.agent ? String(args.agent) : null,
    timestamp: args.timestamp ? String(args.timestamp) : new Date().toISOString(),
    classification: args.classification ? String(args.classification) : 'other',
    session_id: args.session_id ? String(args.session_id) : null
  }

  return { valid: true, payload }
}

/**
 * Validate agent execution input.
 */
function validateAgentExecutionInput (args) {
  const { agent, workflow } = args

  if (!agent || !workflow) {
    return { valid: false, error: 'Missing required fields: agent and workflow are required.' }
  }

  const payload = {
    agent: String(agent),
    workflow: String(workflow),
    tools: Array.isArray(args.tools) ? args.tools.map(String) : [],
    duration_ms: args.duration_ms != null ? Number(args.duration_ms) : null,
    output_size: args.output_size != null ? Number(args.output_size) : null,
    token_cost: args.token_cost || null,
    status: args.status ? String(args.status) : 'success',
    session_id: args.session_id ? String(args.session_id) : null,
    timestamp: new Date().toISOString()
  }

  return { valid: true, payload }
}

/**
 * Validate cost event input.
 */
function validateCostEventInput (args) {
  const { model_cost } = args

  if (!model_cost) {
    return { valid: false, error: 'Missing required field: model_cost is required.' }
  }

  if (!model_cost.model || (!model_cost.total_cost_usd && model_cost.total_cost_usd !== 0)) {
    return { valid: false, error: 'model_cost must include model and total_cost_usd fields.' }
  }

  const payload = {
    model_cost: {
      model: String(model_cost.model),
      total_cost_usd: Number(model_cost.total_cost_usd),
      input_cost_usd: model_cost.input_cost_usd != null ? Number(model_cost.input_cost_usd) : undefined,
      output_cost_usd: model_cost.output_cost_usd != null ? Number(model_cost.output_cost_usd) : undefined
    },
    provider_cost: args.provider_cost || null,
    workflow_cost: args.workflow_cost || null,
    team_cost: args.team_cost || null,
    timestamp: args.timestamp ? String(args.timestamp) : new Date().toISOString()
  }

  return { valid: true, payload }
}

/**
 * Build query params for spend summary from args.
 */
function buildSpendSummaryParams (args) {
  const params = {}
  if (args.period) params.period = String(args.period)
  if (args.start_date) params.start_date = String(args.start_date)
  if (args.end_date) params.end_date = String(args.end_date)
  if (args.group_by) params.group_by = String(args.group_by)
  if (args.team) params.team = String(args.team)
  if (args.agent) params.agent = String(args.agent)
  return params
}

/**
 * Build query params for optimization opportunities.
 */
function buildOptimizationParams (args) {
  const params = {}
  if (args.period) params.period = String(args.period)
  if (args.min_savings_usd) params.min_savings_usd = Number(args.min_savings_usd)
  if (args.categories) params.categories = args.categories.map(String).join(',')
  return params
}

/**
 * Build query params for batch patterns.
 */
function buildBatchPatternsParams (args) {
  const params = {}
  if (args.period) params.period = String(args.period)
  if (args.min_occurrences) params.min_occurrences = Number(args.min_occurrences)
  if (args.agent) params.agent = String(args.agent)
  return params
}

/**
 * Make an authenticated API request to the TokenOps backend.
 */
async function apiRequest (method, path, data, { apiUrl, apiKey }) {
  if (!apiKey) {
    throw new Error('TOKENOPS_API_KEY is not configured. Set it in your environment variables. Get your key at https://ainative.studio/settings')
  }

  try {
    const config = {
      method,
      url: `${apiUrl}${path}`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'tokenops-mcp/0.1.0'
      },
      timeout: 30000
    }

    if (data && (method === 'post' || method === 'put' || method === 'patch')) {
      config.data = data
    } else if (data && method === 'get') {
      config.params = data
    }

    const response = await axios(config)
    return response.data
  } catch (error) {
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.error?.message || error.response.data?.message || error.message

      if (status === 401) {
        throw new Error('Authentication failed. Check your TOKENOPS_API_KEY.')
      } else if (status === 403) {
        throw new Error('Access denied. Your API key may not have the required permissions.')
      } else if (status === 429) {
        throw new Error('Rate limit exceeded. Please wait before retrying.')
      } else if (status >= 500) {
        throw new Error(`TokenOps API server error (${status}). Please try again later.`)
      } else {
        throw new Error(`API error (${status}): ${message}`)
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error(`Cannot connect to TokenOps API at ${apiUrl}. Check your TOKENOPS_API_URL setting and network connectivity.`)
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error('Request timed out. The TokenOps API may be experiencing high load.')
    } else {
      throw new Error(`Network error: ${error.message}`)
    }
  }
}

/**
 * Format a successful MCP response.
 */
function formatResponse (data) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  }
}

/**
 * Format an error MCP response.
 */
function formatError (message) {
  return {
    content: [{
      type: 'text',
      text: message
    }],
    isError: true
  }
}

/**
 * Compute uptime string from start time.
 */
function computeUptime (startTime) {
  const uptimeMs = Date.now() - startTime
  const uptimeSeconds = Math.floor(uptimeMs / 1000)
  const uptimeMinutes = Math.floor(uptimeSeconds / 60)
  const uptimeHours = Math.floor(uptimeMinutes / 60)

  let uptimeStr
  if (uptimeHours > 0) {
    uptimeStr = `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`
  } else if (uptimeMinutes > 0) {
    uptimeStr = `${uptimeMinutes}m ${uptimeSeconds % 60}s`
  } else {
    uptimeStr = `${uptimeSeconds}s`
  }

  return { uptimeStr, uptimeMs }
}

module.exports = {
  validateRequired,
  validatePromptInput,
  validateAgentExecutionInput,
  validateCostEventInput,
  buildSpendSummaryParams,
  buildOptimizationParams,
  buildBatchPatternsParams,
  apiRequest,
  formatResponse,
  formatError,
  computeUptime
}
