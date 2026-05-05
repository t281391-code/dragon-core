import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, normalizePageLimit, requireDepartmentWrite } from "@/lib/security/api";

export const preferredRegion = "sin1";

const dateInput = z.string().trim().min(1).max(64).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");
const WAREHOUSE_MATERIAL_LIMITS = new Map([
  ["АМИАКИЙН ШҮҮ", 500_000],
  ["ЦУУНЫ ХҮЧИЛ", 2_000],
  ["ХҮХРИЙН ХҮЧИЛ", 100],
  ["ШИЛЭН БӨМБӨЛӨГ", 8_000],
  ["ТҮЛШ", 800_000],
  ["НИТРИТ НАТРИ", 7_000],
  ["ЭМУЛЬГАТОР", 100_000],
  ["ХАТУУРУУЛАГЧ", 300_000],
  ["ГИДРОКСИД", 200],
  ["ЦАГААН ТОС", 400_000],
]);

const transactionSchema = z.object({
  materialId: z.string().min(1).max(128).optional(),
  materialName: z.string().trim().min(1).max(160).optional(),
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
    return NextResponse.json({ error: "material, type, quantity утгуудыг зөв оруулна уу" }, { status: 400 });
  }
  const body = parsed.data;

  const materialName = body.materialName?.trim();
  if (!body.materialId && !materialName) {
    return NextResponse.json({ error: "Материал сонгоно уу" }, { status: 400 });
  }
  if (materialName && !WAREHOUSE_MATERIAL_LIMITS.has(materialName)) {
    return NextResponse.json({ error: "Зөвшөөрөгдсөн агуулахын материал сонгоно уу" }, { status: 400 });
  }

  let material = body.materialId
    ? await prisma.material.findUnique({ where: { id: body.materialId } })
    : await prisma.material.findFirst({ where: { name: materialName } });

  if (!material && materialName && body.type === "IN") {
    material = await prisma.material.create({
      data: {
        name: materialName,
        category: "Агуулах",
        unit: "КГ",
        currentStock: 0,
        minimumStock: 0,
        maximumStock: WAREHOUSE_MATERIAL_LIMITS.get(materialName) ?? 0,
        location: "Агуулах",
      },
    });
  }
  if (!material) return NextResponse.json({ error: "Материал олдсонгүй" }, { status: 404 });

  if (body.type === "OUT" && material.currentStock < body.quantity) {
    return NextResponse.json({ error: `Нөөц хүрэлцэхгүй. Одоогийн нөөц: ${material.currentStock} ${material.unit}` }, { status: 422 });
  }

  const [txn] = await prisma.$transaction([
    prisma.materialTransaction.create({
      data: {
        materialId: material.id,
        type: body.type,
        quantity: body.quantity,
        note: body.note || null,
        transactionDate: body.transactionDate ? new Date(body.transactionDate) : new Date(),
        createdById: user.id,
      },
    }),
    prisma.material.update({
      where: { id: material.id },
      data: { currentStock: { increment: body.type === "IN" ? body.quantity : -body.quantity } },
    }),
  ]);

  return NextResponse.json({
    data: {
      id: txn.id,
      type: txn.type,
      quantity: txn.quantity,
      note: txn.note,
      transactionDate: txn.transactionDate,
      material: { id: material.id, name: material.name, unit: material.unit },
      createdBy: { fullName: user.fullName || user.email },
    },
  }, { status: 201 });
}

export async function DELETE(request: Request) {
  const rateLimited = await checkRateLimit(request, "materials-transactions:delete", 60, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "WAREHOUSE")) return forbidden("Зөвхөн агуулахын эрхтэй хэрэглэгч устгах боломжтой");

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Гүйлгээний ID дутуу байна" }, { status: 400 });

  const transaction = await prisma.materialTransaction.findUnique({
    where: { id },
    include: {
      material: true,
      createdBy: { select: { fullName: true } },
    },
  });

  if (!transaction) return NextResponse.json({ error: "Гүйлгээ олдсонгүй" }, { status: 404 });
  if (transaction.type === "IN" && transaction.material.currentStock < transaction.quantity) {
    return NextResponse.json({ error: "Энэ орлогыг устгавал нөөц сөрөг болох тул устгах боломжгүй" }, { status: 422 });
  }

  const stockDelta = transaction.type === "IN" ? -transaction.quantity : transaction.quantity;
  const [, updatedMaterial] = await prisma.$transaction([
    prisma.materialTransaction.delete({ where: { id } }),
    prisma.material.update({
      where: { id: transaction.materialId },
      data: { currentStock: { increment: stockDelta } },
    }),
  ]);

  return NextResponse.json({
    data: {
      transaction: {
        id: transaction.id,
        type: transaction.type,
        quantity: transaction.quantity,
        note: transaction.note,
        transactionDate: transaction.transactionDate,
        material: { id: transaction.material.id, name: transaction.material.name, unit: transaction.material.unit },
        createdBy: { fullName: transaction.createdBy.fullName },
      },
      material: {
        id: updatedMaterial.id,
        name: updatedMaterial.name,
        currentStock: updatedMaterial.currentStock,
      },
    },
  });
}
