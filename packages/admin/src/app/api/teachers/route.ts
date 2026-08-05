/**
 * GET  /api/teachers - 老师列表（支持 search/subject/grade/status 查询参数）
 * POST /api/teachers - 创建老师
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { serializeTeacher } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const subject = searchParams.get("subject") || "";
    const grade = searchParams.get("grade") || "";
    const status = searchParams.get("status") || "";

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { school: { contains: search } },
      ];
    }

    if (subject) {
      where.subject = subject;
    }

    if (status) {
      where.status = status;
    }

    // grade 需要在内存中过滤（因为是 JSON 字符串字段）
    const teachers = await prisma.teacher.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    let result = teachers.map(serializeTeacher);

    // grade 过滤在内存中进行
    if (grade) {
      result = result.filter((t) =>
        (t.grades as string[]).includes(grade),
      );
    }

    return NextResponse.json({ data: result, total: result.length });
  } catch (error) {
    console.error("[Teachers List Error]", error);
    return NextResponse.json(
      { error: "获取老师列表失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证认证
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const body = await request.json();

    // 基本字段校验
    if (!body.name || !body.subject) {
      return NextResponse.json(
        { error: "老师姓名和科目为必填项" },
        { status: 400 },
      );
    }

    const teacher = await prisma.teacher.create({
      data: {
        name: body.name,
        age: body.age || "",
        school: body.school || "",
        subject: body.subject,
        grades: JSON.stringify(body.grades || []),
        mode: body.mode || "线上",
        tags: JSON.stringify(body.tags || []),
        color: body.color || "#f2cabc",
        note: body.note || "",
        rating: body.rating || "0.0",
        students: body.students || "0",
        years: body.years || "1年",
        price: body.price || 100,
        slots: JSON.stringify(body.slots || []),
        video: body.video || "",
        checks: JSON.stringify(body.checks || []),
        status: body.status || "pending",
        totalRevenue: body.totalRevenue || 0,
        pendingRevenue: body.pendingRevenue || 0,
        availableRevenue: body.availableRevenue || 0,
        totalLessons: body.totalLessons || 0,
      },
    });

    return NextResponse.json(serializeTeacher(teacher), { status: 201 });
  } catch (error) {
    console.error("[Teacher Create Error]", error);
    return NextResponse.json(
      { error: "创建老师失败" },
      { status: 500 },
    );
  }
}
