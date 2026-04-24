/**
 * Shared Redis Client Factory
 *
 * Single source of truth for Upstash Redis configuration.
 * Reused by cache and rate-limit modules.
 */

import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}
