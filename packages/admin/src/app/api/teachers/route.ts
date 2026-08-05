/**
 * GET  /api/teachers - 老师列表（支持 search/subject/grade/status/page/pageSize）
 * POST /api/teachers - 创建老师（zod 验证）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { serializeTeacher } from "@/lib/serialize";
import { createTeacherSchema, parsePagination } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const subject = searchParams.get("subject") || "";
    const grade = searchParams.get("grade") || "";
    const status = searchParams.get("status") || "";
    const { skip, take, page, pageSize } = parsePagination(searchParams);

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { school: { contains: search, mode: "insensitive" } },
      ];
    }

    if (subject) {
      where.subject = subject;
    }

    if (status) {
      where.status = status;
    }

    // 并行查询数据和总数
    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.teacher.count({ where }),
    ]);

    let result = teachers.map(serializeTeacher);

    // grade 过滤在内存中进行（JSON 字符串字段）
    if (grade) {
      result = result.filter((t) =>
        (t.grades as string[]).includes(grade),
      );
    }

    return NextResponse.json({
      data: result,
      total,
      page,
      pageSize,
    });
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

    // zod 输入验证
    const result = createTeacherSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const data = result.data;

    const teacher = await prisma.teacher.create({
      data: {
        name: data.name,
        age: data.age,
        school: data.school,
        subject: data.subject,
        grades: JSON.stringify(data.grades),
        mode: data.mode,
        tags: JSON.stringify(data.tags),
        color: data.color,
        note: data.note,
        rating: data.rating,
        students: data.students,
        years: data.years,
        price: data.price,
        slots: JSON.stringify(data.slots),
        video: data.video,
        checks: JSON.stringify(data.checks),
        status: data.status,
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
