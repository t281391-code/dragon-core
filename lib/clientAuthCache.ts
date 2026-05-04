"use client";

export type ClientSessionUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  isActive: boolean;
};

const AUTH_USER_CACHE_KEY = "dragon-city.auth-user.v1";

function isClientSessionUser(value: unknown): value is ClientSessionUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<ClientSessionUser>;
  return (
    typeof user.id === "string" &&
    typeof user.fullName === "string" &&
    typeof user.email === "string" &&
    typeof user.role === "string" &&
    typeof user.department === "string" &&
    typeof user.isActive === "boolean"
  );
}

export function readCachedSessionUser(): ClientSessionUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_USER_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isClientSessionUser(parsed)) {
      window.localStorage.removeItem(AUTH_USER_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedSessionUser(user: ClientSessionUser | null) {
  if (typeof window === "undefined") return;

  if (!user) {
    window.localStorage.removeItem(AUTH_USER_CACHE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(user));
}

export function clearCachedSessionUser() {
  writeCachedSessionUser(null);
}
