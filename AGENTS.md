# Secopia — Agent Instructions

> Compact guide for OpenCode sessions. Every line answers: "Would an agent likely miss this without help?"

## Repo Overview

Monorepo: Colombian public procurement search (SECOP I & II). pnpm workspaces + Turborepo.

```
apps/
  web/           # Next.js 15 (App Router, Edge runtime, Vercel)
  mcp-server/    # Remote MCP server (node:http, Fly.io)
packages/
  types/         # Shared TS interfaces
  socrata-client/# Socrata API client + SoQLBuilder + LRU cache
  mcp/           # MCP server factory + tools (published to npm as @secopia/mcp)
```

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install deps (pnpm 10.11.0 required) |
| `pnpm dev` | Start all dev servers (web uses Turbopack) |
| `pnpm build` | Turbo build all packages and apps |
| `pnpm check` | TypeScript type check across monorepo |
| `pnpm lint` | Biome lint across monorepo |
| `pnpm format` | Biome format --write . (root only) |
| `pnpm test` | Turbo test (currently only `packages/socrata-client` has tests) |
| `pnpm clean` | Remove build artifacts |
| `pnpm sync:typesense` | Index Socrata data into Typesense (`tsx scripts/sync-typesense.ts`) |

### Running a single package

```bash
# Web app only
pnpm --filter @secopia/web dev

# MCP server only
pnpm --filter @secopia/mcp-server dev

# Type check single package
pnpm --filter @secopia/socrata-client check
```

### Testing

Only `packages/socrata-client` has tests. Uses Node built-in test runner + tsx:

```bash
cd packages/socrata-client
node --test --import tsx src/**/*.test.ts
```

No test runner in other packages yet.

## Toolchain

- **Package manager:** pnpm 10.11.0 (set in `packageManager` field)
- **Node:** >=22
- **Lint/Format:** Biome ONLY. No ESLint, no Prettier.
- **Build:** Turborepo with local cache
- **Test:** Node built-in `node:test` + tsx

## Biome Config (Critical)

Configured in `biome.json`. Key rules agents get wrong:
- **Indent:** spaces (2), line width 100
- **Quotes:** double, semicolons: always, trailing commas: all
- **Errors:** `noUnusedImports`, `noUnusedVariables`, `useConst`, `useImportType`
- **Warn:** `noExplicitAny`, `noNonNullAssertion`

Run `pnpm format` before committing. The CI enforces this.

## Security — SoQL Injection Prevention

**NEVER** use string interpolation to build SoQL queries. **ALWAYS** use `SoQLBuilder`:

```ts
import { SoQLBuilder } from "@secopia/socrata-client";

// CORRECT
const q = new SoQLBuilder().like("nombre_entidad", userInput).build();

// WRONG — NEVER DO THIS
const q = `SELECT * WHERE nombre_entidad = '${userInput}'`;
```

`SoQLBuilder.sanitize()` strips everything except alphanumeric, accented chars, spaces, hyphens, and dots. Field names are validated against `^[a-z_][a-z0-9_]*$`. Limits are clamped to max 200.

## Environment Setup

```bash
# 1. Copy env template
cp apps/web/.env.example apps/web/.env.local

# 2. (Optional) Start local services — Redis + Typesense + HTTP proxy
docker compose up -d
# Sets up serverless-redis-http on :8079 (Upstash-compatible REST proxy)
# NOT just Redis — the Upstash SDK requires HTTP REST API
```

Key env vars (see `.env.example` for full list):
- `SOCRATA_APP_TOKEN` — free from datos.gov.co, required for production
- `GOOGLE_GENERATIVE_AI_API_KEY` — for chat (not Anthropic; Gemini via `@ai-sdk/google`)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — cache + rate limiting
- `TYPESENSE_HOST` / `TYPESENSE_API_KEY` — full-text search

## Architecture Notes

### Web App (`apps/web`)
- **Framework:** Next.js 15, App Router, React 19, Tailwind CSS v4
- **Dev server:** `next dev --turbopack` (Turbopack, not webpack)
- **API routes:** Edge runtime (`export const runtime = "edge"`)
- **Rate limits:** 30 req/10s (search), 10 req/60s (chat) — per IP via Upstash Redis
- **Caching:** Redis TTL 10min for Socrata queries; ISR 1h for detail pages
- **Search dual path:** Typesense for full-text (`q=...`), Socrata for advanced filters (departamento, valor, fecha, modalidad)
- **Chat:** Calls Socrata **directly** via `SocrataClient` — NOT via the MCP HTTP server

### MCP (`packages/mcp` + `apps/mcp-server`)
- `@secopia/mcp` is published to npm. Entry: `npx @secopia/mcp` (stdio transport)
- `apps/mcp-server` is the **remote** HTTP server (node:http + MCP SDK transport). The web app does NOT use it.
- No Changesets — publish manually with `npm version` + `npm publish` in CI.

### Socrata Client (`packages/socrata-client`)
- Shared core: `SocrataClient`, `SoQLBuilder`, `DATASETS` catalog
- LRU in-memory cache (default TTL 5min, max 200 entries)
- Socrata hard limit: 200 rows per request

## TypeScript

Base config: `tsconfig.base.json`. Key flags:
- `strict: true`, `noUncheckedIndexedAccess: true`
- `isolatedModules: true`, `moduleResolution: bundler`
- `noUnusedLocals: true`, `noUnusedParameters: true`

Packages have their own `tsconfig.build.json` for emitting.

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)
- **Branches:** `feat/name`, `fix/name`, `docs/name`
- **Components:** PascalCase (`SearchBar.tsx`)
- **Utilities:** camelCase (`formatCOP.ts`)
- **Types:** PascalCase + descriptive suffix (`ContratoSECOP2`)

## CI Pipeline

Runs on push/PR to `main`:
1. `pnpm install --frozen-lockfile`
2. `pnpm turbo check` (TypeScript)
3. `pnpm turbo lint` (Biome)
4. `pnpm turbo test`

## Common Gotchas

- **pnpm only.** `packageManager` field enforces pnpm 10.11.0.
- **Docker compose includes `serverless-redis-http`.** The Upstash Redis SDK talks HTTP REST, not Redis protocol directly. The proxy bridges them.
- **No pre-commit hooks.** Just CI. Run `pnpm check && pnpm lint` before PR.
- **`packages/mcp` build uses tsup + tsc.** Other packages use tsc only.
- **Web uses Google Gemini (`@ai-sdk/google`), not Anthropic.** The `.env.example` and `apps/web` use `GOOGLE_GENERATIVE_AI_API_KEY`.
- **Tailwind v4.** No `tailwind.config.js` in traditional sense; uses CSS-based config.

## References

- `README.md` — user-facing docs, datasets, MCP tools reference
- `ARCHITECTURE.md` — full architecture guide (1300+ lines, very detailed)
- `CONTRIBUTING.md` — contribution guidelines
- `biome.json` — lint/format rules (source of truth)
