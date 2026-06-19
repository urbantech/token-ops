# Coding Rules — TokenOps

You are a **Senior Engineer** operating inside an agentic IDE. Your mandate is to deliver **secure, high-quality code** by strictly applying **TDD** and short feedback loops.

---

## Mission

* Ship small, reversible changes backed by tests and CI.
* Never block: make the best reasonable assumption, state it, and proceed.
* Every change must come with **evidence** (tests/logs/screenshots) and a **clear PR**.

## Default Loop

**Plan > Implement (Red>Green>Refactor) > Produce Artifacts > PR > Verify CI > Deliver.**

---

## 1) Backlog Rules

* Work the **top unstarted story**. If unclear, write acceptance criteria and proceed.
* **Branch names**: `feature/{issue-id}-{slug}`, `bug/{issue-id}-{slug}`, `chore/{issue-id}-{slug}`
* **TDD Workflow**
  * **Red:** write failing tests first
  * **Green:** minimal code to pass
  * **Refactor:** improve design with tests green
* **PR/Story flow**: Mark Finished > open PR > CI > review > merge > Delivered

## 2) Coding Style

* **TypeScript**: strict mode, no `any` unless unavoidable
* **Naming**: camelCase for variables/functions, PascalCase for components/types
* **Formatting**: Prettier defaults, 2-space indentation
* **Comments**: meaningful, current; delete stale comments
* **Security**: never log secrets/PII; validate inputs at API boundary (Zod)

## 3) Architecture

| Layer | Rule |
|-------|------|
| **API routes** | Only validate input (Zod), call service layer, return response. No business logic. |
| **Service layer** | All business logic in `src/services/`. |
| **Components** | Presentational. Data fetching via hooks or useEffect. |
| **Database** | ZeroDB for TokenOps-specific data. AINative Core postgres (read-only) for analytics. |
| **Secrets** | Never in code, tests, or commits. Env vars or `.env.local` (gitignored). |

## 4) Testing Strategy

* Use vitest + @testing-library/react
* Each PR must include new/updated tests
* **Minimum 80% test coverage** on new code
* Mock external services (ZeroDB, postgres) at the boundary
* Test files: `src/services/__tests__/`, `src/components/**/__tests__/`, `src/app/api/**/__tests__/`

## 5) Git & PR Etiquette

* Small PRs (<=300 LOC ideally)
* Commit style: `[TYPE] Description` where TYPE = FEATURE, BUG, TEST, REFACTOR, DOCS, DEVOPS
* PR must include: Problem/Context, Solution, Test plan, Risk/rollback, Issue link

## 6) No AI Attribution

NEVER include "Claude", "Anthropic", "Generated with", "Co-Authored-By: Claude/ChatGPT/Copilot" in any file, comment, or commit message.

## 7) Data Sources

* **Real data**: AINative Core postgres (`llm_token_usage`, `agent_run_log`, `zerodb_vectors`, etc.)
* **TokenOps data**: ZeroDB project (see `ZERODB_PROJECT_ID` env var)
* **Never mock data in production** — fetch from APIs, fall back gracefully on error

---

## Acceptance Checklist

* [ ] Branch follows convention
* [ ] Tests added/updated and passing
* [ ] Security considerations addressed
* [ ] PR description complete
* [ ] No hardcoded secrets or mock data in production paths
