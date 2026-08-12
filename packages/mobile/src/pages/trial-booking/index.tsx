/**
 * V2.3 家长端 — 试听预约页
 *
 * 家长为指定孩子向指定老师发起试听。
 * - 选择科目、授课方式
 * - 选择时间段
 * - 幂等键防重复提交
 */
import { useCallback, useEffect, useState } from "react";
import { Button, Input, Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { TopBar } from "@/components/TopBar";
import { useActiveChild } from "@/hooks/useActiveChild";
import { createTrial, getTutorDetail, type AvailabilitySlotDto, type TeacherProfileDetail, type TeachingMode } from "@/services/api";
import "./index.scss";

const MODE_LABELS: Array<{ value: TeachingMode; label: string }> = [
  { value: "ONLINE", label: "线上" },
  { value: "IN_HOME", label: "上门" },
  { value: "IN_CENTER", label: "中心" },
];

export default function TrialBookingPage() {
  const router = useRouter();
  const teacherId = router.params.teacherId || "";
  const defaultSubject = router.params.subject || "";
  const activeChild = useActiveChild();

  const [subject, setSubject] = useState(defaultSubject);
  const [teacher, setTeacher] = useState<TeacherProfileDetail | null>(null);
  const [slot, setSlot] = useState<AvailabilitySlotDto | null>(null);
  const [mode, setMode] = useState<TeachingMode>("ONLINE");
  const [parentNote, setParentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!teacherId) return; void getTutorDetail(teacherId).then((data) => { setTeacher(data); setSubject((current) => data.subjects.includes(current as any) ? current : data.subjects[0] ?? ""); setMode(data.teachingModes[0] ?? "ONLINE"); }).catch(() => Taro.showToast({ title: "老师资料加载失败", icon: "none" })); }, [teacherId]);

  const onSubmit = useCallback(async () => {
    if (submitting) return;
    if (!teacherId) {
      Taro.showToast({ title: "缺少老师信息", icon: "none" });
      return;
    }
    if (!activeChild) {
      Taro.showToast({ title: "请先选择孩子", icon: "none" });
      return;
    }
    if (!subject) {
      Taro.showToast({ title: "请选择科目", icon: "none" });
      return;
    }
    if (!teacher || !teacher.subjects.includes(subject as any) || !teacher.teachingModes.includes(mode)) {
      Taro.showToast({ title: "所选科目或授课方式不可用", icon: "none" });
      return;
    }
    if (!slot || new Date(slot.startsAt).getTime() <= Date.now()) {
      Taro.showToast({ title: "请选择有效的可约时段", icon: "none" });
      return;
    }

    setSubmitting(true);
    try {
      const startsAt = slot.startsAt;
      const endsAt = slot.endsAt;
      const trial = await createTrial(teacherId, {
        childId: activeChild.id,
        subject: subject as any,
        startsAt,
        endsAt,
        idempotencyKey: `trial-${teacherId}-${activeChild.id}-${startsAt}`,
        mode,
        parentNote: parentNote.trim() || undefined,
      });
      Taro.showToast({ title: "预约成功", icon: "success" });
      // 跳转到试听状态页
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/trial-status/index?trialId=${trial.id}` });
      }, 1500);
    } catch (reason) {
      Taro.showToast({ title: trialErrorMessage(reason), icon: "none" });
    } finally {
      setSubmitting(false);
    }
  }, [submitting, teacherId, activeChild, subject, mode, parentNote, slot, teacher]);

  return (
    <View className="trial-booking-screen">
      <TopBar eyebrow="TUTOR" title="预约试听" subtitle="选择时间发起试听" />

      <View className="booking-body">
        {/* 孩子信息 */}
        <View className="info-card">
          <Text className="info-label">当前孩子</Text>
          <Text className="info-value">{activeChild?.displayName ?? "请先选择孩子"}</Text>
        </View>

        {/* 科目选择 */}
        <View className="form-section">
          <Text className="form-label">科目 *</Text>
          <View className="subject-chips">
            {(teacher?.subjects ?? []).map((value) => (
              <View
                key={value}
                className={`subject-chip ${subject === value ? "active" : ""}`}
                onClick={() => setSubject(value)}
              >
                <Text>{labelSubject(value)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 可约时段 */}
        <View className="form-section">
          <Text className="form-label">可约时段 *</Text>
          <View className="slot-options">{(teacher?.availabilityPreview ?? []).filter((item) => new Date(item.startsAt).getTime() > Date.now()).map((item) => <View key={item.startsAt} className={`slot-option ${slot?.startsAt === item.startsAt ? "active" : ""}`} onClick={() => setSlot(item)}><Text>{formatSlot(item)}</Text></View>)}</View>
          {teacher && teacher.availabilityPreview.length === 0 && <Text className="slot-empty">该老师暂未开放可约时段</Text>}
        </View>

        {/* 授课方式 */}
        <View className="form-section">
          <Text className="form-label">授课方式</Text>
          <View className="mode-chips">
            {MODE_LABELS.filter((item) => teacher?.teachingModes.includes(item.value)).map((m) => (
              <View
                key={m.value}
                className={`mode-chip ${mode === m.value ? "active" : ""}`}
                onClick={() => setMode(m.value)}
              >
                <Text>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 家长备注 */}
        <View className="form-section">
          <Text className="form-label">备注（可选）</Text>
          <Input
            className="form-input"
            value={parentNote}
            placeholder="向老师补充说明（最多 500 字）"
            maxlength={500}
            onInput={(e) => setParentNote(e.detail.value)}
          />
        </View>

        <Button className="submit-btn" onClick={onSubmit} disabled={submitting}>
          {submitting ? "提交中…" : "发起试听"}
        </Button>
      </View>
    </View>
  );
}

function labelSubject(value: string): string { return ({ CHINESE: "语文", MATH: "数学", ENGLISH: "英语", PHYSICS: "物理", CHEMISTRY: "化学" } as Record<string, string>)[value] ?? value; }
function formatSlot(slot: AvailabilitySlotDto): string { const start = new Date(slot.startsAt); const end = new Date(slot.endsAt); return `${start.getMonth() + 1}月${start.getDate()}日 ${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")} - ${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`; }
function trialErrorMessage(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : "";
  if (/not active/i.test(message)) return "该老师已暂停预约，请选择其他老师";
  if (/subject/i.test(message)) return "该老师暂不教授所选科目";
  if (/teaching mode/i.test(message)) return "该老师暂不支持所选授课方式";
  if (/available time|slot/i.test(message)) return "该时段已失效，请重新选择可约时段";
  if (/conflict|already exists/i.test(message)) return "该时段刚被预约，请重新选择";
  return message && !/internal error/i.test(message) ? message : "预约失败，请稍后重试";
}
