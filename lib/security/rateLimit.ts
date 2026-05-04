import { NextResponse } from "next/server";

type BucketEntry = {
  hits: number[];
};

const buckets = new Map<string, BucketEntry>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

type UpstashPipelineItem = {
  result?: unknown;
  error?: string;
};

function upstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

function memorySlidingWindowLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const current = buckets.get(key) ?? { hits: [] };
  current.hits = current.hits.filter((timestamp) => timestamp > cutoff);

  if (current.hits.length >= limit) {
    buckets.set(key, current);
    return {
      ok: false,
      remaining: 0,
      resetAt: current.hits[0] + windowMs,
    };
  }

  current.hits.push(now);
  buckets.set(key, current);
  return {
    ok: true,
    remaining: Math.max(0, limit - current.hits.length),
    resetAt: now + windowMs,
  };
}

async function redisSlidingWindowLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const config = upstashConfig();
  if (!config) return null;

  const now = Date.now();
  const cutoff = now - windowMs;
  const member = `${now}:${Math.random().toString(36).slice(2)}`;

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify([
      ["ZREMRANGEBYSCORE", key, 0, cutoff],
      ["ZADD", key, now, member],
      ["ZCARD", key],
      ["ZRANGE", key, 0, 0, "WITHSCORES"],
      ["PEXPIRE", key, windowMs],
    ]),
  }).catch(() => null);

  if (!response?.ok) return null;

  const data = await response.json().catch(() => null) as UpstashPipelineItem[] | null;
  if (!Array.isArray(data) || data.some((item) => item.error)) return null;

  const count = Number(data[2]?.result ?? 0);
  if (!Number.isFinite(count)) return null;

  const oldest = data[3]?.result;
  let oldestTimestamp = now;
  if (Array.isArray(oldest) && oldest.length >= 2) {
    const candidate = Number(oldest[1]);
    if (Number.isFinite(candidate)) oldestTimestamp = candidate;
  }

  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: count <= limit ? now + windowMs : oldestTimestamp + windowMs,
  };
}

export async function slidingWindowLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redisResult = await redisSlidingWindowLimit(key, limit, windowMs);
  return redisResult ?? memorySlidingWindowLimit(key, limit, windowMs);
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.resetAt),
      },
    }
  );
}
