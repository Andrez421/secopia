/**
 * Socrata Client wrapper for the web app.
 *
 * Creates a singleton SocrataClient instance configured for Edge runtime.
 * In the web app, Redis handles caching (via lib/cache.ts), so the
 * in-memory LRU cache is disabled.
 */

import { SocrataClient } from "@secopia/socrata-client";

let client: SocrataClient | null = null;

/**
 * Get the shared SocrataClient instance.
 * In-memory cache is disabled since the web app uses Redis for caching.
 */
export function getSocrataClient(): SocrataClient {
  if (!client) {
    client = new SocrataClient({
      appToken: process.env.SOCRATA_APP_TOKEN,
      cache: { ttlMs: 0 }, // Disabled — web uses Redis cache
      // 30s: selective filter combinations (like + equals) can scan deep
      // into the dataset — 15s produced 502s on queries Socrata answers
      // in ~20-50s under load. Ceiling, not target: fast queries unaffected.
      timeoutMs: 30_000,
    });
  }
  return client;
}

let countClient: SocrataClient | null = null;

/**
 * SocrataClient with a long timeout for background count(*) queries.
 * A count over filtered LIKE conditions scans millions of rows and
 * observed latencies exceed 90s under load — far beyond the 15s
 * default used on the request path.
 */
export function getSocrataCountClient(): SocrataClient {
  if (!countClient) {
    countClient = new SocrataClient({
      appToken: process.env.SOCRATA_APP_TOKEN,
      cache: { ttlMs: 0 },
      timeoutMs: 180_000,
    });
  }
  return countClient;
}
