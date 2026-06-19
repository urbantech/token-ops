# .ainative Directory

**Purpose**: Project context and configuration for AI coding assistants
**Compatible With**: Gemini CLI, Claude Code, Cursor, Windsurf, and other AI tools
**Project**: TokenOps — AI Cost Optimization Platform

---

## Quick Start

### For Claude Code Users

```bash
# Open project (automatically reads CLAUDE.md and .ainative/)
claude
```

### For Gemini CLI Users

```bash
# Start Gemini CLI (automatically loads .ainative/settings.json)
gemini
```

### For Other AI Tools

1. Read `RULES.md` for coding standards and workflow
2. Review `settings.json` for configuration details
3. Follow rules in `rules/` directory

---

## Directory Structure

```
.ainative/
├── README.md              # This file (quick reference)
├── CODY.md                # Cody agent persona and dispatch config
├── RULES.md               # Coding standards, TDD, PR workflow
├── settings.json          # Gemini CLI-compatible settings
└── rules/
    └── coding-standards.md  # Language and framework conventions
```

---

## Project Overview

TokenOps is an AI Cost Optimization Platform that provides visibility, governance, and savings for AI operations. It connects to AINative Core's production database to analyze real LLM token usage and implements validated savings techniques.

### Key Documents

| Document | Location |
|----------|----------|
| Product Requirements | `prd.md` |
| Product Backlog | `backlog.md` |
| Project Rules | `CLAUDE.md` |

---

## Tech Stack

- **Framework**: Next.js 14+ App Router
- **Language**: TypeScript (strict)
- **UI**: shadcn/ui + Tailwind CSS
- **Charts**: Recharts
- **Auth**: NextAuth.js (Google + Apple OAuth)
- **Database**: ZeroDB (via AINative API) + AINative Core Postgres (read-only)
- **Memory**: ZeroMemory (via AINative API)
- **Deployment**: Railway
- **Testing**: vitest + @testing-library/react

---

## Development Commands

```bash
# Run tests with coverage
npm test

# Start dev server
npm run dev

# Build for production
npm run build

# Lint
npx next lint
```

---

## MCP Servers Available

1. **ZeroDB** — Vector database, embeddings, NoSQL tables, events
2. **ZeroMemory** — Semantic memory, context caching, deduplication
3. **GitHub** — GitHub API integration, issues, PRs

See `settings.json` for MCP configuration.

---

## Links

- **Repo**: https://github.com/AINative-Studio/token-ops
- **App**: Deployed on Railway (see `NEXT_PUBLIC_APP_URL` env var)
- **API Health**: `/api/health`
- **Leaderboard**: `/leaderboard`

---

**Last Updated**: 2026-06-17
