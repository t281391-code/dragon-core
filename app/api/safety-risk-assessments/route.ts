import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { checkRateLimit, forbidden, normalizePageLimit, requireDepartmentRead, safeInternalError } from "@/lib/security/api";

export const preferredRegion = "sin1";

const dateInput = z.string().trim().min(1).max(64).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");
const riskAnswerSchema = z.enum(["yes", "no", ""]);

const riskAssessmentAnswerSchema = z.object({
  sectionTitle: z.string().trim().min(1).max(191),
  question: z.string().trim().min(1).max(500),
  answer: riskAnswerSchema.default(""),
});

const riskAssessmentBodySchema = z.object({
  employeeName: z.string().trim().min(1).max(191),
  taskName: z.string().trim().max(191).default(""),
  workArea: z.string().trim().max(191).default(""),
  assessmentDate: dateInput,
  answers: z.array(riskAssessmentAnswerSchema).min(1).max(60),
});

const riskAssessmentSelect = {
  id: true,
  employeeName: true,
  taskName: true,
  workArea: true,
  assessmentDate: true,
  answers: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { fullName: true } },
} as const;

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentRead(user, "SAFETY")) return forbidden("Safety access required");

  const { searchParams } = new URL(request.url);
  const limit = normalizePageLimit(searchParams.get("limit"), 50, 200);

  const assessments = await prisma.safetyRiskAssessment.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: riskAssessmentSelect,
  });

  return NextResponse.json({ data: assessments });
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, "safety-risk-assessments:post", 40, 60_000);
  if (rateLimited) return rateLimited;

  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireDepartmentRead(user, "SAFETY")) return forbidden("Safety access required");

  const parsed = riskAssessmentBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid risk assessment input" }, { status: 400 });
  }

  try {
    const body = parsed.data;
    const assessment = await prisma.safetyRiskAssessment.create({
      data: {
        employeeName: body.employeeName,
        taskName: body.taskName,
        workArea: body.workArea,
        assessmentDate: new Date(body.assessmentDate),
        answers: body.answers,
        createdById: user.id,
      },
      select: riskAssessmentSelect,
    });

    return NextResponse.json({ data: assessment }, { status: 201 });
  } catch (error) {
    return safeInternalError(error, "Risk assessment save failed");
  }
}
