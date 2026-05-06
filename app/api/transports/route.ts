import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, normalizePageLimit, requireDepartmentRead, requireDepartmentWrite } from "@/lib/security/api";

export const preferredRegion = "sin1";

const dateInput = z.string().trim().min(1).max(64).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");
const nullableDateInput = z.preprocess((value) => value === "" ? null : value, dateInput.nullable().optional());

const transportStatusSchema = z.enum(["pending", "in_transit", "delivered", "cancelled"]);

const transportCreateSchema = z.object({
  materialId: z.string().trim().min(1).max(128).optional(),
  materialName: z.string().trim().min(1).max(160).optional(),
  materialUnit: z.string().trim().min(1).max(32).optional(),
  quantity: z.coerce.number().positive().max(1_000_000_000),
  destinationSite: z.string().trim().min(1).max(160),
  driverInfo: z.string().trim().min(1).max(160),
  vehicleInfo: z.string().trim().min(1).max(160),
  transportDate: dateInput,
  deliveryDate: nullableDateInput,
  status: transportStatusSchema.default("pending"),
  note: z.string().trim().max(2000).nullable().optional(),
  assignedUserId: z.string().trim().min(1).max(128).optional(),
}).refine((value) => value.materialId || value.materialName, {
  message: "Material id or name is required",
  path: ["materialName"],
});

const transportPatchSchema = z.object({
  id: z.string().trim().min(1).max(128),
  driverInfo: z.string().trim().max(160).nullable().optional(),
  vehicleInfo: z.string().trim().max(160).nullable().optional(),
}).refine((value) => "driverInfo" in value || "vehicleInfo" in value, {
  message: "Update field is required",
});

const transportSelect = {
  id: true,
  quantity: true,
  destinationSite: true,
  driverInfo: true,
  vehicleInfo: true,
  transportDate: true,
  deliveryDate: true,
  status: true,
  note: true,
  material: { select: { name: true, unit: true } },
  assignedUser: { select: { fullName: true } },
} as const;

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentRead(user, "LOGISTICS")) return forbidden("Logistics access required");

  const { searchParams } = new URL(request.url);
  const limit = normalizePageLimit(searchParams.get("limit"), 50, 200);

  type TransportRow = {
    id: string;
    quantity: number;
    destinationSite: string;
    driverInfo: string | null;
    vehicleInfo: string | null;
    transportDate: Date;
    deliveryDate: Date | null;
    status: string;
    note: string | null;
    materialName: string;
    materialUnit: string;
    assignedUserFullName: string;
  };

  const rows = await prisma.$queryRaw<TransportRow[]>(Prisma.sql`
    SELECT
      t.id,
      t.quantity,
      t.destinationSite,
      t.driverInfo,
      t.vehicleInfo,
      t.transportDate,
      t.deliveryDate,
      t.status,
      t.note,
      m.name AS materialName,
      m.unit AS materialUnit,
      u.fullName AS assignedUserFullName
    FROM \`Transport\` t
    INNER JOIN \`Material\` m ON m.id = t.materialId
    INNER JOIN \`User\` u ON u.id = t.assignedUserId
    ORDER BY t.transportDate DESC
    LIMIT ${limit}
  `);

  const transports = rows.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    destinationSite: row.destinationSite,
    driverInfo: row.driverInfo,
    vehicleInfo: row.vehicleInfo,
    transportDate: row.transportDate,
    deliveryDate: row.deliveryDate,
    status: row.status,
    note: row.note,
    material: { name: row.materialName, unit: row.materialUnit },
    assignedUser: { fullName: row.assignedUserFullName },
  }));

  return NextResponse.json({ data: transports });
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "transports:post", 60, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "LOGISTICS")) return forbidden("Logistics write permission required");

  const parsed = transportCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transport input" }, { status: 400 });
  }
  const body = parsed.data;
  const assignedUserId = body.assignedUserId ?? user.id;

  const assignedUser = await prisma.user.findFirst({
    where: { id: assignedUserId, isActive: true },
    select: { id: true },
  });
  if (!assignedUser) {
    return NextResponse.json({ error: "Assigned user not found" }, { status: 404 });
  }

  const transport = await prisma.$transaction(async (tx) => {
    let materialId = body.materialId;

    if (materialId) {
      const material = await tx.material.findUnique({ where: { id: materialId }, select: { id: true } });
      if (!material) throw new Error("MATERIAL_NOT_FOUND");
    } else {
      const materialName = body.materialName as string;
      const existingMaterial = await tx.material.findFirst({
        where: { name: materialName },
        select: { id: true },
      });

      if (existingMaterial) {
        materialId = existingMaterial.id;
      } else {
        const material = await tx.material.create({
          data: {
            name: materialName,
            category: "Transport",
            unit: body.materialUnit || "kg",
            currentStock: 0,
            minimumStock: 0,
            maximumStock: 0,
            location: "Transport",
          },
          select: { id: true },
        });
        materialId = material.id;
      }
    }

    return tx.transport.create({
      data: {
        materialId,
        quantity: body.quantity,
        destinationSite: body.destinationSite,
        driverInfo: body.driverInfo,
        vehicleInfo: body.vehicleInfo,
        transportDate: new Date(body.transportDate),
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        status: body.status,
        note: body.note || null,
        assignedUserId: assignedUser.id,
      },
      select: transportSelect,
    });
  }).catch((error) => {
    if (error instanceof Error && error.message === "MATERIAL_NOT_FOUND") return null;
    throw error;
  });

  if (!transport) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  return NextResponse.json({ data: transport }, { status: 201 });
}

export async function PATCH(request: Request) {
  const rateLimited = await checkRateLimit(request, "transports:patch", 60, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "LOGISTICS")) return forbidden("Logistics update permission required");

  const parsed = transportPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transport update input" }, { status: 400 });
  }
  const body = parsed.data;

  const updateData: { driverInfo?: string | null; vehicleInfo?: string | null } = {};
  if ("driverInfo" in body) updateData.driverInfo = body.driverInfo?.trim() || null;
  if ("vehicleInfo" in body) updateData.vehicleInfo = body.vehicleInfo?.trim() || null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No transport fields to update" }, { status: 400 });
  }

  const transport = await prisma.$transaction((tx) =>
    tx.transport.update({
      where: { id: body.id },
      data: updateData,
      select: transportSelect,
    })
  );

  return NextResponse.json({ data: transport });
}

export async function DELETE(request: Request) {
  const rateLimited = await checkRateLimit(request, "transports:delete", 30, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "LOGISTICS")) return forbidden("Logistics delete permission required");

  const { searchParams } = new URL(request.url);
  const id = z.string().trim().min(1).max(128).safeParse(searchParams.get("id"));
  if (!id.success) {
    return NextResponse.json({ error: "Invalid transport id" }, { status: 400 });
  }

  const transport = await prisma.transport.findUnique({
    where: { id: id.data },
    select: { id: true },
  });
  if (!transport) {
    return NextResponse.json({ error: "Transport not found" }, { status: 404 });
  }

  await prisma.transport.delete({
    where: { id: transport.id },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: transport.id });
}
