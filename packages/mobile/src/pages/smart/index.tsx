/**
 * V2.2 "智学" 首页（原来 "家教" tab 切换为 AI 辅导入口）
 *
 * 功能：
 * - 当前孩子切换 + 学科快捷卡片，点击直接打开会话页（没会话时自动创建）
 * - 最近会话快捷列表（最后 5 条，点击跳会话）
 * - 打开"全部会话历史"入口（pages/tutors/index）
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useAppStore } from "@/store";
import {
  listTutorConversations,
  type TutorConversation,
  type TutorSubject,
} from "../../services/api";
import TopBar from "../../components/TopBar";
import "./index.scss";

type SubjectEntry = { id: string; key: TutorSubject; label: string; caption: string; focus?: string };

const SUBJECTS: SubjectEntry[] = [
  { id: "chinese", key: "CHINESE", label: "语文", caption: "阅读与写作" },
  { id: "math", key: "MATH", label: "数学", caption: "思路与解题" },
  { id: "english-speaking", key: "ENGLISH", label: "英语口语", caption: "表达与对话", focus: "speaking" },
  { id: "english-words", key: "ENGLISH", label: "英语单词", caption: "词汇与记忆", focus: "vocabulary" },
  { id: "physics", key: "PHYSICS", label: "物理", caption: "概念与推导" },
  { id: "chemistry", key: "CHEMISTRY", label: "化学", caption: "反应与实验" },
];

const SmartPage: React.FC = () => {
  const { state } = useAppStore();
  const activeChild = state.activeChild;
  const [recent, setRecent] = useState<TutorConversation[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const subjectMap = useMemo(() => {
    const map: Record<string, (typeof SUBJECTS)[number]> = {};
    SUBJECTS.forEach((s) => { if (!map[s.key]) map[s.key] = s; });
    return map;
  }, []);

  useEffect(() => {
    if (!activeChild) {
      setRecent([]);
      return;
    }
    (async () => {
      setRecentLoading(true);
      try {
        const list = await listTutorConversations({ childId: activeChild.id, limit: 5 });
        setRecent(list);
      } catch (err) {
        console.warn("加载最近会话失败", err);
      } finally {
        setRecentLoading(false);
      }
    })();
  }, [activeChild?.id]);

  const onPickSubject = useCallback(
    (entry: SubjectEntry) => {
      if (!activeChild) {
        Taro.showToast({ title: "请先在“我的”中设置孩子档案", icon: "none" });
        return;
      }
      // 如果有最近会话同 subject，直接打开最新；否则由 chat 页创建
      const expectedTitle = entry.focus ? `${entry.label}辅导` : undefined;
      const sameSubjectRecent = recent.find((r) =>
        r.subject === entry.key && (!expectedTitle || r.title === expectedTitle),
      );
      const params = sameSubjectRecent
        ? { conversationId: sameSubjectRecent.id }
        : { subject: entry.key, childId: activeChild.id, focus: entry.focus, title: expectedTitle };
      void Taro.navigateTo({
        url: withParams("/pages/chat/index", params),
      });
    },
    [activeChild, recent],
  );

  const onOpenConversation = useCallback((c: TutorConversation) => {
    void Taro.navigateTo({ url: withParams("/pages/chat/index", { conversationId: c.id }) });
  }, []);

  const onOpenAllConversations = useCallback(() => {
    void Taro.navigateTo({ url: "/pages/chat-history/index" });
  }, []);

  return (
    <View className="smart-root lt-page">
      <TopBar />
      <View className="lt-content">
        <Text className="lt-eyebrow">SMART TUTOR</Text>
        <Text className="lt-page-title">今天想解决什么问题？</Text>
        <Text className="lt-page-intro">选择学科，进入专属 AI 辅导工作台。</Text>

        <View className="subject-panel lt-card">
          <View className="subject-grid">
            {SUBJECTS.map((s, index) => (
              <View key={s.id} className={`subject-card subject-${index + 1}`} onClick={() => onPickSubject(s)}>
                <View className="subject-symbol"><Text>{s.label.slice(0, 1)}</Text></View>
                <Text className="subject-label">{s.label}</Text>
                <Text className="subject-caption">{s.caption}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="lt-section-head">
          <Text className="lt-section-title">最近会话</Text>
          <Text className="lt-section-action" onClick={onOpenAllConversations}>查看全部</Text>
        </View>
      {recentLoading ? (
        <View className="lt-empty">正在加载会话</View>
      ) : !activeChild ? (
        <View className="lt-empty" onClick={() => Taro.switchTab({ url: "/pages/me/index" })}>
          请先在“我的”中完成孩子档案设置
        </View>
      ) : recent.length === 0 ? (
        <View className="lt-empty">还没有辅导记录，从上方选择一个学科开始</View>
      ) : (
        <View className="history-list">
          {recent.map((r) => {
            const s = SUBJECTS.find((item) => r.title === `${item.label}辅导`) ?? subjectMap[r.subject];
            return (
              <View key={r.id} className="history-item" onClick={() => onOpenConversation(r)}>
                <View className="history-symbol"><Text>{s?.label?.slice(0, 1) ?? "学"}</Text></View>
                <View className="history-text">
                  <Text className="history-title">
                    {r.title || `${s?.label ?? r.subject}辅导`}
                  </Text>
                  <Text className="history-meta">
                    {activeChild?.displayName ?? "孩子"} · {formatTime(r.lastActivityAt)}
                  </Text>
                </View>
                <Text className="history-arrow">›</Text>
              </View>
            );
          })}
        </View>
      )}
      </View>
    </View>
  );
};

export default SmartPage;

// helpers ------------------------------------------------------------------

function withParams(path: string, params: Record<string, string | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join("&");
  return qs ? `${path}?${qs}` : path;
}

function formatTime(iso: string): string {
  try {
    const now = Date.now();
    const t = new Date(iso).getTime();
    const diffMs = now - t;
    if (diffMs < 60 * 1000) return "刚刚";
    if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / 60000)}分钟前`;
    if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / 3600000)}小时前`;
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}
function pad(n: number): string { return n < 10 ? `0${n}` : String(n); }
