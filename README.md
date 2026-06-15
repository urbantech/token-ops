# TokenOps

**AI Cost Optimization Platform Powered by AINative**

TokenOps gives organizations visibility into AI spending, optimizes token consumption, and replaces manual consulting work with an autonomous agent swarm. It is built almost entirely from existing AINative platform services, with less than 10% new code.

---

## Build Stats

| Metric | Value |
|--------|-------|
| **Total source files** | 80 |
| **Total lines of code** | 12,159 |
| **Services** | 2,497 lines |
| **UI Components** | 4,189 lines |
| **API Routes** | 811 lines |
| **MCP Server** | 1,933 lines |
| **Types** | 604 lines |
| **Lib / Utilities** | 1,124 lines |
| **Dashboard Pages** | 835 lines |
| **GitHub Issues** | 43 (12 Epics + 31 Features) |
| **Dependencies** | 35 runtime + 13 dev |
| **New backend code** | < 10% |
| **Reused from AINative** | > 90% |
| **Time from zero to working codebase** | ~1 session, 6 parallel agents |

---

## Quick Start

```bash
# Clone
git clone https://github.com/urbantech/token-ops.git
cd token-ops

# Install dependencies
npm install

# Set up environment
cp .env .env.local
# Edit .env.local with your AINative credentials

# Run development server
npm run dev
# Open http://localhost:3000

# Run tests
npm test

# Run MCP server (for customer integration)
cd mcp-server && npm install && node index.js
```

### Environment Variables

Create `.env.local` from the `.env` template:

```bash
AINATIVE_API_URL=https://api.ainative.studio
AINATIVE_API_KEY=your_api_key_here
AINATIVE_API_TOKEN=your_token_here
ZERODB_PROJECT_ID=your_project_id
ZERODB_PROJECT_API_KEY=your_project_api_key
```

---

## Architecture

```
Customer Environment
        ↓
  TokenOps MCP Server (@tokenops/mcp-server)
        ↓
  AINative API Gateway (api.ainative.studio)
        ↓
  ZeroDB (system of record)
        ↓
  Agent Cloud (analysis execution)
        ↓
  ZeroMemory (duplicate detection + caching)
        ↓
  Models API (multi-provider LLM routing)
        ↓
  Executive Dashboard (Next.js)
        ↓
  Fractional AI-Native Executive
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript (strict) |
| **UI Components** | shadcn/ui + Radix UI |
| **Styling** | Tailwind CSS (dark theme) |
| **Charts** | Recharts |
| **Animations** | Framer Motion |
| **State Management** | @tanstack/react-query |
| **HTTP Client** | Axios |
| **Validation** | Zod |
| **Testing** | Vitest + @testing-library/react |
| **Database** | ZeroDB (via AINative API) |
| **Memory** | ZeroMemory (via AINative API) |
| **Auth** | AINative Auth (JWT + API keys) |
| **MCP Server** | @modelcontextprotocol/sdk (stdio) |

---

## Project Structure

```
token-ops/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout with sidebar
│   │   ├── page.tsx                  # Redirect to /dashboard
│   │   ├── dashboard/                # Dashboard pages
│   │   │   ├── spend/page.tsx        # AI Spend Intelligence
│   │   │   ├── prompts/page.tsx      # Prompt Optimization
│   │   │   ├── memory/page.tsx       # Memory Optimization
│   │   │   ├── models/page.tsx       # Model Routing
│   │   │   ├── agents/page.tsx       # Agent Workforce Analytics
│   │   │   ├── governance/page.tsx   # Governance
│   │   │   ├── reports/page.tsx      # Executive Reporting
│   │   │   └── settings/page.tsx     # Settings
│   │   └── api/                      # API routes
│   │       ├── telemetry/            # POST: prompt, agent, cost events
│   │       ├── analytics/            # GET: spend, batch patterns
│   │       ├── prompts/              # POST: analyze, recommend, duplicates
│   │       └── memory/               # GET/POST: detect duplicate, recommendations, stats
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui primitives (14 components)
│   │   ├── layout/                   # Sidebar, Header
│   │   ├── dashboard/                # Cost tracking + spend visualization
│   │   │   ├── CostTracker.tsx       # Per-agent cost table with polling + alerts
│   │   │   ├── UsageIndicator.tsx    # Animated progress bars (80%/95% thresholds)
│   │   │   ├── SpendByCategory.tsx   # Pie chart by classification
│   │   │   ├── CostTrendChart.tsx    # Line chart (7d/30d/90d)
│   │   │   ├── ModelCostComparison.tsx  # Current vs recommended model table
│   │   │   ├── SavingsOpportunities.tsx # Opportunity cards
│   │   │   └── BatchPatternAlert.tsx    # Repetitive pattern detection banner
│   │   ├── prompts/                  # Prompt analysis + optimization
│   │   │   ├── PromptAnalyzer.tsx    # Paste + analyze input
│   │   │   ├── PromptScorecard.tsx   # Verbosity/duplication/waste scores
│   │   │   ├── PromptDiff.tsx        # Original vs optimized side-by-side
│   │   │   └── PromptHistory.tsx     # Recent analyses table
│   │   └── memory/                   # Memory optimization
│   │       ├── DuplicateDetector.tsx  # Test query for duplicates
│   │       ├── MemoryReuseTable.tsx   # Duplicate queries table
│   │       ├── MemoryStats.tsx        # Stats cards
│   │       └── SavingsProjection.tsx  # Projected savings chart
│   │
│   ├── services/                     # Business logic layer
│   │   ├── telemetry.ts              # Record prompt/agent/cost events
│   │   ├── classifier.ts             # Token spend classification engine
│   │   ├── aggregation.ts            # Spend analytics (by model/team/classification)
│   │   ├── prompt-analyzer.ts        # Prompt verbosity + duplication scoring
│   │   ├── prompt-recommender.ts     # Generate optimized prompts
│   │   ├── memory-optimizer.ts       # Duplicate detection + reuse recommendations
│   │   ├── usage.ts                  # Token usage API service
│   │   ├── billing.ts               # Billing/credits API service
│   │   ├── memory.ts                # ZeroMemory API service
│   │   └── agents.ts                # Agent metrics API service
│   │
│   ├── lib/                          # Utilities + clients
│   │   ├── zerodb-client.ts          # TypeScript ZeroDB API client
│   │   ├── api-client.ts             # Axios instance with auth
│   │   ├── validation.ts             # Zod schemas for all API inputs
│   │   ├── constants.ts              # Classification categories, model tiers, colors
│   │   ├── mock-data.ts              # Realistic sample data
│   │   └── utils.ts                  # cn() utility (clsx + tailwind-merge)
│   │
│   ├── types/                        # Shared TypeScript types
│   │   ├── index.ts                  # Core types (TokenEvent, AgentMetrics, etc.)
│   │   ├── telemetry.ts              # PromptEvent, AgentExecution, CostEvent, Classification
│   │   ├── prompt.ts                 # PromptAnalysis, PromptRecommendation, PromptScorecard
│   │   └── memory.ts                 # DuplicateDetectionResult, MemoryStats, RepeatedQuery
│   │
│   └── hooks/                        # React hooks
│       └── use-toast.ts              # Toast notifications
│
├── mcp-server/                       # @tokenops/mcp-server
│   ├── index.js                      # MCP server with 8 tools (telemetry + analytics)
│   ├── services.js                   # Server-side service layer
│   ├── package.json                  # npm package config
│   └── README.md                     # Installation instructions
│
├── CLAUDE.md                         # Project rules + architectural constraints
├── prd.md                            # Product Requirements Document
├── backlog.md                        # Epics, features, user stories, acceptance criteria
└── .env                              # Environment template (gitignored)
```

---

## Token Spend Classification

Every token event is automatically classified into a work type, enabling targeted optimization:

| Category | Color | Optimization Strategy |
|----------|-------|----------------------|
| **Updating Specs** | Blue | Template reuse + ZeroMemory caching |
| **Brainstorming** | Purple | Tolerate higher spend, detect exploration loops |
| **Updating Code** | Green | Route to cheaper models (DeepSeek/Llama) |
| **Fixing Issues** | Orange | Cache fix patterns in ZeroMemory |
| **Batch Commands** | Red | **Highest ROI**: convert to zero-token scripts |

The classifier runs at zero LLM cost (keyword/pattern-based) and detects batch patterns using a sliding-window similarity analysis.

---

## Product Modules

| # | Module | Status | Issues |
|---|--------|--------|--------|
| 1 | AI Spend Intelligence | In Progress | #10, #11, #12 |
| 2 | Prompt Optimization | In Progress | #13, #14, #15 |
| 3 | Memory Optimization | In Progress | #16, #17, #18 |
| 4 | Model Routing | Planned | #22, #23, #24 |
| 5 | Agent Workforce Analytics | Planned | #25, #26, #27 |
| 6 | Context Compression | Planned | #19, #20, #21 |
| 7 | Organizational Knowledge Graph | Planned | #28, #29, #30 |
| 8 | Executive Reporting | Planned | #31, #32, #33 |
| 9 | Fractional Executive Workspace | Planned | #34, #35, #36 |
| 10 | Agent Swarm Operations | Planned | #37, #38-#42 |

**MVP** = Modules 1-3, 8, 9, 10 (Epics 1-5, 10-12)

---

## AINative Platform Reuse Map

TokenOps is a showcase of the AINative ecosystem. Here is every platform component we reuse and where it maps:

### Backend Services (Python/FastAPI — reused via API)

| AINative Service | Source Path | TokenOps Usage |
|-----------------|-------------|----------------|
| **AIUsageLog** | `core/src/backend/app/models/ai_usage.py` | Token tracking data model (prompt_tokens, completion_tokens, cost_millicents, provider, model) |
| **UsageAggregationService** | `core/src/backend/app/services/usage_aggregation_service.py` | Spend analytics by provider+model, billing period aggregation |
| **TaskCostService** | `core/src/backend/app/services/task_cost_service.py` | Recursive delegation chain cost trees via CTE |
| **AgentCloudBillingService** | `core/src/backend/app/services/agent_cloud_billing_service.py` | Credit pricing: compute (2/sec), memory_ops (5/op), vector_search (8/query), storage (0.001/byte), a2a (3/msg), postgresql (20/query) |
| **inference_router.py** | `core/src/backend/app/services/inference_router.py` | `PROVIDER_LIMITS` with cost_per_1M per provider. Tiered routing: FREE→Cerebras→Meta→NVIDIA, PAID→DigitalOcean→NVIDIA→Meta |
| **prompt_optimizer.py** | `core/src/backend/app/services/agent/prompt_optimizer.py` | RLHF-driven prompt refinement (triggers rewrite when avg score < 7.0) |
| **AgentResourceMonitor** | `core/src/backend/app/services/agent/resource_monitor.py` | CPU/memory metrics per agent, 60s collection interval |
| **ZeroDBMemoryService** | `core/src/backend/app/services/zerodb_memory_service.py` | Semantic search, deduplication, categories, priority levels, TTL cleanup |
| **RealtimeOptimizationMonitor** | `core/src/backend/app/services/realtime_optimization_monitor.py` | WebSocket experiment tracking with statistical significance |
| **ai_usage endpoint** | `core/src/backend/app/api/api_v1/endpoints/ai_usage.py` | Paginated usage queries + CSV export from llm_token_usage table |
| **billing admin API** | `core/src/backend/app/api/admin/billing.py` | Endpoint classification + mcp_request_logs queries |
| **StripeBillingService** | `core/src/backend/app/services/stripe_billing_service.py` | PaymentIntent, subscriptions, 3-retry failure handling |

### Frontend Components (React/TypeScript — ported to shadcn/ui)

| AINative Component | Source Path | TokenOps Port |
|-------------------|-------------|---------------|
| **CostTracker.tsx** | `core/src/backend/admin_dashboard/src/components/CostTracker.tsx` | Per-agent cost table with polling + threshold alerts |
| **UsageIndicator.tsx** | `core/ZeroDB.AINative.Studio/src/components/pricing/UsageIndicator.tsx` | Animated progress bars (80%/95% warning) |
| **CostComparison.tsx** | `core/ZeroDB.AINative.Studio/src/components/CostComparison.tsx` | Model cost comparison table |
| **Dashboard.tsx** | `core/zerodb-frontend/src/pages/Dashboard.tsx` | Recharts (Line, Bar, Pie, Area) patterns |
| **34 shadcn/ui components** | `core/zerodb-frontend/src/components/ui/` | Full design system |
| **Agent Swarm Monitor** | `core/packages/agent-swarm-monitor/` | Agent monitoring UI patterns |
| **Auth components** | `core/zerodb-frontend/src/components/auth/` | Login, SignUp, OAuth flows |
| **Billing/Pricing UI** | `core/ZeroDB.AINative.Studio/src/components/pricing/` | PricingCard, BillingToggle, TrialBanner |
| **Admin dashboard** | `core/ZeroDB.AINative.Studio/src/app/dashboard/` | 15+ page route structure |
| **AIKit Sidebar** | `core/packages/agent-swarm-monitor/components/aikit/AIKitSidebar.tsx` | Collapsible nav with badges |

### SDKs & Clients

| AINative SDK | Source Path | TokenOps Usage |
|-------------|-------------|----------------|
| **ZeroDB Python SDK** | `core/sdks/python/zerodb_mcp/` | Full async client with 60+ operations |
| **ZeroDB JS Client** | `core/zerodb-memory-mcp/src/client/zerodb-client.js` | Client pattern for our TS zerodb-client |
| **ZeroDB TS API Client** | `core/zerodb-frontend/src/services/api/zerodb.ts` | TypeScript interfaces + API client |
| **AINativeAuthService** | `core/zerodb-frontend/src/services/auth/ainativeAuthService.ts` | JWT + OAuth with auto-refresh |
| **BillingService** | `core/ZeroDB.AINative.Studio/src/services/BillingService.ts` | Payment methods, subscriptions |
| **CreditService** | `core/ZeroDB.AINative.Studio/src/services/CreditService.ts` | Credit balance, transactions |
| **AIKit Core** | `core/packages/core/` | Agent base class, AgentExecutor, LLM providers |

### MCP Servers

| AINative MCP | Source Path | TokenOps Usage |
|-------------|-------------|----------------|
| **ZeroDB MCP Server** | `core/zerodb-mcp-server/index.js` | Pattern for @tokenops/mcp-server (76+ tools reference) |
| **ZeroMemory MCP** | `core/zerodb-memory-mcp/index.js` | Memory tools, auto-context, write-back patterns |
| **Browser MCP** | `core/packages/browser-mcp/` | Connector pattern for system integrations |

### Documentation

| Doc | Source Path | Relevance |
|-----|-------------|-----------|
| **Agent Cloud Billing** | `core/docs-site/docs/agent-cloud/billing.mdx` | Per-agent metering API |
| **Agent Observability** | `core/docs-site/docs/agent-cloud/observability.mdx` | Token + cost endpoints |
| **Task Cost API** | `core/docs/api/TASK_COST_ATTRIBUTION_API.md` | Cost tree API spec |
| **Token Tracking Guide** | `core/docs/quick-reference/NOUSCODER_TOKEN_TRACKING_QUICK_START.md` | Pricing tables, tiktoken |
| **ZeroMemory Overview** | `core/docs-site/docs/zeromemory/overview.mdx` | Memory architecture |
| **MCP Overview** | `core/docs-site/docs/mcp/overview.mdx` | All 7 MCP servers |
| **SDK Overview** | `core/docs-site/docs/sdks/overview.mdx` | All SDK references |
| **Billing Credits** | `core/docs/guides/BILLING_CREDITS.md` | Credit transaction flow |
| **Docusaurus dev docs** | `core/docs-site/` | Full published docs at docs.ainative.studio |

---

## MCP Server — Customer Integration

The TokenOps MCP server is how customers send telemetry to the platform.

### Install

```bash
npx @tokenops/mcp-server
```

### Add to Claude Code / Cursor

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

### Tools (8 total)

**Telemetry:** `tokenops_record_prompt`, `tokenops_record_agent_execution`, `tokenops_record_cost_event`

**Analytics:** `tokenops_get_spend_summary`, `tokenops_get_optimization_opportunities`, `tokenops_get_batch_patterns`

**Connection:** `tokenops_test_connection`, `tokenops_get_status`

---

## Development Rules

See [CLAUDE.md](./CLAUDE.md) for the complete ruleset. Key rules:

1. **No AI Attribution** — Zero tolerance. No "Claude", "Anthropic", "Co-Authored-By" in any file or commit.
2. **TDD Required** — Write tests first. Coverage >= 80%. Run: `npm test`
3. **GitHub Issue Tracking** — Every PR links to an issue. Branch: `[type]/[issue-number]-[slug]`. Commits: `Refs #123`
4. **Surgical Changes** — Every changed line traces back to the task.
5. **Architecture** — Route handlers are thin (validate → service → response). Business logic in `src/services/` only.
6. **Security** — No secrets in code. Zod validation at all API boundaries.

---

## API Routes

### Telemetry (POST)

| Endpoint | Purpose |
|----------|---------|
| `/api/telemetry/prompt` | Record prompt event (auto-classified) |
| `/api/telemetry/agent` | Record agent execution |
| `/api/telemetry/cost` | Record cost event |

### Analytics (GET)

| Endpoint | Purpose |
|----------|---------|
| `/api/analytics/spend?groupBy=model\|team\|classification` | Spend breakdown |
| `/api/analytics/batch-patterns?threshold=3` | Detected repetitive patterns |

### Prompts (POST)

| Endpoint | Purpose |
|----------|---------|
| `/api/prompts/analyze` | Analyze a prompt for verbosity/duplication/waste |
| `/api/prompts/recommend` | Generate optimized prompt |
| `/api/prompts/duplicates` | Check for duplicate prompts |

### Memory (GET/POST)

| Endpoint | Purpose |
|----------|---------|
| `/api/memory/detect-duplicate` | Check if request is a duplicate |
| `/api/memory/recommendations` | Get memory reuse recommendations |
| `/api/memory/stats` | Memory optimization statistics |

---

## How This Was Built

TokenOps was scaffolded in a single working session using 6 parallel Claude Code agents, each in an isolated git worktree:

| Agent | Scope | Output |
|-------|-------|--------|
| **Project Scaffold** | Next.js setup, design system, layouts, routing | App structure, 14 shadcn/ui components, layouts |
| **Telemetry Backend** | Issues #7, #8, #9, #43 | ZeroDB client, telemetry service, classifier, aggregation, 5 API routes |
| **MCP Server** | Issues #3, #4 | @tokenops/mcp-server with 8 tools |
| **Dashboard UI** | Issues #11, #12 | 7 dashboard components + spend page |
| **Prompt Optimization** | Issues #14, #15 | Analyzer, recommender, 4 UI components, 3 API routes |
| **Memory Optimization** | Issues #17, #18 | Optimizer service, 4 UI components, 3 API routes |

All agents were briefed with:
- Specific file paths from `core/` to read for patterns
- Implementation instructions referencing existing AINative services
- Compliance rules (no AI attribution, TDD, architectural constraints)
- Issue numbers for tracking

The docs (PRD + backlog + 43 GitHub issues) were created first with full implementation guides mapping every feature to existing reusable code, then agents executed against those specs.

---

## Contributing

1. Pick an issue from the [backlog](https://github.com/urbantech/token-ops/issues)
2. Create a branch: `feature/[issue-number]-[slug]`
3. Write tests first (TDD required)
4. Implement the feature following architectural constraints in CLAUDE.md
5. Reference the issue in commits: `Refs #123`
6. Open a PR linking to the issue

---

## License

See [LICENSE](./LICENSE) for details.
