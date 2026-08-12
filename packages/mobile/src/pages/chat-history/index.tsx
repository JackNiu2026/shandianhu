import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import TopBar from "@/components/TopBar";
import { listTutorConversations, type TutorConversation } from "@/services/api";
import { useAppStore } from "@/store";
import "./index.scss";

export default function ChatHistoryPage() {
  const { state } = useAppStore();
  const [items, setItems] = useState<TutorConversation[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!state.activeChild) return;
    setLoading(true);
    void listTutorConversations({ childId: state.activeChild.id, limit: 50 }).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [state.activeChild?.id]);
  return <View className="chat-history-page lt-page"><TopBar eyebrow="SMART TUTOR" title="会话历史" subtitle="查看孩子的 AI 辅导记录" /><View className="lt-content">
    <Text className="lt-page-title">全部会话</Text>
    {loading ? <View className="lt-empty">正在加载会话</View> : items.length === 0 ? <View className="lt-empty">还没有辅导记录</View> : <View className="history-list">{items.map((item) => <View className="history-item lt-card" key={item.id} onClick={() => Taro.navigateTo({ url: `/pages/chat/index?conversationId=${item.id}` })}><Text className="history-title">{item.title || `${item.subject}辅导`}</Text><Text className="history-meta">{new Date(item.lastActivityAt).toLocaleString()}</Text><Text className="history-arrow">›</Text></View>)}</View>}
  </View></View>;
}
