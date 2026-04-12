/**
 * Rate Limiting — Protects API routes from abuse
 *
 * Uses Upstash Redis-based sliding window rate limiting.
 * Works on Vercel Edge Runtime (HTTP-based Redis client).
 *
 * Two limiters with different thresholds:
 * - Search: 30 requests / 10 seconds (normal browsing)
 * - Chat: 10 requests / 60 seconds (expensive LLM calls)
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}

/**
 * Rate limiter for search API routes.
 * Sliding window: 30 requests per 10 seconds per IP.
 */
export function getSearchRateLimiter(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(30, "10 s"),
    prefix: "secopia:rl:search",
    analytics: false,
  });
}

/**
 * Rate limiter for chat API routes (more expensive due to LLM calls).
 * Sliding window: 10 requests per 60 seconds per IP.
 */
export function getChatRateLimiter(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    prefix: "secopia:rl:chat",
    analytics: false,
  });
}

/**
 * Extract client IP from request headers.
 * Works on Vercel Edge, Cloudflare, and standard proxies.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}
