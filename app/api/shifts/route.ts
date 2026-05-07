import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { forbidden, requireRole } from "@/lib/security/api";

const VALID_CODES = new Set(["day", "night", "rest", "leave", "sick"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const putSchema = z.object({
  userId:        z.string().min(1),
  date:          z.string().regex(DATE_RE),
  shiftCode:     z.string().refine((v) => VALID_CODES.has(v), { message: "Invalid shift code" }),
  overtimeHours: z.number().int().min(0).max(24).optional().default(0),
});

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to   = searchParams.get("to")   ?? "";

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "Missing or invalid from/to date params" }, { status: 400 });
  }

  const [participants, entries] = await Promise.all([
    prisma.shiftParticipant.findMany({
      include: {
        user: {
          select: {
            id:         true,
            fullName:   true,
            mrCode:     true,
            isActive:   true,
            role:       { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    }),
    prisma.shiftEntry.findMany({
      where: { date: { gte: from, lte: to } },
      select: { userId: true, date: true, shiftCode: true, overtimeHours: true },
    }),
  ]);

  const users = participants
    .filter((p) => p.user.isActive)
    .map((p) => p.user)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return NextResponse.json({ users, entries });
}

export async function PUT(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(user, "MODERATOR")) return forbidden("Зөвхөн менежер болон админ засах боломжтой");

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { userId, date, shiftCode, overtimeHours } = parsed.data;

  const target = await prisma.shiftParticipant.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User is not a shift participant" }, { status: 404 });
  }

  const entry = await prisma.shiftEntry.upsert({
    where:  { userId_date: { userId, date } },
    update: { shiftCode, overtimeHours },
    create: { userId, date, shiftCode, overtimeHours },
    select: { userId: true, date: true, shiftCode: true, overtimeHours: true },
  });

  return NextResponse.json({ data: entry });
}
