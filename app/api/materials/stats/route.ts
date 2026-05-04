import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRaw<{ month: string; type: string; total: unknown }[]>`
    SELECT
      DATE_FORMAT(transactionDate, '%Y-%m') AS month,
      type,
      SUM(quantity) AS total
    FROM MaterialTransaction
    WHERE transactionDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
    GROUP BY month, type
    ORDER BY month ASC
  `;

  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getUTCMonth() + 1}/с`;
    return { key, label, inbound: 0, outbound: 0 };
  });

  const monthMap = new Map(months.map(m => [m.key, m]));
  for (const row of rows) {
    const m = monthMap.get(row.month);
    if (!m) continue;
    if (row.type === "IN") m.inbound += Number(row.total);
    else m.outbound += Number(row.total);
  }

  return NextResponse.json({ data: months });
}
