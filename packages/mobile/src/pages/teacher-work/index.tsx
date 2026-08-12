/**
 * V2.3 老师工作台 — "工作" tab
 *
 * 聚合展示：
 * - 待处理试听（REQUESTED/ACCEPTED/RESCHEDULE_PROPOSED）
 * - 即将到来的课程
 * - 待反馈课程
 * - 当前服务状态
 */
import { useCallback, useEffect, useState } from "react";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { TeacherWorkspaceNav } from "@/components/TeacherWorkspaceNav";
import { TopBar } from "@/components/TopBar";
import {
  fetchTeacherDashboard,
  performTrialAction,
  type TeacherDashboard,
  type TrialBookingSummary,
} from "@/services/api";
import "./index.scss";

export default function TeacherWorkPage() {
  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTeacherDashboard();
      setDashboard(data);
    } catch {
      // 暂停/封禁老师会收到 FORBIDDEN，提示并跳转到"我的"
      Taro.showToast({ title: "加载失败，请稍后重试", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useDidShow(() => { void load(); });

  // 老师对试听执行接受/拒绝动作
  const onTrialAction = async (trial: TrialBookingSummary, action: "ACCEPT" | "REJECT") => {
    if (acting) return;
    setActing(true);
    try {
      await performTrialAction(trial.id, { action, version: trial.version });
      Taro.showToast({ title: action === "ACCEPT" ? "已接受" : "已拒绝", icon: "success" });
      await load();
    } catch {
      Taro.showToast({ title: "操作失败", icon: "none" });
    } finally {
      setActing(false);
    }
  };

  // 跳转到试听详情（试听状态页）
  const goToTrialStatus = (trialId: string) => {
    void Taro.navigateTo({ url: `/pages/trial-status/index?trialId=${trialId}` });
  };

  // 跳转到反馈页
  const goToFeedback = (lessonId: string) => {
    void Taro.navigateTo({ url: `/pages/teacher-feedback/index?lessonId=${lessonId}` });
  };

  return (
    <View className="teacher-work-screen">
      <TopBar eyebrow="TEACHER" title="工作台" subtitle="待办与今日安排" />

      <ScrollView scrollY className="work-body">
        {/* 服务状态标识 */}
        <View className="status-badge">
          <Text className="status-label">服务状态</Text>
          <Text className={`status-value ${dashboard?.serviceStatus === "ACTIVE" ? "active" : "inactive"}`}>
            {dashboard?.serviceStatus === "ACTIVE" ? "在线" : dashboard?.serviceStatus ?? "加载中"}
          </Text>
        </View>

        {loading && !dashboard ? (
          <View className="work-empty">加载中…</View>
        ) : !dashboard ? (
          <View className="work-empty">暂无数据</View>
        ) : (
          <>
            {/* 待处理试听 */}
            <View className="section">
              <Text className="section-title">待处理试听 ({dashboard.pendingTrials.length})</Text>
              {dashboard.pendingTrials.length === 0 ? (
                <View className="work-empty">暂无待处理试听</View>
              ) : (
                dashboard.pendingTrials.map((trial) => (
                  <View key={trial.id} className="trial-card" onClick={() => goToTrialStatus(trial.id)}>
                    <View className="trial-head">
                      <Text className="trial-subject">{labelSubject(trial.subject)}</Text>
                      <Text className="trial-status">{labelTrialStatus(trial.status)}</Text>
                    </View>
                    <Text className="trial-time">
                      {formatDateTime(trial.startsAt)} — {formatDateTime(trial.endsAt)}
                    </Text>
                    <View className="trial-actions">
                      <Button
                        className="action-btn accept"
                        onClick={(e) => { e.stopPropagation(); void onTrialAction(trial, "ACCEPT"); }}
                        disabled={acting}
                      >
                        接受
                      </Button>
                      <Button
                        className="action-btn reject"
                        onClick={(e) => { e.stopPropagation(); void onTrialAction(trial, "REJECT"); }}
                        disabled={acting}
                      >
                        拒绝
                      </Button>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* 即将到来的课程 */}
            <View className="section">
              <Text className="section-title">即将到来 ({dashboard.upcomingLessons.length})</Text>
              {dashboard.upcomingLessons.length === 0 ? (
                <View className="work-empty">暂无即将到来的课程</View>
              ) : (
                dashboard.upcomingLessons.map((lesson) => (
                  <View key={lesson.id} className="lesson-card">
                    <View className="lesson-head">
                      <Text className="lesson-subject">{labelSubject(lesson.subject)}</Text>
                      <Text className="lesson-status">{labelLessonStatus(lesson.status)}</Text>
                    </View>
                    <Text className="lesson-time">{formatDateTime(lesson.startsAt)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* 待反馈课程 */}
            <View className="section">
              <Text className="section-title">待反馈 ({dashboard.lessonsAwaitingFeedback.length})</Text>
              {dashboard.lessonsAwaitingFeedback.length === 0 ? (
                <View className="work-empty">暂无待反馈课程</View>
              ) : (
                dashboard.lessonsAwaitingFeedback.map((lesson) => (
                  <View key={lesson.id} className="lesson-card" onClick={() => goToFeedback(lesson.id)}>
                    <View className="lesson-head">
                      <Text className="lesson-subject">{labelSubject(lesson.subject)}</Text>
                      <Text className="lesson-status">待反馈</Text>
                    </View>
                    <Text className="lesson-time">{formatDateTime(lesson.startsAt)} 已完成</Text>
                    <Text className="lesson-hint">点击填写课程反馈</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <TeacherWorkspaceNav />
    </View>
  );
}

// ─── 辅助函数 ──────────────────────────────────────────────

function labelSubject(subject: string): string {
  const map: Record<string, string> = {
    CHINESE: "语文", MATH: "数学", ENGLISH: "英语", PHYSICS: "物理",
    CHEMISTRY: "化学", BIOLOGY: "生物", HISTORY: "历史", GEOGRAPHY: "地理", POLITICS: "道法",
  };
  return map[subject] ?? subject;
}

function labelTrialStatus(status: string): string {
  const map: Record<string, string> = {
    REQUESTED: "待处理", ACCEPTED: "已接受", RESCHEDULE_PROPOSED: "建议改期",
    REJECTED: "已拒绝", PARENT_CONFIRMED: "家长已确认", READY: "已就绪",
    COMPLETED: "已完成", CANCELLED: "已取消",
  };
  return map[status] ?? status;
}

function labelLessonStatus(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: "已排课", IN_PROGRESS: "进行中", COMPLETED: "已完成",
    CANCELLED: "已取消", NO_SHOW: "缺席",
  };
  return map[status] ?? status;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return iso; }
}
