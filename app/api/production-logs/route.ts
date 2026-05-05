import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, normalizePageLimit, requireDepartmentWrite } from "@/lib/security/api";

export const preferredRegion = "sin1";

const dateInput = z.string().trim().min(1).max(64).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");
const nullableDateInput = z.preprocess((value) => value === "" ? null : value, dateInput.nullable().optional());

const productionLogSchema = z.object({
  lotNumber: z.string().trim().max(80).optional(),
  productionDate: dateInput,
  shift: z.string().trim().max(80).optional(),
  productName: z.string().trim().min(1).max(160),
  outputQuantity: z.coerce.number().positive().max(1_000_000_000),
  dailyTargetQuantity: z.coerce.number().positive().max(1_000_000_000).nullable().optional(),
  scheduledDate: nullableDateInput,
  destinationMine: z.string().trim().max(160).nullable().optional(),
  status: z.string().trim().max(40).optional(),
  materialId: z.string().min(1).max(128).nullable().optional(),
  quantityUsed: z.coerce.number().min(0).max(1_000_000_000).optional(),
  downtimeMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  workerInfo: z.string().trim().max(4000).nullable().optional(),
  density: z.coerce.number().positive().max(1000),
  note: z.string().trim().max(4000).nullable().optional(),
});

const shipmentPatchSchema = z.object({
  id: z.string().min(1).max(128),
  scheduledDate: dateInput,
  destinationMine: z.string().trim().min(1).max(160),
  productName: z.string().trim().min(1).max(160),
  shipmentQuantity: z.coerce.number().positive().max(1_000_000_000),
});

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = normalizePageLimit(searchParams.get("limit"), 50, 200);
  const now = new Date();
  const planStart = new Date(now);
  planStart.setDate(now.getDate() - 6);
  planStart.setHours(0, 0, 0, 0);
  const planEnd = new Date(now);
  planEnd.setDate(now.getDate() + 7);
  planEnd.setHours(23, 59, 59, 999);

  type ProductionLogRow = {
    id: string;
    lotNumber: string;
    productionDate: Date;
    productName: string;
    outputQuantity: number;
    quantityUsed: number;
    scheduledDate: Date | null;
    destinationMine: string | null;
    status: string;
    workerInfo: string | null;
    density: number | null;
    note: string | null;
    materialName: string;
    materialUnit: string;
    createdByFullName: string;
  };

  const [logRows, plans] = await Promise.all([
    prisma.$queryRaw<ProductionLogRow[]>(Prisma.sql`
      SELECT
        pl.id,
        pl.lotNumber,
        pl.productionDate,
        pl.productName,
        pl.outputQuantity,
        pl.quantityUsed,
        pl.scheduledDate,
        pl.destinationMine,
        pl.status,
        pl.workerInfo,
        pl.density,
        pl.note,
        m.name AS materialName,
        m.unit AS materialUnit,
        u.fullName AS createdByFullName
      FROM \`ProductionLog\` pl
      INNER JOIN \`Material\` m ON m.id = pl.materialId
      INNER JOIN \`User\` u ON u.id = pl.createdById
      ORDER BY pl.productionDate DESC
      LIMIT ${limit}
    `),
    prisma.dailyProductionPlan.findMany({
      where: { planDate: { gte: planStart, lte: planEnd } },
      orderBy: { planDate: "asc" },
      select: {
        id: true,
        planDate: true,
        targetQuantity: true,
      },
    }),
  ]);

  const logs = logRows.map((row) => ({
    id: row.id,
    lotNumber: row.lotNumber,
    productionDate: row.productionDate,
    productName: row.productName,
    outputQuantity: row.outputQuantity,
    shipmentQuantity: row.quantityUsed,
    scheduledDate: row.scheduledDate,
    destinationMine: row.destinationMine,
    status: row.status,
    workerInfo: row.workerInfo,
    density: row.density,
    note: row.note,
    material: { name: row.materialName, unit: row.materialUnit },
    createdBy: { fullName: row.createdByFullName },
  }));

  return NextResponse.json({ data: logs, plans });
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "production-logs:post", 60, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "PRODUCTION")) return forbidden("Production write permission required");

  const parsed = productionLogSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid production log input" }, { status: 400 });
  }
  const body = parsed.data;
  const productionDate = new Date(body.productionDate);

  const log = await prisma.$transaction(async (tx) => {
    let materialId = body.materialId ?? "";
    if (!materialId) {
      const fallbackMaterial = await tx.material.findFirst({
        where: { name: "Үйлдвэрлэлийн ерөнхий материал" },
        select: { id: true },
      });
      materialId = fallbackMaterial?.id ?? (await tx.material.create({
        data: {
          name: "Үйлдвэрлэлийн ерөнхий материал",
          category: "Үйлдвэрлэл",
          unit: "КГ",
          currentStock: 0,
          minimumStock: 0,
          maximumStock: 0,
          location: "Үйлдвэрлэл",
        },
        select: { id: true },
      })).id;
    }

    const created = await tx.productionLog.create({
      data: {
        lotNumber: body.lotNumber || `LOT-${Date.now()}`,
        productionDate,
        shift: body.shift ?? "day",
        productName: body.productName,
        outputQuantity: body.outputQuantity,
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
        destinationMine: body.destinationMine || null,
        status: body.status ?? "ready",
        materialId,
        quantityUsed: body.quantityUsed ?? 0,
        downtimeMinutes: body.downtimeMinutes ?? 0,
        workerInfo: body.workerInfo || null,
        density: body.density,
        note: body.note || null,
        createdById: user.id,
      },
    });

    if (body.dailyTargetQuantity) {
      await tx.dailyProductionPlan.upsert({
        where: { planDate: productionDate },
        update: {
          targetQuantity: body.dailyTargetQuantity,
          createdById: user.id,
        },
        create: {
          planDate: productionDate,
          targetQuantity: body.dailyTargetQuantity,
          createdById: user.id,
        },
      });
    }

    return created;
  });

  return NextResponse.json({ data: log }, { status: 201 });
}

export async function DELETE(request: Request) {
  const rateLimited = await checkRateLimit(request, "production-logs:delete", 30, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "PRODUCTION")) return forbidden("Production delete permission required");

  const { searchParams } = new URL(request.url);
  const id = z.string().min(1).max(128).safeParse(searchParams.get("id"));
  if (!id.success) {
    return NextResponse.json({ error: "Production log id is required" }, { status: 400 });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.productionLog.findUnique({
      where: { id: id.data },
      select: { id: true },
    });

    if (!existing) throw new Error("NOT_FOUND");

    await tx.productionLog.delete({ where: { id: id.data } });
    return true;
  }).catch((error) => {
    if (error instanceof Error && error.message === "NOT_FOUND") return null;
    throw error;
  });

  if (!deleted) {
    return NextResponse.json({ error: "Production log not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: id.data });
}

export async function PATCH(request: Request) {
  const rateLimited = await checkRateLimit(request, "production-logs:patch", 60, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "PRODUCTION")) return forbidden("Production update permission required");

  const parsed = shipmentPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid shipment input" }, { status: 400 });
  }
  const body = parsed.data;

  const log = await prisma.$transaction((tx) =>
    tx.productionLog.update({
      where: { id: body.id },
      data: {
        scheduledDate: new Date(body.scheduledDate),
        destinationMine: body.destinationMine,
        productName: body.productName,
        quantityUsed: body.shipmentQuantity,
      },
      select: {
        id: true,
        productName: true,
        outputQuantity: true,
        quantityUsed: true,
        scheduledDate: true,
        destinationMine: true,
      },
    })
  );

  return NextResponse.json({ data: log });
}
