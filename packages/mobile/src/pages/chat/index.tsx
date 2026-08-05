import { useState } from "react";
import { View, Text, Input } from "@tarojs/components";
import "./index.scss";

type ChatMsg = { mine: boolean; text: string; time: string };

export default function ChatPage() {
  const [inChat, setInChat] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([
    { mine: false, text: "周六下午可以先安排一次免费试听，了解一下孩子目前的学习情况。", time: "10:16" },
    { mine: true, text: "好的老师！他最近数学应用题有点没信心。", time: "10:18" },
  ]);

  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages((old) => [...old, { mine: true, text: message.trim(), time: "刚刚" }]);
    setMessage("");
  };

  return (
    <View className="chat-screen">
      {!inChat ? (
        <>
          <View className="chat-list-title">
            <Text>消息</Text>
            <Text>1 条未读</Text>
          </View>
          <View className="chat-contact" onClick={() => setInChat(true)}>
            <View className="chat-avatar">
              <Text>林</Text>
            </View>
            <View>
              <Text>
                林知夏老师 <Text>✓</Text>
              </Text>
              <Text>{messages[messages.length - 1].text}</Text>
            </View>
            <Text>10:18</Text>
          </View>
          <View className="chat-empty">
            <Text>◌</Text>
            <Text>约过试听的老师会出现在这里，聊过再决定要不要长期跟。</Text>
          </View>
        </>
      ) : (
        <View className="conversation">
          <View className="conversation-head">
            <View onClick={() => setInChat(false)}>
              <Text>‹</Text>
            </View>
            <View className="chat-avatar small">
              <Text>林</Text>
            </View>
            <Text>林知夏老师</Text>
            <Text>•••</Text>
          </View>
          <View className="date-label">
            <Text>今天</Text>
          </View>
          <View className="message-stack">
            {messages.map((m, i) => (
              <View className={`bubble-row ${m.mine ? "mine" : ""}`} key={i}>
                {!m.mine && (
                  <View className="chat-avatar tiny">
                    <Text>林</Text>
                  </View>
                )}
                <View>
                  <Text className="bubble">{m.text}</Text>
                  <Text>{m.time}</Text>
                </View>
              </View>
            ))}
          </View>
          <View className="message-input">
            <View>
              <Text>＋</Text>
            </View>
            <Input
              value={message}
              onInput={(e) => setMessage(e.detail.value)}
              onConfirm={() => sendMessage()}
              placeholder="聊聊孩子的学习情况"
            />
            <View className="send" onClick={sendMessage}>
              <Text>发送</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
