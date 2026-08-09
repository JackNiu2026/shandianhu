import { useEffect, useMemo, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { LEARNING_STYLE_QUESTIONS, LEARNING_STYLE_VERSION, type LearningStyleAnswer } from "@lightning-tiger/shared";
import { fetchChildren, submitLearningStyle } from "@/services/api";
import "./index.scss";

const DRAFT_KEY = `${LEARNING_STYLE_VERSION}:draft`;

export default function AssessmentStylePage() {
  const [answers, setAnswers] = useState<Record<string, "A" | "B">>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [childId, setChildId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const draft = Taro.getStorageSync(DRAFT_KEY) as { answers?: Record<string, "A" | "B">; currentIndex?: number } | undefined;
    if (draft?.answers) setAnswers(draft.answers);
    if (typeof draft?.currentIndex === "number") setCurrentIndex(Math.min(Math.max(draft.currentIndex, 0), LEARNING_STYLE_QUESTIONS.length - 1));
    void fetchChildren().then((workspace) => setChildId(workspace.activeChildId)).catch(() => undefined);
  }, []);

  useEffect(() => {
    Taro.setStorageSync(DRAFT_KEY, { answers, currentIndex });
  }, [answers, currentIndex]);

  const question = LEARNING_STYLE_QUESTIONS[currentIndex]!;
  const completed = useMemo(() => LEARNING_STYLE_QUESTIONS.every((item) => answers[item.id]), [answers]);

  function choose(option: "A" | "B") {
    setAnswers((previous) => ({ ...previous, [question.id]: option }));
    if (currentIndex < LEARNING_STYLE_QUESTIONS.length - 1) setCurrentIndex((index) => index + 1);
  }

  async function submit() {
    if (!completed || !childId || submitting) {
      Taro.showToast({ title: completed ? "请先选择孩子档案" : "请完成全部题目", icon: "none" });
      return;
    }
    setSubmitting(true);
    try {
      const response = await submitLearningStyle({
        childId,
        idempotencyKey: `${LEARNING_STYLE_VERSION}:${Date.now()}`,
        answers: LEARNING_STYLE_QUESTIONS.map((item) => ({ questionId: item.id, option: answers[item.id]! })) as LearningStyleAnswer[],
      });
      Taro.removeStorageSync(DRAFT_KEY);
      setCode(response.code);
    } catch {
      Taro.showToast({ title: "提交失败，请稍后重试", icon: "none" });
    } finally {
      setSubmitting(false);
    }
  }

  if (code) {
    return <View className="assessment-style-page result-view">
      <Text className="eyebrow">LEARNING STYLE</Text>
      <Text className="result-code">{code}</Text>
      <Text className="result-title">学习风格结果已保存</Text>
      <Text className="disclaimer">教学偏好参考，不是心理诊断或能力评价</Text>
    </View>;
  }

  return <View className="assessment-style-page">
    <View className="progress-row">
      <Text>第 {currentIndex + 1} / {LEARNING_STYLE_QUESTIONS.length} 题</Text>
      <Text>{Object.keys(answers).length} 已答</Text>
    </View>
    <View className="progress-track"><View className="progress-fill" style={{ width: `${((currentIndex + 1) / LEARNING_STYLE_QUESTIONS.length) * 100}%` }} /></View>
    <View className="question-card">
      <Text className="question-title">{question.prompt}</Text>
      <Text className="question-hint">请选择更接近孩子近期真实状态的一项</Text>
      {question.options.map((option) => <View
        className={`option ${answers[question.id] === option.id ? "selected" : ""}`}
        key={option.id}
        onClick={() => choose(option.id as "A" | "B")}
      >
        <Text className="option-letter">{option.id}</Text>
        <Text className="option-text">{option.text}</Text>
      </View>)}
    </View>
    <View className="actions">
      <View className="secondary-action" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}><Text>上一题</Text></View>
      {currentIndex === LEARNING_STYLE_QUESTIONS.length - 1 && <View className={`primary-action ${completed ? "" : "disabled"}`} onClick={submit}><Text>{submitting ? "提交中" : "提交测评"}</Text></View>}
    </View>
    <Text className="disclaimer">教学偏好参考，不是心理诊断或能力评价</Text>
  </View>;
}
