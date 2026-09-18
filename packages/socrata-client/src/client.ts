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
  /** Request timeout in ms. Default: 15000. Set 0 to disable. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export class SocrataClient {
  private readonly baseUrl: string;
  private readonly appToken?: string;
  private readonly cache: LruCache<unknown[]>;
  private readonly timeoutMs: number;

  constructor(options: SocrataClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? SOCRATA_BASE_URL;
    this.appToken = options.appToken;
    this.cache = new LruCache(options.cache);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Execute a SoQL query against a Socrata dataset.
   *
   * @param datasetId - The Socrata dataset identifier (e.g., "jbjy-vk9h")
   * @param soql - A SoQL query string, ideally built with SoQLBuilder
   * @param signal - Optional AbortSignal for caller-side cancellation
   * @returns Array of records matching the query
   *
   * @throws {SocrataError} When the API returns a non-OK response or the
   *   request times out (status 408)
   */
  async query<T = Record<string, unknown>>(
    datasetId: string,
    soql: string,
    signal?: AbortSignal,
  ): Promise<T[]> {
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

    // 3. Fetch from Socrata with timeout (Socrata can hang on heavy queries)
    const signals = [
      signal,
      this.timeoutMs > 0 ? AbortSignal.timeout(this.timeoutMs) : undefined,
    ].filter((s): s is AbortSignal => s !== undefined);
    const combined =
      signals.length === 0
        ? undefined
        : signals.length === 1
          ? signals[0]
          : AbortSignal.any(signals);

    let response: Response;
    try {
      response = await fetch(url.toString(), { headers, signal: combined });
    } catch (err) {
      // Caller-initiated abort propagates as-is
      if (signal?.aborted) throw err;
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new SocrataError(`Socrata request timed out after ${this.timeoutMs}ms`, 408, "");
      }
      throw err;
    }

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
