import { ConversationService, MessageService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";
import { authenticatedUserId } from "@/lib/v2-auth";

const conversations = new ConversationService();
const messages = new MessageService();

// GET /api/v2/tutor/conversations/[id] — 会话详情 + 最近消息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const { id } = await params;
    const parentProfileId = await resolveParentProfileId(userId);
    const detail = await conversations.get(id, parentProfileId);
    const recent = await messages.listRecent(id, 100);
    return {
      conversation: {
        id: detail.id,
        childId: detail.childId,
        agentId: detail.agentId,
        subject: detail.subject,
        schoolStage: detail.schoolStage,
        status: detail.status,
        title: detail.title,
        lastActivityAt: detail.lastActivityAt.toISOString(),
        promptVersionSequence: detail.promptVersionSequence,
      },
      messages: recent.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        generationStatus: m.generationStatus,
        sequence: m.sequence,
        createdAt: m.createdAt.toISOString(),
        clientMessageId: m.clientMessageId,
        attachments: (m.attachments ?? []).map((a) => ({
          id: a.id,
          ordinal: a.ordinal,
          fileObjectId: a.fileObjectId,
        })),
      })),
    };
  });
}

// PATCH /api/v2/tutor/conversations/[id] — 更新 status/title（归档/改名）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const { id } = await params;
    const parentProfileId = await resolveParentProfileId(userId);
    const body = await request.json() as { status?: "ACTIVE" | "ARCHIVED"; title?: string | null };
    const patch: { status?: "ACTIVE" | "ARCHIVED"; title?: string | null } = {};
    if (body.status !== undefined) patch.status = body.status;
    if (body.title !== undefined) patch.title = body.title;
    const updated = await conversations.update(id, patch, parentProfileId);
    return {
      conversation: {
        id: updated.id,
        status: updated.status,
        title: updated.title,
        lastActivityAt: updated.lastActivityAt.toISOString(),
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
