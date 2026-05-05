import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, requireDepartmentWrite } from "@/lib/security/api";

export const preferredRegion = "sin1";

const WAREHOUSE_MATERIAL_LIMITS = [
  { name: "АМИАКИЙН ШҮҮ", maximumStock: 500_000 },
  { name: "ЦУУНЫ ХҮЧИЛ", maximumStock: 2_000 },
  { name: "ХҮХРИЙН ХҮЧИЛ", maximumStock: 100 },
  { name: "ШИЛЭН БӨМБӨЛӨГ", maximumStock: 8_000 },
  { name: "ТҮЛШ", maximumStock: 800_000 },
  { name: "НИТРИТ НАТРИ", maximumStock: 7_000 },
  { name: "ЭМУЛЬГАТОР", maximumStock: 100_000 },
  { name: "ХАТУУРУУЛАГЧ", maximumStock: 300_000 },
  { name: "ГИДРОКСИД", maximumStock: 200 },
  { name: "ЦАГААН ТОС", maximumStock: 400_000 },
];
const WAREHOUSE_MATERIALS = WAREHOUSE_MATERIAL_LIMITS.map((material) => material.name);

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
  const missingMaterials = WAREHOUSE_MATERIAL_LIMITS.filter((material) => !existingNames.has(material.name));

  if (missingMaterials.length > 0) {
    await prisma.material.createMany({
      data: missingMaterials.map((material) => ({
        name: material.name,
        category: "Агуулах",
        unit: "КГ",
        currentStock: 0,
        minimumStock: 0,
        maximumStock: material.maximumStock,
        location: "Агуулах",
      })),
    });
  }

  await Promise.all(
    WAREHOUSE_MATERIAL_LIMITS.map((material) =>
      prisma.material.updateMany({
        where: {
          name: material.name,
          OR: [
            { category: { not: "Агуулах" } },
            { unit: { not: "КГ" } },
            { maximumStock: { not: material.maximumStock } },
            { location: { not: "Агуулах" } },
          ],
        },
        data: {
          category: "Агуулах",
          unit: "КГ",
          maximumStock: material.maximumStock,
          location: "Агуулах",
        },
      })
    )
  );

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
