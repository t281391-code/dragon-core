import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { DEPARTMENTS, ROLES, type DepartmentName, type RoleName } from "@/lib/permissions";

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: RoleName;
  department: DepartmentName;
  isActive: boolean;
};

const ROLE_NAMES = new Set<string>(Object.values(ROLES));
const DEPARTMENT_NAMES = new Set<string>(Object.values(DEPARTMENTS));

type HeaderReader = {
  get(name: string): string | null;
};

type SessionPayload = {
  id: string;
  email: string;
  role: string;
  department: string;
};

function isRoleName(value: string | null): value is RoleName {
  return typeof value === "string" && ROLE_NAMES.has(value);
}

function isDepartmentName(value: string | null): value is DepartmentName {
  return typeof value === "string" && DEPARTMENT_NAMES.has(value);
}

function userFromTrustedHeaders(requestHeaders: HeaderReader): AuthUser | null {
  const id = requestHeaders.get("x-user-id");
  const role = requestHeaders.get("x-user-role");
  const department = requestHeaders.get("x-user-department");

  if (!id || !isRoleName(role) || !isDepartmentName(department)) return null;

  const email = requestHeaders.get("x-user-email") ?? "";
  return {
    id,
    fullName: requestHeaders.get("x-user-full-name") ?? email,
    email,
    role,
    department,
    isActive: true,
  };
}

function userFromSession(session: SessionPayload | null): AuthUser | null {
  if (!session || !isRoleName(session.role) || !isDepartmentName(session.department)) return null;

  return {
    id: session.id,
    fullName: "",
    email: session.email,
    role: session.role,
    department: session.department,
    isActive: true,
  };
}

async function getRequestIdentity(): Promise<AuthUser | null> {
  const { headers } = await import("next/headers");
  const requestHeaders = await headers();
  const headerUser = userFromTrustedHeaders(requestHeaders);
  if (headerUser) return headerUser;

  const { getSession } = await import("@/lib/session");
  const session = await getSession();
  return userFromSession(session);
}

async function lookupActiveUser(userId: string): Promise<AuthUser | null> {
  const { prisma } = await import("@/lib/prisma");
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
        role: { select: { name: true } },
        department: { select: { name: true } },
      }
    });

    if (!user || !user.isActive) return null;
    if (!isRoleName(user.role.name) || !isDepartmentName(user.department.name)) return null;

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role.name,
      department: user.department.name,
      isActive: user.isActive
    };
  } catch (error) {
    console.error("Current user lookup failed.", error);
    return null;
  }
}

export async function getRequestUser(): Promise<AuthUser | null> {
  const identity = await getRequestIdentity();
  if (!identity) return null;
  return lookupActiveUser(identity.id);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  return getRequestUser();
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
