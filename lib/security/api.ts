import { NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth";
import { getClientIpFromHeaders } from "@/lib/security/edge";
import { rateLimitResponse, slidingWindowLimit } from "@/lib/security/rateLimit";
import type { DepartmentName, RoleName } from "@/lib/permissions";

const ROLE_LEVEL: Record<RoleName, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
};

export function requireRole(user: AuthUser, minimumRole: RoleName) {
  return ROLE_LEVEL[user.role] >= ROLE_LEVEL[minimumRole];
}

export function requireDepartmentWrite(user: AuthUser, department: DepartmentName) {
  if (!requireRole(user, "MODERATOR")) return false;
  if (user.role === "ADMIN") return true;
  return user.department === department;
}

export function forbidden(message = "Permission denied") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function checkRateLimit(request: Request, scope: string, limit: number, windowMs: number) {
  const ip = getClientIpFromHeaders(request.headers);
  const result = await slidingWindowLimit(`${scope}:${ip}`, limit, windowMs);
  return result.ok ? null : rateLimitResponse(result);
}

export function normalizePageLimit(value: string | null, fallback = 50, max = 200) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}
