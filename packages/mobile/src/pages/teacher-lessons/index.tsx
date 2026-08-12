/**
 * V2.3 老师课程 — "课程" tab
 *
 * 展示老师所有课程列表，按状态过滤，可标记课程完成。
 */
import { useCallback, useEffect, useState } from "react";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { TeacherWorkspaceNav } from "@/components/TeacherWorkspaceNav";
import { TopBar } from "@/components/TopBar";
import {
  completeLesson,
  listTeacherLessons,
  type LessonStatus,
  type LessonSummary,
} from "@/services/api";
import "./index.scss";

const STATUS_FILTERS: Array<{ key: LessonStatus | "ALL"; label: string }> = [
  { key: "ALL", label: "全部" },
  { key: "SCHEDULED", label: "已排课" },
  { key: "IN_PROGRESS", label: "进行中" },
  { key: "COMPLETED", label: "已完成" },
  { key: "CANCELLED", label: "已取消" },
];

export default function TeacherLessonsPage() {
  const [filter, setFilter] = useState<LessonStatus | "ALL">("ALL");
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTeacherLessons(filter === "ALL" ? undefined : filter);
      setLessons(data);
    } catch {
      Taro.showToast({ title: "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);
  useDidShow(() => { void load(); });

  // 标记课程完成
  const onComplete = async (lessonId: string) => {
    if (completing) return;
    setCompleting(true);
    try {
      await completeLesson(lessonId);
      Taro.showToast({ title: "已完成", icon: "success" });
      await load();
    } catch {
      Taro.showToast({ title: "操作失败", icon: "none" });
    } finally {
      setCompleting(false);
    }
  };

  // 跳转到反馈页
  const goToFeedback = (lessonId: string) => {
    void Taro.navigateTo({ url: `/pages/teacher-feedback/index?lessonId=${lessonId}` });
  };

  return (
    <View className="teacher-lessons-screen">
      <TopBar eyebrow="TEACHER" title="课程" subtitle="我的课程安排" />

      <ScrollView scrollX enhanced showScrollbar={false} className="filter-strip">
        {STATUS_FILTERS.map((s) => (
          <View
            key={s.key}
            className={`filter-chip ${filter === s.key ? "active" : ""}`}
            onClick={() => setFilter(s.key)}
          >
            <Text>{s.label}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView scrollY className="lessons-body">
        {loading && lessons.length === 0 ? (
          <View className="lessons-empty">加载中…</View>
        ) : lessons.length === 0 ? (
          <View className="lessons-empty">暂无课程</View>
        ) : (
          lessons.map((lesson) => (
            <View key={lesson.id} className="lesson-item">
              <View className="lesson-head">
                <Text className="lesson-subject">{labelSubject(lesson.subject)}</Text>
                <Text className="lesson-status">{labelStatus(lesson.status)}</Text>
              </View>
              <Text className="lesson-time">
                {formatDateTime(lesson.startsAt)} — {formatDateTime(lesson.endsAt)}
              </Text>
              {lesson.mode && (
                <Text className="lesson-mode">{labelMode(lesson.mode)}</Text>
              )}
              <View className="lesson-actions">
                {(lesson.status === "SCHEDULED" || lesson.status === "IN_PROGRESS") && (
                  <Button
                    className="action-btn complete"
                    onClick={() => goToFeedback(lesson.id)}
                    disabled={completing}
                  >
                    完成并反馈
                  </Button>
                )}
                {lesson.status === "COMPLETED" && (
                  <Button
                    className="action-btn feedback"
                    onClick={() => goToFeedback(lesson.id)}
                  >
                    {lesson.hasFeedback ? "查看反馈" : "填写反馈"}
                  </Button>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TeacherWorkspaceNav />
    </View>
  );
}

function labelSubject(subject: string): string {
  const map: Record<string, string> = {
    CHINESE: "语文", MATH: "数学", ENGLISH: "英语", PHYSICS: "物理",
    CHEMISTRY: "化学", BIOLOGY: "生物", HISTORY: "历史", GEOGRAPHY: "地理", POLITICS: "道法",
  };
  return map[subject] ?? subject;
}

function labelStatus(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: "已排课", IN_PROGRESS: "进行中", COMPLETED: "已完成",
    CANCELLED: "已取消", NO_SHOW: "缺席",
  };
  return map[status] ?? status;
}

function labelMode(mode: string): string {
  const map: Record<string, string> = { ONLINE: "线上", IN_HOME: "上门", IN_CENTER: "中心" };
  return map[mode] ?? mode;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return iso; }
}
