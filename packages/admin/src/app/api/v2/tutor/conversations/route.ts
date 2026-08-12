import { ConversationService, MessageService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const conversations = new ConversationService();
const messages = new MessageService();

const createSchema = z.object({
  childId: z.string().min(1),
  subject: z.enum(["CHINESE", "MATH", "ENGLISH", "PHYSICS", "CHEMISTRY"]),
  title: z.string().max(200).optional(),
});

// GET /api/v2/tutor/conversations — 列出指定孩子的会话
// Query: ?childId=xxx&status=ACTIVE|ARCHIVED
export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const url = new URL(request.url);
    const childId = url.searchParams.get("childId");
    if (!childId) {
      // fall back: get active child
      throw { code: "VALIDATION_ERROR", status: 400, message: "childId is required" };
    }
    const status = (url.searchParams.get("status") as "ACTIVE" | "ARCHIVED" | undefined);
    const parentProfileId = await resolveParentProfileId(userId);
    const list = await conversations.listByChild(parentProfileId, childId, status, 100);
    return {
      conversations: list.map((c) => ({
        id: c.id,
        childId: c.childId,
        agentId: c.agentId,
        subject: c.subject,
        schoolStage: c.schoolStage,
        status: c.status,
        title: c.title,
        lastActivityAt: c.lastActivityAt.toISOString(),
        promptVersionSequence: c.promptVersionSequence,
      })),
    };
  });
}

// POST /api/v2/tutor/conversations — 创建会话
export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw { code: "VALIDATION_ERROR", status: 400, message: parsed.error.message };
    }
    const parentProfileId = await resolveParentProfileId(userId);
    const created = await conversations.create({
      parentProfileId,
      childId: parsed.data.childId,
      subject: parsed.data.subject,
      title: parsed.data.title ?? null,
    });
    return {
      conversation: {
        id: created.id,
        childId: created.childId,
        agentId: created.agentId,
        subject: created.subject,
        schoolStage: created.schoolStage,
        status: created.status,
        title: created.title,
        lastActivityAt: created.lastActivityAt.toISOString(),
        promptVersionSequence: created.promptVersionSequence,
      },
    };
  });
}

async function resolveParentProfileId(userId: string): Promise<string> {
  // Lazy import to avoid circular dependencies; this route only needs the database client here.
  // 实际项目中通过 ParentProfileService。为保持隔离，调用 prisma 直查：
  const { prisma } = await import("@/server/prisma");
  const profile = await prisma.parentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw { code: "NOT_FOUND", status: 404, message: "Parent profile not found" };
  return profile.id;
}
