/**
 * V2.3 老师申请页
 *
 * 填写老师申请草稿字段并提交。草稿自动保存，提交后进入审核流程。
 * 已通过的老师可查看自己的申请信息。
 */
import { useCallback, useEffect, useState } from "react";
import { Button, Input, Text, Textarea, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { TopBar } from "@/components/TopBar";
import {
  getTeacherApplication,
  submitTeacherApplication,
  updateTeacherApplicationDraft,
  type TeacherApplicationSummary,
  type TeachingMode,
} from "@/services/api";
import "./index.scss";

const MODE_OPTIONS: Array<{ value: TeachingMode; label: string }> = [
  { value: "ONLINE", label: "线上" },
  { value: "IN_HOME", label: "上门" },
  { value: "IN_CENTER", label: "中心" },
];

export default function TeacherApplyPage() {
  const [application, setApplication] = useState<TeacherApplicationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单字段
  const [legalName, setLegalName] = useState("");
  const [education, setEducation] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [pricePerHour, setPricePerHour] = useState("");
  const [bio, setBio] = useState("");
  const [teachingModes, setTeachingModes] = useState<TeachingMode[]>([]);
  const [serviceAreaCode, setServiceAreaCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTeacherApplication();
      setApplication(data);
      // 回填表单
      setLegalName(data.legalName || "");
      setEducation(data.education || "");
      setExperienceYears(data.experienceYears != null ? String(data.experienceYears) : "");
      setPricePerHour(data.pricePerHour != null ? String(data.pricePerHour) : "");
      setBio(data.bio || "");
      setTeachingModes(data.teachingModes || []);
      setServiceAreaCode(data.serviceAreaCode || "");
    } catch {
      Taro.showToast({ title: "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // 切换授课方式
  const toggleMode = (mode: TeachingMode) => {
    setTeachingModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    );
  };

  // 保存草稿
  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const data = await updateTeacherApplicationDraft({
        legalName: legalName.trim() || undefined,
        education: education.trim() || undefined,
        experienceYears: experienceYears ? Number(experienceYears) : undefined,
        pricePerHour: pricePerHour ? Number(pricePerHour) : undefined,
        bio: bio.trim() || undefined,
        teachingModes: teachingModes.length > 0 ? teachingModes : undefined,
        serviceAreaCode: serviceAreaCode.trim() || undefined,
      });
      setApplication(data);
      Taro.showToast({ title: "已保存", icon: "success" });
    } catch {
      Taro.showToast({ title: "保存失败", icon: "none" });
    } finally {
      setSaving(false);
    }
  };

  // 提交申请
  const onSubmit = async () => {
    if (submitting) return;
    // 校验必填字段
    if (!legalName.trim()) {
      Taro.showToast({ title: "请填写姓名", icon: "none" });
      return;
    }
    if (!education.trim()) {
      Taro.showToast({ title: "请填写学历", icon: "none" });
      return;
    }
    if (teachingModes.length === 0) {
      Taro.showToast({ title: "请选择授课方式", icon: "none" });
      return;
    }
    setSubmitting(true);
    try {
      // 先保存草稿再提交
      await updateTeacherApplicationDraft({
        legalName: legalName.trim(),
        education: education.trim(),
        experienceYears: experienceYears ? Number(experienceYears) : undefined,
        pricePerHour: pricePerHour ? Number(pricePerHour) : undefined,
        bio: bio.trim() || undefined,
        teachingModes,
        serviceAreaCode: serviceAreaCode.trim() || undefined,
      });
      const data = await submitTeacherApplication();
      setApplication(data);
      Taro.showToast({ title: "已提交，等待审核", icon: "success" });
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch {
      Taro.showToast({ title: "提交失败", icon: "none" });
    } finally {
      setSubmitting(false);
    }
  };

  const isReadOnly = application != null && ["UNDER_REVIEW", "APPROVED"].includes(application.status);

  return (
    <View className="teacher-apply-screen">
      <TopBar eyebrow="TEACHER" title="老师申请" subtitle="填写资料开始入驻" />

      <View className="apply-body">
        {loading ? (
          <View className="apply-empty">加载中…</View>
        ) : (
          <>
            {/* 申请状态提示 */}
            {application && (
              <View className={`status-banner ${application.status.toLowerCase()}`}>
                <Text className="status-text">当前状态：{labelStatus(application.status)}</Text>
              </View>
            )}

            {/* 表单 */}
            <View className="form-section">
              <Text className="form-label">真实姓名 *</Text>
              <Input
                className="form-input"
                value={legalName}
                placeholder="请输入真实姓名"
                disabled={isReadOnly}
                onInput={(e) => setLegalName(e.detail.value)}
              />
            </View>

            <View className="form-section">
              <Text className="form-label">学历背景 *</Text>
              <Input
                className="form-input"
                value={education}
                placeholder="如：北京师范大学 本科"
                disabled={isReadOnly}
                onInput={(e) => setEducation(e.detail.value)}
              />
            </View>

            <View className="form-section">
              <Text className="form-label">教龄（年）</Text>
              <Input
                className="form-input"
                type="number"
                value={experienceYears}
                placeholder="如：5"
                disabled={isReadOnly}
                onInput={(e) => setExperienceYears(e.detail.value)}
              />
            </View>

            <View className="form-section">
              <Text className="form-label">课时费（元/小时）</Text>
              <Input
                className="form-input"
                type="number"
                value={pricePerHour}
                placeholder="如：200"
                disabled={isReadOnly}
                onInput={(e) => setPricePerHour(e.detail.value)}
              />
            </View>

            <View className="form-section">
              <Text className="form-label">个人简介</Text>
              <Textarea
                className="form-textarea"
                value={bio}
                placeholder="介绍你的教学风格、专长等（最多 2000 字）"
                maxlength={2000}
                disabled={isReadOnly}
                onInput={(e) => setBio(e.detail.value)}
              />
            </View>

            <View className="form-section">
              <Text className="form-label">授课方式 *</Text>
              <View className="mode-chips">
                {MODE_OPTIONS.map((opt) => (
                  <View
                    key={opt.value}
                    className={`mode-chip ${teachingModes.includes(opt.value) ? "active" : ""}`}
                    onClick={() => !isReadOnly && toggleMode(opt.value)}
                  >
                    <Text>{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="form-section">
              <Text className="form-label">服务区域编码</Text>
              <Input
                className="form-input"
                value={serviceAreaCode}
                placeholder="如：100000"
                disabled={isReadOnly}
                onInput={(e) => setServiceAreaCode(e.detail.value)}
              />
            </View>

            {/* 操作按钮 */}
            {!isReadOnly && (
              <View className="form-actions">
                <Button className="action-btn save" onClick={onSave} disabled={saving}>
                  {saving ? "保存中…" : "保存草稿"}
                </Button>
                <Button className="action-btn submit" onClick={onSubmit} disabled={submitting}>
                  {submitting ? "提交中…" : "提交申请"}
                </Button>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function labelStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "草稿中", SUBMITTED: "已提交", UNDER_REVIEW: "审核中",
    NEEDS_MORE_INFO: "需补充材料", APPROVED: "已通过", PAUSED: "已暂停", BANNED: "已封禁",
  };
  return map[status] ?? status;
}
