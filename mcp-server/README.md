# @tokenops/mcp-server

MCP server for the TokenOps AI Cost Optimization Platform. Sends telemetry (token usage, prompts, agent executions) and retrieves analytics (spend summaries, optimization opportunities, batch patterns).

## Quick Start

```bash
npx @tokenops/mcp-server
```

## Configuration

### Claude Code (`.claude.json` or `claude_desktop_config.json`)

Add to your `mcpServers` configuration:

```json
{
  "mcpServers": {
    "tokenops": {
      "command": "npx",
      "args": ["-y", "@tokenops/mcp-server"],
      "env": {
        "TOKENOPS_API_KEY": "your-api-key",
        "TOKENOPS_API_URL": "https://api.ainative.studio"
      }
    }
  }
}
```

### Cursor / Windsurf

Add to your MCP configuration file:

```json
{
  "tokenops": {
    "command": "npx",
    "args": ["-y", "@tokenops/mcp-server"],
    "env": {
      "TOKENOPS_API_KEY": "your-api-key",
      "TOKENOPS_API_URL": "https://api.ainative.studio"
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TOKENOPS_API_KEY` | Yes | - | Your TokenOps API key from [ainative.studio/settings](https://ainative.studio/settings) |
| `TOKENOPS_API_URL` | No | `https://api.ainative.studio` | TokenOps API base URL |

## Tools

### Telemetry (3 tools)

| Tool | Description |
|------|-------------|
| `tokenops_record_prompt` | Record a prompt event with model, tokens, classification |
| `tokenops_record_agent_execution` | Record an agent execution with workflow, tools, duration, cost |
| `tokenops_record_cost_event` | Record a cost event with model/provider/workflow/team breakdown |

### Analytics (3 tools)

| Tool | Description |
|------|-------------|
| `tokenops_get_spend_summary` | Get spend summary by model, team, classification, or agent |
| `tokenops_get_optimization_opportunities` | Get savings opportunities (duplicates, downgrades, batching) |
| `tokenops_get_batch_patterns` | Get detected batch patterns that could become scripts |

### Connection (2 tools)

| Tool | Description |
|------|-------------|
| `tokenops_test_connection` | Test API connectivity and authentication |
| `tokenops_get_status` | Get MCP server health, uptime, and request stats |

## Examples

### Record a prompt

```
Use tokenops_record_prompt with:
- prompt: "Generate unit tests for the user service"
- model: "claude-sonnet-4-20250514"
- tokens: { input: 1500, output: 3200 }
- classification: "testing"
- agent: "cody"
```

### Get spend summary

```
Use tokenops_get_spend_summary with:
- period: "last_7_days"
- group_by: "model"
```

### Find optimization opportunities

```
Use tokenops_get_optimization_opportunities with:
- period: "last_30_days"
- categories: ["duplicate_prompts", "model_downgrade"]
```

## License

MIT
