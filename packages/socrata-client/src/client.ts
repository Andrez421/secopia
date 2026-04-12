/**
 * Socrata SODA API Client
 *
 * Async HTTP client for querying datos.gov.co datasets.
 * Features:
 * - LRU in-memory cache with configurable TTL
 * - Proper error handling with typed errors
 * - App Token support for higher rate limits
 *
 * @example
 * ```ts
 * const client = new SocrataClient({ appToken: "your-token" });
 * const results = await client.query<ContratoSECOP2>("jbjy-vk9h", soqlQuery);
 * ```
 */

import { LruCache } from "./cache.js";
import type { LruCacheOptions } from "./cache.js";
import { SocrataError } from "./errors.js";

const SOCRATA_BASE_URL = "https://www.datos.gov.co/resource";

export interface SocrataClientOptions {
  /** Socrata App Token for higher rate limits (1000 req/hr vs 60 req/hr) */
  appToken?: string;
  /** LRU cache configuration. Set ttlMs to 0 to disable caching. */
  cache?: Partial<LruCacheOptions>;
  /** Base URL for the Socrata API. Default: https://www.datos.gov.co/resource */
  baseUrl?: string;
}

export class SocrataClient {
  private readonly baseUrl: string;
  private readonly appToken?: string;
  private readonly cache: LruCache<unknown[]>;

  constructor(options: SocrataClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? SOCRATA_BASE_URL;
    this.appToken = options.appToken;
    this.cache = new LruCache(options.cache);
  }

  /**
   * Execute a SoQL query against a Socrata dataset.
   *
   * @param datasetId - The Socrata dataset identifier (e.g., "jbjy-vk9h")
   * @param soql - A SoQL query string, ideally built with SoQLBuilder
   * @returns Array of records matching the query
   *
   * @throws {SocrataError} When the API returns a non-OK response
   */
  async query<T = Record<string, unknown>>(datasetId: string, soql: string): Promise<T[]> {
    const cacheKey = `${datasetId}:${soql}`;

    // 1. Check in-memory cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as T[];
    }

    // 2. Build request URL
    const url = new URL(`${this.baseUrl}/${datasetId}.json`);
    url.searchParams.set("$query", soql);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (this.appToken) {
      headers["X-App-Token"] = this.appToken;
    }

    // 3. Fetch from Socrata
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

    // 4. Store in LRU cache
    this.cache.set(cacheKey, data);

    return data;
  }

  /** Clear the in-memory cache */
  clearCache(): void {
    this.cache.clear();
  }

  /** Number of cached entries */
  get cacheSize(): number {
    return this.cache.size;
  }
}
