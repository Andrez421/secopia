// @secopia/socrata-client — Public API
// Re-exports all client functionality from a single entry point.

export { SocrataClient } from "./client.js";
export type { SocrataClientOptions } from "./client.js";

export { SoQLBuilder, SoQLValidationError } from "./soql.js";

export { LruCache } from "./cache.js";
export type { LruCacheOptions } from "./cache.js";

export { SocrataError } from "./errors.js";

export { DATASETS, getDataset } from "./datasets.js";
