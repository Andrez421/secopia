/**
 * /api/buscar — Search API Route
 *
 * SEARCH STRATEGY:
 * - Socrata is the primary path for ALL queries (full ~5M-row dataset) —
 *   free text via orLike across entity/provider/description fields.
 * - Typesense is a degraded fallback for text-only queries when Socrata
 *   fails: its index holds ~50K rows (partial coverage, flagged `partial`).
 * - Totals: rows are fetched as limite+1 (hasMore probe). Exact counts run
 *   in the background via after() + SELECT count(*) and land in Redis for
 *   subsequent pages — the count can take ~60s (full scan), too slow for
 *   the request path.
 *
 * SECURITY:
 * - Rate limited: 30 req/10s per IP
 * - All Socrata inputs sanitized via SoQLBuilder (never string interpolation)
 * - Dataset type validated against known registry
 * - Limit/offset clamped by SoQLBuilder
 */

import { acquireCacheLock, getCached, setCached } from "@/lib/cache";
import { getClientIp, getSearchRateLimiter } from "@/lib/rate-limit";
import { validateSearchParams } from "@/lib/search-validation";
import { getSocrataClient, getSocrataCountClient } from "@/lib/socrata";
import { searchContratos } from "@/lib/typesense";
import { DATASETS, SoQLBuilder, getDataset } from "@secopia/socrata-client";
import type { SearchResponse } from "@secopia/types";
import { type NextRequest, NextResponse, after } from "next/server";

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
    !params.get("estado") &&
    !params.get("ciudad") &&
    !params.get("valor_min") &&
    !params.get("valor_max") &&
    !params.get("fecha_desde") &&
    !params.get("fecha_hasta")
  );
}

/** Detect if a query looks like a document/NIT number (digits only, 5-15 chars) */
function isNumericQuery(q: string): boolean {
  return /^\d{5,15}$/.test(q.trim());
}

/**
 * Fire-and-forget exact count: `SELECT count(*)` runs a full scan that
 * can take ~60s — too slow for the request path. after() executes it
 * post-response and caches the total for subsequent pages.
 */
function scheduleExactCount(datasetId: string, countKey: string, countQuery: string): void {
  after(async () => {
    try {
      const rows = await getSocrataCountClient().query<{ count: string }>(datasetId, countQuery);
      const n = Number(rows[0]?.count);
      if (Number.isFinite(n)) await setCached(countKey, n);
    } catch (error) {
      console.warn(
        "[api/buscar] background count failed:",
        error instanceof Error ? error.message : error,
      );
    }
  });
}

/** Schedule the background count unless the total is already known/in-flight. */
async function maybeScheduleCount(
  hasMore: boolean,
  cachedCount: number | null,
  datasetId: string,
  countKey: string,
  countQuery: string,
): Promise<void> {
  if (hasMore && cachedCount === null && (await acquireCacheLock(`lock:${countKey}`, 120))) {
    scheduleExactCount(datasetId, countKey, countQuery);
  }
}

/**
 * Degraded search via the partial Typesense index (~50K of 5M+ rows).
 * Only reached when Socrata fails — responses are flagged `partial`
 * so the UI can communicate reduced coverage instead of a wrong total.
 */
async function searchTypesensePartial(
  q: string,
  limite: number,
  offset: number,
  rateLimitRemaining: number,
): Promise<NextResponse | null> {
  try {
    const tsResult = await searchContratos({
      q,
      limit: Math.min(limite, 200),
      offset: Math.max(0, offset),
    });

    const response: SearchResponse<unknown> = {
      items: tsResult.items,
      total: tsResult.total,
      hasMore: offset + tsResult.items.length < tsResult.total,
      totalExact: true,
      partial: true,
      query_soql: `typesense:${q}`,
      searchTimeMs: tsResult.searchTimeMs,
    };

    return NextResponse.json(response, {
      headers: { "X-RateLimit-Remaining": String(rateLimitRemaining) },
    });
  } catch (tsError) {
    console.warn(
      "[api/buscar] Typesense fallback also failed:",
      tsError instanceof Error ? tsError.message : tsError,
    );
    return null;
  }
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
    const estado = params.get("estado") ?? undefined;
    const ciudad = params.get("ciudad") ?? undefined;
    const fechaDesde = params.get("fecha_desde") ?? undefined;
    const fechaHasta = params.get("fecha_hasta") ?? undefined;
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

    // ── 3. Build SoQL — fetch limite+1 rows as a hasMore probe ─
    // Socrata cannot report a total; the extra row cheaply tells us
    // whether another page exists beyond this one.

    const fetchLimit = Math.min(limite + 1, 200); // Socrata max
    const builder = new SoQLBuilder().limit(fetchLimit).offset(offset);

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
    // estado/ciudad use exact (case-insensitive) match: like '%X%' on these
    // low-cardinality columns forces a full scan that times out (verified live)
    if (estado && ds.campos.estado) builder.equalsUpper(ds.campos.estado, estado);
    if (ciudad && ds.campos.ciudad) builder.equalsUpper(ds.campos.ciudad, ciudad);
    if (fechaDesde) builder.gte(ds.campos.fecha_firma, fechaDesde);
    if (fechaHasta) builder.lte(ds.campos.fecha_firma, fechaHasta);
    if (valorMinRaw) builder.gte(ds.campos.valor, Number(valorMinRaw));
    if (valorMaxRaw) builder.lte(ds.campos.valor, Number(valorMaxRaw));

    builder.orderBy(ds.campos.fecha_firma);

    const soqlQuery = builder.build();
    const countQuery = builder.buildCount();

    // ── 4. Check Redis Cache ────────────────────────────────

    const cacheKey = `${ds.id}:${soqlQuery}`;
    const countKey = `count:${ds.id}:${countQuery}`;
    const cached = await getCached<SearchResponse<unknown>>(cacheKey);

    if (cached) {
      // Re-derive the total on every hit: the background count may have
      // landed in Redis after this response was cached.
      const cachedCount = cached.hasMore ? await getCached<number>(countKey) : null;
      await maybeScheduleCount(cached.hasMore ?? false, cachedCount, ds.id, countKey, countQuery);
      return NextResponse.json(
        {
          ...cached,
          total: cachedCount ?? cached.total,
          totalExact: !cached.hasMore || cachedCount !== null,
          fromCache: true,
        },
        {
          headers: { "X-RateLimit-Remaining": String(remaining) },
        },
      );
    }

    // ── 5. Query Socrata (primary path — full dataset) ──────

    const client = getSocrataClient();
    let rows: Record<string, unknown>[];
    try {
      rows = await client.query(ds.id, soqlQuery);
    } catch (socrataError) {
      // Socrata down or timed out — degraded fallback to the partial
      // Typesense index for text-only contratos queries.
      if (
        q &&
        tipo === "contratos" &&
        !isNumericQuery(q) &&
        isTextOnlyQuery(req.nextUrl.searchParams) &&
        isTypesenseAvailable()
      ) {
        const degraded = await searchTypesensePartial(q, limite, offset, remaining);
        if (degraded) return degraded;
      }
      throw socrataError;
    }

    // When fetchLimit == limite (limite already at the 200 cap), a full
    // page can't distinguish "exactly N" from "more" — stay optimistic.
    const hasMore = rows.length > limite || (fetchLimit === limite && rows.length === fetchLimit);
    const items = rows.slice(0, limite);
    const cachedCount = hasMore ? await getCached<number>(countKey) : null;
    await maybeScheduleCount(hasMore, cachedCount, ds.id, countKey, countQuery);

    const response: SearchResponse<unknown> = {
      items,
      total: cachedCount ?? offset + items.length,
      hasMore,
      totalExact: !hasMore || cachedCount !== null,
      query_soql: soqlQuery,
    };

    // ── 6. Cache & Return ───────────────────────────────────

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
