/**
 * Redis Cache — Edge-compatible caching layer
 *
 * Wraps Upstash Redis for caching Socrata query results.
 * Works on Vercel Edge Runtime (HTTP-based, no TCP).
 *
 * TTL: 10 minutes for search results (SECOP data doesn't change frequently).
 */

import { getRedis } from "./redis.js";

const CACHE_TTL_SECONDS = 600; // 10 minutes
const CACHE_PREFIX = "secopia:q";

/**
 * Get a cached value by key.
 * Returns null if not found or expired.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await getRedis().get<T>(`${CACHE_PREFIX}:${key}`);
    return cached;
  } catch {
    // Cache failures should not break the app
    console.warn("[cache:get] Redis error, skipping cache");
    return null;
  }
}

/**
 * Set a value in the cache with the default TTL.
 */
export async function setCached<T>(key: string, value: T): Promise<void> {
  try {
    await getRedis().set(`${CACHE_PREFIX}:${key}`, value, {
      ex: CACHE_TTL_SECONDS,
    });
  } catch {
    // Cache failures should not break the app
    console.warn("[cache:set] Redis error, skipping cache write");
  }
}
