import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, normalizePageLimit, requireDepartmentRead, requireDepartmentWrite, safeInternalError } from "@/lib/security/api";

export const preferredRegion = "sin1";

const dateInput = z.string().trim().min(1).max(64).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");

const waybillHeaderSchema = z.object({
  orgName: z.string().trim().max(160).default(""),
  driverName: z.string().trim().max(160).default(""),
  equipmentModel: z.string().trim().max(160).default(""),
  plateNumber: z.string().trim().max(80).default(""),
  reportDate: z.string().trim().max(64).default(""),
  year: z.string().trim().max(16).default(""),
  month: z.string().trim().max(16).default(""),
  day: z.string().trim().max(16).default(""),
  routeNote: z.string().trim().max(500).default(""),
});

const waybillRowSchema = z.object({
  id: z.string().trim().max(80).default(""),
  monthDay: z.string().trim().max(32).default(""),
  operator: z.string().trim().max(160).default(""),
  purpose: z.string().trim().max(500).default(""),
  motoStart: z.string().trim().max(64).default(""),
  motoEnd: z.string().trim().max(64).default(""),
  motoUsed: z.string().trim().max(64).default(""),
  dieselRemain: z.string().trim().max(64).default(""),
  dieselTaken: z.string().trim().max(64).default(""),
  dieselUsed: z.string().trim().max(64).default(""),
  userPosition: z.string().trim().max(160).default(""),
  userName: z.string().trim().max(160).default(""),
  signature: z.string().trim().max(160).default(""),
  note: z.string().trim().max(500).default(""),
});

const waybillBodySchema = z.object({
  title: z.string().trim().min(1).max(191),
  reportDate: dateInput,
  header: waybillHeaderSchema,
  rows: z.array(waybillRowSchema).min(1).max(31),
});

const waybillPatchSchema = waybillBodySchema.extend({
  id: z.string().trim().min(1).max(128),
});

const waybillSelect = {
  id: true,
  title: true,
  header: true,
  rows: true,
  reportDate: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { fullName: true } },
} as const;

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentRead(user, "LOGISTICS")) return forbidden("Logistics access required");

  const { searchParams } = new URL(request.url);
  const limit = normalizePageLimit(searchParams.get("limit"), 20, 100);

  const waybills = await prisma.transportWaybill.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: waybillSelect,
  });

  return NextResponse.json({ data: waybills });
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "transport-waybills:post", 40, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "LOGISTICS")) return forbidden("Logistics write permission required");

  const parsed = waybillBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid waybill input" }, { status: 400 });
  }

  try {
    const body = parsed.data;
    const waybill = await prisma.transportWaybill.create({
      data: {
        title: body.title,
        header: body.header,
        rows: body.rows,
        reportDate: new Date(body.reportDate),
        createdById: user.id,
      },
      select: waybillSelect,
    });

    return NextResponse.json({ data: waybill }, { status: 201 });
  } catch (error) {
    return safeInternalError(error, "Waybill save failed");
  }
}

export async function PATCH(request: Request) {
  const rateLimited = await checkRateLimit(request, "transport-waybills:patch", 40, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "LOGISTICS")) return forbidden("Logistics write permission required");

  const parsed = waybillPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid waybill update input" }, { status: 400 });
  }

  try {
    const body = parsed.data;
    const existing = await prisma.transportWaybill.findUnique({
      where: { id: body.id },
      select: { id: true, createdById: true },
    });
    if (!existing) return NextResponse.json({ error: "Waybill not found" }, { status: 404 });
    if (user.role !== "ADMIN" && existing.createdById !== user.id) {
      return forbidden("Only creator or admin can update this waybill");
    }

    const waybill = await prisma.transportWaybill.update({
      where: { id: body.id },
      data: {
        title: body.title,
        header: body.header,
        rows: body.rows,
        reportDate: new Date(body.reportDate),
      },
      select: waybillSelect,
    });

    return NextResponse.json({ data: waybill });
  } catch (error) {
    return safeInternalError(error, "Waybill update failed");
  }
}
