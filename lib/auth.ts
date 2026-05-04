import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import type { DepartmentName, RoleName } from "@/lib/permissions";

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: RoleName;
  department: DepartmentName;
  isActive: boolean;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { headers } = await import("next/headers");
  const requestHeaders = await headers();
  let userId = requestHeaders.get("x-user-id");

  if (!userId) {
    const { getSession } = await import("@/lib/session");
    const session = await getSession();
    if (!session) return null;
    userId = session.id;
  }

  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, department: true }
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.name as RoleName,
    department: user.department.name as DepartmentName,
    isActive: user.isActive
  };
}

export async function requireCurrentUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 3) return false;
    const [, salt, hash] = parts;
    const derived = scryptSync(password, salt, 64);
    return timingSafeEqual(Buffer.from(hash, "hex"), derived);
  } catch {
    return false;
  }
}
