import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { blockIp, getClientIpFromHeaders, honeypotCookieOptions } from "@/lib/security/edge";
import { checkRateLimit } from "@/lib/security/api";
import type { RoleName, DepartmentName } from "@/lib/permissions";

export const preferredRegion = "hkg1";

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256),
  website: z.string().max(200).optional().default(""),
});

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "auth:login", 20, 60_000);
  if (rateLimited) return rateLimited;

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email ба нууц үг шаардлагатай" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.website.trim()) {
    await blockIp(getClientIpFromHeaders(request.headers));
    const response = new NextResponse("Not found", { status: 404 });
    response.cookies.set("dragon_hp", "1", honeypotCookieOptions());
    return response;
  }

  const user = await prisma.user.findUnique({
    where: { email: body.email },
    select: {
      id: true,
      fullName: true,
      email: true,
      passwordHash: true,
      isActive: true,
      role: { select: { name: true } },
      department: { select: { name: true } },
    },
  });

  if (!user || !user.isActive || !verifyPassword(body.password, user.passwordHash)) {
    return NextResponse.json({ error: "Email эсвэл нууц үг буруу байна" }, { status: 401 });
  }

  const authUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.name as RoleName,
    department: user.department.name as DepartmentName,
    isActive: user.isActive,
  };

  await createSession(authUser);

  return NextResponse.json({ user: authUser });
}
