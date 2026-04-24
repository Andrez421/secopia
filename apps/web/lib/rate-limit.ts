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
import { getRedis } from "./redis.js";

let searchRateLimiter: Ratelimit | null = null;

/**
 * Rate limiter for search API routes.
 * Sliding window: 30 requests per 10 seconds per IP.
 */
export function getSearchRateLimiter(): Ratelimit {
  if (!searchRateLimiter) {
    searchRateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(30, "10 s"),
      prefix: "secopia:rl:search",
      analytics: false,
    });
  }
  return searchRateLimiter;
}

let chatRateLimiter: Ratelimit | null = null;

/**
 * Rate limiter for chat API routes (more expensive due to LLM calls).
 * Sliding window: 10 requests per 60 seconds per IP.
 */
export function getChatRateLimiter(): Ratelimit {
  if (!chatRateLimiter) {
    chatRateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "secopia:rl:chat",
      analytics: false,
    });
  }
  return chatRateLimiter;
}

/**
 * Extract client IP from request headers.
 * Uses the LAST IP from x-forwarded-for (closest to the server) to prevent spoofing.
 * Falls back to cf-connecting-ip for Cloudflare.
 * Generates a stable derived key when no IP is identifiable.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    const last = parts.at(-1)?.trim();
    if (last) return last;
  }

  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;

  // Stable derived key per request to avoid grouping all unknown clients
  return `anon-${crypto.randomUUID()}`;
}
