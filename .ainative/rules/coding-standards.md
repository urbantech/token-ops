# Coding Standards — TokenOps

## Language: TypeScript (Strict)

### Style
- **Formatter**: Prettier defaults (2-space indent)
- **Linter**: ESLint via Next.js
- **Type checking**: TypeScript strict mode (`tsconfig.json`)

### Naming Conventions
- `camelCase` for variables, functions, hooks
- `PascalCase` for components, types, interfaces, enums
- `UPPER_SNAKE_CASE` for constants
- Prefix private/internal functions with `_` in services

### React Components
- Functional components only (no class components)
- Use `'use client'` directive for client components
- Server components by default (no directive needed)
- Props interfaces named `{ComponentName}Props`

### API Routes (Next.js App Router)
- Route handlers in `src/app/api/`
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`
- Validate input with Zod schemas from `src/lib/validation.ts`
- Return `{ success: boolean, data?, error?, timestamp }` shape
- Business logic in `src/services/`, never in route handlers

### Service Layer
- All business logic in `src/services/`
- Services are classes with singleton factory functions
- Constructor accepts optional dependency injection for testing
- Example: `class FooService { constructor(client?: ZeroDBClient) {} }`

### Error Handling
- Use structured error responses with `success: false` and `error` message
- Services throw `Error` with descriptive messages
- Route handlers catch and return appropriate HTTP status codes
- Never expose internal stack traces to API consumers

### Testing
- Test files mirror source structure: `src/services/foo.ts` → `src/services/__tests__/foo.test.ts`
- Use `vitest` with `@testing-library/react` for component tests
- Mock ZeroDB client and postgres at the boundary
- Use `vi.mock()` before imports for module mocking

### Data
- Currency as `number` (USD float, not cents)
- Dates as ISO 8601 strings
- Token counts as `number` (integers)
- All API responses include `timestamp` field

---

## Framework: Next.js 14+ App Router

### Project Structure
```
src/
├── app/              — Pages + API routes (App Router)
├── components/
│   ├── ui/           — shadcn/ui primitives
│   ├── layout/       — Sidebar, Header
│   ├── dashboard/    — Cost tracking, charts
│   ├── prompts/      — Prompt analysis
│   ├── memory/       — Memory optimization
│   ├── leaderboard/  — Leaderboard UI
│   └── providers/    — Context providers
├── services/         — Business logic
├── lib/              — Utilities, clients
├── types/            — TypeScript types
└── hooks/            — React hooks
```

### UI
- shadcn/ui component library (`src/components/ui/`)
- Tailwind CSS with dark theme (zinc palette)
- Violet accents for interactive elements
- Recharts for data visualization
