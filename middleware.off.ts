import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/register"];
const API_PUBLIC_PATHS = ["/api/auth/login", "/api/auth/register"];

const DEPT_HOME: Record<string, string> = {
  WAREHOUSE: "/warehouse",
  PRODUCTION: "/production",
  SAFETY: "/safety",
  LOGISTICS: "/logistics"
};

const DEPT_ROUTES = ["/warehouse", "/production", "/safety", "/logistics"];
const ADMIN_ONLY_ROUTES = ["/users"];
const DEFAULT_HOME = "/warehouse";

function homeFor(department: string) {
  return DEPT_HOME[department] ?? DEFAULT_HOME;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (API_PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const session = request.cookies.get("session");
  if (!session?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const rd = request.cookies.get("rd")?.value ?? "";
  const [role, department] = rd.split(":");
  if (!role || !department) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL(homeFor(department), request.url));
  }

  // Admin-only pages (users management)
  if (ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL(homeFor(department), request.url));
    }
    return NextResponse.next();
  }

  // Department pages
  const accessedDept = DEPT_ROUTES.find(r => pathname.startsWith(r));
  if (accessedDept) {
    // ADMIN: access all
    if (role === "ADMIN") return NextResponse.next();
    // Non-admin users: only their own department
    if (accessedDept !== DEPT_HOME[department]) {
      return NextResponse.redirect(new URL(homeFor(department), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
