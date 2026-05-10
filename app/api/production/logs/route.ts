import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, requireDepartmentWrite } from "@/lib/security/api";
import {
  applyProductionStockFlow,
  getProductionRelationMaterialId,
  StockFlowError,
} from "@/lib/productionFlow.server";
import { INTERMEDIATE_EXPLOSIVE_INPUTS, isIntermediateExplosiveProduct } from "@/lib/productionFlowConfig";

export const preferredRegion = "sin1";

const dateInput = z.string().trim().min(1).max(64).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");

const equipmentTelemetrySchema = z.object({
  equipmentId: z.string().trim().max(128).optional(),
  equipmentName: z.string().trim().min(1).max(160),
  rpm: z.coerce.number().positive().max(100_000),
  maxRpm: z.coerce.number().positive().max(100_000),
  temperature: z.coerce.number().min(-100).max(500).nullable().optional(),
  pressure: z.coerce.number().min(0).max(10_000).nullable().optional(),
  vibration: z.coerce.number().min(0).max(10_000).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

const materialUsageSchema = z.object({
  materialName: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().positive().max(1_000_000_000),
});

const productionLogSchema = z.object({
  lotNumber: z.string().trim().max(80).optional(),
  productType: z.string().trim().min(1).max(160).optional(),
  productName: z.string().trim().min(1).max(160).optional(),
  producedKg: z.coerce.number().positive().max(1_000_000_000).optional(),
  outputQuantity: z.coerce.number().positive().max(1_000_000_000).optional(),
  productionDateTime: dateInput.optional(),
  productionDate: dateInput.optional(),
  operator: z.string().trim().max(4000).nullable().optional(),
  workerInfo: z.string().trim().max(4000).nullable().optional(),
  note: z.string().trim().max(4000).nullable().optional(),
  materialId: z.string().min(1).max(128).nullable().optional(),
  destinationMine: z.string().trim().max(160).nullable().optional(),
  density: z.coerce.number().positive().max(1000).nullable().optional(),
  materialUsage: z.array(materialUsageSchema).max(12).optional(),
  equipmentTelemetry: z.array(equipmentTelemetrySchema).min(1).max(12),
});

function getLoadStatus(loadPercent: number) {
  if (loadPercent >= 95) return "CRITICAL";
  if (loadPercent >= 80) return "WARNING";
  return "NORMAL";
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "production-logs-with-equipment:post", 60, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "PRODUCTION")) return forbidden("Production write permission required");

  const parsed = productionLogSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid production log input" }, { status: 400 });
  }

  const body = parsed.data;
  const productName = body.productType ?? body.productName;
  const outputQuantity = body.producedKg ?? body.outputQuantity;
  const productionDate = new Date(body.productionDateTime ?? body.productionDate ?? new Date());

  if (!productName || !outputQuantity) {
    return NextResponse.json({ error: "Product and produced amount are required" }, { status: 400 });
  }
  const materialUsage = body.materialUsage ?? [];
  if (isIntermediateExplosiveProduct(productName)) {
    const requiredMaterials = new Set(INTERMEDIATE_EXPLOSIVE_INPUTS);
    const usageMap = new Map(materialUsage.map((item) => [item.materialName, item.quantity]));
    const missingMaterial = [...requiredMaterials].find((materialName) => !usageMap.has(materialName));
    if (missingMaterial) {
      return NextResponse.json({ error: `${missingMaterial} зарцуулалтыг оруулна уу` }, { status: 400 });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const materialId = await getProductionRelationMaterialId(tx, body.materialId, productName);
    const createdLog = await tx.productionLog.create({
      data: {
        lotNumber: body.lotNumber || `LOT-${Date.now()}`,
        productionDate,
        shift: "day",
        productName,
        outputQuantity,
        scheduledDate: null,
        destinationMine: body.destinationMine || null,
        status: "ready",
        materialId,
        quantityUsed: 0,
        downtimeMinutes: 0,
        workerInfo: body.operator || body.workerInfo || null,
        density: body.density ?? null,
        note: body.note || null,
        createdById: user.id,
      },
    });

    await applyProductionStockFlow(tx, {
      productionLogId: createdLog.id,
      productName,
      outputQuantity,
      productionDate,
      userId: user.id,
      materialUsage,
    });

    const telemetryRows = [];
    for (const item of body.equipmentTelemetry) {
      const equipment = item.equipmentId
        ? await tx.equipment.findUnique({ where: { id: item.equipmentId } })
        : await tx.equipment.upsert({
            where: { name: item.equipmentName },
            update: {
              maxRpm: item.maxRpm,
              isActive: true,
            },
            create: {
              name: item.equipmentName,
              type: item.equipmentName.toLowerCase().includes("mixer") ? "MIXER" : "PUMP",
              maxRpm: item.maxRpm,
              department: "PRODUCTION",
              isActive: true,
            },
          });

      if (!equipment) {
        throw new Error(`Equipment not found: ${item.equipmentName}`);
      }

      const loadPercent = Math.round((item.rpm / item.maxRpm) * 1000) / 10;
      telemetryRows.push({
        productionLogId: createdLog.id,
        equipmentId: equipment.id,
        rpm: item.rpm,
        maxRpm: item.maxRpm,
        loadPercent,
        temperature: item.temperature ?? null,
        pressure: item.pressure ?? null,
        vibration: item.vibration ?? null,
        status: getLoadStatus(loadPercent),
        note: item.note || null,
        recordedAt: productionDate,
      });
    }

    await tx.equipmentTelemetryLog.createMany({ data: telemetryRows });

    return tx.productionLog.findUniqueOrThrow({
      where: { id: createdLog.id },
      include: {
        createdBy: { select: { fullName: true } },
        material: { select: { name: true, unit: true } },
        telemetryLogs: {
          include: {
            equipment: { select: { id: true, name: true, type: true, maxRpm: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }).catch((error) => {
    if (error instanceof StockFlowError) return error;
    throw error;
  });

  if (result instanceof StockFlowError) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ data: result }, { status: 201 });
}
