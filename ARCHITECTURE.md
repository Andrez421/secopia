---

# Secopia — Guía de Arquitectura

> Buscador de contratación pública de Colombia (SECOP I y II), open source, sin registro, sin CAPTCHA.  
> Versión del documento: 3.0 | Stack: Next.js 15 + TypeScript + MCP + Edge Cache + Typesense

---

## Tabla de contenido

1. [Visión general](#1-visión-general)
2. [Principios de diseño](#2-principios-de-diseño)
3. [Estructura del monorepo](#3-estructura-del-monorepo)
4. [Stack tecnológico](#4-stack-tecnológico)
5. [Packages compartidos](#5-packages-compartidos)
   - 5.1 [@secopia/types](#51-secopiatypes)
   - 5.2 [@secopia/socrata-client](#52-secopiasocrata-client)
   - 5.3 [@secopia/mcp](#53-secopiamcp)
6. [Apps](#6-apps)
   - 6.1 [apps/web — Next.js](#61-appsweb--nextjs)
   - 6.2 [apps/mcp-server — Servidor MCP Remoto](#62-appsmcp-server--servidor-mcp-remoto)
7. [Datasets y fuentes de datos](#7-datasets-y-fuentes-de-datos)
8. [Flujos de datos](#8-flujos-de-datos)
9. [Diseño de la UI / UX](#9-diseño-de-la-ui--ux)
10. [Seguridad](#10-seguridad)
11. [Convenciones de código](#10-convenciones-de-código)
12. [Variables de entorno](#11-variables-de-entorno)
13. [Deploy y CI/CD](#12-deploy-y-cicd)
14. [Self-hosting](#13-self-hosting)
15. [Roadmap por fases](#14-roadmap-por-fases)

---

## 1. Visión general

Secopia es una plataforma open source de consulta de contratación pública colombiana. Expone los datos de SECOP I y SECOP II (vía API SODA de datos.gov.co) de dos formas:

- **Web app** (`secopia.co`): búsqueda ultrarrápida con filtros avanzados, búsqueda full-text con Typesense, páginas de detalle, y un chat con IA integrado que consulta datos en tiempo real.
- **MCP server** (`@secopia/mcp`): paquete npm que permite a herramientas de IA como Claude Desktop o Cursor consultar SECOP directamente mediante herramientas (tools) definidas bajo el Model Context Protocol de Anthropic.

### ¿Por qué monorepo?

El `@secopia/socrata-client` es el corazón compartido entre web y MCP. Separar en repos independientes obligaría a publicar el client en npm, coordinar versiones entre repos, y arriesgar desalineación de tipos. En un monorepo, un cambio en el client se valida instantáneamente contra ambos consumidores con `turbo check`.

```
secopia/
 ├── apps/
 │   ├── web/            → Next.js 15, Vercel Edge + Caché Redis
 │   └── mcp-server/     → Node.js HTTP nativo + MCP SDK Streamable HTTP
 └── packages/
     ├── types/          → @secopia/types
     ├── socrata-client/ → @secopia/socrata-client (compartido entre Web y MCP)
     └── mcp/            → @secopia/mcp (publicado en npm)
```

---

## 2. Principios de diseño

| Principio | Descripción |
|---|---|
| **Velocidad ante todo** | La búsqueda debe devolver resultados visibles en < 200ms (Typesense) o < 500ms (Socrata con caché). Streaming, skeleton loading, y edge cache. |
| **Sin fricción** | Sin registro, sin login, sin CAPTCHA. El usuario entra y busca. |
| **Caché inteligente** | Queries cacheadas en Redis (TTL 10min) en el Edge. Páginas de detalle con ISR (1h). El MCP standalone usa caché LRU in-memory. |
| **Seguridad por defecto** | Sanitización estricta en SoQLBuilder (NUNCA string interpolation manual). Rate limiting por IP. API keys solo en servidor. |
| **Open source friendly** | Código claro, convenciones estándar, documentación en español, alternativas self-hosting documentadas. |
| **Un solo lenguaje** | TypeScript en toda la cadena: web, MCP, cliente Socrata, tipos. |
| **Despliegue independiente** | El MCP es instalable con `npx`. La web no depende del servidor MCP remoto. Cada app tiene su propio deploy. |

---

## 3. Estructura del monorepo

```
secopia/
├── apps/
│   ├── web/
│   │   ├── app/                    # Next.js App Router
│   │   │   ├── (home)/
│   │   │   │   └── page.tsx        # Página principal con buscador
│   │   │   ├── buscar/
│   │   │   │   └── page.tsx        # Resultados de búsqueda (Híbrido RSC + Client)
│   │   │   ├── contrato/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Detalle de contrato (ISR)
│   │   │   ├── proveedor/
│   │   │   │   └── [nit]/
│   │   │   │       └── page.tsx    # Perfil de proveedor
│   │   │   ├── entidad/
│   │   │   │   └── [nombre]/
│   │   │   │       └── page.tsx    # Perfil de entidad
│   │   │   ├── api/
│   │   │   │   ├── buscar/
│   │   │   │   │   └── route.ts    # Proxy a Socrata/Typesense + Caché Redis
│   │   │   │   └── chat/
│   │   │   │       └── route.ts    # Streaming chat + Llamadas directas a Socrata
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── search/
│   │   │   │   ├── SearchBar.tsx
│   │   │   │   ├── SearchFilters.tsx
│   │   │   │   └── SearchResults.tsx  (TanStack Query Infinite Scroll)
│   │   │   ├── contract/
│   │   │   │   ├── ContractCard.tsx
│   │   │   │   └── ContractDetail.tsx
│   │   │   ├── chat/
│   │   │   │   └── ChatPanel.tsx
│   │   │   └── ui/                 # Componentes base (Tailwind puro + Radix solo para complejos)
│   │   ├── lib/
│   │   │   ├── socrata.ts          # Wrapper del cliente Socrata para web
│   │   │   ├── typesense.ts        # Cliente Typesense para búsqueda full-text
│   │   │   ├── cache.ts            # Lógica de caché con Upstash Redis
│   │   │   ├── rate-limit.ts       # Rate limiter por IP con Redis
│   │   │   └── utils.ts
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── mcp-server/
│       ├── src/
│       │   └── index.ts            # Entry point: node:http + MCP SDK transport
│       └── package.json
│
├── packages/
│   ├── types/
│   │   ├── src/
│   │   │   ├── secop.ts            # Interfaces de contratos y procesos
│   │   │   ├── socrata.ts          # Tipos de respuesta SODA
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── socrata-client/
│   │   ├── src/
│   │   │   ├── client.ts           # Cliente HTTP async + Caché LRU in-memory
│   │   │   ├── soql.ts             # Builder de queries SoQL (SANITIZADO, con orLike)
│   │   │   ├── datasets.ts         # Catálogo de datasets y sus campos
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── mcp/
│       ├── src/
│       │   ├── server.ts           # Definición del MCP Server con registerTool + Zod
│       │   ├── resources.ts        # MCP Resources: datasets disponibles
│       │   └── index.ts
│       ├── bin/
│       │   └── mcp.ts              # Entry point para npx (stdio transport)
│       └── package.json
│
├── scripts/
│   └── sync-typesense.ts           # Script para indexar datos de Socrata en Typesense
│
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── biome.json                      # Reemplaza ESLint + Prettier (más rápido, un solo tool)
└── package.json
```

---

## 4. Stack tecnológico

### Web app (`apps/web`)

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| Framework | Next.js | 15 (App Router) | SSR/ISR, RSC, streaming, Edge first-class |
| Lenguaje | TypeScript | 5.x | Tipos compartidos con MCP y cliente Socrata |
| Estilos | Tailwind CSS | 4.x | Utilidades, sin CSS custom, consistente |
| Componentes | Tailwind puro + Radix UI | — | Tailwind puro para simples (Button, Card, Input). Radix solo para complejos (Dialog, Combobox, Dropdown). Sin wrapper de shadcn/ui para reducir bundle |
| Fetching UI | TanStack Query | 5.x | Infinite scroll fluido, manejo de caché en cliente, hidratación con RSC |
| Búsqueda full-text | Typesense Cloud | — | Búsqueda instantánea (< 50ms), typo-tolerance, ranking por relevancia. Reemplaza `LIKE '%text%'` para la búsqueda principal |
| Caché Edge | Upstash Redis | — | Compatible con Edge Runtime (HTTP-based), sin Vercel vendor lock-in. Caché de queries Socrata, rate limiting |
| AI / Chat | Vercel AI SDK | 4.x | Streaming first-class, tool calls con Zod, ejecución directa de tools |
| Rate Limiting | @upstash/ratelimit | — | Rate limiting por IP usando sliding window en Redis |
| Deploy | Vercel | — | CI/CD automático, Edge Functions, CDN global. Funciona en plan gratuito |

### MCP server HTTP (`apps/mcp-server`)

| Capa | Tecnología | Justificación |
|---|---|---|
| Runtime | Node.js 22 LTS | Compatibilidad total con SDK MCP |
| HTTP server | `node:http` (built-in) | Cero dependencias extra. El SDK MCP maneja todo el protocolo |
| Transport | `NodeStreamableHTTPServerTransport` | Clase del SDK oficial. Maneja Streamable HTTP, sesiones, cleanup automático |
| Deploy | Fly.io | Soporta procesos long-lived, streaming sin timeouts estrictos, pricing por uso |

### MCP package (`packages/mcp`)

| Capa | Tecnología | Justificación |
|---|---|---|
| SDK | `@modelcontextprotocol/server` | SDK oficial de Anthropic para TS (nueva estructura modular) |
| Validación | `zod/v4` | Validación de inputs en cada tool via `registerTool` |
| Transporte local | stdio | Para Claude Desktop, Cursor, Claude Code |
| Build | tsup | Bundle rápido, genera CJS + ESM |
| Publicación | npm (`@secopia/mcp`) | `npx @secopia/mcp` para cualquier usuario |

### Monorepo tooling

| Herramienta | Rol |
|---|---|
| pnpm workspaces | Gestión de dependencias entre packages |
| Turborepo | Builds y tasks paralelas con caché local |
| TypeScript project references | Type checking incremental entre packages |
| Biome | Linting + formato en uno solo (reemplaza ESLint + Prettier, 10-100x más rápido) |

> **Nota:** Se removió Changesets del tooling. Solo se publica `@secopia/mcp` a npm, para lo cual basta con `npm version` + `npm publish` en CI. Changesets agrega complejidad innecesaria para un solo paquete público.

---

## 5. Packages compartidos

### 5.1 `@secopia/types`

Fuente única de verdad para todas las interfaces TypeScript del proyecto. Puro TypeScript compilado a declaraciones de tipo.

```typescript
// packages/types/src/secop.ts

export interface ContratoSECOP2 {
  nombre_entidad: string;
  nit_entidad: string;
  departamento: string;
  ciudad: string;
  nombre_del_proveedor: string;
  nit_del_proveedor: string;
  objeto_del_contrato: string;
  tipo_de_contrato: string;
  modalidad_de_contratacion: string;
  valor_del_contrato: string;
  valor_de_pago_al_contratista: string;
  fecha_de_firma: string;
  fecha_de_inicio_del_contrato: string;
  fecha_de_fin_del_contrato: string;
  id_contrato: string;
  urlproceso: string;
}

export interface FiltrosBusqueda {
  q?: string;
  entidad?: string;
  proveedor?: string;
  departamento?: string;
  modalidad?: string;
  valor_min?: number;
  valor_max?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  tipo?: "contratos" | "procesos" | "secop1";
  limite?: number;
  offset?: number;
}
```

### 5.2 `@secopia/socrata-client`

Cliente HTTP async para la API SODA con **sanitización anti-inyección SoQL** y **caché LRU in-memory**.

#### SoQLBuilder — Con sanitización estricta y `orLike()`

```typescript
// packages/socrata-client/src/soql.ts

export class SoQLBuilder {
  private conditions: string[] = [];
  private selectFields: string[] = ["*"];
  private orderByField?: string;
  private limitVal = 50;
  private offsetVal = 0;

  /**
   * SANITIZACIÓN: Previene SoQL Injection.
   * Solo permite letras (con acentos), números, espacios, guiones y puntos.
   * TODA entrada del usuario DEBE pasar por aquí.
   */
  private sanitize(value: string): string {
    return value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\-\.]/g, "").trim();
  }

  /**
   * Valida que un nombre de campo solo contenga caracteres válidos para SoQL.
   * Previene inyección a través de nombres de campo dinámicos.
   */
  private sanitizeField(field: string): string {
    if (!/^[a-z_][a-z0-9_]*$/i.test(field)) {
      throw new Error(`Invalid SoQL field name: ${field}`);
    }
    return field;
  }

  select(fields: string[]): this {
    this.selectFields = fields.map((f) => this.sanitizeField(f));
    return this;
  }

  where(condition: string): this {
    if (condition) this.conditions.push(condition);
    return this;
  }

  /**
   * Búsqueda LIKE en un solo campo. Sanitiza el valor automáticamente.
   */
  like(field: string, value: string): this {
    const sanitized = this.sanitize(value).replace(/'/g, "''").toUpperCase();
    if (!sanitized) return this;
    const safeField = this.sanitizeField(field);
    return this.where(`upper(${safeField}) like '%${sanitized}%'`);
  }

  /**
   * Búsqueda LIKE en MÚLTIPLES campos con OR.
   * Resuelve la necesidad de buscar texto libre en entidad, proveedor, descripción, etc.
   * Sanitiza el valor una sola vez y aplica a todos los campos.
   */
  orLike(fields: string[], value: string): this {
    const sanitized = this.sanitize(value).replace(/'/g, "''").toUpperCase();
    if (!sanitized) return this;
    const clauses = fields.map((f) => {
      const safeField = this.sanitizeField(f);
      return `upper(${safeField}) like '%${sanitized}%'`;
    });
    return this.where(`(${clauses.join(" OR ")})`);
  }

  equals(field: string, value: string | number): this {
    const safeField = this.sanitizeField(field);
    if (typeof value === "string") {
      const sanitized = this.sanitize(value).replace(/'/g, "''");
      return this.where(`${safeField} = '${sanitized}'`);
    }
    return this.where(`${safeField} = ${value}`);
  }

  gte(field: string, value: string | number): this {
    const safeField = this.sanitizeField(field);
    if (typeof value === "string") {
      const sanitized = this.sanitize(value);
      return this.where(`${safeField} >= '${sanitized}'`);
    }
    return this.where(`${safeField} >= ${value}`);
  }

  lte(field: string, value: string | number): this {
    const safeField = this.sanitizeField(field);
    if (typeof value === "string") {
      const sanitized = this.sanitize(value);
      return this.where(`${safeField} <= '${sanitized}'`);
    }
    return this.where(`${safeField} <= ${value}`);
  }

  orderBy(field: string, dir: "ASC" | "DESC" = "DESC"): this {
    const safeField = this.sanitizeField(field);
    this.orderByField = `${safeField} ${dir}`;
    return this;
  }

  limit(n: number): this {
    this.limitVal = Math.min(Math.max(1, n), 200);
    return this;
  }

  offset(n: number): this {
    this.offsetVal = Math.max(0, n);
    return this;
  }

  build(): string {
    const parts: string[] = [`SELECT ${this.selectFields.join(", ")}`];
    if (this.conditions.length > 0)
      parts.push(`WHERE ${this.conditions.join(" AND ")}`);
    if (this.orderByField) parts.push(`ORDER BY ${this.orderByField}`);
    parts.push(`LIMIT ${this.limitVal}`);
    parts.push(`OFFSET ${this.offsetVal}`);
    return parts.join(" ");
  }
}
```

#### SocrataClient — Con caché LRU in-memory

```typescript
// packages/socrata-client/src/client.ts

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface SocrataClientOptions {
  appToken?: string;
  /** TTL del caché LRU in-memory en ms. Default: 5 min. 0 = desactivado. */
  cacheTtlMs?: number;
  /** Máximo de entradas en el caché LRU. Default: 200 */
  cacheMaxEntries?: number;
}

export class SocrataClient {
  private readonly baseUrl = "https://www.datos.gov.co/resource";
  private readonly appToken?: string;
  private readonly cacheTtlMs: number;
  private readonly cacheMaxEntries: number;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(options: SocrataClientOptions = {}) {
    this.appToken = options.appToken;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000; // 5 min default
    this.cacheMaxEntries = options.cacheMaxEntries ?? 200;
  }

  async query<T = Record<string, unknown>>(
    datasetId: string,
    soql: string,
  ): Promise<T[]> {
    const cacheKey = `${datasetId}:${soql}`;

    // 1. Check in-memory cache
    if (this.cacheTtlMs > 0) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data as T[];
      }
      // Expired entry: delete
      if (cached) this.cache.delete(cacheKey);
    }

    // 2. Fetch from Socrata
    const url = new URL(`${this.baseUrl}/${datasetId}.json`);
    url.searchParams.set("$query", soql);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (this.appToken) {
      headers["X-App-Token"] = this.appToken;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new SocrataError(
        `Socrata API error: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    const data = (await response.json()) as T[];

    // 3. Store in LRU cache
    if (this.cacheTtlMs > 0) {
      // Evict oldest entry if at capacity
      if (this.cache.size >= this.cacheMaxEntries) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) this.cache.delete(oldestKey);
      }
      this.cache.set(cacheKey, {
        data,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }

    return data;
  }

  /** Limpia todo el caché in-memory */
  clearCache(): void {
    this.cache.clear();
  }
}

export class SocrataError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = "SocrataError";
  }
}
```

### 5.3 `@secopia/mcp`

Paquete publicado en npm. Usa `McpServer.registerTool()` con **validación Zod** en cada tool. Devuelve **JSON estructurado** para que los LLMs puedan razonar con los datos. Expone **Resources** para descubrimiento de datasets.

#### Tools definidas

| Tool | Descripción | Parámetros clave |
|---|---|---|
| `buscar_contratos` | Busca en SECOP II Contratos con filtros | `entidad`, `proveedor`, `valor_min`, `valor_max`, `fecha_inicio`, `fecha_fin`, `departamento`, `modalidad`, `limite` |
| `buscar_procesos` | Busca procesos de contratación SECOP II | `entidad`, `descripcion`, `fecha_inicio`, `departamento` |
| `buscar_secop1` | Consulta procesos históricos SECOP I | `entidad`, `objeto`, `departamento`, `fecha` |
| `buscar_proveedores` | Busca proveedores registrados | `nombre`, `nit`, `departamento` |
| `detalle_contrato` | Devuelve todos los campos de un contrato | `numero_contrato` o `id_portafolio` |
| `historial_proveedor` | Contratos históricos de un proveedor por NIT | `nit`, `fecha_inicio`, `limite` |
| `estadisticas_entidad` | Totales y distribución de contratos por entidad | `nombre_entidad`, `anio` |
| `top_proveedores` | Ranking de proveedores por valor total | `entidad?`, `departamento?`, `anio?` |

> **Nota:** Se removió `consulta_soql` (query SoQL libre). Un LLM podría generar queries arbitrariamente pesadas que saturen la cuota de Socrata. Las tools específicas cubren todos los casos de uso con queries controladas y optimizadas.

#### Resources definidos (MCP Resources)

| Resource | URI | Descripción |
|---|---|---|
| `datasets-disponibles` | `secopia://datasets` | Lista todos los datasets disponibles, sus IDs, campos, y descripciones |
| `campos-dataset` | `secopia://datasets/{id}/campos` | Detalle de campos de un dataset específico |

Los Resources permiten al LLM descubrir datos disponibles sin ejecutar queries. Es un concepto first-class del protocolo MCP y más eficiente que una tool `listar_datasets`.

#### Implementación del servidor MCP

```typescript
// packages/mcp/src/server.ts

import { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { SocrataClient, SoQLBuilder, DATASETS } from "@secopia/socrata-client";

export function createSecopiaServer(appToken?: string): McpServer {
  const client = new SocrataClient({ appToken });

  const server = new McpServer({
    name: "secopia",
    version: "1.0.0",
  });

  // ── Resources ─────────────────────────────────────────────

  server.resource("datasets-disponibles", "secopia://datasets", async () => ({
    contents: [
      {
        uri: "secopia://datasets",
        mimeType: "application/json",
        text: JSON.stringify(
          Object.entries(DATASETS).map(([key, ds]) => ({
            key,
            id: ds.id,
            nombre: ds.nombre,
            campos: Object.keys(ds.campos),
          })),
        ),
      },
    ],
  }));

  // ── Tools ─────────────────────────────────────────────────

  server.registerTool("buscar_contratos", {
    title: "Buscar Contratos SECOP II",
    description:
      "Busca contratos en SECOP II con filtros por entidad, proveedor, valor, fecha, departamento y modalidad.",
    inputSchema: z.object({
      entidad: z
        .string()
        .optional()
        .describe("Nombre parcial o completo de la entidad contratante"),
      proveedor: z
        .string()
        .optional()
        .describe("Nombre parcial o completo del proveedor/contratista"),
      departamento: z
        .string()
        .optional()
        .describe("Departamento (BOGOTA, ANTIOQUIA, etc.)"),
      modalidad: z
        .string()
        .optional()
        .describe("Modalidad de contratación"),
      valor_min: z
        .number()
        .optional()
        .describe("Valor mínimo del contrato en COP"),
      valor_max: z
        .number()
        .optional()
        .describe("Valor máximo del contrato en COP"),
      fecha_inicio: z
        .string()
        .optional()
        .describe("Fecha mínima de firma (YYYY-MM-DD)"),
      fecha_fin: z
        .string()
        .optional()
        .describe("Fecha máxima de firma (YYYY-MM-DD)"),
      limite: z
        .number()
        .min(1)
        .max(100)
        .default(20)
        .describe("Cantidad máxima de resultados (1-100)"),
    }),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  }, async (args): Promise<CallToolResult> => {
    try {
      const ds = DATASETS.contratos;
      const q = new SoQLBuilder();

      if (args.entidad) q.like(ds.campos.entidad, args.entidad);
      if (args.proveedor) q.like(ds.campos.proveedor, args.proveedor);
      if (args.departamento) q.equals(ds.campos.departamento, args.departamento);
      if (args.modalidad) q.like(ds.campos.modalidad, args.modalidad);
      if (args.valor_min) q.gte(ds.campos.valor, args.valor_min);
      if (args.valor_max) q.lte(ds.campos.valor, args.valor_max);
      if (args.fecha_inicio) q.gte(ds.campos.fecha_firma, args.fecha_inicio);
      if (args.fecha_fin) q.lte(ds.campos.fecha_firma, args.fecha_fin);

      q.orderBy(ds.campos.fecha_firma).limit(args.limite);

      const results = await client.query(ds.id, q.build());

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ contratos: results, total: results.length }),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error consultando SECOP: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  });

  // ... (demás tools siguen el mismo patrón: Zod schema + try/catch + JSON response)

  return server;
}
```

#### Entry point para npx (stdio)

```typescript
// packages/mcp/bin/mcp.ts
#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/server";
import { createSecopiaServer } from "../src/server.js";

const server = createSecopiaServer(process.env.SOCRATA_APP_TOKEN);
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 6. Apps

### 6.1 `apps/web` — Next.js

#### Estrategia de rendering

```
/                    → Static (generada en build)
/buscar?q=...        → Dynamic (Edge + Typesense para texto libre, Socrata para filtros avanzados)
/contrato/[id]       → ISR (revalidate: 3600) + Caché Redis
/proveedor/[nit]     → ISR (revalidate: 3600)
/entidad/[nombre]    → ISR (revalidate: 3600)
```

#### Rate Limiting

```typescript
// apps/web/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

/**
 * Rate limiter para API routes públicas.
 * Sliding window: 30 requests por 10 segundos por IP.
 * Previene abuso sin afectar uso normal.
 */
export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "10 s"),
  prefix: "secopia:rl",
  analytics: true,
});

/**
 * Rate limiter más estricto para el chat con IA (más costoso).
 * 10 mensajes por minuto por IP.
 */
export const chatRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "secopia:rl:chat",
});

/**
 * Extrae la IP del request. Funciona en Vercel Edge.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
```

#### API Routes

**`/api/buscar` — Proxy seguro con caché y rate limiting**

```typescript
// apps/web/app/api/buscar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { SocrataClient, SoQLBuilder, DATASETS } from "@secopia/socrata-client";
import { Redis } from "@upstash/redis";
import { rateLimiter, getClientIp } from "@/lib/rate-limit";

export const runtime = "edge";

const redis = Redis.fromEnv();
const client = new SocrataClient({
  appToken: process.env.SOCRATA_APP_TOKEN,
  cacheTtlMs: 0, // Desactivar caché in-memory en Edge (usamos Redis)
});

export async function GET(req: NextRequest) {
  // 1. Rate limiting
  const ip = getClientIp(req);
  const { success, remaining } = await rateLimiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta en unos segundos." },
      {
        status: 429,
        headers: { "Retry-After": "10", "X-RateLimit-Remaining": "0" },
      },
    );
  }

  // 2. Validar y parsear parámetros
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const {
    tipo = "contratos",
    q,
    entidad,
    proveedor,
    departamento,
    modalidad,
    valor_min,
    valor_max,
    limite = "50",
    offset = "0",
  } = params;

  const ds = DATASETS[tipo as keyof typeof DATASETS];
  if (!ds) {
    return NextResponse.json(
      { error: `Tipo de dataset inválido: ${tipo}` },
      { status: 400 },
    );
  }

  // 3. Construir query USANDO SIEMPRE el builder (nunca string interpolation)
  const builder = new SoQLBuilder()
    .limit(Number(limite))
    .offset(Number(offset));

  // Búsqueda de texto libre: usa orLike() para buscar en múltiples campos
  if (q) {
    builder.orLike(
      [ds.campos.entidad, ds.campos.proveedor, ds.campos.descripcion],
      q,
    );
  }

  // Filtros específicos: cada uno pasa por el sanitizador del builder
  if (entidad) builder.like(ds.campos.entidad, entidad);
  if (proveedor) builder.like(ds.campos.proveedor, proveedor);
  if (departamento) builder.equals(ds.campos.departamento, departamento);
  if (modalidad) builder.like(ds.campos.modalidad, modalidad);
  if (valor_min) builder.gte(ds.campos.valor, Number(valor_min));
  if (valor_max) builder.lte(ds.campos.valor, Number(valor_max));

  builder.orderBy(ds.campos.fecha_firma);

  const soqlQuery = builder.build();

  try {
    // 4. Verificar caché en Redis
    const cacheKey = `secopia:q:${ds.id}:${soqlQuery}`;
    const cached = await redis.get<string>(cacheKey);

    if (cached) {
      return NextResponse.json(
        { ...JSON.parse(cached), fromCache: true },
        { headers: { "X-RateLimit-Remaining": String(remaining) } },
      );
    }

    // 5. Cache Miss: consultar Socrata
    const results = await client.query(ds.id, soqlQuery);
    const response = { items: results, total: results.length, query_soql: soqlQuery };

    // 6. Guardar en caché (TTL 10 minutos)
    await redis.set(cacheKey, JSON.stringify(response), { ex: 600 });

    return NextResponse.json(response, {
      headers: { "X-RateLimit-Remaining": String(remaining) },
    });
  } catch (error) {
    // 7. Error handling diferenciado
    if (error instanceof Error && error.name === "SocrataError") {
      console.error(`[Socrata Error] ${error.message}`);
      return NextResponse.json(
        { error: "Error consultando datos de SECOP. Intenta de nuevo." },
        { status: 502 },
      );
    }

    console.error(`[Internal Error] ${String(error)}`);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
```

**`/api/chat` — Chat con IA + Ejecución Directa (Sin MCP HTTP)**

```typescript
// apps/web/app/api/chat/route.ts
import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool, convertToModelMessages, UIMessage } from "ai";
import { z } from "zod";
import { SocrataClient, SoQLBuilder, DATASETS } from "@secopia/socrata-client";
import { chatRateLimiter, getClientIp } from "@/lib/rate-limit";

export const runtime = "edge";
export const maxDuration = 60;

const client = new SocrataClient({
  appToken: process.env.SOCRATA_APP_TOKEN,
  cacheTtlMs: 0,
});

export async function POST(req: Request) {
  // 1. Rate limiting (más estricto para chat)
  const ip = getClientIp(req);
  const { success } = await chatRateLimiter.limit(ip);

  if (!success) {
    return Response.json(
      { error: "Has alcanzado el límite de mensajes. Espera un momento." },
      { status: 429 },
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `Eres Secopia, un asistente experto en contratación pública de Colombia.
Consultas datos reales de SECOP I y II. Responde en español.
Cuando el usuario pregunte sobre contratos, usa las herramientas disponibles para consultar datos reales.
Siempre cita los datos exactos (valores, fechas, entidades) y menciona que provienen de SECOP.
Si no encuentras resultados, sugiere reformular la búsqueda con otros términos.`,
    messages: await convertToModelMessages(messages),
    tools: {
      buscar_contratos: tool({
        description:
          "Busca contratos en SECOP II por entidad, proveedor, departamento, valor o fecha",
        inputSchema: z.object({
          entidad: z.string().optional().describe("Nombre de la entidad contratante"),
          proveedor: z.string().optional().describe("Nombre del proveedor"),
          departamento: z.string().optional().describe("Departamento"),
          valor_min: z.number().optional().describe("Valor mínimo en COP"),
          valor_max: z.number().optional().describe("Valor máximo en COP"),
          limite: z.number().min(1).max(50).default(10).describe("Máximo resultados"),
        }),
        execute: async (args) => {
          // LLAMADA DIRECTA A SOCRATA — sin pasar por MCP-HTTP
          const ds = DATASETS.contratos;
          const q = new SoQLBuilder();
          if (args.entidad) q.like(ds.campos.entidad, args.entidad);
          if (args.proveedor) q.like(ds.campos.proveedor, args.proveedor);
          if (args.departamento)
            q.equals(ds.campos.departamento, args.departamento);
          if (args.valor_min) q.gte(ds.campos.valor, args.valor_min);
          if (args.valor_max) q.lte(ds.campos.valor, args.valor_max);
          q.orderBy(ds.campos.fecha_firma).limit(args.limite);
          return await client.query(ds.id, q.build());
        },
      }),

      buscar_procesos: tool({
        description: "Busca procesos de contratación en SECOP II",
        inputSchema: z.object({
          entidad: z.string().optional().describe("Nombre de la entidad"),
          descripcion: z.string().optional().describe("Texto en la descripción del proceso"),
          departamento: z.string().optional().describe("Departamento"),
          limite: z.number().min(1).max(50).default(10),
        }),
        execute: async (args) => {
          const ds = DATASETS.procesos;
          const q = new SoQLBuilder();
          if (args.entidad) q.like(ds.campos.entidad, args.entidad);
          if (args.descripcion) q.like(ds.campos.descripcion, args.descripcion);
          if (args.departamento)
            q.equals(ds.campos.departamento, args.departamento);
          q.limit(args.limite);
          return await client.query(ds.id, q.build());
        },
      }),
    },
    maxSteps: 5,
  });

  return result.toUIMessageStreamResponse();
}
```

### 6.2 `apps/mcp-server` — Servidor MCP Remoto

Servidor MCP remoto con `node:http` nativo + SDK transport. **Sin Fastify, sin Express, sin dependencias extra.** El SDK de MCP maneja todo el protocolo.

Solo debe ser utilizado por clientes MCP externos (Claude Desktop remoto, IDEs, otras apps). La web app NO lo usa.

```typescript
// apps/mcp-server/src/index.ts
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  NodeStreamableHTTPServerTransport,
} from "@modelcontextprotocol/node";
import { isInitializeRequest } from "@modelcontextprotocol/server";
import { createSecopiaServer } from "@secopia/mcp";

const mcpServer = createSecopiaServer(process.env.SOCRATA_APP_TOKEN);

// Almacenar transports por sesión para soportar múltiples clientes concurrentes
const transports = new Map<string, NodeStreamableHTTPServerTransport>();

const httpServer = createServer(async (req, res) => {
  // CORS headers para clientes web-based
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Mcp-Session-Id, Mcp-Protocol-Version",
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", sessions: transports.size }));
    return;
  }

  // MCP endpoint
  if (req.url === "/mcp" && req.method === "POST") {
    // Leer body
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString());

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      // Reusar transport existente
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, body);
    } else if (!sessionId && isInitializeRequest(body)) {
      // Nueva sesión
      const transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => transports.set(sid, transport),
      });

      transport.onclose = () => {
        if (transport.sessionId) transports.delete(transport.sessionId);
      };

      // Cleanup cuando el cliente cierra la conexión
      res.on("close", () => {
        if (!transports.has(transport.sessionId ?? "")) {
          transport.close();
        }
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, body);
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            "Sesión inválida o request sin inicialización. Envía un Initialize request primero.",
        }),
      );
    }
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const PORT = Number(process.env.PORT ?? 3001);
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Secopia MCP server listening on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`MCP:    http://localhost:${PORT}/mcp`);
});
```

---

## 7. Datasets y fuentes de datos

### Datasets principales

| Dataset | ID Socrata | Fuente |
|---|---|---|
| SECOP II - Contratos | `jbjy-vk9h` | datos.gov.co |
| SECOP II - Procesos | `p6dx-8zbt` | datos.gov.co |
| SECOP I - Procesos | `f789-7hwg` | datos.gov.co |

### Rate limits de Socrata

| Condición | Límite |
|---|---|
| Sin App Token | 60 requests/hora (throttled) |
| Con App Token | 1000 requests/hora |
| Límite absoluto | 200 filas por request |

> **Importante:** El App Token se obtiene gratis en datos.gov.co. Es obligatorio para producción.

---

## 8. Flujos de datos

### 8.1 Búsqueda rápida (Typesense) — < 50ms

```
Usuario escribe en SearchBar
  → debounce 300ms (useDeferredValue para no bloquear input)
  → GET /api/buscar?q=... (Vercel Edge)
  → Rate limit check (Upstash Redis, < 1ms)
  → Typesense.search() → Resultados rankeados por relevancia (~20-50ms)
  → Caché resultado en Redis (TTL 10min)
  → TanStack Query actualiza SearchResults con infinite scroll
```

### 8.2 Búsqueda con filtros avanzados (Socrata) — < 500ms con caché

```
Usuario aplica filtros (departamento, valor, fecha, modalidad)
  → GET /api/buscar?departamento=BOGOTA&valor_min=1000000 (Vercel Edge)
  → Rate limit check
  → ¿Existe en Redis?
    → SÍ: Devuelve JSON en ~15ms
    → NO: SoQLBuilder construye query sanitizada → Socrata API (~800ms)
         → Guarda en Redis (TTL 10min) → Devuelve JSON
```

### 8.3 Chat con IA (Latencia Reducida)

```
Usuario escribe pregunta en ChatPanel
  → POST /api/chat (Vercel Edge)
  → Rate limit check (10 msgs/min por IP)
  → Vercel AI SDK → Anthropic API
  → Anthropic requiere datos → Invoca tool "buscar_contratos"
  → Edge Function ejecuta SocrataClient DIRECTAMENTE (Sin saltar a MCP-HTTP)
  → SocrataClient → Socrata API (sanitizado por SoQLBuilder)
  → Resultado vuelve a Anthropic → Genera respuesta textual
  → Streaming de vuelta al browser
```

### 8.4 MCP standalone (Claude Desktop / Cursor)

```
Claude invoca tool "buscar_contratos"
  → stdio → @secopia/mcp (npx local)
  → Zod valida inputs
  → SoQLBuilder construye query sanitizada
  → SocrataClient → ¿Caché LRU in-memory?
    → SÍ: Retorna datos cacheados (0ms)
    → NO: Socrata API → Guarda en LRU (TTL 5min) → Retorna JSON
  → Resultado JSON → Claude
```

### 8.5 Sincronización Typesense (Background)

```
Script programado (cron cada 30min o GitHub Action)
  → scripts/sync-typesense.ts
  → SocrataClient.query() con paginación (offset incremental)
  → Upsert documentos en Typesense (batch de 250)
  → Typesense indexa y hace disponible para búsqueda instantánea
```

---

## 9. Diseño de la UI / UX

### Estrategia de componentes

- **Componentes simples** (Button, Card, Input, Badge): Tailwind CSS puro. Sin dependencia de runtime, máximo rendimiento, mínimo bundle.
- **Componentes complejos** (Dialog, Combobox, Dropdown, Tooltip): Radix UI primitives directamente. Sin wrapper de shadcn/ui (que solo agrega una capa de abstracción innecesaria cuando ya sabés Tailwind + Radix).

### Comportamiento de búsqueda sin fricción

- **Búsqueda dual:** Typesense para búsqueda de texto libre (instantánea, con typo-tolerance), Socrata para filtros avanzados (valor, fecha, modalidad).
- **Infinite Scroll Híbrido:** Server Component para primer render → datos iniciales como prop a Client Component (`SearchResults.tsx`) con `useInfiniteQuery` de TanStack Query.
- **Filtros en URL:** Todos los filtros sincronizados con URL params (`?departamento=BOGOTA&valor_min=1000000`), permitiendo compartir búsquedas.
- **Transiciones suaves:** `useDeferredValue` de React para tipeo fluido mientras se re-renderizan resultados.

---

## 10. Seguridad

### Principios

1. **NUNCA string interpolation para SoQL.** Todo input del usuario pasa por `SoQLBuilder.sanitize()` y los métodos tipados (`like()`, `orLike()`, `equals()`, `gte()`, `lte()`). La API route `/api/buscar` NO construye queries manualmente.

2. **Validación de nombres de campo.** `SoQLBuilder.sanitizeField()` verifica que los campos solo contengan `[a-z0-9_]`. Previene inyección a través de campos dinámicos.

3. **Rate limiting en todas las API routes.** Sliding window por IP con Upstash Redis. Configuraciones diferenciadas:
   - `/api/buscar`: 30 req / 10s (uso normal de búsqueda)
   - `/api/chat`: 10 req / 60s (operación costosa con LLM)

4. **API keys solo en servidor.** `SOCRATA_APP_TOKEN` y `ANTHROPIC_API_KEY` nunca llegan al cliente. Validados al inicio del proceso, no en runtime.

5. **Límites de query.** `SoQLBuilder.limit()` tiene un cap de 200 (límite de Socrata). `offset` tiene un floor de 0. Las tools del MCP tienen límites de 100 vía Zod schema.

6. **Sin `consulta_soql` libre.** La tool que aceptaba SoQL arbitrario fue removida. Un LLM podría generar queries extremadamente pesadas que saturen la cuota de Socrata o expongan datos de formas no anticipadas.

---

## 11. Convenciones de código

| Convención | Regla |
|---|---|
| Commits | Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`) |
| Componentes | PascalCase (`SearchBar.tsx`, `ContractCard.tsx`) |
| Utilidades | camelCase (`formatCurrency.ts`, `parseDate.ts`) |
| Tipos | PascalCase + sufijo descriptivo (`ContratoSECOP2`, `FiltrosBusqueda`) |
| Linting + Formato | Biome (un solo tool, configurado en `biome.json`) |
| Branches | `feat/nombre`, `fix/nombre`, `docs/nombre` |

---

## 12. Variables de entorno

### `apps/web` (Vercel)

```bash
# .env.local
SOCRATA_APP_TOKEN=            # Token de datos.gov.co — requerido
ANTHROPIC_API_KEY=            # Clave de Anthropic — para el chat
UPSTASH_REDIS_REST_URL=       # Upstash Redis URL (caché + rate limiting)
UPSTASH_REDIS_REST_TOKEN=     # Upstash Redis Token
TYPESENSE_HOST=               # Host de Typesense Cloud
TYPESENSE_API_KEY=            # API key de Typesense (search-only para cliente)
TYPESENSE_ADMIN_API_KEY=      # API key admin (solo para sync script)
NEXT_PUBLIC_APP_URL=          # URL pública del sitio
```

### `apps/mcp-server` (Fly.io)

```bash
SOCRATA_APP_TOKEN=            # Token de datos.gov.co — requerido
PORT=3001                     # Puerto
```

### `packages/mcp` (Usuario final vía npx)

```bash
SOCRATA_APP_TOKEN=            # Opcional (funciona sin token con rate limit de 60 req/hora)
```

---

## 13. Deploy y CI/CD

| Componente | Plataforma | Notas |
|---|---|---|
| `apps/web` | Vercel | CI/CD automático. Funciona en plan gratuito (sin KV integrado, usar Upstash externo) |
| `apps/mcp-server` | Fly.io | Mejor control de timeouts para long-polling. Alternativa: Railway |
| `@secopia/mcp` | npm | Publicación manual o via CI con `npm version` + `npm publish` |
| Typesense | Typesense Cloud | Tier gratuito para open source. Alternativa: self-hosted con Docker |

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo check     # TypeScript type checking
      - run: pnpm turbo lint      # Biome lint
      - run: pnpm turbo test      # Tests
```

---

## 14. Self-hosting

Para quienes quieran deployar su propia instancia sin depender de Vercel o servicios pagos:

| Servicio | Opción Vercel | Alternativa Self-hosted |
|---|---|---|
| Hosting Web | Vercel | Docker + `next start` en cualquier VPS |
| Redis Cache | Upstash | Redis local o `docker run redis` |
| Búsqueda | Typesense Cloud | `docker run typesense/typesense` |
| MCP Server | Fly.io | Docker en cualquier VPS |

```bash
# Docker Compose para desarrollo local completo
# docker-compose.yml (incluido en el repo)
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  typesense:
    image: typesense/typesense:27.1
    ports: ["8108:8108"]
    volumes: ["typesense-data:/data"]
    command: --data-dir /data --api-key=dev-key
```

---

## 15. Roadmap por fases

### Fase 0 — Setup (semana 1-2)
- [ ] Inicializar monorepo con pnpm + Turborepo + Biome
- [ ] Crear `@secopia/types` y `@secopia/socrata-client` (con sanitización + caché LRU)
- [ ] Verificar conectividad con Socrata
- [ ] Setup Upstash Redis (o Redis local para dev)

### Fase 1 — MCP MVP (semana 3-4)
- [ ] Implementar `@secopia/mcp` con `registerTool` + Zod + Resources
- [ ] Probar localmente con Claude Desktop vía stdio
- [ ] Publicar en npm
- [ ] Implementar `apps/mcp-server` con `node:http` + MCP SDK transport

### Fase 2 — Web MVP Core (semana 5-8)
- [ ] Scaffolding Next.js 15
- [ ] Implementar rate limiting con `@upstash/ratelimit`
- [ ] Implementar `/api/buscar` con caché Redis (TTL 10min) y SoQLBuilder seguro
- [ ] Página de resultados con TanStack Query infinite scroll
- [ ] Filtros avanzados sincronizados con URL

### Fase 3 — Detalles y SEO (semana 9-11)
- [ ] Páginas de detalle con ISR (Contrato, Proveedor, Entidad)
- [ ] Metadatos dinámicos para redes sociales
- [ ] Sitemap dinámico

### Fase 4 — Chat Directo (semana 12-14)
- [ ] Integrar Vercel AI SDK en `/api/chat` con rate limiting
- [ ] Implementar ChatPanel con ejecución directa de tools (sin MCP HTTP)
- [ ] Sugerencias contextuales

### Fase 5 — Búsqueda Full-Text (semana 15-17)
- [ ] Setup Typesense Cloud (o Docker para dev)
- [ ] Crear script `sync-typesense.ts` para indexar datos de Socrata
- [ ] Integrar Typesense en `/api/buscar` para búsqueda de texto libre
- [ ] Mantener Socrata como fallback para filtros avanzados

### Fase 6 — Pulido (semana 18-20)
- [ ] Performance audit (Core Web Vitals < 500ms TTFB)
- [ ] Docker Compose para self-hosting
- [ ] README completo en el repo
- [ ] Documentación del MCP (ejemplos de uso con Claude)
- [ ] Lanzamiento público
