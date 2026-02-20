import { type Duration, Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL?.trim();
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

let redisInstance: Redis | null = null;
let warnedMissingEnv = false;
const ratelimitByConfigName = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redisInstance !== null) return redisInstance;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null;
  redisInstance = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  });
  return redisInstance;
}

function getOrCreateRatelimit(config: {
  name: string;
  limit: number;
  window: string;
}): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  let rl = ratelimitByConfigName.get(config.name);
  if (!rl) {
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, config.window as Duration),
    });
    ratelimitByConfigName.set(config.name, rl);
  }
  return rl;
}

/**
 * Run rate limit check for the given key with the given config.
 * Uses a sliding window. If Upstash env vars are missing, fails open (ok: true) and warns once.
 */
export async function rateLimit(
  key: string,
  config: { name: string; limit: number; window: string }
): Promise<RateLimitResult> {
  const rl = getOrCreateRatelimit(config);
  if (!rl) {
    if (!warnedMissingEnv) {
      console.warn("Rate limiting disabled: missing Upstash env");
      warnedMissingEnv = true;
    }
    return {
      ok: true,
      limit: config.limit,
      remaining: config.limit,
      reset: Math.ceil(Date.now() / 1000),
    };
  }

  const res = await rl.limit(key);
  return {
    ok: res.success,
    limit: res.limit,
    remaining: res.remaining,
    reset: res.reset,
  };
}

/** Headers-like object (Request.headers or next/headers). */
type HeadersLike = { get(name: string): string | null };

function getClientIpFromHeadersLike(headers: HeadersLike): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Get client IP from request headers.
 * Order: x-forwarded-for (first item), x-real-ip, then "unknown".
 */
export function getClientIp(request: Request): string {
  return getClientIpFromHeadersLike(request.headers);
}

/**
 * Get client IP from a headers object (e.g. from next/headers in server components).
 */
export function getClientIpFromHeaders(headers: HeadersLike): string {
  return getClientIpFromHeadersLike(headers);
}

/**
 * Build a rate-limit key from parts with basic sanitization (trim, lowercase).
 */
export function makeKey(parts: string[]): string {
  return parts
    .map((p) => String(p).trim().toLowerCase())
    .filter((p) => p.length > 0)
    .join(":");
}
