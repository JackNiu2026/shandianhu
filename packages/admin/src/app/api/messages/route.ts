/**
 * GET  /api/messages - 获取消息列表（支持 conversationId 查询参数）
 * POST /api/messages - 发送消息
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { sendMessageSchema } from "@/lib/validation";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId") || "";

    const userId = auth.username;

    const where: Record<string, unknown> = {};
    if (contactId) {
      where.OR = [
        { AND: [{ senderId: userId }, { receiverId: contactId }] },
        { AND: [{ senderId: contactId }, { receiverId: userId }] },
      ];
    } else {
      where.OR = [{ senderId: userId }, { receiverId: userId }];
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    const result = messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderRole: m.senderRole,
      receiverId: m.receiverId,
      receiverRole: m.receiverRole,
      content: m.content,
      read: m.read,
      time: m.createdAt.toISOString(),
      mine: m.senderId === userId,
    }));

    return NextResponse.json({ data: result, total: result.length });
  } catch (error) {
    console.error("[Messages List Error]", error);
    return NextResponse.json(
      { error: "获取消息列表失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const result = sendMessageSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { receiverId, content } = result.data;
    const senderId = auth.username;

    // 验证接收者存在
    const receiver = await prisma.parent.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return NextResponse.json({ error: "接收者不存在" }, { status: 404 });
    }

    const message = await prisma.message.create({
      data: {
        senderId,
        senderRole: "parent",
        receiverId,
        receiverRole: "parent",
        content,
      },
    });

    return NextResponse.json({
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      read: message.read,
      time: message.createdAt.toISOString(),
      mine: true,
    }, { status: 201 });
  } catch (error) {
    console.error("[Message Send Error]", error);
    return NextResponse.json(
      { error: "发送消息失败" },
      { status: 500 },
    );
  }
}
