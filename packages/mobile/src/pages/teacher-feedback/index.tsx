/**
 * V2.3 老师课程反馈页
 *
 * 老师查看、提交或修订课程反馈。
 * - 仅该课程老师可在课程结束后提交反馈
 * - 修改必须创建修订版本并填写更正原因
 * - operationKey 用于幂等，修订时使用新的 operationKey
 */
import { useCallback, useEffect, useState } from "react";
import { Button, Input, Text, Textarea, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { TopBar } from "@/components/TopBar";
import {
  getLessonFeedback,
  submitLessonFeedback,
  type FeedbackPerformance,
  type TeacherFeedbackDto,
} from "@/services/api";
import "./index.scss";

const PERFORMANCE_OPTIONS: Array<{ value: FeedbackPerformance; label: string }> = [
  { value: "STRONG", label: "表现优秀" },
  { value: "STEADY", label: "稳步提升" },
  { value: "NEEDS_SUPPORT", label: "需要支持" },
];

export default function TeacherFeedbackPage() {
  const router = useRouter();
  const lessonId = router.params.lessonId || "";

  const [feedback, setFeedback] = useState<TeacherFeedbackDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单字段
  const [lessonContent, setLessonContent] = useState("");
  const [performance, setPerformance] = useState<FeedbackPerformance>("STEADY");
  const [difficulties, setDifficulties] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const load = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    try {
      const data = await getLessonFeedback(lessonId);
      setFeedback(data);
      // 回填已有反馈
      if (data) {
        setLessonContent(data.lessonContent.join("\n"));
        setPerformance(data.performance);
        setDifficulties(data.difficulties.join("\n"));
        setSuggestions(data.suggestions.join("\n"));
        setPrivateNote(data.privateTeacherNote || "");
      }
    } catch {
      Taro.showToast({ title: "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => { void load(); }, [load]);

  // 提交反馈
  const onSubmit = async () => {
    if (submitting) return;
    if (!lessonId) return;

    // 校验必填
    const contentArr = lessonContent.split("\n").map((s) => s.trim()).filter(Boolean);
    if (contentArr.length === 0) {
      Taro.showToast({ title: "请填写课程内容", icon: "none" });
      return;
    }
    const suggestionArr = suggestions.split("\n").map((s) => s.trim()).filter(Boolean);
    if (suggestionArr.length === 0) {
      Taro.showToast({ title: "请填写教学建议", icon: "none" });
      return;
    }

    // 修订时必须填写更正原因
    const isRevision = feedback != null;
    if (isRevision && !correctionReason.trim()) {
      Taro.showToast({ title: "修订需填写更正原因", icon: "none" });
      return;
    }

    setSubmitting(true);
    try {
      const difficultyArr = difficulties.split("\n").map((s) => s.trim()).filter(Boolean);
      const data = await submitLessonFeedback(lessonId, {
        operationKey: `feedback-${lessonId}-${Date.now()}`,
        correctionReason: isRevision ? correctionReason.trim() : undefined,
        feedback: {
          lessonContent: contentArr,
          performance,
          difficulties: difficultyArr,
          suggestions: suggestionArr,
          privateTeacherNote: privateNote.trim() || undefined,
        },
      });
      setFeedback(data);
      Taro.showToast({ title: isRevision ? "已修订" : "已提交", icon: "success" });
      setCorrectionReason("");
      await load();
    } catch {
      Taro.showToast({ title: "提交失败", icon: "none" });
    } finally {
      setSubmitting(false);
    }
  };

  const isRevision = feedback != null;

  return (
    <View className="teacher-feedback-screen">
      <TopBar eyebrow="TEACHER" title="课程反馈" subtitle={isRevision ? "修订反馈" : "提交反馈"} />

      <View className="feedback-body">
        {loading ? (
          <View className="feedback-empty">加载中…</View>
        ) : (
          <>
            {/* 已有反馈提示 */}
            {feedback && (
              <View className="existing-banner">
                <Text className="existing-text">
                  已有反馈（第 {feedback.sequence} 版{feedback.isCurrent ? "，当前版本" : ""}）
                </Text>
              </View>
            )}

            {/* 修订原因 */}
            {isRevision && (
              <View className="form-section">
                <Text className="form-label">更正原因 *</Text>
                <Input
                  className="form-input"
                  value={correctionReason}
                  placeholder="说明修订原因"
                  onInput={(e) => setCorrectionReason(e.detail.value)}
                />
              </View>
            )}

            {/* 课程内容 */}
            <View className="form-section">
              <Text className="form-label">课程内容 *</Text>
              <Textarea
                className="form-textarea"
                value={lessonContent}
                placeholder="每行一条，记录本次课程教学内容"
                onInput={(e) => setLessonContent(e.detail.value)}
              />
            </View>

            {/* 表现评估 */}
            <View className="form-section">
              <Text className="form-label">学生表现 *</Text>
              <View className="perf-options">
                {PERFORMANCE_OPTIONS.map((opt) => (
                  <View
                    key={opt.value}
                    className={`perf-chip ${performance === opt.value ? "active" : ""}`}
                    onClick={() => setPerformance(opt.value)}
                  >
                    <Text>{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 困难点 */}
            <View className="form-section">
              <Text className="form-label">学习困难点</Text>
              <Textarea
                className="form-textarea"
                value={difficulties}
                placeholder="每行一条，可留空"
                onInput={(e) => setDifficulties(e.detail.value)}
              />
            </View>

            {/* 教学建议 */}
            <View className="form-section">
              <Text className="form-label">教学建议 *</Text>
              <Textarea
                className="form-textarea"
                value={suggestions}
                placeholder="每行一条，给家长的学习建议"
                onInput={(e) => setSuggestions(e.detail.value)}
              />
            </View>

            {/* 私有笔记（不进入画像） */}
            <View className="form-section">
              <Text className="form-label">老师私有笔记</Text>
              <Textarea
                className="form-textarea"
                value={privateNote}
                placeholder="仅老师可见，不进入学生画像"
                onInput={(e) => setPrivateNote(e.detail.value)}
              />
            </View>

            <Button className="action-btn submit" onClick={onSubmit} disabled={submitting}>
              {submitting ? "提交中…" : isRevision ? "提交修订" : "提交反馈"}
            </Button>
          </>
        )}
      </View>
    </View>
  );
}
