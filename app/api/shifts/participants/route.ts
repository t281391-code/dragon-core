import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { forbidden, requireRole } from "@/lib/security/api";

const bodySchema = z.object({ userId: z.string().min(1) });

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(user, "MODERATOR")) return forbidden("Зөвхөн менежер болон админ нэмэх боломжтой");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { userId } = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });
  if (!target || !target.isActive) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const participant = await prisma.shiftParticipant.upsert({
    where:  { userId },
    update: {},
    create: { userId },
    select: { userId: true, addedAt: true },
  });

  return NextResponse.json({ data: participant }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(user, "MODERATOR")) return forbidden("Зөвхөн менежер болон админ хасах боломжтой");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { userId } = parsed.data;

  const existing = await prisma.shiftParticipant.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  await prisma.shiftParticipant.delete({ where: { userId } });

  return NextResponse.json({ ok: true });
}
