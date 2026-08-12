/**
 * V2.3 家长端 — 老师详情页
 *
 * 展示老师公开资料、适用科目/学段、授课方式、价格、可选时段和真实评价。
 * 家长可从此页发起试听预约。
 */
import { useCallback, useEffect, useState } from "react";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { TopBar } from "@/components/TopBar";
import { getTutorDetail, type TeacherProfileDetail } from "@/services/api";
import "./index.scss";

export default function TutorDetailPage() {
  const router = useRouter();
  const teacherId = router.params.id || "";

  const [teacher, setTeacher] = useState<TeacherProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!teacherId) return;
    setLoading(true);
    try {
      const data = await getTutorDetail(teacherId);
      setTeacher(data);
    } catch {
      Taro.showToast({ title: "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { void load(); }, [load]);

  // 跳转到试听预约页
  const goToBooking = () => {
    if (!teacher) return;
    void Taro.navigateTo({
      url: `/pages/trial-booking/index?teacherId=${teacherId}&subject=${teacher.subjects[0] || ""}`,
    });
  };

  return (
    <View className="tutor-detail-screen">
      <TopBar eyebrow="TUTOR" title="老师详情" subtitle="查看资料与评价" />

      <ScrollView scrollY className="detail-body">
        {loading && !teacher ? (
          <View className="detail-empty">加载中…</View>
        ) : !teacher ? (
          <View className="detail-empty">未找到老师</View>
        ) : (
          <>
            {/* 老师基本信息卡 */}
            <View className="tutor-hero">
              <View className="tutor-name-row">
                <Text className="tutor-name">{teacher.displayName}</Text>
                {teacher.avgRating != null && (
                  <Text className="tutor-rating">★ {teacher.avgRating.toFixed(1)}</Text>
                )}
              </View>
              <Text className="tutor-bio">{teacher.bio}</Text>
              <View className="tutor-stats">
                <View className="stat-item">
                  <Text className="stat-value">{teacher.experienceYears}年</Text>
                  <Text className="stat-label">教龄</Text>
                </View>
                <View className="stat-item">
                  <Text className="stat-value">¥{teacher.pricePerHour}</Text>
                  <Text className="stat-label">每小时</Text>
                </View>
                <View className="stat-item">
                  <Text className="stat-value">{teacher.reviewCount}</Text>
                  <Text className="stat-label">评价数</Text>
                </View>
              </View>
            </View>

            {/* 适用科目 */}
            <View className="section">
              <Text className="section-title">教授科目</Text>
              <View className="tag-list">
                {teacher.subjects.map((subject) => (
                  <Text key={subject} className="tag subject">{labelSubject(subject)}</Text>
                ))}
              </View>
            </View>

            {/* 适用学段 */}
            <View className="section">
              <Text className="section-title">适用学段</Text>
              <View className="tag-list">
                {teacher.schoolStages.map((stage) => (
                  <Text key={stage} className="tag stage">{labelStage(stage)}</Text>
                ))}
              </View>
            </View>

            {/* 授课方式 */}
            <View className="section">
              <Text className="section-title">授课方式</Text>
              <View className="tag-list">
                {teacher.teachingModes.map((mode) => (
                  <Text key={mode} className="tag mode">{labelMode(mode)}</Text>
                ))}
              </View>
            </View>

            {/* 服务区域 */}
            {teacher.serviceAreaCodes.length > 0 && (
              <View className="section">
                <Text className="section-title">服务区域</Text>
                <View className="tag-list">
                  {teacher.serviceAreaCodes.map((code) => (
                    <Text key={code} className="tag area">{code}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* 教学标签 */}
            {teacher.teachingTags.length > 0 && (
              <View className="section">
                <Text className="section-title">教学特色</Text>
                <View className="tag-list">
                  {teacher.teachingTags.map((tag) => (
                    <Text key={tag} className="tag">{tag}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* 可选时段预览 */}
            {teacher.availabilityPreview.length > 0 && (
              <View className="section">
                <Text className="section-title">可选时段（未来 14 天）</Text>
                <View className="slot-list">
                  {teacher.availabilityPreview.slice(0, 10).map((slot, i) => (
                    <View key={i} className="slot-item">
                      <Text className="slot-time">{formatDateTime(slot.startsAt)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 真实评价 */}
            {teacher.recentReviews.length > 0 && (
              <View className="section">
                <Text className="section-title">家长评价</Text>
                {teacher.recentReviews.map((review) => (
                  <View key={review.id} className="review-card">
                    <View className="review-head">
                      <Text className="review-author">{review.authorDisplayName}</Text>
                      <Text className="review-rating">★ {review.rating}</Text>
                    </View>
                    <Text className="review-content">{review.content}</Text>
                    <Text className="review-month">{review.lessonMonth}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 预约试听按钮 */}
            <Button className="book-btn" onClick={goToBooking}>
              预约试听
            </Button>
          </>
        )}
      </ScrollView>
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

function labelStage(stage: string): string {
  const map: Record<string, string> = { PRIMARY: "小学", MIDDLE: "初中", HIGH: "高中", JUNIOR: "初中", SENIOR: "高中" };
  return map[stage] ?? stage;
}

function labelMode(mode: string): string {
  const map: Record<string, string> = { ONLINE: "线上", IN_HOME: "上门", IN_CENTER: "中心" };
  return map[mode] ?? mode;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${labelWeekday(d.getDay())} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return iso; }
}

function labelWeekday(day: number): string {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][day] ?? "";
}
