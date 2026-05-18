import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getJwtSecret } from "@/lib/env";
import { blockedResponse, inspectRequest } from "@/lib/security/edge";

const PUBLIC_PATHS = ["/", "/login", "/thesis"];
const API_PUBLIC_PATHS = ["/api/auth/login", "/api/auth/register"];
const STATIC_EXT = /\.(glb|gltf|fbx|obj|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|otf|mp4|mp3|pdf)$/i;

const DEPT_HOME: Record<string, string> = {
  WAREHOUSE: "/warehouse",
  PRODUCTION: "/production",
  SAFETY: "/safety",
  LOGISTICS: "/logistics"
};

const DEPT_ROUTES = ["/warehouse", "/production", "/safety", "/logistics"];
const AUTHENTICATED_ROUTES = ["/agent", "/shifts"];
const ADMIN_ONLY_ROUTES = ["/users"];
const DEFAULT_HOME = "/warehouse";
const SESSION_SECRET = getJwtSecret();
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function homeFor(department: string) {
  return DEPT_HOME[department] ?? DEFAULT_HOME;
}

type VerifiedSession = {
  id: string;
  email?: string;
  role: string;
  department: string;
};

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function base64UrlToString(value: string) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

async function verifySessionToken(token: string): Promise<VerifiedSession | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(signature),
    new TextEncoder().encode(`${header}.${body}`),
  );
  if (!valid) return null;

  const payload = JSON.parse(base64UrlToString(body)) as Record<string, unknown>;
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.id !== "string" || typeof payload.role !== "string" || typeof payload.department !== "string") {
    return null;
  }

  return {
    id: payload.id,
    email: typeof payload.email === "string" ? payload.email : undefined,
    role: payload.role,
    department: payload.department,
  };
}

async function getVerifiedSession(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) return null;
  return verifySessionToken(token).catch(() => null);
}

function nextWithSessionHeaders(request: NextRequest, session: VerifiedSession | null) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-email");
  requestHeaders.delete("x-user-role");
  requestHeaders.delete("x-user-department");
  requestHeaders.delete("x-user-full-name");

  if (session) {
    requestHeaders.set("x-user-id", session.id);
    if (session.email) requestHeaders.set("x-user-email", session.email);
    requestHeaders.set("x-user-role", session.role);
    requestHeaders.set("x-user-department", session.department);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

function validateSameOriginApiMutation(request: NextRequest) {
  if (SAFE_METHODS.has(request.method) || !request.nextUrl.pathname.startsWith("/api/")) return null;

  const origin = request.headers.get("origin");
  if (origin) {
    return origin === request.nextUrl.origin
      ? null
      : NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === request.nextUrl.origin
        ? null
        : NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Origin header required" }, { status: 403 });
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const blockReason = await inspectRequest(request);
  if (blockReason) return blockedResponse(blockReason);

  const sameOriginBlock = validateSameOriginApiMutation(request);
  if (sameOriginBlock) return sameOriginBlock;

  const verifiedSession = await getVerifiedSession(request);

  if (pathname === "/register") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (PUBLIC_PATHS.includes(pathname)) return nextWithSessionHeaders(request, verifiedSession);
  if (STATIC_EXT.test(pathname)) return nextWithSessionHeaders(request, verifiedSession);
  if (API_PUBLIC_PATHS.some(p => pathname.startsWith(p))) return nextWithSessionHeaders(request, verifiedSession);
  if (pathname.startsWith("/api/")) return nextWithSessionHeaders(request, verifiedSession);

  if (!verifiedSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { role, department } = verifiedSession;

  if (pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL(homeFor(department), request.url));
  }

  if (AUTHENTICATED_ROUTES.some(r => pathname.startsWith(r))) {
    return nextWithSessionHeaders(request, verifiedSession);
  }

  if (ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL(homeFor(department), request.url));
    }
    return nextWithSessionHeaders(request, verifiedSession);
  }

  const accessedDept = DEPT_ROUTES.find(r => pathname.startsWith(r));
  if (accessedDept) {
    if (role === "ADMIN") return nextWithSessionHeaders(request, verifiedSession);
    if (accessedDept !== DEPT_HOME[department]) {
      return NextResponse.redirect(new URL(homeFor(department), request.url));
    }
  }

  return nextWithSessionHeaders(request, verifiedSession);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
