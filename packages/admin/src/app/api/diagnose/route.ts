/**
 * POST /api/diagnose - 提交学情诊断（家长认证）
 * GET  /api/diagnose  - 获取当前家长的历史诊断报告
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { diagnoseSchema, parsePagination } from "@/lib/validation";
import { serializeDiagnosisReport } from "@/lib/serialize";
import { DiagnosisUnavailableError, generateDiagnosis } from "@/lib/diagnosis";

export const dynamic = "force-dynamic";

/* ---- POST: 提交诊断 ---- */
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    if (auth.role !== "parent") {
      return NextResponse.json(
        { error: "仅家长可使用学情诊断" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const result = diagnoseSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const parentId = auth.username;
    const { subject, grade, images } = result.data;

    const diagnosisResult = await generateDiagnosis({ subject, grade, images });

    // 存入数据库
    const report = await prisma.diagnosisReport.create({
      data: {
        parentId,
        subject,
        grade,
        imageCount: images.length,
        overallScore: diagnosisResult.overallScore,
        level: diagnosisResult.level,
        weakPoints: diagnosisResult.weakPoints,
        errorTypes: diagnosisResult.errorTypes,
        questionAnalysis: diagnosisResult.questionAnalysis,
        suggestions: diagnosisResult.suggestions,
      },
    });

    return NextResponse.json(serializeDiagnosisReport(report), { status: 201 });
  } catch (error) {
    console.error("[Diagnosis Create Error]", error);
    if (error instanceof DiagnosisUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "诊断失败，请重试" },
      { status: 500 },
    );
  }
}

/* ---- GET: 历史报告列表 ---- */
export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    if (auth.role !== "parent") {
      return NextResponse.json(
        { error: "仅家长可查看诊断报告" },
        { status: 403 },
      );
    }

    const parentId = auth.username;
    const { searchParams } = new URL(request.url);
    const { skip, take } = parsePagination(searchParams);

    const [reports, total] = await Promise.all([
      prisma.diagnosisReport.findMany({
        where: { parentId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.diagnosisReport.count({ where: { parentId } }),
    ]);

    return NextResponse.json({
      data: reports.map(serializeDiagnosisReport),
      total,
    });
  } catch (error) {
    console.error("[Diagnosis List Error]", error);
    return NextResponse.json(
      { error: "获取诊断报告列表失败" },
      { status: 500 },
    );
  }
}
