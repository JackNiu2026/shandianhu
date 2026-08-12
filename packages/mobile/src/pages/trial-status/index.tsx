/**
 * V2.3 试听状态页（家长和老师共用）
 *
 * 展示完整 BookingChange 时间线，并提供当前角色允许的单一下一步：
 * - 家长：REQUESTED → 等待老师确认；RESCHEDULE_PROPOSED → 确认/拒绝改期
 * - 老师：REQUESTED → 接受/拒绝；ACCEPTED → 标记就绪；READY → 完成
 * 所有角色：CANCELLED / REJECTED / COMPLETED → 仅展示最终状态
 */
import { useCallback, useEffect, useState } from "react";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useRouter, useDidShow } from "@tarojs/taro";
import { TopBar } from "@/components/TopBar";
import {
  getTrialDetail,
  performTrialAction,
  type TrialBookingDetail,
} from "@/services/api";
import "./index.scss";

export default function TrialStatusPage() {
  const router = useRouter();
  const trialId = router.params.trialId || "";

  const [trial, setTrial] = useState<TrialBookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!trialId) return;
    setLoading(true);
    try {
      const data = await getTrialDetail(trialId);
      setTrial(data);
    } catch {
      Taro.showToast({ title: "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, [trialId]);

  useEffect(() => { void load(); }, [load]);
  useDidShow(() => { void load(); });

  // 老师执行动作
  const onTeacherAction = async (
    action: "ACCEPT" | "REJECT" | "MARK_READY" | "COMPLETE" | "CANCEL",
    extra?: { proposedStartsAt?: string; proposedEndsAt?: string; reason?: string },
  ) => {
    if (acting || !trial) return;
    setActing(true);
    try {
      const updated = await performTrialAction(trial.id, {
        action,
        version: trial.version,
        ...extra,
      });
      // 重新加载以获取最新状态和时间线
      await load();
      Taro.showToast({ title: "操作成功", icon: "success" });
    } catch {
      Taro.showToast({ title: "操作失败", icon: "none" });
    } finally {
      setActing(false);
    }
  };

  return (
    <View className="trial-status-screen">
      <TopBar eyebrow="TRIAL" title="试听状态" subtitle="查看进度与时间线" />

      <ScrollView scrollY className="status-body">
        {loading && !trial ? (
          <View className="status-empty">加载中…</View>
        ) : !trial ? (
          <View className="status-empty">未找到试听记录</View>
        ) : (
          <>
            {/* 状态概览卡 */}
            <View className="status-card">
              <View className="status-head">
                <Text className="status-subject">{labelSubject(trial.subject)}</Text>
                <Text className={`status-badge ${trial.status.toLowerCase()}`}>
                  {labelStatus(trial.status)}
                </Text>
              </View>
              <Text className="status-time">
                {formatDateTime(trial.startsAt)} — {formatDateTime(trial.endsAt)}
              </Text>
              {trial.mode && (
                <Text className="status-mode">{labelMode(trial.mode)}</Text>
              )}
              {trial.parentNote && (
                <View className="status-note">
                  <Text className="note-label">家长备注</Text>
                  <Text className="note-text">{trial.parentNote}</Text>
                </View>
              )}
            </View>

            {/* 变更时间线 */}
            <View className="section">
              <Text className="section-title">变更历史</Text>
              {trial.changes.length === 0 ? (
                <View className="status-empty">暂无变更记录</View>
              ) : (
                <View className="timeline">
                  {trial.changes.map((change) => (
                    <View key={change.id} className="timeline-item">
                      <View className="timeline-dot" />
                      <View className="timeline-content">
                        <Text className="timeline-action">{labelAction(change.action)}</Text>
                        <Text className="timeline-status">
                          {labelStatus(change.fromStatus)} → {labelStatus(change.toStatus)}
                        </Text>
                        {change.reason && (
                          <Text className="timeline-reason">{change.reason}</Text>
                        )}
                        <Text className="timeline-time">{formatDateTime(change.createdAt)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 当前角色可执行的动作 */}
            <View className="section">
              <Text className="section-title">可执行操作</Text>
              <View className="action-area">
                {renderActions(trial, acting, onTeacherAction)}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── 渲染当前状态下的可用操作 ──────────────────────────────

function renderActions(
  trial: TrialBookingDetail,
  acting: boolean,
  onAction: (action: "ACCEPT" | "REJECT" | "MARK_READY" | "COMPLETE" | "CANCEL") => void,
) {
  switch (trial.status) {
    case "REQUESTED":
      return (
        <>
          <Text className="action-hint">老师待处理：可接受或拒绝</Text>
          <View className="action-row">
            <Button className="action-btn accept" disabled={acting} onClick={() => onAction("ACCEPT")}>接受</Button>
            <Button className="action-btn reject" disabled={acting} onClick={() => onAction("REJECT")}>拒绝</Button>
          </View>
        </>
      );
    case "ACCEPTED":
      return (
        <>
          <Text className="action-hint">老师已接受，可标记就绪</Text>
          <Button className="action-btn primary" disabled={acting} onClick={() => onAction("MARK_READY")}>标记就绪</Button>
        </>
      );
    case "RESCHEDULE_PROPOSED":
      return <Text className="action-hint">老师建议改期，请家长确认</Text>;
    case "READY":
      return (
        <>
          <Text className="action-hint">试听已就绪，结束后可标记完成</Text>
          <Button className="action-btn primary" disabled={acting} onClick={() => onAction("COMPLETE")}>标记完成</Button>
        </>
      );
    case "PARENT_CONFIRMED":
      return <Text className="action-hint">家长已确认，等待老师标记就绪</Text>;
    case "COMPLETED":
      return <Text className="action-hint">试听已完成</Text>;
    case "CANCELLED":
      return <Text className="action-hint">试听已取消</Text>;
    case "REJECTED":
      return <Text className="action-hint">试听已被拒绝</Text>;
    default:
      return null;
  }
}

// ─── 辅助函数 ──────────────────────────────────────────────

function labelSubject(subject: string): string {
  const map: Record<string, string> = {
    CHINESE: "语文", MATH: "数学", ENGLISH: "英语", PHYSICS: "物理",
    CHEMISTRY: "化学", BIOLOGY: "生物", HISTORY: "历史", GEOGRAPHY: "地理", POLITICS: "道法",
  };
  return map[subject] ?? subject;
}

function labelStatus(status: string): string {
  const map: Record<string, string> = {
    REQUESTED: "待处理", ACCEPTED: "已接受", RESCHEDULE_PROPOSED: "建议改期",
    REJECTED: "已拒绝", PARENT_CONFIRMED: "家长已确认", READY: "已就绪",
    COMPLETED: "已完成", CANCELLED: "已取消",
  };
  return map[status] ?? status;
}

function labelAction(action: string): string {
  const map: Record<string, string> = {
    CREATE: "创建试听", ACCEPT: "接受", REJECT: "拒绝", PROPOSE_RESCHEDULE: "建议改期",
    PARENT_CONFIRM: "家长确认", PARENT_REJECT_RESCHEDULE: "家长拒绝改期",
    MARK_READY: "标记就绪", COMPLETE: "完成", CANCEL: "取消",
  };
  return map[action] ?? action;
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
