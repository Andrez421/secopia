/**
 * @secopia/types — Search and filter interfaces
 *
 * Used by both the web app and MCP server to define
 * search parameters in a type-safe way.
 */

/** Supported dataset types for search operations */
export type DatasetType = "contratos" | "procesos" | "secop1";

/** Sort direction for query results */
export type SortDirection = "ASC" | "DESC";

/** Search filters applied by the web UI and MCP tools */
export interface SearchFilters {
  /** Free text search across multiple fields */
  q?: string;
  /** Filter by contracting entity name (partial match) */
  entidad?: string;
  /** Filter by provider/contractor name (partial match) */
  proveedor?: string;
  /** Filter by department (exact match, uppercase) */
  departamento?: string;
  /** Filter by procurement modality (partial match) */
  modalidad?: string;
  /** Minimum contract value in COP */
  valor_min?: number;
  /** Maximum contract value in COP */
  valor_max?: number;
  /** Start date filter (ISO 8601: YYYY-MM-DD) */
  fecha_inicio?: string;
  /** End date filter (ISO 8601: YYYY-MM-DD) */
  fecha_fin?: string;
  /** Dataset type to search */
  tipo?: DatasetType;
  /** Max results per page (capped at 200 by Socrata) */
  limite?: number;
  /** Pagination offset */
  offset?: number;
}

/** Paginated API response from /api/buscar */
export interface SearchResponse<T> {
  items: T[];
  /**
   * Best-known match count. Exact when `totalExact` is true; otherwise a
   * lower bound (matches seen so far) — Socrata cannot report totals on a
   * rows query.
   */
  total: number;
  /** True when `total` is the exact match count, not a lower bound */
  totalExact?: boolean;
  /** True when more results exist beyond this page */
  hasMore?: boolean;
  /**
   * True when results come from the partial Typesense index as a degraded
   * fallback (Socrata unavailable) — coverage is a subset of the dataset.
   */
  partial?: boolean;
  query_soql: string;
  fromCache?: boolean;
  /** Time in milliseconds for Typesense search (only present for Typesense results) */
  searchTimeMs?: number;
}

/** Error response from API routes */
export interface ApiError {
  error: string;
  status?: number;
}
