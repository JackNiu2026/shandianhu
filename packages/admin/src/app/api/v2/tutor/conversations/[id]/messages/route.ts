import { ConversationService, MessageService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { toHttpResponse } from "@/lib/v2-handler";
import { authenticatedUserId } from "@/lib/v2-auth";

const messagesSvc = new MessageService();
const conversations = new ConversationService();

const acceptSchema = z.object({
  content: z.string().max(20000),
  clientMessageId: z.string().min(1).max(128),
  attachmentFileObjectIds: z.array(z.string()).max(4).optional(),
});

// GET /api/v2/tutor/conversations/[id]/messages — 列出会话消息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const { id } = await params;
    const parentProfileId = await resolveParentProfileId(userId);
    await conversations.get(id, parentProfileId);
    const url = new URL(request.url);
    const take = Number(url.searchParams.get("limit") ?? 100);
    const list = await messagesSvc.listRecent(id, Math.min(200, take));
    return {
      messages: list.map((m) => ({
        id: m.id,
        role: m.role,
        clientMessageId: m.clientMessageId,
        content: m.content,
        generationStatus: m.generationStatus,
        sequence: m.sequence,
        createdAt: m.createdAt.toISOString(),
        attachments: (m.attachments ?? []).map((a) => ({
          id: a.id, ordinal: a.ordinal, fileObjectId: a.fileObjectId,
        })),
      })),
    };
  });
}

// POST /api/v2/tutor/conversations/[id]/messages — 接受用户消息（幂等）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const { id } = await params;
    const parentProfileId = await resolveParentProfileId(userId);
    const parsed = acceptSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw { code: "VALIDATION_ERROR", status: 400, message: parsed.error.message };
    }
    const accepted = await messagesSvc.accept({
      conversationId: id,
      clientMessageId: parsed.data.clientMessageId,
      content: parsed.data.content,
      attachmentFileObjectIds: parsed.data.attachmentFileObjectIds,
      parentProfileId,
    });
    // 刷新会话最后活动时间
    try { await conversations.update(id, {}, parentProfileId); } catch { /* ignore */ }
    return {
      message: {
        id: accepted.id,
        role: accepted.role,
        clientMessageId: accepted.clientMessageId,
        content: accepted.content,
        generationStatus: accepted.generationStatus,
        sequence: accepted.sequence,
        createdAt: accepted.createdAt.toISOString(),
        attachments: accepted.attachments.map((a) => ({
          id: a.id, ordinal: a.ordinal, fileObjectId: a.fileObjectId,
        })),
      },
    };
  });
}

async function resolveParentProfileId(userId: string): Promise<string> {
  const { prisma } = await import("@/server/prisma");
  const profile = await prisma.parentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw { code: "NOT_FOUND", status: 404, message: "Parent profile not found" };
  return profile.id;
}
