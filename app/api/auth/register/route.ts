import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { blockIp, getClientIpFromHeaders, honeypotCookieOptions } from "@/lib/security/edge";
import { checkRateLimit } from "@/lib/security/api";
import type { RoleName, DepartmentName } from "@/lib/permissions";

export const preferredRegion = "hkg1";

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(6).max(256),
  departmentName: z.enum(["WAREHOUSE", "PRODUCTION", "SAFETY", "LOGISTICS"]),
  website: z.string().max(200).optional().default(""),
});

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "auth:register", 10, 60_000);
  if (rateLimited) return rateLimited;

  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Бүх талбарыг зөв бөглөнө үү" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.website.trim()) {
    await blockIp(getClientIpFromHeaders(request.headers));
    const response = new NextResponse("Not found", { status: 404 });
    response.cookies.set("dragon_hp", "1", honeypotCookieOptions());
    return response;
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Энэ имэйл бүртгэлтэй байна" }, { status: 409 });
  }

  const [userRole, department] = await Promise.all([
    prisma.role.findUnique({ where: { name: "USER" }, select: { id: true } }),
    prisma.department.findUnique({ where: { name: body.departmentName }, select: { id: true } }),
  ]);

  if (!userRole || !department) {
    return NextResponse.json({ error: "Систем бэлтгэгдэж байна, дахин оролдоно уу" }, { status: 500 });
  }

  const user = await prisma.user.create({
    data: {
      fullName: body.fullName,
      email: body.email,
      passwordHash: hashPassword(body.password),
      roleId: userRole.id,
      departmentId: department.id,
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      role: { select: { name: true } },
      department: { select: { name: true } },
    },
  });

  const authUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.name as RoleName,
    department: user.department.name as DepartmentName,
    isActive: user.isActive,
  };

  await createSession(authUser);

  return NextResponse.json({ user: authUser }, { status: 201 });
}
