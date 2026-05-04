import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, requireRole } from "@/lib/security/api";

export const preferredRegion = "sin1";

const rolePatchSchema = z.object({
  roleName: z.enum(["USER", "MODERATOR", "ADMIN"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = await checkRateLimit(request, "users:patch", 30, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(user, "ADMIN")) return forbidden("Admin permission required");

  const { id: rawId } = await params;
  const id = z.string().trim().min(1).max(128).safeParse(rawId);
  if (!id.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const parsed = rolePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role input" }, { status: 400 });
  }
  const body = parsed.data;

  if (id.data === user.id && body.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Admin cannot demote own account" }, { status: 400 });
  }

  const [role, target] = await Promise.all([
    prisma.role.findUnique({ where: { name: body.roleName }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: id.data }, select: { id: true } }),
  ]);
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id: id.data },
    data: { roleId: role.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: true,
      department: true,
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = await checkRateLimit(request, "users:delete", 20, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(user, "ADMIN")) return forbidden("Admin permission required");

  const { id: rawId } = await params;
  const id = z.string().trim().min(1).max(128).safeParse(rawId);
  if (!id.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  if (id.data === user.id) {
    return NextResponse.json({ error: "Admin cannot kick own account" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      isActive: true,
      role: { select: { name: true } },
    },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role.name === "ADMIN") {
    return NextResponse.json({ error: "Admin account cannot be kicked" }, { status: 400 });
  }

  if (!target.isActive) {
    return NextResponse.json({ ok: true, id: target.id, alreadyInactive: true });
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { isActive: false },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: target.id });
}
