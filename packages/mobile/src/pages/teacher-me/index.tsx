/**
 * V2.3 老师我的 — "我的" tab
 *
 * 展示：
 * - 老师申请进度（状态、资质审核结论）
 * - 服务状态（ACTIVE/PAUSED/BANNED）
 * - 快捷入口：申请、排期、工作区切换（回家长端）
 */
import { useCallback, useEffect, useState } from "react";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { TeacherWorkspaceNav } from "@/components/TeacherWorkspaceNav";
import { TopBar } from "@/components/TopBar";
import {
  getTeacherApplication,
  type TeacherApplicationSummary,
} from "@/services/api";
import "./index.scss";

export default function TeacherMePage() {
  const [application, setApplication] = useState<TeacherApplicationSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTeacherApplication();
      setApplication(data);
    } catch {
      // 未登录或无 teacherProfile 时静默处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useDidShow(() => { void load(); });

  // 跳转到老师申请页
  const goToApply = () => {
    void Taro.navigateTo({ url: "/pages/teacher-apply/index" });
  };

  // 跳转到排期页
  const goToSchedule = () => {
    void Taro.navigateTo({ url: "/pages/teacher-schedule/index" });
  };

  // 切换回家长工作区
  const switchToParent = () => {
    void Taro.switchTab({ url: "/pages/smart/index" });
  };

  return (
    <View className="teacher-me-screen">
      <TopBar eyebrow="TEACHER" title="我的" subtitle="老师个人中心" />

      <ScrollView scrollY className="me-body">
        {/* 老师身份卡 */}
        <View className="teacher-hero">
          <View className="hero-row">
            <Text className="hero-name">{application?.legalName || "未填写"}</Text>
            <Text className={`hero-status ${application?.status === "APPROVED" ? "active" : "pending"}`}>
              {labelApplicationStatus(application?.status)}
            </Text>
          </View>
          {application?.education && (
            <Text className="hero-sub">{application.education}</Text>
          )}
          {application?.experienceYears != null && (
            <Text className="hero-sub">{application.experienceYears} 年教龄</Text>
          )}
          {application?.pricePerHour != null && (
            <Text className="hero-sub">¥{application.pricePerHour}/小时</Text>
          )}
        </View>

        {/* 申请进度 */}
        <View className="section">
          <Text className="section-title">申请进度</Text>
          <View className="progress-card">
            <View className="progress-step">
              <Text className={`step-dot ${application ? "done" : ""}`}>1</Text>
              <Text className="step-label">填写资料</Text>
            </View>
            <View className="progress-step">
              <Text className={`step-dot ${application?.status && application.status !== "DRAFT" ? "done" : ""}`}>2</Text>
              <Text className="step-label">提交申请</Text>
            </View>
            <View className="progress-step">
              <Text className={`step-dot ${["UNDER_REVIEW", "APPROVED", "PAUSED", "BANNED"].includes(application?.status ?? "") ? "done" : ""}`}>3</Text>
              <Text className="step-label">审核中</Text>
            </View>
            <View className="progress-step">
              <Text className={`step-dot ${application?.status === "APPROVED" ? "done" : ""}`}>4</Text>
              <Text className="step-label">审核通过</Text>
            </View>
          </View>

          {/* 资质审核结论 */}
          {application?.qualifications && application.qualifications.length > 0 && (
            <View className="qual-list">
              <Text className="section-subtitle">资质审核</Text>
              {application.qualifications.map((qual) => (
                <View key={qual.id} className="qual-item">
                  <Text className="qual-type">{labelQualType(qual.type)}</Text>
                  <Text className={`qual-status ${qual.reviewStatus.toLowerCase()}`}>
                    {labelQualStatus(qual.reviewStatus)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* 需要补充信息时提示 */}
          {application?.status === "NEEDS_MORE_INFO" && (
            <View className="notice-card">
              <Text className="notice-text">审核需要补充材料，请更新后重新提交</Text>
            </View>
          )}
        </View>

        {/* 快捷入口 */}
        <View className="section">
          <Text className="section-title">快捷操作</Text>
          <View className="action-list">
            <Button className="action-item" onClick={goToApply}>
              {application?.status === "DRAFT" ? "继续填写申请" : "查看/编辑申请"}
            </Button>
            {application?.status === "APPROVED" && (
              <Button className="action-item" onClick={goToSchedule}>
                管理排期时间
              </Button>
            )}
            <Button className="action-item secondary" onClick={switchToParent}>
              切换到家长端
            </Button>
          </View>
        </View>
      </ScrollView>

      <TeacherWorkspaceNav />
    </View>
  );
}

function labelApplicationStatus(status?: string): string {
  if (!status) return "未申请";
  const map: Record<string, string> = {
    DRAFT: "草稿中", SUBMITTED: "已提交", UNDER_REVIEW: "审核中",
    NEEDS_MORE_INFO: "需补充", APPROVED: "已通过", PAUSED: "已暂停", BANNED: "已封禁",
  };
  return map[status] ?? status;
}

function labelQualType(type: string): string {
  const map: Record<string, string> = {
    IDENTITY: "身份认证", EDUCATION: "学历认证", TEACHING_CERT: "教师资格证",
    SUBJECT_CERT: "学科资质", OTHER: "其他",
  };
  return map[type] ?? type;
}

function labelQualStatus(status: string): string {
  const map: Record<string, string> = { PENDING: "待审核", PASS: "已通过", FAIL: "未通过" };
  return map[status] ?? status;
}
