import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { checkRateLimit, forbidden, normalizePageLimit, requireRole } from "@/lib/security/api";

const userCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(6).max(256),
  roleId: z.string().trim().min(1).max(128),
  departmentId: z.string().trim().min(1).max(128),
  isActive: z.boolean().optional().default(true),
});

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  role: true,
  department: true,
} as const;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim();
  const hasSearch = query.length > 0;
  const includeInactive = searchParams.get("includeInactive") === "1";

  if (query.length > 120) {
    return NextResponse.json({ error: "Search query is too long" }, { status: 400 });
  }

  if (!hasSearch && !requireRole(user, "ADMIN")) {
    return forbidden("Admin permission required");
  }

  if (hasSearch) {
    if (!requireRole(user, "MODERATOR")) return forbidden("Member search permission required");

    const limit = normalizePageLimit(searchParams.get("limit"), 10, 25);
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { fullName: { contains: query } },
          { email: { contains: query } },
        ],
      },
      orderBy: { fullName: "asc" },
      take: limit,
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
        role: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    return NextResponse.json({ data: users });
  }

  const users = await prisma.user.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { fullName: "asc" },
    select: userSelect,
  });

  return NextResponse.json({ data: users });
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "users:post", 30, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(user, "ADMIN")) return forbidden("Admin permission required");

  const parsed = userCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user input" }, { status: 400 });
  }
  const body = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const [role, department] = await Promise.all([
    prisma.role.findUnique({ where: { id: body.roleId }, select: { id: true } }),
    prisma.department.findUnique({ where: { id: body.departmentId }, select: { id: true } }),
  ]);
  if (!role || !department) {
    return NextResponse.json({ error: "Role or department not found" }, { status: 404 });
  }

  const newUser = await prisma.user.create({
    data: {
      fullName: body.fullName,
      email: body.email,
      passwordHash: hashPassword(body.password),
      roleId: role.id,
      departmentId: department.id,
      isActive: body.isActive,
    },
    select: userSelect,
  });

  return NextResponse.json({ data: newUser }, { status: 201 });
}
