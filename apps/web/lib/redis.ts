/**
 * Shared Redis Client Factory
 *
 * Single source of truth for Upstash Redis configuration.
 * Reused by cache and rate-limit modules.
 */

import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
let redisUnavailable = false;

/**
 * Get the shared Upstash Redis client.
 * Returns null if Redis is not configured (dev mode without env vars).
 */
export function getRedis(): Redis | null {
  if (redisUnavailable) return null;
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      redisUnavailable = true;
      return null;
    }
    redis = new Redis({ url, token });
  }
  return redis;
}
