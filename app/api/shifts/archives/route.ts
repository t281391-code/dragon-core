import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { forbidden, requireRole, safeInternalError } from "@/lib/security/api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHIFT_HOURS: Record<string, number> = {
  day: 12,
  night: 12,
  rest: 0,
  leave: 0,
  sick: 0,
};

const archiveSchema = z.object({
  startDate: z.string().regex(DATE_RE),
  endDate: z.string().regex(DATE_RE),
  title: z.string().trim().min(1).max(160).optional(),
});

function keyToUtcDate(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

function dateKeyUtc(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function shortDateLabel(key: string) {
  const [, month, day] = key.split("-").map(Number);
  return `${month}/${day}`;
}

function makeDays(startDate: string, endDate: string) {
  const start = keyToUtcDate(startDate);
  const end = keyToUtcDate(endDate);
  const days: { key: string; label: string }[] = [];

  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const key = dateKeyUtc(cursor);
    days.push({ key, label: shortDateLabel(key) });
  }

  return days;
}

const archiveSelect = {
  id: true,
  startDate: true,
  endDate: true,
  title: true,
  snapshot: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { fullName: true, email: true } },
} as const;

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  try {
    if (id) {
      const archive = await prisma.shiftArchive.findUnique({
        where: { id },
        select: archiveSelect,
      });
      if (!archive) return NextResponse.json({ error: "Archive not found" }, { status: 404 });
      return NextResponse.json({ data: archive });
    }

    const archives = await prisma.shiftArchive.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { fullName: true, email: true } },
      },
    });

    return NextResponse.json({ data: archives });
  } catch (error) {
    return safeInternalError(error, "Shift archive fetch failed");
  }
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(user, "MODERATOR")) return forbidden("Only managers and admins can archive shifts");

  const parsed = archiveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid archive input" }, { status: 400 });

  const { startDate, endDate } = parsed.data;
  if (startDate > endDate) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const days = makeDays(startDate, endDate);
  if (days.length === 0 || days.length > 31) {
    return NextResponse.json({ error: "Archive range must be 1-31 days" }, { status: 400 });
  }

  try {
    const [participants, entries] = await Promise.all([
      prisma.shiftParticipant.findMany({
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              mrCode: true,
              isActive: true,
              role: { select: { name: true } },
              department: { select: { name: true } },
            },
          },
        },
      }),
      prisma.shiftEntry.findMany({
        where: { date: { gte: startDate, lte: endDate } },
        select: { userId: true, date: true, shiftCode: true, overtimeHours: true },
      }),
    ]);

    const activeUsers = participants
      .filter((participant) => participant.user.isActive)
      .map((participant) => participant.user)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const entryMap = new Map(entries.map((entry) => [`${entry.userId}:${entry.date}`, entry]));
    const snapshot = {
      version: 1,
      startDate,
      endDate,
      archivedAt: new Date().toISOString(),
      days,
      users: activeUsers.map((archiveUser) => {
        const totalHours = days.reduce((sum, day) => {
          const entry = entryMap.get(`${archiveUser.id}:${day.key}`);
          if (!entry) return sum;
          return sum + (SHIFT_HOURS[entry.shiftCode] ?? 0) + entry.overtimeHours;
        }, 0);

        return {
          id: archiveUser.id,
          fullName: archiveUser.fullName,
          mrCode: archiveUser.mrCode,
          roleName: archiveUser.role.name,
          departmentName: archiveUser.department.name,
          totalHours,
        };
      }),
      entries: entries.map((entry) => ({
        userId: entry.userId,
        date: entry.date,
        shiftCode: entry.shiftCode,
        overtimeHours: entry.overtimeHours,
      })),
    } satisfies Prisma.InputJsonObject;

    const title = parsed.data.title ?? `${startDate} - ${endDate} ээлжийн архив`;
    const archive = await prisma.shiftArchive.upsert({
      where: { startDate_endDate: { startDate, endDate } },
      update: {
        title,
        snapshot,
        createdById: user.id,
      },
      create: {
        startDate,
        endDate,
        title,
        snapshot,
        createdById: user.id,
      },
      select: archiveSelect,
    });

    return NextResponse.json({ data: archive });
  } catch (error) {
    return safeInternalError(error, "Shift archive save failed");
  }
}
