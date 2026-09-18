# 🔍 Secopia

**Buscador de contratación pública de Colombia.** Consulta datos reales de SECOP I y II (datos.gov.co) sin registro, sin CAPTCHA, open source.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## ¿Qué es Secopia?

Secopia es una plataforma open source que facilita la consulta de contratos y procesos de contratación pública en Colombia. Los datos provienen directamente de [datos.gov.co](https://www.datos.gov.co) (SECOP I y II).

### Componentes

| Componente | Descripción |
|---|---|
| **Web App** | Búsqueda con filtros avanzados, páginas de detalle, chat con IA |
| **MCP Server** | Model Context Protocol para agentes de IA (Claude, Cursor, etc.) |
| **CLI** | `npx @secopia/mcp` para uso local con Claude Desktop |

## Quick Start

### Web App (desarrollo)

```bash
# Requisitos: Node.js ≥ 22, pnpm ≥ 9
git clone https://github.com/Andrez421/secopia.git
cd secopia
pnpm install

# Configurar variables de entorno
cp apps/web/.env.example apps/web/.env.local
# Editar .env.local (ver sección Variables de Entorno)

# Desarrollo
pnpm dev
```

### MCP con Claude Desktop

```json
{
  "mcpServers": {
    "secopia": {
      "command": "npx",
      "args": ["-y", "@secopia/mcp"]
    }
  }
}
```

## Arquitectura

```
secopia/
├── apps/
│   ├── web/              # Next.js 16 — búsqueda + chat + páginas ISR
│   └── mcp-server/       # HTTP server para MCP remoto
├── packages/
│   ├── types/            # Interfaces TypeScript compartidas
│   ├── socrata-client/   # Cliente Socrata + SoQLBuilder + LRU cache
│   └── mcp/              # MCP server factory + tools + resources
├── scripts/
│   └── sync-typesense.ts # Sincronización Socrata → Typesense
└── docker-compose.yml    # Redis + Typesense para dev/self-hosting
```

### Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS v4, TanStack Query
- **Backend:** Edge Functions (Vercel), Upstash Redis (cache + rate limit)
- **Búsqueda:** Typesense (full-text), Socrata API (filtros avanzados)
- **Chat:** Vercel AI SDK v6 + Google Gemini
- **MCP:** Model Context Protocol SDK con Zod validation
- **Monorepo:** pnpm workspaces + Turborepo
- **Linting:** Biome

## Datasets

| Dataset | ID | Fuente |
|---|---|---|
| SECOP II — Contratos | `jbjy-vk9h` | Contratos registrados en SECOP II |
| SECOP II — Procesos | `p6dx-8zbt` | Procesos de contratación SECOP II |
| SECOP I — Históricos | `f789-7hwg` | Procesos históricos desde 2011 |

## MCP Tools

El servidor MCP expone 8 herramientas para agentes de IA:

| Tool | Descripción |
|---|---|
| `buscar_contratos` | Buscar contratos en SECOP II |
| `buscar_procesos` | Buscar procesos de contratación SECOP II |
| `buscar_secop1` | Buscar procesos históricos SECOP I |
| `buscar_proveedores` | Buscar proveedores por nombre, NIT o departamento |
| `detalle_contrato` | Obtener detalle completo de un contrato |
| `historial_proveedor` | Contratos históricos de un proveedor por NIT |
| `estadisticas_entidad` | Estadísticas de contratación de una entidad |
| `top_proveedores` | Ranking de proveedores por valor adjudicado |

## Variables de Entorno

### `apps/web` (.env.local)

```bash
SOCRATA_APP_TOKEN=            # Token de datos.gov.co (gratis, requerido)
GOOGLE_GENERATIVE_AI_API_KEY= # Clave de Google AI Studio (para el chat)
UPSTASH_REDIS_REST_URL=       # Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN=     # Upstash Redis Token
TYPESENSE_HOST=               # Host de Typesense
TYPESENSE_PORT=               # Puerto de Typesense (8108 local)
TYPESENSE_PROTOCOL=           # http o https
TYPESENSE_API_KEY=            # API key de Typesense (search-only)
TYPESENSE_ADMIN_API_KEY=      # API key admin (solo sync script)
NEXT_PUBLIC_APP_URL=          # URL pública de la app
```

### `apps/mcp-server`

```bash
SOCRATA_APP_TOKEN=            # Token de datos.gov.co
PORT=3002                     # Puerto HTTP
HOST=0.0.0.0                  # Interfaz de red
MCP_API_KEY=                  # Si se define, exige Authorization: Bearer <key>
MCP_ALLOWED_ORIGINS=          # Orígenes CORS separados por coma (clientes browser)
MCP_RATE_LIMIT=60             # Requests por minuto por IP en /mcp
```

## Self-hosting

Para deployar tu propia instancia:

```bash
# Levantar Redis + Typesense
docker compose up -d

# Configurar .env.local para servicios locales
UPSTASH_REDIS_REST_URL=http://localhost:8079
TYPESENSE_HOST=localhost
TYPESENSE_API_KEY=dev-key

# Sincronizar datos de Socrata a Typesense
pnpm tsx scripts/sync-typesense.ts

# Iniciar la app
pnpm build
pnpm start
```

## Seguridad

- **SoQL Injection Prevention:** Todo input pasa por `SoQLBuilder.sanitize()`. Nunca string interpolation.
- **Rate Limiting:** 30 req/10s para búsqueda, 10 req/60s para chat (por IP).
- **API Keys:** Solo en servidor, nunca expuestas al cliente.
- **Sin queries arbitrarias:** La tool `consulta_soql` fue removida por seguridad.

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para guía completa.

```bash
# Verificar antes de hacer PR
pnpm check    # TypeScript
pnpm lint     # Biome
pnpm test     # Tests
```

## Licencia

[MIT](LICENSE)

---

Datos abiertos de [datos.gov.co](https://www.datos.gov.co) · Open Source
