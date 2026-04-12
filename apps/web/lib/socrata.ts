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
