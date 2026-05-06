import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, normalizePageLimit, requireDepartmentRead, requireDepartmentWrite } from "@/lib/security/api";

export const preferredRegion = "sin1";

const dateInput = z.string().trim().min(1).max(64).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");
const severitySchema = z.enum(["low", "medium", "high"]);
const statusSchema = z.enum(["open", "investigating", "resolved", "closed"]);

const incidentCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
  severity: severitySchema,
  status: statusSchema.default("open"),
  incidentDate: dateInput,
  location: z.string().trim().min(1).max(160),
  reportedById: z.string().trim().min(1).max(128).optional(),
});

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentRead(user, "SAFETY")) return forbidden("Safety access required");

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = statusParam ? statusSchema.safeParse(statusParam) : null;
  if (statusParam && !status?.success) {
    return NextResponse.json({ error: "Invalid incident status" }, { status: 400 });
  }
  const limit = normalizePageLimit(searchParams.get("limit"), 50, 200);

  type SafetyIncidentRow = {
    id: string;
    title: string;
    description: string;
    severity: string;
    status: string;
    incidentDate: Date;
    location: string;
    reportedByFullName: string;
    reportedByMrCode: string | null;
    reportedByDepartmentName: string;
  };

  const rows = await prisma.$queryRaw<SafetyIncidentRow[]>(Prisma.sql`
    SELECT
      si.id,
      si.title,
      si.description,
      si.severity,
      si.status,
      si.incidentDate,
      si.location,
      u.fullName AS reportedByFullName,
      u.mrCode AS reportedByMrCode,
      d.name AS reportedByDepartmentName
    FROM \`SafetyIncident\` si
    INNER JOIN \`User\` u ON u.id = si.reportedById
    INNER JOIN \`Department\` d ON d.id = u.departmentId
    ${status?.success ? Prisma.sql`WHERE si.status = ${status.data}` : Prisma.empty}
    ORDER BY si.incidentDate DESC
    LIMIT ${limit}
  `);

  const incidents = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    status: row.status,
    incidentDate: row.incidentDate,
    location: row.location,
    reportedBy: {
      fullName: row.reportedByFullName,
      mrCode: user.role === "ADMIN" ? row.reportedByMrCode : null,
      department: { name: row.reportedByDepartmentName },
    },
  }));

  return NextResponse.json({ data: incidents });
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "safety-incidents:post", 60, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "SAFETY")) return forbidden("Safety write permission required");

  const parsed = incidentCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid incident input" }, { status: 400 });
  }
  const body = parsed.data;
  const reportedById = body.reportedById ?? user.id;

  const reportedBy = await prisma.user.findFirst({
    where: { id: reportedById, isActive: true },
    select: { id: true },
  });
  if (!reportedBy) {
    return NextResponse.json({ error: "Reporter not found" }, { status: 404 });
  }

  const incident = await prisma.safetyIncident.create({
    data: {
      title: body.title,
      description: body.description,
      severity: body.severity,
      status: body.status,
      incidentDate: new Date(body.incidentDate),
      location: body.location,
      reportedById: reportedBy.id,
    },
  });

  return NextResponse.json({ data: incident }, { status: 201 });
}

export async function DELETE(request: Request) {
  const rateLimited = await checkRateLimit(request, "safety-incidents:delete", 30, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentWrite(user, "SAFETY")) return forbidden("Safety write permission required");

  const { searchParams } = new URL(request.url);
  const id = z.string().trim().min(1).max(128).safeParse(searchParams.get("id"));
  if (!id.success) {
    return NextResponse.json({ error: "Invalid incident id" }, { status: 400 });
  }

  const incident = await prisma.safetyIncident.findUnique({
    where: { id: id.data },
    select: { id: true },
  });
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  await prisma.safetyIncident.delete({
    where: { id: incident.id },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: incident.id });
}
