import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/auth";

const SECRET = process.env.JWT_SECRET ?? "kpi-dashboard-dev-secret-change-in-prod";
const COOKIE = "session";
const TTL = 7 * 24 * 3600; // 7 days

function b64(s: string) {
  return Buffer.from(s).toString("base64url");
}

function sign(payload: Record<string, unknown>): string {
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TTL }));
  const sig = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verify(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function createSession(user: AuthUser): Promise<void> {
  const token = sign({ id: user.id, email: user.email, role: user.role, department: user.department });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TTL,
    path: "/"
  });
  // Readable routing cookie for middleware (not sensitive — actual auth still uses httpOnly JWT)
  jar.set("rd", `${user.role}:${user.department}`, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TTL,
    path: "/"
  });
}

export async function getSession(): Promise<{ id: string; email: string; role: string; department: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  return payload as { id: string; email: string; role: string; department: string };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete("rd");
}
