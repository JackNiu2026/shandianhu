/**
 * GET    /api/teachers/[id] - 获取老师详情
 * PUT    /api/teachers/[id] - 更新老师信息
 * DELETE /api/teachers/[id] - 删除老师
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { serializeTeacher } from "@/lib/serialize";
import { updateTeacherSchema } from "@/lib/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const { id } = await params;

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        reviews: { orderBy: { createdAt: "desc" } },
        bookings: {
          include: { parent: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "老师不存在" },
        { status: 404 },
      );
    }

    const serialized = serializeTeacher(teacher);
    return NextResponse.json({
      ...serialized,
      reviews: teacher.reviews.map((r) => ({
        id: r.id,
        author: r.author,
        text: r.text,
        rating: r.rating,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      bookings: teacher.bookings.map((b) => ({
        id: b.id,
        parentName: b.parent?.name || "",
        subject: b.subject,
        slot: b.slot,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[Teacher Detail Error]", error);
    return NextResponse.json(
      { error: "获取老师详情失败" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 验证认证
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();

    // zod 输入验证
    const result = updateTeacherSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    // 检查老师是否存在
    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "老师不存在" },
        { status: 404 },
      );
    }

    // 构建更新数据（zod 已过滤，只需处理 JSON 字段序列化）
    const data = result.data;
    const updateData: Record<string, unknown> = {};
    const jsonFields = ["grades", "tags", "slots", "checks"];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (jsonFields.includes(key) && Array.isArray(value)) {
        updateData[key] = JSON.stringify(value);
      } else {
        updateData[key] = value;
      }
    }

    const teacher = await prisma.teacher.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(serializeTeacher(teacher));
  } catch (error) {
    console.error("[Teacher Update Error]", error);
    return NextResponse.json(
      { error: "更新老师信息失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 验证认证
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const { id } = await params;

    // 检查老师是否存在
    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "老师不存在" },
        { status: 404 },
      );
    }

    await prisma.teacher.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Teacher Delete Error]", error);
    return NextResponse.json(
      { error: "删除老师失败" },
      { status: 500 },
    );
  }
}
