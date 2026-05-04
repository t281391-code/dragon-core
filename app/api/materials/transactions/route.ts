import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, forbidden, normalizePageLimit, requireDepartmentWrite } from "@/lib/security/api";

const dateInput = z.string().trim().min(1).max(64).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");

const transactionSchema = z.object({
  materialId: z.string().min(1).max(128),
  type: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().positive().max(1_000_000_000),
  note: z.string().trim().max(2000).optional().nullable(),
  transactionDate: dateInput.optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(Math.floor(daysParam), 365) : null;
  const defaultLimit = days ? 1000 : 50;
  const maxLimit = days ? 5000 : 200;
  const limit = normalizePageLimit(searchParams.get("limit"), defaultLimit, maxLimit);
  const since = days ? new Date() : null;
  if (since && days) {
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);
  }

  const txns = await prisma.materialTransaction.findMany({
    where: since ? { transactionDate: { gte: since } } : undefined,
    orderBy: { transactionDate: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      quantity: true,
      note: true,
      transactionDate: true,
      material: { select: { id: true, name: true, unit: true } },
      createdBy: { select: { fullName: true } },
    },
  });

  return NextResponse.json({ data: txns });
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "materials-transactions:post", 60, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "WAREHOUSE")) return forbidden("Зөвхөн агуулахын эрхтэй хэрэглэгч бичих боломжтой");

  const parsed = transactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "materialId, type, quantity утгуудыг зөв оруулна уу" }, { status: 400 });
  }
  const body = parsed.data;

  const material = await prisma.material.findUnique({ where: { id: body.materialId } });
  if (!material) return NextResponse.json({ error: "Материал олдсонгүй" }, { status: 404 });

  if (body.type === "OUT" && material.currentStock < body.quantity) {
    return NextResponse.json({ error: `Нөөц хүрэлцэхгүй. Одоогийн нөөц: ${material.currentStock} ${material.unit}` }, { status: 422 });
  }

  const [txn] = await prisma.$transaction([
    prisma.materialTransaction.create({
      data: {
        materialId: body.materialId,
        type: body.type,
        quantity: body.quantity,
        note: body.note || null,
        transactionDate: body.transactionDate ? new Date(body.transactionDate) : new Date(),
        createdById: user.id,
      },
    }),
    prisma.material.update({
      where: { id: body.materialId },
      data: { currentStock: { increment: body.type === "IN" ? body.quantity : -body.quantity } },
    }),
  ]);

  return NextResponse.json({ data: txn }, { status: 201 });
}
