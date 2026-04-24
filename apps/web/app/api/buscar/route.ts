/**
 * /api/buscar — Search API Route (Dual Search)
 *
 * DUAL SEARCH STRATEGY:
 * - Free text queries (param `q`): Typesense for instant full-text search (<50ms)
 * - Advanced filters (departamento, valor, fecha): Socrata via SoQLBuilder
 * - If Typesense is unavailable: falls back to Socrata for all queries
 *
 * SECURITY:
 * - Rate limited: 30 req/10s per IP
 * - All Socrata inputs sanitized via SoQLBuilder (never string interpolation)
 * - Dataset type validated against known registry
 * - Limit/offset clamped by SoQLBuilder
 */

import { getCached, setCached } from "@/lib/cache";
import { getClientIp, getSearchRateLimiter } from "@/lib/rate-limit";
import { validateSearchParams } from "@/lib/search-validation";
import { getSocrataClient } from "@/lib/socrata";
import { searchContratos } from "@/lib/typesense";
import { DATASETS, SoQLBuilder, getDataset } from "@secopia/socrata-client";
import type { SearchResponse } from "@secopia/types";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/** Check if Typesense is configured in environment */
function isTypesenseAvailable(): boolean {
  return !!(process.env.TYPESENSE_HOST && process.env.TYPESENSE_API_KEY);
}

/** Check if the query has only free text (no advanced filters) */
function isTextOnlyQuery(params: URLSearchParams): boolean {
  return (
    !!params.get("q") &&
    !params.get("entidad") &&
    !params.get("proveedor") &&
    !params.get("departamento") &&
    !params.get("modalidad") &&
    !params.get("valor_min") &&
    !params.get("valor_max")
  );
}

/** Detect if a query looks like a document/NIT number (digits only, 5-15 chars) */
function isNumericQuery(q: string): boolean {
  return /^\d{5,15}$/.test(q.trim());
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: API handler with multiple sequential stages
export async function GET(req: NextRequest) {
  // ── 1. Rate Limiting ────────────────────────────────────

  const ip = getClientIp(req);

  try {
    const { success, remaining } = await getSearchRateLimiter().limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta en unos segundos." },
        {
          status: 429,
          headers: {
            "Retry-After": "10",
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    // ── 2. Parse & Validate Parameters ──────────────────────

    const params = req.nextUrl.searchParams;
    const tipo = params.get("tipo") ?? "contratos";
    const q = params.get("q") ?? undefined;
    const entidad = params.get("entidad") ?? undefined;
    const proveedor = params.get("proveedor") ?? undefined;
    const departamento = params.get("departamento") ?? undefined;
    const modalidad = params.get("modalidad") ?? undefined;
    const valorMinRaw = params.get("valor_min");
    const valorMaxRaw = params.get("valor_max");
    const validationError = validateSearchParams({
      limite: params.get("limite"),
      offset: params.get("offset"),
      valorMin: valorMinRaw,
      valorMax: valorMaxRaw,
    });

    if (validationError) {
      return NextResponse.json(
        { error: validationError.error },
        { status: validationError.status },
      );
    }

    const limite = Number(params.get("limite") ?? 50);
    const offset = Number(params.get("offset") ?? 0);

    if (Number.isNaN(limite) || Number.isNaN(offset)) {
      return NextResponse.json({ error: "limite y offset deben ser números" }, { status: 400 });
    }

    if (valorMinRaw && valorMaxRaw && Number(valorMinRaw) > Number(valorMaxRaw)) {
      return NextResponse.json(
        { error: "valor_min no puede ser mayor que valor_max" },
        { status: 400 },
      );
    }

    // Validate dataset type
    let ds: ReturnType<typeof getDataset>;
    try {
      ds = getDataset(tipo);
    } catch {
      return NextResponse.json(
        {
          error: `Tipo de dataset inválido: "${tipo}". Disponibles: ${Object.keys(DATASETS).join(", ")}`,
        },
        { status: 400 },
      );
    }

    // ── 3. Typesense path (free text, contratos only, non-numeric) ─
    // Numeric queries (cédula/NIT) bypass Typesense: the index holds
    // only 50K records out of 5M+. Exact document lookups go to Socrata.

    if (
      q &&
      tipo === "contratos" &&
      isTextOnlyQuery(req.nextUrl.searchParams) &&
      !isNumericQuery(q) &&
      isTypesenseAvailable()
    ) {
      const cacheKey = `ts:${q}:${limite}:${offset}`;
      const cached = await getCached<SearchResponse<unknown>>(cacheKey);

      if (cached) {
        return NextResponse.json(
          { ...cached, fromCache: true },
          { headers: { "X-RateLimit-Remaining": String(remaining) } },
        );
      }

      try {
        const tsResult = await searchContratos({
          q,
          limit: Math.min(limite, 200),
          offset: Math.max(0, offset),
        });

        const response: SearchResponse<unknown> = {
          items: tsResult.items,
          total: tsResult.total,
          query_soql: `typesense:${q}`,
          searchTimeMs: tsResult.searchTimeMs,
        };

        await setCached(cacheKey, response);

        return NextResponse.json(response, {
          headers: { "X-RateLimit-Remaining": String(remaining) },
        });
      } catch (tsError) {
        // Typesense failed — fall through to Socrata
        console.warn(
          "[api/buscar] Typesense error, falling back to Socrata:",
          tsError instanceof Error ? tsError.message : tsError,
        );
      }
    }

    // ── 4. Socrata path (filters or fallback) ──────────────

    const builder = new SoQLBuilder().limit(limite).offset(offset);

    // Free text search: orLike across multiple fields (sanitized)
    if (q) {
      if (isNumericQuery(q) && ds.campos.documento_proveedor) {
        // Exact match for document/NIT numbers — faster and more precise than LIKE
        builder.equals(ds.campos.documento_proveedor, q.trim());
      } else {
        const searchFields = [ds.campos.entidad, ds.campos.proveedor, ds.campos.descripcion];
        builder.orLike(searchFields, q);
      }
    }

    // Specific filters: each goes through sanitize()
    if (entidad) builder.like(ds.campos.entidad, entidad);
    if (proveedor) builder.like(ds.campos.proveedor, proveedor);
    if (departamento) builder.equals(ds.campos.departamento, departamento);
    if (modalidad) builder.like(ds.campos.modalidad, modalidad);
    if (valorMinRaw) builder.gte(ds.campos.valor, Number(valorMinRaw));
    if (valorMaxRaw) builder.lte(ds.campos.valor, Number(valorMaxRaw));

    builder.orderBy(ds.campos.fecha_firma);

    const soqlQuery = builder.build();

    // ── 5. Check Redis Cache ────────────────────────────────

    const cacheKey = `${ds.id}:${soqlQuery}`;
    const cached = await getCached<SearchResponse<unknown>>(cacheKey);

    if (cached) {
      return NextResponse.json(
        { ...cached, fromCache: true },
        {
          headers: { "X-RateLimit-Remaining": String(remaining) },
        },
      );
    }

    // ── 6. Query Socrata ────────────────────────────────────

    const client = getSocrataClient();
    const results = await client.query(ds.id, soqlQuery);

    // Socrata does not provide a total count. If we received fewer rows than
    // requested, we know the exact total; otherwise it's unknown.
    const exactTotal = results.length < limite ? results.length : undefined;

    const response: SearchResponse<unknown> = {
      items: results,
      total: exactTotal ?? results.length,
      query_soql: soqlQuery,
    };

    // ── 7. Cache & Return ───────────────────────────────────

    await setCached(cacheKey, response);

    return NextResponse.json(response, {
      headers: { "X-RateLimit-Remaining": String(remaining) },
    });
  } catch (error) {
    // Differentiated error handling
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "Unknown";

    console.error(`[api/buscar] ${errorName}: ${errorMessage}`);

    if (errorName === "SocrataError") {
      return NextResponse.json(
        { error: "Error consultando datos de SECOP. Intenta de nuevo." },
        { status: 502 },
      );
    }

    if (errorName === "SoQLValidationError") {
      return NextResponse.json({ error: "Parámetros de búsqueda inválidos." }, { status: 400 });
    }

    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
