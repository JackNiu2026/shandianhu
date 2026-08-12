/**
 * V2.2 智学辅导：会话聊天页
 *
 * 路由参数：
 *  - conversationId: 已有会话 id
 *  - subject / childId：不传 conversationId 时，按需创建新会话
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Textarea, Button } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import {
  createTutorConversation,
  listTutorConversations,
  listTutorMessages,
  sendTutorUserMessage,
  startTutorStream,
  cancelTutorGeneration,
  type TutorConversation,
  type TutorMessage,
} from "../../services/api";
import "./index.scss";

type RuntimeMsg =
  | (TutorMessage & { kind: "persisted" })
  | {
      kind: "inflight-assistant";
      id: string;
      role: "ASSISTANT";
      content: string;
      generationStatus: "STREAMING" | "CANCELLED" | "COMPLETE" | "FAILED";
      createdAt: string;
    };

function genClientMsgId(): string {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const ChatPage: React.FC = () => {
  const router = useRouter();
  const {
    conversationId: cidFromUrl,
    subject: subjectFromUrl,
    childId: childIdFromUrl,
    title: titleFromUrl,
  } = router.params;

  const [conversation, setConversation] = useState<TutorConversation | null>(null);
  const [messages, setMessages] = useState<RuntimeMsg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const generationIdRef = useRef<string | null>(null);
  const streamAbortRef = useRef<(() => void) | null>(null);
  const scrollAnchorRef = useRef<string>("");

  // 初始化会话
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let conv: TutorConversation | null = null;
        if (cidFromUrl) {
          // 详情路由：/pages/chat?conversationId=xxx
          conv = await (async () => {
            // 复用 list 来避免在 mobile 中还没 get 单会话时出错（list 返回的对象含相同字段）
            const list = await listTutorConversations({ limit: 100 });
            return list.find((c) => c.id === cidFromUrl) ?? null;
          })();
          if (!conv) {
            Taro.showToast({ title: "会话不存在或无权限", icon: "none" });
            return;
          }
        } else if (childIdFromUrl && subjectFromUrl) {
          conv = await createTutorConversation({
            childId: childIdFromUrl,
            subject: subjectFromUrl as any,
            title: titleFromUrl || null,
          });
        } else {
          Taro.showToast({ title: "缺少参数 conversationId 或 subject+childId", icon: "none" });
          return;
        }
        setConversation(conv);
        const msgs = await listTutorMessages(conv.id, 200);
        setMessages(msgs.map((m) => ({ ...m, kind: "persisted" as const })));
        scrollAnchorRef.current = `msg-${msgs.length}`;
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      // 离开页面时主动取消本地产物；服务端生成会继续（不保证 kill）
      streamAbortRef.current?.();
    };
  }, [cidFromUrl, childIdFromUrl, subjectFromUrl, titleFromUrl]);

  const assistantAvatars = useMemo(() => {
    return { user: "我", tutor: labelForSubject(conversation?.subject) };
  }, [conversation?.subject]);

  // 发送
  async function onSend() {
    if (sending || generating || !conversation) return;
    const content = text.trim();
    if (!content) {
      Taro.showToast({ title: "请输入内容", icon: "none" });
      return;
    }
    setSending(true);
    const clientMessageId = genClientMsgId();
    try {
      const userMsg = await sendTutorUserMessage({
        conversationId: conversation.id,
        clientMessageId,
        content,
      });
      setMessages((prev) => [...prev, { ...userMsg, kind: "persisted" as const }]);
      setText("");
      // 立刻启动生成
      kickoffAssistantGeneration(conversation.id, clientMessageId, userMsg.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "发送失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setSending(false);
    }
  }

  function kickoffAssistantGeneration(
    convId: string,
    userClientMsgId: string,
    _justSentUserMsgId: string,
  ) {
    const inflightId = `inflight-${genClientMsgId()}`;
    setGenerating(true);
    setMessages((prev) => [
      ...prev,
      {
        kind: "inflight-assistant",
        id: inflightId,
        role: "ASSISTANT",
        content: "",
        generationStatus: "STREAMING",
        createdAt: new Date().toISOString(),
      },
    ]);

    const handle = startTutorStream({
      conversationId: convId,
      userClientMessageId: userClientMsgId,
      onStart(ev) {
        generationIdRef.current = handle.generationId;
        // 可以在开发调试中展示 assistantMessageId：
        // console.log("[tutor] start assistantMessageId=", ev.assistantMessageId, "model=", ev.model);
        void ev;
      },
      onDelta(ev) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === inflightId && m.kind === "inflight-assistant"
              ? { ...m, content: m.content + ev.text }
              : m,
          ),
        );
        scrollToBottom();
      },
      onUsage(ev) {
        console.log("[tutor] charged points:", ev.chargedPoints);
      },
      onDone(ev) {
        streamAbortRef.current = null;
        setGenerating(false);
        const finalStatus =
          ev.finishReason === "cancelled" ? "CANCELLED" : "COMPLETE";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === inflightId && m.kind === "inflight-assistant"
              ? { ...m, generationStatus: finalStatus }
              : m,
          ),
        );
        scrollToBottom();
        // done 之后拉取一次，把 inflight 替换成持久化的助手消息
        setTimeout(() => {
          (async () => {
            try {
              const persisted = await listTutorMessages(convId, 200);
              setMessages(persisted.map((p) => ({ ...p, kind: "persisted" as const })));
              scrollToBottom();
            } catch { /* ignore */ }
          })();
        }, 200);
      },
      onError(ev) {
        streamAbortRef.current = null;
        setGenerating(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === inflightId && m.kind === "inflight-assistant"
              ? {
                  ...m,
                  generationStatus: "FAILED",
                  content:
                    m.content +
                    `\n\n[生成失败：${ev.code}，${ev.retryable ? "可尝试重新发送" : "请稍后再试"}]`,
                }
              : m,
          ),
        );
        Taro.showToast({
          title: ev.retryable ? "生成失败，可重试" : `错误：${ev.code}`,
          icon: "none",
        });
      },
    });
    streamAbortRef.current = handle.abort;
  }

  function scrollToBottom() {
    try {
      const count = messages.length;
      scrollAnchorRef.current = `msg-${count}`;
      Taro.nextTick(() => {
        Taro.pageScrollTo({ scrollTop: 999999, duration: 80 });
      });
    } catch { /* ignore */ }
  }

  async function onCancelGeneration() {
    const genId = generationIdRef.current;
    // 先本地 abort，再告诉服务端——双保险
    streamAbortRef.current?.();
    if (genId) {
      try { await cancelTutorGeneration(genId); } catch { /* ignore */ }
    } else {
      // 即使拿不到服务端 generation id，也把前端流断开
      Taro.showToast({ title: "已断开本地流", icon: "none" });
    }
  }

  return (
    <View className="chat-page">
      <View className="banner">
        正在接受 <b>{assistantAvatars.tutor}辅导</b>。内容来自 AI，做题前请先独立思考；重要结论需与老师/家长确认。
      </View>

      {loading ? (
        <View className="empty">加载会话中…</View>
      ) : messages.length === 0 ? (
        <View className="empty">
          会话准备就绪！<br />
          可以把题目拍照上传、或者直接把不会的题用文字描述。
        </View>
      ) : (
        <View className="chat-list">
          {messages.map((m, idx) => (
            <View
              key={m.id}
              id={`msg-${idx}`}
              className={`msg-row ${m.role === "USER" ? "user" : ""}`}
            >
              <View className="avatar">{m.role === "USER" ? assistantAvatars.user : "AI"}</View>
              <View
                className={`bubble ${
                  m.kind === "inflight-assistant" && m.generationStatus === "STREAMING"
                    ? "streaming"
                    : ""
                }`}
              >
                <Text>{m.content || (m.kind === "inflight-assistant" && m.generationStatus === "STREAMING" ? "" : " ")}</Text>
                {m.generationStatus && m.generationStatus !== "COMPLETE" ? (
                  <Text className="status-tag">{statusLabel(m.generationStatus)}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      <View className="composer">
        {generating ? (
          <Button className="btn-ghost" onClick={onCancelGeneration}>
            停止生成
          </Button>
        ) : null}
        <View className="composer-row">
          <View className="input-wrap">
            <Textarea
              className="tx"
              value={text}
              onInput={(e) => setText(e.detail.value)}
              placeholder="请输入题目或你想问的问题…"
              autoHeight
              maxlength={2000}
              confirmType="send"
              disabled={sending || generating}
            />
          </View>
          <Button
            className={`btn-primary ${sending || generating ? "disabled" : ""}`}
            onClick={onSend}
            disabled={sending || generating}
          >
            {sending ? "发送中" : generating ? "生成中" : "发送"}
          </Button>
        </View>
      </View>
    </View>
  );
};

function statusLabel(s: string): string {
  switch (s) {
    case "PENDING": return "思考中";
    case "STREAMING": return "打字中";
    case "COMPLETE": return "完成";
    case "CANCELLED": return "已取消";
    case "FAILED": return "失败";
    default: return "";
  }
}

function labelForSubject(subject?: string): string {
  switch (subject) {
    case "CHINESE": return "语文老师";
    case "MATH": return "数学老师";
    case "ENGLISH": return "英语老师";
    case "PHYSICS": return "物理老师";
    case "CHEMISTRY": return "化学老师";
    case "BIOLOGY": return "生物老师";
    case "HISTORY": return "历史老师";
    case "GEOGRAPHY": return "地理老师";
    case "POLITICS": return "道法老师";
    default: return "AI";
  }
}

export default ChatPage;
