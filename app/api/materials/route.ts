import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, requireDepartmentWrite } from "@/lib/security/api";

export const preferredRegion = "sin1";

const WAREHOUSE_MATERIALS = [
  "АМИАКИЙН ШҮҮ",
  "ЦУУНЫ ХҮЧИЛ",
  "ХҮХРИЙН ХҮЧИЛ",
  "ШИЛЭН БӨМБӨЛӨГ",
  "ТҮЛШ",
  "НИТРИТ НАТРИ",
  "ЭМУЛЬГАТОР",
  "ХАТУУРУУЛАГЧ",
  "ГИДРОКСИД",
  "ЦАГААН ТОС",
];

const materialSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(120).optional().default("Бусад"),
  unit: z.string().trim().min(1).max(24),
  currentStock: z.coerce.number().min(0).max(1_000_000_000).optional().default(0),
  minimumStock: z.coerce.number().min(0).max(1_000_000_000).optional().default(0),
  maximumStock: z.coerce.number().min(0).max(1_000_000_000).optional().default(0),
  location: z.string().trim().max(160).optional().default(""),
});

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existingWarehouseMaterials = await prisma.material.findMany({
    where: { name: { in: WAREHOUSE_MATERIALS } },
    select: { name: true },
  });
  const existingNames = new Set(existingWarehouseMaterials.map((material) => material.name));
  const missingNames = WAREHOUSE_MATERIALS.filter((name) => !existingNames.has(name));

  if (missingNames.length > 0) {
    await prisma.material.createMany({
      data: missingNames.map((name) => ({
        name,
        category: "Агуулах",
        unit: "КГ",
        currentStock: 0,
        minimumStock: 0,
        maximumStock: 0,
        location: "Агуулах",
      })),
    });
  }

  const materials = await prisma.material.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      unit: true,
      currentStock: true,
      minimumStock: true,
      maximumStock: true,
      location: true,
    },
  });
  const orderMap = new Map(WAREHOUSE_MATERIALS.map((name, index) => [name, index]));
  const sortedMaterials = materials.sort((a, b) => {
    const aIndex = orderMap.get(a.name) ?? 999;
    const bIndex = orderMap.get(b.name) ?? 999;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ data: sortedMaterials });
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "materials:post", 30, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "WAREHOUSE")) return forbidden("Зөвхөн агуулахын эрхтэй хэрэглэгч материал нэмнэ");

  const parsed = materialSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Материалын мэдээллийг зөв оруулна уу" }, { status: 400 });
  }
  const body = parsed.data;

  const material = await prisma.material.create({
    data: {
      name: body.name,
      category: body.category,
      unit: body.unit,
      currentStock: body.currentStock,
      minimumStock: body.minimumStock,
      maximumStock: body.maximumStock,
      location: body.location,
    },
  });

  return NextResponse.json({ data: material }, { status: 201 });
}
