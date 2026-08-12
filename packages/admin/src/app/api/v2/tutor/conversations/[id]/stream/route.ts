import {
  ConversationService,
  MessageService,
  QuotaService,
  StreamService,
  defaultCancellationRegistry,
  AgentService,
  buildContext,
  contextToSystemMessage,
  NdjsonFrameEncoder,
  OpenAiCompatibleGateway,
} from "@lightning-tiger/server";
import { NextResponse, type NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { randomUUID } from "node:crypto";

const conversations = new ConversationService();
const messagesSvc = new MessageService();
const quota = new QuotaService();
const agents = new AgentService();
const gateway = new OpenAiCompatibleGateway();

const streams = new StreamService({
  quota: quota as unknown as StreamService["deps"]["quota"],
  messages: messagesSvc as unknown as StreamService["deps"]["messages"],
  conversations: conversations as unknown as StreamService["deps"]["conversations"],
}, randomUUID);

/**
 * POST /api/v2/tutor/conversations/[id]/stream
 * Body: { userClientMessageId: string }
 *
 * 执行流程：
 *  1. 鉴权家长 + 会话
 *  2. 调用 StreamService.begin 预占积分 + 创建助手 PENDING 消息
 *  3. 拉上下文并调用已启用模型配置；模型失败时释放预占额度
 *  4. 发 start → delta → usage → done，设置 assistant 消息状态
 *  5. 客户端调用 cancel 路由 → runtime.cancelled=true → 本次响应循环下一次 delta 检查后发送 done(cancelled)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticatedUserId(request);
  const { id: conversationId } = await params;
  const parentProfileId = await resolveParentProfileId(userId);
  const body = await request.json().catch(() => ({})) as { userClientMessageId?: string };

  // 拉会话详情 + 最近消息
  const conv = await conversations.get(conversationId, parentProfileId);
  const agent = await agents.findById(conv.agentId);
  if (!agent || !agent.publishedPromptVersion) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: { code: "RESOURCE_CONFLICT", message: "Agent not ready" } }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  }

  // 组装上下文（简化：取 publish prompt + 会话消息）
  const recent = await messagesSvc.listRecent(conversationId, 30);
  const ctxParts = await buildContext({
    publishedPromptContent: agent.publishedPromptVersion.content,
    childProfileSummary: null, // 画像部分在后续 Task 10 中接入
    currentTaskContent: body.userClientMessageId
      ? (recent.find((m) => m.clientMessageId === body.userClientMessageId)?.content ?? "")
      : (recent.filter((m) => m.role === "USER").slice(-1)[0]?.content ?? ""),
    relevantHistory: [],
    conversationMessages: recent
      .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
      .map((m) => ({ role: m.role as "USER" | "ASSISTANT", content: m.content })),
  });
  const systemPrompt = contextToSystemMessage(ctxParts);

  const generation = await streams.begin({
    conversationId,
    parentProfileId,
    inputTokens: 500,
    maxOutputTokens: agent.maxOutputTokens ?? 2048,
    images: 0,
    purpose: "AI_TUTORING",
  });

  // 启动流式 NDJSON Response
  const encoder = new NdjsonFrameEncoder();
  const generationId = generation.generationId;
  const runtime = defaultCancellationRegistry.get(generationId) ?? generation.runtime;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      try {
        // start frame
        controller.enqueue(encoder.start({ assistantMessageId: generation.assistantMessageId, model: "primary" }));

        const completion = await gateway.completeText({
          purpose: "AI_TUTORING",
          userId,
          childId: conv.childId,
          messages: [
            { role: "system", content: systemPrompt },
            ...recent
              .filter((message) => message.role === "USER" || message.role === "ASSISTANT")
              .map((message) => ({ role: message.role.toLowerCase() as "user" | "assistant", content: message.content })),
          ],
        });
        const deltas = splitForNdjson(completion.output);
        for (const delta of deltas) {
          if (runtime.cancelled) break;
          assistantText += delta;
          controller.enqueue(encoder.delta(delta));
          await messagesSvc.updateAssistantProgress(generation.assistantMessageId, assistantText);
        }
        if (runtime.cancelled) {
          controller.enqueue(encoder.done("cancelled"));
          await streams.finish({
            generationId,
            assistantMessageId: generation.assistantMessageId,
            reservationId: generation.reservationId,
            conversationId,
            parentProfileId,
            childId: conv.childId,
            finalText: assistantText,
            finishReason: "cancelled",
          });
        } else {
          controller.enqueue(encoder.usage(10));
          controller.enqueue(encoder.done("stop"));
          await streams.finish({
            generationId,
            assistantMessageId: generation.assistantMessageId,
            reservationId: generation.reservationId,
            conversationId,
            parentProfileId,
            childId: conv.childId,
            finalText: assistantText,
            finishReason: "stop",
            usage: { inputTokens: Math.max(1, Math.ceil(systemPrompt.length / 4)), outputTokens: Math.max(1, Math.ceil(assistantText.length / 4)), images: 0 },
            modelCallId: completion.callId,
          });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encoder.error("MODEL_UNAVAILABLE", true));
        await streams.fail({
          generationId,
          assistantMessageId: generation.assistantMessageId,
          reservationId: generation.reservationId,
          conversationId,
          parentProfileId,
          childId: conv.childId,
          reason: msg,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "transfer-encoding": "chunked",
      "cache-control": "no-store",
      "x-generation-id": generationId,
    },
  });
}

async function resolveParentProfileId(userId: string): Promise<string> {
  const { prisma } = await import("@/server/prisma");
  const profile = await prisma.parentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw new Response(JSON.stringify({ ok: false, error: "NOT_FOUND" }), { status: 404 }) as unknown as never;
  return profile.id;
}

// Next.js 动态路由处理：强制不使用 Next 自动 JSON 封装（该接口直接返回 Response）
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function splitForNdjson(text: string): string[] {
  const chunks = text.match(/[\s\S]{1,160}/g);
  return chunks && chunks.length > 0 ? chunks : ["抱歉，模型没有返回内容。"];
}
