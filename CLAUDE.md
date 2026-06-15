# TokenOps — AI Cost Optimization Platform

## Rules (Problem-First)

### 1. Think Before Coding
If a task is ambiguous, ask before coding. Plan your approach before touching code.

### 2. No AI Attribution (Zero Tolerance)
NEVER include: "Claude", "Anthropic", "Generated with", "Co-Authored-By: Claude/ChatGPT/Copilot" in any file, comment, or commit message.
Correct: `Add feature description` with `Refs #123`

### 3. TDD Required
Write the test first. Coverage >= 80%.
- Services: `src/services/__tests__/`
- Components: `src/components/**/__tests__/`
- Routes: `src/app/api/**/__tests__/`
- Run: `npm test`

### 4. GitHub Issue Tracking
Every PR links to an issue. Branch: `[type]/[issue-number]-[slug]`
Commits: `Refs #123` or `Closes #123`
Types: `[BUG]`, `[FEATURE]`, `[TEST]`, `[REFACTOR]`, `[DOCS]`, `[DEVOPS]`

### 5. Surgical Changes Only
Every changed line should trace back to the task.

### 6. Security
Never log secrets/PII. Validate all inputs at API boundary (Zod). No credentials in code or tests.

---

## Architectural Constraints

| Layer | Rule |
|-------|------|
| **API routes** | Only validate input (Zod), call service layer, return response. No business logic. |
| **Service layer** | All business logic lives in `src/services/`. |
| **Components** | Presentational. Data fetching via hooks in `src/hooks/`. |
| **Memory/Context** | ZeroDB for ALL storage. No Supabase. |
| **Secrets** | Never in code, tests, or commits. Env vars or `.env` (gitignored). |

---

## Quick Reference

| Item | Value |
|------|-------|
| **Framework** | Next.js 14+ App Router |
| **Language** | TypeScript (strict) |
| **UI** | shadcn/ui + Tailwind CSS |
| **Charts** | Recharts |
| **API Client** | axios + Zod validation |
| **State** | @tanstack/react-query |
| **Testing** | vitest + @testing-library/react |
| **Database** | ZeroDB (via AINative API) |
| **Memory** | ZeroMemory (via AINative API) |
| **Auth** | AINative Auth (JWT + API keys) |
| **Main Branch** | `main` |

---

## Project Structure

```
src/
  app/              — Next.js App Router pages + API routes
  components/
    ui/             — shadcn/ui primitives
    layout/         — Sidebar, Header
    dashboard/      — Cost tracking, charts, savings
    prompts/        — Prompt analysis, optimization
    memory/         — Memory reuse, duplicate detection
  services/         — Business logic (telemetry, classifier, aggregation, etc.)
  lib/              — Utilities (zerodb-client, api-client, utils)
  types/            — Shared TypeScript types
  hooks/            — React hooks
mcp-server/         — @tokenops/mcp-server (customer integration)
```

---

## Key Services

| Service | Path | Purpose |
|---------|------|---------|
| Telemetry | `src/services/telemetry.ts` | Record prompt, agent, cost events |
| Classifier | `src/services/classifier.ts` | Classify token spend (specs/brainstorm/code/fixes/batch) |
| Aggregation | `src/services/aggregation.ts` | Spend analytics by model/team/classification |
| Prompt Analyzer | `src/services/prompt-analyzer.ts` | Prompt verbosity, duplication, waste scoring |
| Prompt Recommender | `src/services/prompt-recommender.ts` | Generate optimized prompts |
| Memory Optimizer | `src/services/memory-optimizer.ts` | Duplicate detection, reuse recommendations |
| ZeroDB Client | `src/lib/zerodb-client.ts` | TypeScript client for ZeroDB API |

---

## AINative Platform Dependencies

TokenOps reuses >90% of existing AINative infrastructure. Key reusable code lives in `/Users/aideveloper/core/`:

- **Token tracking**: `core/src/backend/app/models/ai_usage.py`, `core/src/backend/app/services/usage_aggregation_service.py`
- **Cost attribution**: `core/src/backend/app/services/task_cost_service.py`
- **Model routing**: `core/src/backend/app/services/inference_router.py`
- **Prompt optimization**: `core/src/backend/app/services/agent/prompt_optimizer.py`
- **Memory**: `core/src/backend/app/services/zerodb_memory_service.py`
- **Agent billing**: `core/src/backend/app/services/agent_cloud_billing_service.py`
- **UI components**: `core/zerodb-frontend/src/components/ui/` (34 shadcn/ui components)
- **MCP pattern**: `core/zerodb-mcp-server/index.js`
