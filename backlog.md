# TokenOps Backlog

## Detailed Epics, Features, User Stories & Acceptance Criteria

# EPIC 1

## Customer Onboarding & MCP Installation

Goal:
Connect customer systems to AINative in under 15 minutes.

**Reusable Code:**

* Auth: `AINativeAuthService` (`core/zerodb-frontend/src/services/auth/ainativeAuthService.ts`) — JWT + OAuth with auto-refresh
* Auth UI: `LoginForm.tsx`, `SignUpForm.tsx`, `OAuthButtons.tsx` (`core/zerodb-frontend/src/components/auth/`)
* MCP pattern: ZeroDB MCP Server (`core/zerodb-mcp-server/index.js`) — 76+ tools, follow same install pattern
* MCP rate limiter: `core/src/backend/app/zerodb/services/mcp_rate_limiter.py`

---

### Feature 1.1

MCP Installation Wizard

#### User Story

As a customer

I want to install the TokenOps MCP

So that my systems begin sending telemetry automatically.

#### Acceptance Criteria

* MCP install instructions displayed
* One-click copy command
* Connection test available
* Validation status shown
* Success confirmation displayed

**Implementation:** Follow `core/zerodb-mcp-server/` install pattern. Reuse `zerodb-cli` quickstart flow (`core/docs/products/zerodb/guides/ZERODB_CLI_QUICKSTART.md`).

---

### Feature 1.2

API Key Provisioning

#### User Story

As a customer

I want to generate API credentials

So that MCP can authenticate securely.

#### Acceptance Criteria

* Create API key
* Rotate API key
* Revoke API key
* Audit logging enabled

**Implementation:** Reuse `AINativeAuthService` (`core/zerodb-frontend/src/services/auth/ainativeAuthService.ts`). Backend auth already handles API key CRUD via `core/src/backend/app/api/admin/auth.py`. See `docs-site/docs/billing/credits.mdx` for API key patterns.

---

### Feature 1.3

System Connections

#### User Story

As a customer

I want to connect external systems

So that TokenOps can analyze activity.

#### Acceptance Criteria

Support:

* GitHub
* GitLab
* Gmail
* Slack
* Jira
* Linear
* Google Workspace

Connection health displayed.

**Implementation:** Reuse MCP connector patterns from existing servers (Browser MCP at `core/packages/browser-mcp/`, ZeroMemory write-back tools at `core/zerodb-memory-mcp/src/tools/writeback-tools.js` for Slack, GitHub, Gmail, Notion). Connection health via `zerodb_admin_health` pattern.

---

# EPIC 2

## Telemetry Collection Platform

Goal:
Capture AI operational data into ZeroDB.

**Reusable Code:**

* `AIUsageLog` model (`core/src/backend/app/models/ai_usage.py`) — already tracks prompt_tokens, completion_tokens, total_tokens, latency_ms, cost_millicents, provider, model_name
* `ai_usage.py` endpoint (`core/src/backend/app/api/api_v1/endpoints/ai_usage.py`) — paginated queries + CSV export
* `agent_resource_usage.py` model (`core/src/backend/app/models/agent_resource_usage.py`) — ResourceType, ResourceUnit
* ZeroDB event stream (`zerodb_create_event`, `zerodb_list_events`)
* MCP request logging: `mcp_request_logs` table (queried in `core/src/backend/app/api/admin/billing.py`)

---

### Feature 2.1

Prompt Event Collection

#### User Story

As a platform administrator

I want all prompt activity captured

So that optimization analysis is possible.

#### Acceptance Criteria

Capture:

* prompt
* model
* tokens
* user
* agent
* timestamp

Stored in ZeroDB.

**Implementation:** Extend existing `AIUsageLog` model. Use `llm_usage_tracking_service` with tiktoken integration (see `docs/quick-reference/NOUSCODER_TOKEN_TRACKING_QUICK_START.md`). Store in `llm_token_usage` table.

---

### Feature 2.2

Agent Execution Collection

#### User Story

As a platform administrator

I want agent activity recorded

So that agent efficiency can be measured.

#### Acceptance Criteria

Capture:

* agent
* workflow
* tools
* duration
* output size
* token cost

**Implementation:** Reuse `AgentResourceMonitor` (`core/src/backend/app/services/agent/resource_monitor.py`) — already collects CPU/memory metrics to `agent_resource_metrics` table every 60s. Extend with `TaskCostService` (`core/src/backend/app/services/task_cost_service.py`) for per-task cost attribution.

---

### Feature 2.4

Token Spend Classification Engine

#### User Story

As a platform administrator

I want every token spend event classified by work type

So that optimization is targeted to the highest-waste categories.

#### Classification Categories

1. **Updating Specs** — documentation, PRDs, planning artifacts
2. **Brainstorming Ideas** — creative exploration, research, ideation
3. **Updating Code** — implementation, refactoring, feature development
4. **Fixing Issues** — debugging, bug fixes, error resolution
5. **Batch Commands** — repetitive operations that could be replaced by zero-token scripts

#### Acceptance Criteria

* Every token event tagged with a classification category
* Classification applied in real-time via prompt/context analysis
* Classification accuracy > 85% (validated via RLHF feedback)
* Batch command detection flags repetitive patterns automatically
* Dashboard shows spend breakdown by category
* "Script Opportunity" alerts when batch patterns exceed configurable threshold

#### Why Classification Matters

Without classification, optimization is generic ("spend less"). With classification:

* **Specs work** → optimize with template reuse + ZeroMemory caching
* **Brainstorming** → tolerate higher spend (creative value), but detect when exploration loops
* **Code updates** → route to cheaper models (code tasks work well on Sonnet/DeepSeek)
* **Bug fixes** → cache common fix patterns in ZeroMemory to avoid repeat debugging
* **Batch commands** → **highest ROI**: convert detected patterns into deterministic scripts with zero token cost

#### Implementation

**Reuse:**

* `AIUsageLog` model (`core/src/backend/app/models/ai_usage.py`) — extend with classification field
* `inference_router.py` (`core/src/backend/app/services/inference_router.py`) — classification-aware model routing
* `ZeroDBMemoryService` (`core/src/backend/app/services/zerodb_memory_service.py`) — batch pattern detection via semantic search
* `prompt_optimizer.py` — classification context for targeted refinement
* Models API free tier (Meta/Cerebras at $0/token) for classification inference

**New Code:** Classification prompt, batch pattern detector, script generation agent, classification dashboard widget.

---

### Feature 2.3

Cost Event Collection

#### User Story

As a customer

I want AI spend tracked

So that I understand cost drivers.

#### Acceptance Criteria

Track:

* model cost
* provider cost
* workflow cost
* team cost

**Implementation:** Reuse `UsageAggregationService` (`core/src/backend/app/services/usage_aggregation_service.py`) — already aggregates api_calls, llm_tokens by provider+model, storage, total_cost. Pricing: $0.002/credit, $0.10/GB-month. Also reuse `AgentCloudBillingService` credit pricing (compute 2/sec, memory_ops 5/op, vector_search 8/query, storage 0.001/byte, a2a 3/msg, postgresql 20/query).

---

# EPIC 3

## AI Spend Intelligence Dashboard

Goal:
Create visibility into AI spending.

**Reusable Code:**

* `CostTracker.tsx` (`core/src/backend/admin_dashboard/src/components/CostTracker.tsx`) — per-agent cost breakdown with 10s polling, $5/$10 threshold alerts
* `UsageIndicator.tsx` (`core/ZeroDB.AINative.Studio/src/components/pricing/UsageIndicator.tsx`) — animated progress bars with 80%/95% warnings
* `CostComparison.tsx` (`core/ZeroDB.AINative.Studio/src/components/CostComparison.tsx`) — cost comparison table
* Dashboard charts (`core/zerodb-frontend/src/pages/Dashboard.tsx`) — Recharts Line, Bar, Pie, Area with real-time token usage
* 34 shadcn/ui components (`core/zerodb-frontend/src/components/ui/`)
* Admin dashboard pages (`core/ZeroDB.AINative.Studio/src/app/dashboard/analytics/`)

---

### Feature 3.1

Executive Cost Dashboard

#### User Story

As a CTO

I want a consolidated AI spend dashboard

So that I understand organizational AI costs.

#### Acceptance Criteria

Display:

* total spend
* spend by model
* spend by team
* spend by project
* spend trend

**Implementation:** Compose `CostTracker.tsx` + `UsageIndicator.tsx` + Recharts from `Dashboard.tsx`. Data from `UsageAggregationService.aggregate_user_usage()` which already returns full breakdown by provider+model. Use shadcn/ui `Card`, `Table`, `Tabs` components.

---

### Feature 3.2

Savings Opportunity Dashboard

#### User Story

As an executive

I want to see optimization opportunities

So that I know where savings exist.

#### Acceptance Criteria

Show:

* duplicate prompts
* expensive models
* unused memory
* inefficient workflows

**Implementation:** Duplicate prompts via `ZeroDBMemoryService` semantic search. Expensive models from `inference_router.py` `PROVIDER_LIMITS` comparison. Unused memory from ZeroMemory MCP `zerodb_search_memory`. Inefficient workflows from `TaskCostService` delegation tree analysis. Reuse `CostComparison.tsx` re-themed for model cost comparisons.

---

# EPIC 4

## Prompt Optimization Engine

Goal:
Reduce token consumption.

**Reusable Code:**

* `prompt_optimizer.py` (`core/src/backend/app/services/agent/prompt_optimizer.py`) — RLHF-driven prompt refinement, triggers LLM rewrite when avg score < 7.0 over last 5 runs, stores refined prompt in ZeroMemory
* `rlhf_scorer.py` (`core/src/backend/app/services/agent/rlhf_scorer.py`)
* `tool_schema_optimizer.py` (`core/src/backend/app/services/tool_schema_optimizer.py`)
* Token counting: tiktoken integration (see `docs/quick-reference/NOUSCODER_TOKEN_TRACKING_QUICK_START.md`)

---

### Feature 4.1

Prompt Analysis Agent

Built Using:

AIKit Prompt Analyzer

#### User Story

As a platform user

I want prompts analyzed

So that inefficiencies are identified.

#### Acceptance Criteria

Detect:

* verbosity
* duplication
* unnecessary context
* repeated instructions

**Implementation:** Wrap `prompt_optimizer.py` `maybe_refine_agent_prompt()`. Use RLHF scores from `agent_run_log` to identify low-performing prompts. Duplicate detection via `ZeroDBMemoryService` semantic search with confidence threshold. Token counting via tiktoken for verbosity scoring.

---

### Feature 4.2

Prompt Recommendation Engine

#### User Story

As a developer

I want prompt improvement suggestions

So that costs decrease.

#### Acceptance Criteria

Generate:

* revised prompt
* token reduction estimate
* performance estimate

**Implementation:** Use `prompt_optimizer.py` rewrite pipeline (already calls LLM to generate refined prompt). Token reduction calculated via tiktoken before/after comparison. Performance estimate from RLHF historical scores. Store optimized prompts in ZeroMemory for reuse.

---

# EPIC 5

## Memory Optimization Platform

Goal:
Reuse intelligence before calling models.

**Reusable Code:**

* `ZeroDBMemoryService` (`core/src/backend/app/services/zerodb_memory_service.py`) — semantic search, deduplication, categories, priority levels, TTL cleanup, export
* ZeroMemory MCP tools (`core/zerodb-memory-mcp/src/tools/memory-tools.js`) — `zerodb_store_memory`, `zerodb_search_memory`, `zerodb_get_context`, `zerodb_semantic_search`
* Memory manager utils (`core/zerodb-memory-mcp/src/utils/memory-manager.js`)
* Auto-context middleware (`core/zerodb-memory-mcp/src/utils/auto-context.js`)
* Docs: `docs-site/docs/zeromemory/overview.mdx`, `docs/products/zeromemory/architecture/MEMORY_MANAGEMENT_ARCHITECTURE.md`

---

### Feature 5.1

Duplicate Request Detection

Built Using:

ZeroMemory

#### User Story

As an agent

I want to detect similar requests

So that existing knowledge can be reused.

#### Acceptance Criteria

Return:

* confidence score
* prior answer
* memory reference

**Implementation:** Direct call to `ZeroDBMemoryService.semantic_search()` with embedding comparison. Already returns confidence scores. Use auto-context middleware for automatic interception before LLM calls. Memory reference via `zerodb_get_context`.

---

### Feature 5.2

Memory Reuse Recommendations

#### User Story

As an administrator

I want memory reuse suggestions

So that token costs decrease.

#### Acceptance Criteria

Show:

* duplicate queries
* repeated research
* repeated workflows

**Implementation:** Aggregate `ZeroDBMemoryService` search logs to identify frequently repeated queries. Use `zerodb_semantic_search` to cluster similar memories. Report via existing Recharts dashboard components.

---

# EPIC 6

## Context Compression Engine

Goal:
Reduce context size.

**Reusable Code:**

* Memory manager summarization (`core/zerodb-memory-mcp/src/utils/memory-manager.js`) — prune strategy: hybrid, keep recent 5 messages, auto-embed, summarization enabled
* Auto-context middleware (`core/zerodb-memory-mcp/src/utils/auto-context.js`)
* Token counting via tiktoken

---

### Feature 6.1

Conversation Compression

#### User Story

As an AI operator

I want conversations compressed

So that fewer tokens are consumed.

#### Acceptance Criteria

Produce:

* original size
* compressed size
* reduction percentage

**Implementation:** Wrap memory-manager.js summarization with before/after token counting. Use existing prune strategy (hybrid mode with configurable context window of 8192 tokens).

---

### Feature 6.2

Context Utilization Reporting

#### User Story

As a CTO

I want visibility into context waste

So that improvements can be made.

#### Acceptance Criteria

Report:

* average context size
* wasted context
* oversized prompts

**Implementation:** Analyze `llm_token_usage` table for prompt_tokens vs completion_tokens ratios. Flag prompts exceeding configurable threshold. Use `UsageIndicator.tsx` with custom thresholds for context waste visualization.

---

# EPIC 7

## Model Routing Engine

Goal:
Use lowest-cost model capable of solving the task.

**Reusable Code:**

* `inference_router.py` (`core/src/backend/app/services/inference_router.py`) — `PROVIDER_LIMITS` with cost_per_1m_input/output. Routes: FREE→Cerebras→Meta→NVIDIA, PAID→DigitalOcean→NVIDIA→Meta, BYOK→user key. MinIO-configurable rate limits with 5-minute cache + fleet jitter.
* Provider pricing: Cerebras ($0/$0), Meta ($0/$0), NVIDIA NIM ($0.10/$0.10), DigitalOcean ($0.15/$0.60), HuggingFace ($0.20/$0.80)
* Chat completions endpoint (`core/src/backend/app/api/api_v1/endpoints/chat.py`)
* Docs: `docs-site/docs/api/chat-completions.mdx`

---

### Feature 7.1

Model Recommendation Agent

#### User Story

As a developer

I want model recommendations

So that I reduce AI spend.

#### Acceptance Criteria

Recommend:

* optimal model
* expected savings
* confidence score

**Implementation:** Analyze `llm_token_usage` records by model. Compare actual cost against `PROVIDER_LIMITS` for cheaper alternatives. Calculate expected savings as (current_cost - recommended_cost) * projected_volume. Confidence based on task complexity classification from RLHF scores.

---

### Feature 7.2

Automatic Model Routing

#### User Story

As an administrator

I want routing automated

So that savings occur automatically.

#### Acceptance Criteria

Rules engine available.

Supports:

* Claude
* GPT
* Gemini
* DeepSeek
* Llama

**Implementation:** Extend `inference_router.py` tiered routing with configurable rules. Already supports provider fallback chains. Add task-type classification to auto-select tier (simple→free, moderate→paid, complex→premium). Expose rules via admin API.

---

# EPIC 8

## Agent Workforce Analytics

Goal:
Measure agent productivity.

**Reusable Code:**

* `AgentResourceMonitor` (`core/src/backend/app/services/agent/resource_monitor.py`) — CPU/memory metrics per agent, 60s collection interval
* `AgentCloudBillingService` (`core/src/backend/app/services/agent_cloud_billing_service.py`) — credit pricing for 6 resource types
* `TaskCostService` (`core/src/backend/app/services/task_cost_service.py`) — recursive delegation cost trees
* Agent Swarm Monitor (`core/packages/agent-swarm-monitor/`) — `@ainative/agent-swarm-monitor` with Recharts + Framer Motion
* `CostTracker.tsx` (`core/src/backend/admin_dashboard/src/components/CostTracker.tsx`) — per-agent cost breakdown
* Observability API: `/api/v1/cloud/observability/metrics/{agent_id}` and `/api/v1/cloud/observability/costs/{agent_id}`

---

### Feature 8.1

Agent Performance Dashboard

#### User Story

As an executive

I want visibility into agent effectiveness

So that I understand ROI.

#### Acceptance Criteria

Display:

* agent activity
* success rate
* token usage
* memory usage

**Implementation:** Compose Agent Swarm Monitor UI + `CostTracker.tsx`. Data from observability endpoints (per-agent input/output/total tokens + cost breakdown by resource type). Success rate from RLHF scores. Memory usage from `zerodb_search_memory` stats.

---

### Feature 8.2

Workflow Optimization

#### User Story

As a customer

I want redundant workflows identified

So that operations improve.

#### Acceptance Criteria

Detect:

* duplicated workflows
* inefficient workflows
* excessive tool calls

**Implementation:** Analyze `TaskCostService` delegation trees for repeated patterns. Flag workflows where tool_call cost exceeds LLM cost. Use `RealtimeOptimizationMonitor` WebSocket events for live workflow tracking.

---

# EPIC 9

## Organizational Knowledge Graph

Goal:
Create organizational intelligence layer.

**Reusable Code:**

* ZeroDB GraphRAG via vector operations (`core/sdks/python/zerodb_mcp/operations/vectors.py`)
* ZeroDB MCP vector tools (`zerodb_upsert_vector`, `zerodb_search_vectors`, `zerodb_batch_upsert_vectors`)
* LangChain embedding integration (`core/sdks/python/zerodb_mcp/langchain_embeddings.py`)
* Docs: `docs-site/docs/zerodb/vectors.mdx`, `docs-site/docs/zerodb/embeddings.mdx`

---

### Feature 9.1

Knowledge Graph Builder

Built Using:

ZeroDB GraphRAG

#### User Story

As an organization

I want knowledge connected

So that agents learn faster.

#### Acceptance Criteria

Create entities:

* people
* projects
* systems
* prompts
* workflows

**Implementation:** Use ZeroDB vector operations to store entity embeddings. Build relationships via metadata in vector upserts. Use LangChain embedding integration for entity encoding. Query via `zerodb_search_vectors` with metadata filters.

---

### Feature 9.2

Knowledge Discovery

#### User Story

As a consultant

I want organizational intelligence surfaced

So that opportunities are discovered.

#### Acceptance Criteria

Recommend:

* duplicate work
* hidden expertise
* workflow overlap

**Implementation:** Semantic similarity search across entity vectors to find duplicates. Cluster analysis on workflow embeddings for overlap detection. Surface expertise by analyzing agent interaction patterns stored in ZeroMemory.

---

# EPIC 10

## Executive Reporting

Goal:
Automate consulting deliverables.

**Reusable Code:**

* Recharts (Line, Bar, Pie, Area) from `Dashboard.tsx` (`core/zerodb-frontend/src/pages/Dashboard.tsx`)
* `InvoiceStats.tsx`, `InvoiceStatusBadge.tsx` (`core/zerodb-frontend/src/components/invoices/`)
* `UsageAggregationService` for period summaries
* Airflow DAGs for scheduled exports (`core/services/airflow/dags/`)
* RLHF weekly export DAG (`core/services/airflow/dags/rlhf_weekly_export.py`)

---

### Feature 10.1

Weekly Executive Brief

#### User Story

As an executive

I want automated reports

So that I understand AI operations.

#### Acceptance Criteria

Generate:

* spend summary
* optimization summary
* risks
* opportunities

**Implementation:** Scheduled agent using AIKit `AgentExecutor`. Pulls data from `UsageAggregationService.aggregate_user_usage()`. Generates report using LLM via Models API. Stores in ZeroDB. Delivers via ZeroMemory write-back tools (email, Slack). Follow Airflow DAG pattern from `rlhf_weekly_export.py`.

---

### Feature 10.2

Monthly AI Maturity Report

#### User Story

As a customer

I want maturity assessments

So that progress is measured.

#### Acceptance Criteria

Score:

* governance
* memory
* optimization
* automation
* agent adoption

**Implementation:** Compute scores from existing metrics: governance (policy compliance events), memory (ZeroMemory reuse rate), optimization (token reduction trend), automation (agent vs human task ratio), agent adoption (active agents + RLHF scores). Render via Recharts radar/bar charts with shadcn/ui `Card` layout.

---

# EPIC 11

## Fractional AI-Native Executive Workspace

Goal:
Scale consulting through software.

**Reusable Code:**

* Admin dashboard structure (`core/ZeroDB.AINative.Studio/src/app/dashboard/`) — 15+ page routes
* `SystemHealthCard.tsx`, `SystemStatsCard.tsx`, `UserUsagePanel.tsx`, `AllProjectsTable.tsx` (`core/ZeroDB.AINative.Studio/src/components/admin/`)
* `PricingCard.tsx`, `TrialBanner.tsx`, `UpgradeDialog.tsx` (`core/ZeroDB.AINative.Studio/src/components/pricing/`)
* AIKit Sidebar (`core/packages/agent-swarm-monitor/components/aikit/AIKitSidebar.tsx`) — collapsible nav with badge support

---

### Feature 11.1

Consultant Dashboard

#### User Story

As a fractional executive

I want customer insights surfaced

So that I can advise efficiently.

#### Acceptance Criteria

Display:

* alerts
* recommendations
* risks
* opportunities

**Implementation:** Compose `SystemHealthCard.tsx` (health status) + `CostTracker.tsx` (cost alerts) + `UsageIndicator.tsx` (threshold warnings) into multi-customer view. Use `AIKitSidebar.tsx` for customer navigation. Data from per-customer `UsageAggregationService` queries.

---

### Feature 11.2

Customer Action Plans

#### User Story

As a consultant

I want remediation plans generated

So that customer outcomes improve.

#### Acceptance Criteria

Generate:

* roadmap
* priorities
* expected savings

**Implementation:** Agent-generated using AIKit `AgentExecutor`. Input: customer's usage data + optimization opportunities + model routing recommendations. Output: prioritized action items with projected savings from `PROVIDER_LIMITS` cost comparisons. Store plans in ZeroMemory for tracking.

---

# EPIC 12

## Agent Swarm Operations

Goal:
Replace manual consulting work.

**Reusable Code:**

* AIKit Core (`core/packages/core/`) — `Agent` base class, `AgentExecutor`, `ToolRegistry`, Zod validation
* LLM Providers (`core/packages/core/src/agents/llm/`) — Anthropic + OpenAI providers with streaming adapters
* Agent Swarm Monitor (`core/packages/agent-swarm-monitor/`) — real-time monitoring UI
* Swarm quota service (`core/src/backend/app/services/agent_framework/swarm_quota_service.py`)
* RLHF tools (`core/packages/core/src/rlhf/`)

---

### Feature 12.1

Token Auditor Agent

Acceptance Criteria

Produces:

* cost findings
* savings estimates

**Implementation:** AIKit Agent wrapping `UsageAggregationService` + `TaskCostService`. Queries `llm_token_usage` for anomalies (cost spikes, unused models, over-provisioned contexts). Calculates savings via `PROVIDER_LIMITS` model downgrade analysis. Outputs structured findings to ZeroDB.

---

### Feature 12.2

Prompt Architect Agent

Acceptance Criteria

Produces:

* optimized prompts
* prompt scorecards

**Implementation:** AIKit Agent wrapping `prompt_optimizer.py` `maybe_refine_agent_prompt()`. Reads RLHF scores from `agent_run_log`. Generates scorecards with verbosity score, duplication rate, context efficiency. Stores optimized prompts in ZeroMemory.

---

### Feature 12.3

Memory Architect Agent

Acceptance Criteria

Produces:

* memory recommendations
* reuse opportunities

**Implementation:** AIKit Agent wrapping `ZeroDBMemoryService`. Analyzes semantic search patterns for frequently repeated queries. Identifies low-confidence memories that could be consolidated. Uses ZeroMemory `zerodb_semantic_search` to cluster related memories. Reports via structured output to ZeroDB.

---

### Feature 12.4

Governance Agent

Acceptance Criteria

Produces:

* compliance findings
* governance recommendations

**Implementation:** AIKit Agent querying ZeroDB event stream for policy violations. Monitors model usage against approved model list. Flags unauthorized API key usage. Checks prompt content against governance rules. Uses RLHF feedback loop for continuous improvement.

---

### Feature 12.5

Executive Report Agent

Acceptance Criteria

Produces:

* board-ready reports
* executive summaries

**Implementation:** AIKit Agent composing outputs from all other agents (Token Auditor findings + Prompt Architect scorecards + Memory Architect recommendations + Governance findings). Generates narrative summary via Models API. Renders charts data for Recharts. Delivers via ZeroMemory write-back tools (email, Slack). Follow Airflow DAG scheduling pattern.

---

# MVP Definition

Required For Launch

Epic 1
Epic 2
Epic 3
Epic 4
Epic 5
Epic 10
Epic 11
Epic 12

Everything else can follow after customer validation.

Estimated New Backend Code

< 10%

Estimated Reuse of Existing AINative Platform

> 90%
