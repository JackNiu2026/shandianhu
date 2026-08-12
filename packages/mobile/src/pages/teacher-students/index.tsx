/**
 * V2.3 老师学生 — "学生" tab
 *
 * 列出有有效服务关系的学生，点击查看最小范围学习摘要。
 * 严格不展示家长手机号、原始错题、AI 对话原文、MBTI、学校名称等敏感字段。
 */
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { TeacherWorkspaceNav } from "@/components/TeacherWorkspaceNav";
import { TopBar } from "@/components/TopBar";
import {
  getStudentSummary,
  listTeacherStudents,
  type StudentSummaryDto,
} from "@/services/api";
import "./index.scss";

type StudentListItem = {
  childId: string;
  childDisplayName: string;
  subject: string;
  nextLessonAt: string | null;
};

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [summary, setSummary] = useState<StudentSummaryDto | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTeacherStudents();
      setStudents(data);
    } catch {
      Taro.showToast({ title: "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useDidShow(() => { void load(); });

  // 查看学生摘要
  const onViewSummary = async (childId: string) => {
    if (selectedChildId === childId) {
      // 再次点击关闭
      setSelectedChildId(null);
      setSummary(null);
      return;
    }
    setSelectedChildId(childId);
    setSummary(null);
    setLoadingSummary(true);
    try {
      const data = await getStudentSummary(childId);
      setSummary(data);
    } catch {
      Taro.showToast({ title: "无权查看或授权已过期", icon: "none" });
      setSelectedChildId(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <View className="teacher-students-screen">
      <TopBar eyebrow="TEACHER" title="学生" subtitle="我的服务学生" />

      <ScrollView scrollY className="students-body">
        {loading && students.length === 0 ? (
          <View className="students-empty">加载中…</View>
        ) : students.length === 0 ? (
          <View className="students-empty">暂无服务学生</View>
        ) : (
          students.map((student) => (
            <View key={student.childId}>
              <View className="student-card" onClick={() => void onViewSummary(student.childId)}>
                <View className="student-head">
                  <Text className="student-name">{student.childDisplayName}</Text>
                  <Text className="student-subject">{labelSubject(student.subject)}</Text>
                </View>
                {student.nextLessonAt && (
                  <Text className="student-next">下次课程：{formatDateTime(student.nextLessonAt)}</Text>
                )}
                <Text className="student-hint">
                  {selectedChildId === student.childId ? "收起摘要" : "查看学习摘要"}
                </Text>
              </View>

              {/* 展开的学习摘要（最小范围） */}
              {selectedChildId === student.childId && (
                <View className="summary-card">
                  {loadingSummary ? (
                    <Text className="summary-loading">加载中…</Text>
                  ) : summary ? (
                    <View>
                      <View className="summary-row">
                        <Text className="summary-label">年级</Text>
                        <Text className="summary-value">{summary.grade ?? "未设置"}</Text>
                      </View>
                      <View className="summary-section">
                        <Text className="summary-label">学习目标</Text>
                        {summary.learningGoals.length > 0 ? (
                          summary.learningGoals.map((goal, i) => (
                            <Text key={i} className="summary-tag">{goal}</Text>
                          ))
                        ) : (
                          <Text className="summary-empty">暂无</Text>
                        )}
                      </View>
                      <View className="summary-section">
                        <Text className="summary-label">薄弱知识点</Text>
                        {summary.weakKnowledgePoints.length > 0 ? (
                          summary.weakKnowledgePoints.map((point, i) => (
                            <Text key={i} className="summary-tag weak">{point}</Text>
                          ))
                        ) : (
                          <Text className="summary-empty">暂无</Text>
                        )}
                      </View>
                      <View className="summary-section">
                        <Text className="summary-label">教学偏好</Text>
                        {summary.teachingPreferences.length > 0 ? (
                          summary.teachingPreferences.map((pref, i) => (
                            <Text key={i} className="summary-tag">{pref}</Text>
                          ))
                        ) : (
                          <Text className="summary-empty">暂无</Text>
                        )}
                      </View>
                    </View>
                  ) : null}
                </View>
              )}
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

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return iso; }
}
