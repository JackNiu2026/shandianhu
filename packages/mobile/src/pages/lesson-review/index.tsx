/**
 * V2.3 家长端 — 课程评价页
 *
 * 家长为已完成课程提交评价。
 * - 每个 completed Lesson 仅一个 ParentReview
 * - 评分 1–5，正文 10–1000 字
 * - author 从会话和课程关系推导，客户端不传作者 ID
 */
import { useCallback, useEffect, useState } from "react";
import { Button, Text, Textarea, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { TopBar } from "@/components/TopBar";
import {
  createLessonReview,
  getLessonReview,
  type ParentReviewDto,
} from "@/services/api";
import "./index.scss";

const RATING_OPTIONS = [1, 2, 3, 4, 5];

export default function LessonReviewPage() {
  const router = useRouter();
  const lessonId = router.params.lessonId || "";

  const [existingReview, setExistingReview] = useState<ParentReviewDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单字段
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");

  const load = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    try {
      const review = await getLessonReview(lessonId);
      setExistingReview(review);
      if (review) {
        setRating(review.rating);
        setContent(review.content);
      }
    } catch {
      // 课程未完成或不属于当前家长时会报错，静默处理
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => { void load(); }, [load]);

  // 提交评价
  const onSubmit = async () => {
    if (submitting) return;
    if (rating === 0) {
      Taro.showToast({ title: "请选择评分", icon: "none" });
      return;
    }
    if (content.trim().length < 10) {
      Taro.showToast({ title: "评价至少 10 字", icon: "none" });
      return;
    }
    setSubmitting(true);
    try {
      const review = await createLessonReview(lessonId, {
        rating,
        content: content.trim(),
      });
      setExistingReview(review);
      Taro.showToast({ title: "评价已提交", icon: "success" });
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch {
      Taro.showToast({ title: "提交失败，课程可能未完成", icon: "none" });
    } finally {
      setSubmitting(false);
    }
  };

  const hasExisting = existingReview != null;

  return (
    <View className="lesson-review-screen">
      <TopBar eyebrow="REVIEW" title="课程评价" subtitle="为已完成课程评价" />

      <View className="review-body">
        {loading ? (
          <View className="review-empty">加载中…</View>
        ) : (
          <>
            {/* 已有评价提示 */}
            {hasExisting && (
              <View className="existing-banner">
                <Text className="existing-text">您已评价过此课程</Text>
              </View>
            )}

            {/* 评分 */}
            <View className="form-section">
              <Text className="form-label">评分 *</Text>
              <View className="rating-stars">
                {RATING_OPTIONS.map((value) => (
                  <View
                    key={value}
                    className={`star ${rating >= value ? "active" : ""}`}
                    onClick={() => !hasExisting && setRating(value)}
                  >
                    <Text>★</Text>
                  </View>
                ))}
              </View>
              <Text className="rating-hint">
                {rating > 0 ? `${rating} 星` : "点击选择评分"}
              </Text>
            </View>

            {/* 评价正文 */}
            <View className="form-section">
              <Text className="form-label">评价内容 *（10–1000 字）</Text>
              <Textarea
                className="form-textarea"
                value={content}
                placeholder="请分享您的上课体验、老师教学效果等"
                maxlength={1000}
                disabled={hasExisting}
                onInput={(e) => setContent(e.detail.value)}
              />
              <Text className="char-count">{content.length}/1000</Text>
            </View>

            {/* 提交按钮 */}
            {!hasExisting && (
              <Button className="submit-btn" onClick={onSubmit} disabled={submitting}>
                {submitting ? "提交中…" : "提交评价"}
              </Button>
            )}
          </>
        )}
      </View>
    </View>
  );
}
