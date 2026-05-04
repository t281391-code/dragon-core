import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, normalizePageLimit, requireDepartmentWrite } from "@/lib/security/api";

export const preferredRegion = "bom1";

const dateInput = z.string().trim().min(1).max(64).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");

const transactionSchema = z.object({
  materialId: z.string().min(1).max(128),
  type: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().positive().max(1_000_000_000),
  note: z.string().trim().max(2000).optional().nullable(),
  transactionDate: dateInput.optional(),
});

export async function GET(request: Request) {
  const user = await getRequestUser();
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

  type TransactionRow = {
    id: string;
    type: "IN" | "OUT";
    quantity: number;
    note: string | null;
    transactionDate: Date;
    materialId: string;
    materialName: string;
    materialUnit: string;
    createdByFullName: string;
  };

  const rows = await prisma.$queryRaw<TransactionRow[]>(Prisma.sql`
    SELECT
      mt.id,
      mt.type,
      mt.quantity,
      mt.note,
      mt.transactionDate,
      m.id AS materialId,
      m.name AS materialName,
      m.unit AS materialUnit,
      u.fullName AS createdByFullName
    FROM \`MaterialTransaction\` mt
    INNER JOIN \`Material\` m ON m.id = mt.materialId
    INNER JOIN \`User\` u ON u.id = mt.createdById
    ${since ? Prisma.sql`WHERE mt.transactionDate >= ${since}` : Prisma.empty}
    ORDER BY mt.transactionDate DESC
    LIMIT ${limit}
  `);

  const txns = rows.map((row) => ({
    id: row.id,
    type: row.type,
    quantity: row.quantity,
    note: row.note,
    transactionDate: row.transactionDate,
    material: { id: row.materialId, name: row.materialName, unit: row.materialUnit },
    createdBy: { fullName: row.createdByFullName },
  }));

  return NextResponse.json({ data: txns });
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "materials-transactions:post", 60, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
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
