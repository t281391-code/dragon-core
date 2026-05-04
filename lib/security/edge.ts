import { NextResponse, type NextRequest } from "next/server";

const BLOCK_COOKIE = "dragon_hp";
const BLOCK_TTL_SECONDS = 60 * 60;
const MAX_URL_LENGTH = 2048;
const MAX_HEADER_VALUE_LENGTH = 8192;

const SQLI_PATTERNS = [
  /\bunion\s+select\b/i,
  /\bselect\b.+\bfrom\b/i,
  /\bdrop\s+table\b/i,
  /\binsert\s+into\b/i,
  /\bdelete\s+from\b/i,
  /\bupdate\b.+\bset\b/i,
  /\bexec\s*\(/i,
  /\bor\s+1\s*=\s*1\b/i,
  /--\s*$/,
];

const XSS_PATTERNS = [
  /<\s*script\b/i,
  /javascript\s*:/i,
  /\bon(?:error|load|click|mouseover)\s*=/i,
  /document\s*\.\s*cookie/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e%2f/i,
  /%2e%2e%5c/i,
  /\.\.%2f/i,
  /\.\.%5c/i,
];

const BAD_USER_AGENT_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /nessus/i,
  /burpsuite/i,
  /nuclei/i,
  /acunetix/i,
  /wpscan/i,
  /dirbuster/i,
  /gobuster/i,
  /masscan/i,
  /zgrab/i,
];

export type WafBlockReason =
  | "blocked-ip"
  | "url-too-long"
  | "header-too-long"
  | "bad-user-agent"
  | "sql-injection"
  | "xss"
  | "path-traversal";

function upstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

function blockKey(ip: string) {
  return `dragon:block:${ip}`;
}

export function getClientIpFromHeaders(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

export function honeypotCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: BLOCK_TTL_SECONDS,
    path: "/",
  };
}

export async function blockIp(ip: string) {
  const config = upstashConfig();
  if (!config || ip === "unknown") return;

  await fetch(`${config.url}/set/${encodeURIComponent(blockKey(ip))}/1?EX=${BLOCK_TTL_SECONDS}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
  }).catch(() => undefined);
}

async function isIpBlocked(ip: string) {
  const config = upstashConfig();
  if (!config || ip === "unknown") return false;

  const response = await fetch(`${config.url}/get/${encodeURIComponent(blockKey(ip))}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) return false;
  const data = (await response.json().catch(() => null)) as { result?: string | null } | null;
  return data?.result === "1";
}

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

export async function inspectRequest(request: NextRequest): Promise<WafBlockReason | null> {
  const ip = getClientIpFromHeaders(request.headers);
  if (request.cookies.get(BLOCK_COOKIE)?.value === "1" || await isIpBlocked(ip)) return "blocked-ip";

  const rawTarget = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const decodedTarget = safeDecode(rawTarget);
  if (rawTarget.length > MAX_URL_LENGTH) return "url-too-long";

  for (const [, value] of request.headers) {
    if (value.length > MAX_HEADER_VALUE_LENGTH) return "header-too-long";
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  if (matchesAny(userAgent, BAD_USER_AGENT_PATTERNS)) return "bad-user-agent";

  const inspectable = `${rawTarget} ${decodedTarget}`;
  if (matchesAny(inspectable, PATH_TRAVERSAL_PATTERNS)) return "path-traversal";
  if (matchesAny(inspectable, XSS_PATTERNS)) return "xss";
  if (matchesAny(inspectable, SQLI_PATTERNS)) return "sql-injection";

  return null;
}

export function blockedResponse(reason: WafBlockReason) {
  if (reason === "blocked-ip") {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.json({ error: "Request blocked" }, { status: 403 });
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
