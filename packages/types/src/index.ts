// @secopia/types — Public API
// Re-exports all shared types from a single entry point.

export type {
  ContratoSECOP2,
  ProcesoSECOP2,
  ProcesoSECOP1,
  SocrataErrorResponse,
} from "./secop.js";

export type {
  DatasetType,
  SortDirection,
  SearchFilters,
  SearchResponse,
  ApiError,
} from "./search.js";

export type {
  DatasetFieldMap,
  DatasetConfig,
  DatasetRegistry,
} from "./datasets.js";
