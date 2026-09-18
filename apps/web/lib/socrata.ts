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
    });
  }
  return client;
}

let countClient: SocrataClient | null = null;

/**
 * SocrataClient with a long timeout for background count(*) queries.
 * A count over filtered LIKE conditions can scan millions of rows and
 * take ~60s — far beyond the 15s default used on the request path.
 */
export function getSocrataCountClient(): SocrataClient {
  if (!countClient) {
    countClient = new SocrataClient({
      appToken: process.env.SOCRATA_APP_TOKEN,
      cache: { ttlMs: 0 },
      timeoutMs: 90_000,
    });
  }
  return countClient;
}
