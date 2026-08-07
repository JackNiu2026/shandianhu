import { useState, useEffect, useCallback } from "react";
import { View, Text, Input, ScrollView } from "@tarojs/components";
import { fetchMessages, sendMessage } from "@/services/api";
import { TopBar } from "@/components/TopBar";
import { useAppStore } from "@/store";
import "./index.scss";

type ChatMsg = { id: string; mine: boolean; text: string; time: string };

export default function ChatPage() {
  const { state } = useAppStore();
  const [inChat, setInChat] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);

  const contactId = state.booked?.teacherId || null;
  const contactName = state.booked?.teacher || "老师";

  const loadMessages = useCallback(async () => {
    if (!state.parentId || !contactId) return;
    setLoading(true);
    try {
      const res = await fetchMessages(contactId);
      const mapped = res.data.map((m) => ({
        id: m.id,
        mine: m.mine,
        text: m.content,
        time: new Date(m.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      }));
      setMessages(mapped);
    } catch (err) {
      console.error("[Chat] 加载消息失败", err);
    } finally {
      setLoading(false);
    }
  }, [state.parentId, contactId]);

  useEffect(() => {
    if (inChat) {
      loadMessages();
    }
  }, [inChat, loadMessages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !contactId) return;
    const text = message.trim();
    setMessage("");

    // 乐观更新
    const tempMsg: ChatMsg = {
      id: `temp-${Date.now()}`,
      mine: true,
      text,
      time: "刚刚",
    };
    setMessages((old) => [...old, tempMsg]);

    try {
      await sendMessage(contactId, text);
      // 重新加载以获取服务端返回的真实消息
      loadMessages();
    } catch (err) {
      console.error("[Chat] 发送消息失败", err);
      // 失败时标记消息
      setMessages((old) =>
        old.map((m) =>
          m.id === tempMsg.id ? { ...m, text: `${text} (发送失败)` } : m
        )
      );
    }
  };

  return (
    <View className="chat-screen">
      <TopBar />
      {!inChat ? (
        <>
          <View className="chat-list-title">
            <Text className="h1">消息</Text>
            <Text className="span">
              {messages.length > 0
                ? `${messages.length} 条消息`
                : "暂无未读"}
            </Text>
          </View>
          {messages.length > 0 ? (
            <View
              className="chat-contact"
              onClick={() => setInChat(true)}
            >
              <View className="chat-avatar">
                <Text>{contactName?.[0] || "师"}</Text>
              </View>
              <View>
                <Text className="h3">
                  {contactName} <Text className="i">✓</Text>
                </Text>
                <Text className="p">
                  {messages[messages.length - 1]?.text || "点击开始对话"}
                </Text>
              </View>
              <Text className="time">
                {messages[messages.length - 1]?.time || ""}
              </Text>
            </View>
          ) : (
            <View className="chat-empty">
              <Text className="span">◌</Text>
              <Text className="p">
                约过试听的老师会出现在这里，聊过再决定要不要长期跟。
              </Text>
            </View>
          )}
        </>
      ) : (
        <View className="conversation">
          <View className="conversation-head">
            <View className="button" onClick={() => setInChat(false)}>
              <Text>‹</Text>
            </View>
            <View className="chat-avatar small">
              <Text>{contactName?.[0] || "师"}</Text>
            </View>
            <Text className="b">{contactName}</Text>
            <Text className="span">•••</Text>
          </View>
          <View className="date-label">
            <Text>今天</Text>
          </View>
          <ScrollView
            className="message-stack"
            scrollY
            scrollTop={99999}
          >
            {loading && messages.length === 0 ? (
              <View className="chat-empty">
                <Text className="p">加载中...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View className="chat-empty">
                <Text className="p">还没有消息，打个招呼吧！</Text>
              </View>
            ) : (
              messages.map((m) => (
                <View className={`bubble-row ${m.mine ? "mine" : ""}`} key={m.id}>
                  {!m.mine && (
                    <View className="chat-avatar tiny">
                      <Text>{contactName?.[0] || "师"}</Text>
                    </View>
                  )}
                  <View className="bubble-body">
                    <Text className="bubble">{m.text}</Text>
                    <Text className="time">{m.time}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          <View className="message-input">
            <View className="button">
              <Text>＋</Text>
            </View>
            <Input
              value={message}
              onInput={(e) => setMessage(e.detail.value)}
              onConfirm={() => handleSendMessage()}
              placeholder="聊聊孩子的学习情况"
            />
            <View className="send" onClick={handleSendMessage}>
              <Text>发送</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
