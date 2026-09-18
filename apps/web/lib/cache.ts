/**
 * Redis Cache — Edge-compatible caching layer
 *
 * Wraps Upstash Redis for caching Socrata query results.
 * Works on Vercel Edge Runtime (HTTP-based, no TCP).
 *
 * TTL: 10 minutes for search results (SECOP data doesn't change frequently).
 */

import { getRedis } from "./redis";

const CACHE_TTL_SECONDS = 600; // 10 minutes
const CACHE_PREFIX = "secopia:q";

/**
 * Get a cached value by key.
 * Returns null if not found or expired.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const cached = await redis.get<T>(`${CACHE_PREFIX}:${key}`);
    return cached;
  } catch {
    // Cache failures should not break the app
    return null;
  }
}

/**
 * Set a value in the cache with the default TTL.
 */
export async function setCached<T>(key: string, value: T): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`${CACHE_PREFIX}:${key}`, value, {
      ex: CACHE_TTL_SECONDS,
    });
  } catch {
    // Cache failures should not break the app
  }
}

/**
 * Acquire a short-lived lock (SET NX). Returns true when this caller
 * holds the lock. Used to deduplicate background work like count queries.
 */
export async function acquireCacheLock(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const res = await redis.set(`${CACHE_PREFIX}:${key}`, 1, { ex: ttlSeconds, nx: true });
    return res === "OK";
  } catch {
    return false;
  }
}
