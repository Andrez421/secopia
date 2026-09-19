/**
 * Typesense client for full-text search.
 *
 * Provides instant search (< 50ms) with typo-tolerance
 * for free-text queries. Falls back to Socrata for
 * advanced filters (value, date, modalidad).
 *
 * Supports both cloud (HTTPS/443) and local Docker (HTTP/8108)
 * via TYPESENSE_PORT and TYPESENSE_PROTOCOL env vars.
 *
 * @see scripts/sync-typesense.ts for indexing
 */

import { Client } from "typesense";

const COLLECTION_NAME = "contratos";

let client: Client | null = null;

function getTypesenseClient(): Client {
  if (!client) {
    const host = process.env.TYPESENSE_HOST;
    const apiKey = process.env.TYPESENSE_API_KEY;

    if (!host || !apiKey) {
      throw new Error("Missing TYPESENSE_HOST or TYPESENSE_API_KEY environment variables");
    }

    const port = Number(process.env.TYPESENSE_PORT ?? 443);
    const protocol = process.env.TYPESENSE_PROTOCOL ?? "https";

    client = new Client({
      nodes: [
        {
          host,
          port,
          protocol,
        },
      ],
      apiKey,
      connectionTimeoutSeconds: 5,
    });
  }

  return client;
}

export interface TypesenseSearchParams {
  q: string;
  limit?: number;
  offset?: number;
}

export interface TypesenseSearchResult<T> {
  items: T[];
  total: number;
  searchTimeMs: number;
}

/**
 * Search contracts using Typesense full-text search.
 *
 * Returns results ranked by relevance with typo-tolerance.
 * Typical latency: 20-50ms.
 */
export async function searchContratos<T = Record<string, unknown>>(
  params: TypesenseSearchParams,
): Promise<TypesenseSearchResult<T>> {
  const ts = getTypesenseClient();

  const result = await ts
    .collections(COLLECTION_NAME)
    .documents()
    .search({
      q: params.q,
      query_by:
        "documento_proveedor,proveedor_adjudicado,nombre_entidad,objeto_del_contrato,departamento",
      per_page: params.limit ?? 50,
      page: Math.floor((params.offset ?? 0) / (params.limit ?? 50)) + 1,
      sort_by: "fecha_de_firma:desc",
    });

  const items = (result.hits ?? []).map((hit: { document: unknown }) => {
    const doc = hit.document as Record<string, unknown>;
    // Typesense stores fecha_de_firma as int64 epoch; Socrata rows carry an
    // ISO string. Normalize here so UI helpers (formatDate) get one shape.
    if (typeof doc.fecha_de_firma === "number") {
      doc.fecha_de_firma =
        doc.fecha_de_firma > 0 ? new Date(doc.fecha_de_firma * 1000).toISOString() : "";
    }
    return doc as T;
  });

  return {
    items,
    total: result.found,
    searchTimeMs: result.search_time_ms,
  };
}

/**
 * Schema for the contratos collection in Typesense.
 * Used by the sync script to create/update the collection.
 */
export const CONTRATOS_SCHEMA = {
  name: COLLECTION_NAME,
  fields: [
    { name: "id_contrato", type: "string" as const, facet: false },
    { name: "nombre_entidad", type: "string" as const, facet: true },
    { name: "nit_entidad", type: "string" as const, facet: false },
    { name: "proveedor_adjudicado", type: "string" as const, facet: true },
    { name: "documento_proveedor", type: "string" as const, facet: false },
    { name: "objeto_del_contrato", type: "string" as const, facet: false },
    { name: "tipo_de_contrato", type: "string" as const, facet: true },
    { name: "modalidad_de_contratacion", type: "string" as const, facet: true },
    { name: "departamento", type: "string" as const, facet: true },
    { name: "ciudad", type: "string" as const, facet: true },
    { name: "estado_contrato", type: "string" as const, facet: true },
    { name: "valor_del_contrato", type: "float" as const, facet: false },
    // facet:true is required for the sync worker's purge-by-filter
    { name: "fecha_de_firma", type: "int64" as const, facet: true, sort: true },
  ],
  default_sorting_field: "fecha_de_firma",
} as const;
