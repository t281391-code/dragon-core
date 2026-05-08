import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { forbidden, requireDepartmentRead } from "@/lib/security/api";

export const preferredRegion = "sin1";

function parseDateParam(value: string | null, fallback: Date, endOfDay = false) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    parsed.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getAverage(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentRead(user, "PRODUCTION")) return forbidden("Production access required");

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(now.getDate() - 14);

  const from = parseDateParam(searchParams.get("from"), defaultFrom);
  const to = parseDateParam(searchParams.get("to"), now, true);
  const productType = searchParams.get("productType")?.trim() || undefined;
  const equipmentId = searchParams.get("equipmentId")?.trim() || undefined;

  const equipment = await prisma.equipment.findMany({
    where: { isActive: true, department: "PRODUCTION" },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      maxRpm: true,
      department: true,
      isActive: true,
    },
  });

  const telemetry = await prisma.equipmentTelemetryLog.findMany({
    where: {
      recordedAt: { gte: from, lte: to },
      ...(equipmentId ? { equipmentId } : {}),
      ...(productType ? { productionLog: { productName: productType } } : {}),
    },
    orderBy: { recordedAt: "asc" },
    take: 1000,
    include: {
      equipment: { select: { id: true, name: true, type: true, maxRpm: true } },
      productionLog: { select: { id: true, productName: true, outputQuantity: true, productionDate: true } },
    },
  });

  const rpmValues = telemetry.map((row) => row.rpm);
  const loadValues = telemetry.map((row) => row.loadPercent);
  const latest = telemetry.at(-1) ?? null;
  const chartData = telemetry.map((row) => ({
    id: row.id,
    time: row.recordedAt.toISOString(),
    label: row.recordedAt.toLocaleString("mn-MN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
    productType: row.productionLog.productName,
    producedKg: row.productionLog.outputQuantity,
    equipmentId: row.equipmentId,
    equipmentName: row.equipment.name,
    rpm: row.rpm,
    maxRpm: row.maxRpm,
    loadPercent: row.loadPercent,
    temperature: row.temperature,
    pressure: row.pressure,
    vibration: row.vibration,
    status: row.status,
  }));

  const summaryEquipment = equipmentId ? equipment.filter((item) => item.id === equipmentId) : equipment;
  const equipmentSummaries = summaryEquipment.map((item) => {
    const rows = telemetry.filter((row) => row.equipmentId === item.id);
    const latestRow = rows.at(-1) ?? null;
    return {
      equipmentId: item.id,
      equipmentName: item.name,
      equipmentType: item.type,
      maxRpm: item.maxRpm,
      latestRpm: latestRow?.rpm ?? null,
      latestLoadPercent: latestRow?.loadPercent ?? null,
      avgRpm: rows.length ? round(getAverage(rows.map((row) => row.rpm))) : null,
      avgLoadPercent: rows.length ? round(getAverage(rows.map((row) => row.loadPercent))) : null,
      temperature: latestRow?.temperature ?? null,
      pressure: latestRow?.pressure ?? null,
      vibration: latestRow?.vibration ?? null,
      status: latestRow?.status ?? "NO_DATA",
      lastRecordedAt: latestRow?.recordedAt.toISOString() ?? null,
      healthScore: latestRow ? Math.max(0, Math.round(100 - Math.max(0, latestRow.loadPercent - 75) * 1.2 - Math.max(0, (latestRow.vibration ?? 0) - 3) * 4)) : null,
      trend: rows.slice(-12).map((row) => ({
        time: row.recordedAt.toISOString(),
        rpm: row.rpm,
        loadPercent: row.loadPercent,
      })),
    };
  });

  const productRows = await prisma.productionLog.findMany({
    select: { productName: true },
    distinct: ["productName"],
    orderBy: { productName: "asc" },
  });

  const products = Array.from(new Set(productRows.map((row) => row.productName)))
    .filter(Boolean)
    .sort();

  return NextResponse.json({
    data: {
      latestRpm: latest?.rpm ?? null,
      avgRpm: rpmValues.length ? round(getAverage(rpmValues)) : null,
      maxRpm: rpmValues.length ? Math.max(...rpmValues) : null,
      minRpm: rpmValues.length ? Math.min(...rpmValues) : null,
      avgLoadPercent: loadValues.length ? round(getAverage(loadValues)) : null,
      warningCount: telemetry.filter((row) => row.status === "WARNING").length,
      criticalCount: telemetry.filter((row) => row.status === "CRITICAL").length,
      chartData,
      equipmentSummaries,
    },
    filters: {
      from: from.toISOString(),
      to: to.toISOString(),
      products,
      equipment,
    },
  });
}
