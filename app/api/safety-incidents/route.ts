import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, forbidden, normalizePageLimit, requireDepartmentWrite } from "@/lib/security/api";

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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = statusParam ? statusSchema.safeParse(statusParam) : null;
  if (statusParam && !status?.success) {
    return NextResponse.json({ error: "Invalid incident status" }, { status: 400 });
  }
  const limit = normalizePageLimit(searchParams.get("limit"), 50, 200);

  const incidents = await prisma.safetyIncident.findMany({
    where: status?.success ? { status: status.data } : undefined,
    orderBy: { incidentDate: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      description: true,
      severity: true,
      status: true,
      incidentDate: true,
      location: true,
      reportedBy: { select: { fullName: true } },
    },
  });

  return NextResponse.json({ data: incidents });
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "safety-incidents:post", 60, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getCurrentUser();
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
