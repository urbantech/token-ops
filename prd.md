# TokenOps

## AI Cost Optimization Platform Powered by AINative

# Executive Summary

TokenOps is an AI Cost Optimization and AI Governance platform built almost entirely on top of existing AINative infrastructure.

Rather than building another analytics platform from scratch, TokenOps leverages:

* ZeroDB
* ZeroMemory
* Models API
* Agent Cloud
* AIKit
* MCP Servers
* Cody CLI

to deliver:

* AI Spend Visibility
* Token Optimization
* Agent Optimization
* Organizational Memory
* AI Governance
* Fractional AI-Native Executive Services

The software performs the analysis.

The agent swarm performs the optimization.

The fractional executive drives organizational adoption.

---

# AINative Platform Mapping

## Existing Infrastructure

### ZeroDB

Primary System of Record

Used For:

* Prompt logs
* Token usage
* Cost events
* Agent executions
* MCP telemetry
* Knowledge graph entities
* Optimization recommendations

No custom database required.

**Existing Code to Reuse:**

* `AIUsageLog` model (`core/src/backend/app/models/ai_usage.py`) — already tracks `prompt_tokens`, `completion_tokens`, `total_tokens`, `latency_ms`, `cost_millicents`, `provider`, `model_name` per call
* `ai_usage.py` endpoint (`core/src/backend/app/api/api_v1/endpoints/ai_usage.py`) — paginated usage queries from `llm_token_usage` table with CSV export and provider normalization
* ZeroDB Python SDK (`core/sdks/python/zerodb_mcp/client.py`) — full async client with 60+ operations
* ZeroDB JS Client (`core/zerodb-memory-mcp/src/client/zerodb-client.js`) — auto-detection of ZeroLocal vs cloud
* ZeroDB TS API Client (`core/zerodb-frontend/src/services/api/zerodb.ts`) — TypeScript interfaces + API client
* ZeroDB Studio API Services (`core/ZeroDB.AINative.Studio/src/lib/api/services/`) — vectors, tables, projects, events, admin

Example:

```typescript
await zerodb.records.create({
  table: "executions",
  data: execution
})
```

---

### ZeroMemory

Memory Optimization Engine

Used For:

* Duplicate request detection
* Prompt reuse
* Organizational memory
* Research caching
* Context reduction
* Agent memory

**Existing Code to Reuse:**

* `ZeroDBMemoryService` (`core/src/backend/app/services/zerodb_memory_service.py`) — semantic search with embeddings, deduplication, categories (conversation, knowledge, task, error, context, instruction, feedback, summary), priority levels, TTL cleanup
* ZeroMemory MCP tools (`core/zerodb-memory-mcp/src/tools/memory-tools.js`) — `zerodb_store_memory`, `zerodb_search_memory`, `zerodb_get_context`, `zerodb_clear_session`, `zerodb_embed_text`, `zerodb_semantic_search`
* Auto-context middleware (`core/zerodb-memory-mcp/src/utils/auto-context.js`)

Example:

```typescript
const result = await zeromemory.search({
  query: prompt
})
```

Before sending an LLM request:

```typescript
if(result.confidence > .9){
   return result.answer
}
```

Potential savings:

30-70% fewer model calls.

---

### Models API

Model Routing Layer

Existing AINative endpoint already provides:

* Claude
* GPT
* Gemini
* DeepSeek
* Llama
* Mistral
* Additional OSS Models

TokenOps analyzes workloads and recommends:

* Lower cost models
* Faster models
* More efficient models

**Existing Code to Reuse:**

* Inference Router (`core/src/backend/app/services/inference_router.py`) — tiered provider routing with `PROVIDER_LIMITS` containing `cost_per_1m_input` and `cost_per_1m_output` per provider. Routes FREE tier to Cerebras→Meta→NVIDIA, PAID to DigitalOcean→NVIDIA→Meta, BYOK to user's own key.
* Chat completions endpoint (`core/src/backend/app/api/api_v1/endpoints/chat.py`) — wires to inference router with `usage.input_tokens`/`output_tokens` in response

Example:

```typescript
const response = await models.chat({
   model: optimalModel,
   messages
})
```

No model integrations required.

---

### AIKit

Optimization Components

TokenOps should be implemented as AIKit modules.

**Existing Code to Reuse:**

* AIKit Core Package (`core/packages/core/`) — published as `@ainative/ai-kit-core` with Agent base class, Zod tool validation, `ToolRegistry`, LLM providers (Anthropic, OpenAI), streaming adapters
* Agent executor (`core/packages/core/src/agents/AgentExecutor.ts`)
* AIKit UI primitives (`core/packages/agent-swarm-monitor/components/aikit/`) — `AIKitButton`, `AIKitSidebar`, `AIKitModal`, `AIKitBadge`

Proposed Components:

* Cost Analyzer → wraps `UsageAggregationService` + `TaskCostService`
* Prompt Analyzer → wraps `prompt_optimizer.py` + RLHF scorer
* Context Compressor → wraps ZeroMemory auto-context
* Memory Reuse Engine → wraps `ZeroDBMemoryService` semantic search
* Model Router → wraps `inference_router.py` with `PROVIDER_LIMITS`
* Governance Auditor → new thin layer over ZeroDB event queries
* Agent Auditor → wraps `AgentResourceMonitor` + `AgentCloudBillingService`

These become reusable platform services.

---

### Agent Cloud

Optimization Execution Layer

TokenOps does not perform analysis directly.

Agent Cloud agents perform analysis continuously.

**Existing Code to Reuse:**

* `AgentCloudBillingService` (`core/src/backend/app/services/agent_cloud_billing_service.py`) — credit pricing for compute (2/sec), memory_ops (5/op), vector_search (8/query), storage (0.001/byte), a2a (3/msg), postgresql (20/query)
* `TaskCostService` (`core/src/backend/app/services/task_cost_service.py`) — recursive cost trees for multi-agent delegation chains via CTE
* `AgentResourceMonitor` (`core/src/backend/app/services/agent/resource_monitor.py`) — CPU/memory metrics per agent
* `prompt_optimizer.py` (`core/src/backend/app/services/agent/prompt_optimizer.py`) — RLHF-driven prompt refinement when avg score < 7.0
* `RealtimeOptimizationMonitor` (`core/src/backend/app/services/realtime_optimization_monitor.py`) — WebSocket broadcasting for experiment tracking
* Swarm quota service (`core/src/backend/app/services/agent_framework/swarm_quota_service.py`)
* Agent Swarm Monitor UI (`core/packages/agent-swarm-monitor/`) — published as `@ainative/agent-swarm-monitor`

Example Agents:

Token Auditor

Prompt Architect

Memory Architect

Model Router

Workflow Auditor

Governance Agent

Knowledge Graph Agent

Executive Reporting Agent

---

### MCP Server

Customer Integration Layer

Customer installs:

```bash
npm install @opencapstack/mcp-server
```

or

```bash
npx @opencapstack/mcp-server
```

MCP becomes the telemetry collection layer.

**Existing MCP Servers to Reuse:**

* ZeroDB MCP Server (`core/zerodb-mcp-server/index.js`) — 76+ tools across 11 categories
* ZeroMemory MCP Server (`core/zerodb-memory-mcp/index.js`) — 18 tools (9 memory + 5 write-back + 4 plan-artifacts)
* Browser MCP Server (`core/packages/browser-mcp/`) — browser automation
* PostgreSQL MCP Bridge (`core/src/backend/app/mcp/postgres_mcp_bridge.py`) — query, schema, connection, performance tools
* MCP rate limiter (`core/src/backend/app/zerodb/services/mcp_rate_limiter.py`)
* MCP error handler (`core/src/backend/app/zerodb/services/mcp_error_handler.py`)

Connectors:

* GitHub
* GitLab
* Jira
* Linear
* Gmail
* Slack
* Google Workspace
* Databases
* Internal APIs

Collected Data:

* AI usage
* Prompt activity
* Workflow execution
* Agent behavior
* Knowledge artifacts

Stored directly in ZeroDB.

---

# Product Architecture

Customer Environment

↓

OpenCap Stack MCP

↓

AINative API Gateway

↓

ZeroDB

↓

Agent Cloud

↓

ZeroMemory

↓

Models API

↓

Executive Dashboard

↓

Fractional AI-Native Executive

---

# Product Modules

## Module 1

AI Spend Intelligence

Built Using:

* ZeroDB Events
* AIKit Cost Analyzer

**Reusable Components:**

* Backend: `UsageAggregationService` (aggregates api_calls, llm_tokens by provider+model, storage, total_cost), `TaskCostService` (recursive delegation cost trees), `ai_usage.py` endpoint (paginated usage + CSV export)
* Frontend: `CostTracker.tsx` (per-agent cost breakdown with 10s polling + $5/$10 threshold alerts), `UsageIndicator.tsx` (animated progress bars with 80%/95% warnings), `CostComparison.tsx` (re-theme for LLM provider comparisons)
* API Docs: `docs-site/docs/agent-cloud/billing.mdx`, `docs-site/docs/agent-cloud/observability.mdx`

Tracks:

* Tokens
* Cost
* Models
* Teams
* Projects
* Agents
* Classification (what type of work consumed the tokens)

Token Spend Classification:

Every token event is classified into a work type to enable targeted optimization:

1. **Updating Specs** — documentation/planning → optimize with templates + ZeroMemory caching
2. **Brainstorming Ideas** — creative exploration → tolerate spend, detect exploration loops
3. **Updating Code** — implementation → route to cheaper models (DeepSeek/Llama)
4. **Fixing Issues** — debugging → cache fix patterns in ZeroMemory
5. **Batch Commands** — repetitive tasks → **highest ROI**: convert to zero-token scripts

Classification enables:

* Per-category model routing (brainstorm→Opus, code→DeepSeek, batch→scripts)
* Batch-to-script conversion (detect repetitive patterns, generate replacement scripts)
* Loop detection (brainstorming going in circles with rising cost)
* Template reuse (specs that follow the same structure)

Output:

Savings Opportunities (classified by work type with targeted recommendations)

---

## Module 2

Prompt Optimization

Built Using:

* ZeroMemory
* Agent Cloud
* AIKit Prompt Analyzer

**Reusable Components:**

* Backend: `prompt_optimizer.py` (RLHF-driven prompt refinement, triggers rewrite when avg score < 7.0), `rlhf_scorer.py`, `tool_schema_optimizer.py`
* Memory: `ZeroDBMemoryService` semantic search for duplicate prompt detection
* Docs: `docs/quick-reference/NOUSCODER_TOKEN_TRACKING_QUICK_START.md` (tiktoken integration, pricing tables)

Outputs:

* Prompt improvements
* Context reduction recommendations
* Duplicate prompt detection

---

## Module 3

Memory Optimization

Built Using:

* ZeroMemory
* GraphRAG APIs

**Reusable Components:**

* Backend: `ZeroDBMemoryService` (semantic search, deduplication, TTL cleanup, priority levels, export)
* MCP: ZeroMemory MCP tools (`zerodb_search_memory`, `zerodb_semantic_search`)
* Frontend: ZeroDB Studio memory dashboard (`core/ZeroDB.AINative.Studio/src/app/dashboard/memory/`)
* Docs: `docs-site/docs/zeromemory/overview.mdx`, `docs/products/zeromemory/architecture/MEMORY_MANAGEMENT_ARCHITECTURE.md`

Outputs:

* Reusable answers
* Cached research
* Duplicate reasoning detection

---

## Module 4

Model Optimization

Built Using:

* Models API
* AIKit Model Router

**Reusable Components:**

* Backend: `inference_router.py` with `PROVIDER_LIMITS` dict (cost_per_1m_input/output per provider). Already routes FREE→Cerebras→Meta→NVIDIA, PAID→DigitalOcean→NVIDIA→Meta
* Pricing data: Cerebras ($0/$0), Meta ($0/$0), NVIDIA NIM ($0.10/$0.10), DigitalOcean ($0.15/$0.60), HuggingFace ($0.20/$0.80)
* API Docs: `docs-site/docs/api/chat-completions.mdx` (free models with 1M daily token cap)

Outputs:

Recommended Model Changes

Example:

Claude Opus

↓

Claude Sonnet

↓

DeepSeek

↓

Local Model

Based on workload characteristics.

---

## Module 5

Agent Workforce Analytics

Built Using:

* Agent Cloud
* ZeroDB

**Reusable Components:**

* Backend: `AgentResourceMonitor` (CPU/memory metrics to `agent_resource_metrics` table every 60s), `AgentCloudBillingService` (credit pricing for 6 resource types), `TaskCostService` (delegation chain cost attribution)
* Frontend: Agent Swarm Monitor (`@ainative/agent-swarm-monitor`) — standalone Next.js 14 app with Recharts + Framer Motion
* Admin: `CostTracker.tsx` (per-agent cost widget), `AllProjectsTable.tsx`, `SystemHealthCard.tsx`, `UserUsagePanel.tsx`
* API Docs: `docs-site/docs/agent-cloud/observability.mdx` (per-agent token tracking at `/api/v1/cloud/observability/metrics/{agent_id}`)

Measures:

* Agent productivity
* Agent cost
* Tool utilization
* Memory utilization
* Workflow duplication

---

## Module 6

Governance Layer

Built Using:

* ZeroDB
* Knowledge Graph
* Agent Cloud

**Reusable Components:**

* Backend: ZeroDB event stream (`zerodb_create_event`, `zerodb_list_events`), RLHF tools for scoring/feedback
* MCP: ZeroDB MCP Server admin tools (project management, system stats, health checks)
* Docs: `docs-site/docs/billing/webhooks.mdx` (event types: `memory.stored`, `vectors.indexed`, `agent.task.complete`)

Tracks:

* AI policies
* Model approvals
* Compliance
* Risk reviews
* Prompt governance

---

# Fractional Executive Layer

This is the highest-margin component.

The executive does not perform analysis.

The platform generates:

* Weekly Reports
* Monthly Executive Briefings
* Quarterly AI Maturity Assessments
* Governance Recommendations
* Optimization Roadmaps

Executive Responsibilities:

* Leadership coaching
* Governance reviews
* Change management
* AI strategy

Everything else is automated.

---

# Existing Code Reuse Inventory

## Backend Services (Python/FastAPI)

| Service | Path | TokenOps Module |
|---------|------|-----------------|
| `AIUsageLog` model | `core/src/backend/app/models/ai_usage.py` | Module 1 |
| `UsageAggregationService` | `core/src/backend/app/services/usage_aggregation_service.py` | Module 1 |
| `TaskCostService` | `core/src/backend/app/services/task_cost_service.py` | Modules 1, 5 |
| `AgentCloudBillingService` | `core/src/backend/app/services/agent_cloud_billing_service.py` | Modules 1, 5 |
| `inference_router.py` | `core/src/backend/app/services/inference_router.py` | Module 4 |
| `prompt_optimizer.py` | `core/src/backend/app/services/agent/prompt_optimizer.py` | Module 2 |
| `AgentResourceMonitor` | `core/src/backend/app/services/agent/resource_monitor.py` | Module 5 |
| `RealtimeOptimizationMonitor` | `core/src/backend/app/services/realtime_optimization_monitor.py` | Module 2 |
| `ZeroDBMemoryService` | `core/src/backend/app/services/zerodb_memory_service.py` | Module 3 |
| `StripeBillingService` | `core/src/backend/app/services/stripe_billing_service.py` | Billing |
| `ai_usage.py` endpoint | `core/src/backend/app/api/api_v1/endpoints/ai_usage.py` | Module 1 |
| `billing.py` admin API | `core/src/backend/app/api/admin/billing.py` | Module 1 |
| `credits.py` admin API | `core/src/backend/app/api/admin/credits.py` | Billing |

## Frontend Components (React/TypeScript)

| Component | Path | TokenOps Module |
|-----------|------|-----------------|
| `CostTracker.tsx` | `core/src/backend/admin_dashboard/src/components/CostTracker.tsx` | Module 1 |
| `UsageIndicator.tsx` | `core/ZeroDB.AINative.Studio/src/components/pricing/UsageIndicator.tsx` | Module 1 |
| `CostComparison.tsx` | `core/ZeroDB.AINative.Studio/src/components/CostComparison.tsx` | Module 4 |
| 34 shadcn/ui components | `core/zerodb-frontend/src/components/ui/` | All Modules |
| Dashboard + Recharts | `core/zerodb-frontend/src/pages/Dashboard.tsx` | Modules 1, 5 |
| Agent Swarm Monitor | `core/packages/agent-swarm-monitor/` | Module 5 |
| Auth components | `core/zerodb-frontend/src/components/auth/` | Onboarding |
| Billing components | `core/ZeroDB.AINative.Studio/src/components/pricing/` | Billing |
| Invoice components | `core/zerodb-frontend/src/components/invoices/` | Reporting |
| Admin dashboard | `core/ZeroDB.AINative.Studio/src/app/dashboard/` | All Modules |

## SDKs & Clients

| SDK | Path | Usage |
|-----|------|-------|
| ZeroDB Python SDK | `core/sdks/python/zerodb_mcp/` | All backend |
| ZeroDB JS Client | `core/zerodb-memory-mcp/src/client/zerodb-client.js` | MCP integration |
| ZeroDB TS API Client | `core/zerodb-frontend/src/services/api/zerodb.ts` | Frontend |
| Auth Service | `core/zerodb-frontend/src/services/auth/ainativeAuthService.ts` | Auth |
| Billing Service | `core/ZeroDB.AINative.Studio/src/services/BillingService.ts` | Billing |
| Credit Service | `core/ZeroDB.AINative.Studio/src/services/CreditService.ts` | Credits |

## Documentation

| Doc | Path | Topic |
|-----|------|-------|
| Agent Cloud Billing | `core/docs-site/docs/agent-cloud/billing.mdx` | Per-agent metering |
| Agent Observability | `core/docs-site/docs/agent-cloud/observability.mdx` | Token + cost endpoints |
| Task Cost Attribution API | `core/docs/api/TASK_COST_ATTRIBUTION_API.md` | Cost tree API spec |
| Token Tracking Guide | `core/docs/quick-reference/NOUSCODER_TOKEN_TRACKING_QUICK_START.md` | Usage tracking impl |
| Billing Credits | `core/docs/guides/BILLING_CREDITS.md` | Credit transaction flow |
| Chat Completions API | `core/docs-site/docs/api/chat-completions.mdx` | Token usage in responses |
| ZeroMemory Overview | `core/docs-site/docs/zeromemory/overview.mdx` | Memory architecture |
| MCP Overview | `core/docs-site/docs/mcp/overview.mdx` | All 7 MCP servers |
| SDK Overview | `core/docs-site/docs/sdks/overview.mdx` | All SDKs reference |

---

# Minimal New Code Strategy

Build New:

* TokenOps Dashboard UI — Next.js app composing existing components (CostTracker, UsageIndicator, shadcn/ui, Recharts)
* Executive Reporting UI — report templates using existing chart components + aggregation services
* AIKit Optimization Components — thin wrappers calling existing services (inference_router, prompt_optimizer, ZeroMemory)
* TokenOps MCP Extensions — custom MCP tools following existing zerodb-mcp-server patterns

Reuse Existing:

* ZeroDB APIs + Python SDK + JS Client + TS Client
* ZeroMemory APIs + MCP Server + Memory Service
* Models API + Inference Router + PROVIDER_LIMITS
* Agent Cloud + Billing Service + Resource Monitor + Cost Service
* Authentication (AINativeAuthService + AuthContext + OAuth)
* Billing (StripeBillingService + CreditService + BillingService)
* SDKs (React, Next.js, Vue, Svelte, Python, Agent SDK)
* OpenCap Stack MCP + ZeroDB MCP + ZeroMemory MCP
* 34 shadcn/ui components + CostTracker + UsageIndicator + CostComparison
* Agent Swarm Monitor + Admin Dashboard

Target:

Less than 10% new backend code.

More than 90% assembled from existing AINative platform capabilities.

---

# Long-Term Vision

TokenOps becomes the first AI-Native Operations Platform.

Not merely software.

Not merely consulting.

A hybrid system where:

* MCP collects data
* ZeroDB stores knowledge
* ZeroMemory reduces waste
* Agent Cloud performs analysis
* Models API executes intelligence
* Fractional executives guide adoption

The result is an AI-native consulting firm where software and agents perform most of the work and human experts focus on strategic decision-making.
