import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, requireDepartmentWrite } from "@/lib/security/api";

export const preferredRegion = "bom1";

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

  const materials = await prisma.material.findMany({
    orderBy: { name: "asc" },
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
  return NextResponse.json({ data: materials });
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
