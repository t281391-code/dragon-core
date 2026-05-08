import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { forbidden, requireDepartmentRead } from "@/lib/security/api";

export const preferredRegion = "sin1";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentRead(user, "PRODUCTION")) return forbidden("Production access required");

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
  }).catch((error) => {
    console.error("Equipment list fetch failed; returning empty equipment list.", error);
    return [];
  });

  return NextResponse.json({ data: equipment });
}
