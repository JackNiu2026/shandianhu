import { useMemo, useState } from "react";
import { View, Text, Image } from "@tarojs/components";
import { BookSheet } from "@/components/Modals";
import { useAppStore } from "@/store";
import { questions, calculateMBTI, matchTeachers } from "@lightning-tiger/shared";
import type { Teacher } from "@lightning-tiger/shared";
import "./index.scss";

export default function TestPage() {
  const { state, dispatch } = useAppStore();
  const { prefs } = state;

  const [answers, setAnswers] = useState<string[]>([]);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [bookFor, setBookFor] = useState<Teacher | null>(null);

  const answered = answers.length;
  const result = useMemo(() => calculateMBTI(answers), [answers]);
  const matched = useMemo(() => matchTeachers(prefs), [prefs]);

  return (
    <View className="test-screen">
      {!assessmentStarted ? (
        <View className="assessment-welcome">
          <View className="assessment-welcome-top">
            <Text className="welcome-kicker">MBTI学习风格测评</Text>
          </View>
          <Text>
            用一次认真回答，<Text>认识孩子的学习偏好</Text>
          </Text>
          <Text>
            帮助我们了解孩子在理解信息、获得反馈和安排节奏时更舒服的方式，从而推荐教学风格更合拍的老师。
          </Text>
          <View className="welcome-benefits">
            <Text>
              <Text>约 3 分钟</Text>
              <Text>无需跳转</Text>
            </Text>
            <Text>
              <Text>仅作匹配参考</Text>
              <Text>不评价能力</Text>
            </Text>
            <Text>
              <Text>结果可重测</Text>
              <Text>随成长更新</Text>
            </Text>
          </View>
          <View className="welcome-notice">
            <Text>✓</Text>
            <Text>
              测评结果会在当前 App 内生成；正式授权题库与计分规则接入后，将按授权版本输出报告。
            </Text>
          </View>
          <View className="start-assessment" onClick={() => setAssessmentStarted(true)}>
            <Text>开始为孩子测评 </Text>
            <Text>→</Text>
          </View>
          <Text className="welcome-foot">请根据孩子最近 1–2 个月的真实状态作答</Text>
        </View>
      ) : !result ? (
        <>
          <View className="mbti-constellation">
            <View className="mbti-purpose-chip">
              <Text>⌁</Text>
              <Text> 给家长的测评说明</Text>
            </View>
            <View className="mbti-core">
              <Text>第</Text>
              <Text>
                {answered + 1}
                <Text>/12</Text>
              </Text>
              <Text>题</Text>
            </View>
            <View className="test-copy">
              <Text className="tiny-label">LEARNING STYLE CHECK</Text>
              <Text>
                了解孩子如何学习，<Text>匹配更合拍的老师</Text>
              </Text>
              <Text>结果只用于推荐教学风格，不是能力评价或心理诊断。</Text>
            </View>
            <View className="purpose-quick-points">
              <Text>理解方式</Text>
              <Text>反馈偏好</Text>
              <Text>学习节奏</Text>
              <Text>12 题 · 约 3 分钟</Text>
            </View>
          </View>
          <View className="question-card magnetic-question">
            <View className="question-head">
              <Text className="question-no">
                QUESTION {String(answered + 1).padStart(2, "0")} / 12
              </Text>
              <View className="stepper">
                {questions.map((_, i) => (
                  <View className={i <= answered ? "active" : ""} key={i} />
                ))}
              </View>
            </View>
            <Text>{questions[answered].title}</Text>
            <Text className="choose-hint">
              <Text>请代入孩子最近的真实状态</Text>，选择最接近的一项
            </Text>
            <View className="option-list">
              {questions[answered].options.map((option, i) => (
                <View
                  key={option.text}
                  onClick={() => setAnswers((old) => [...old, option.letter])}
                >
                  <Text>{i === 0 ? "A" : "B"}</Text>
                  <Text>{option.text}</Text>
                  <Text>↗</Text>
                </View>
              ))}
            </View>
            {answered > 0 && (
              <View
                className="back-question"
                onClick={() => setAnswers((old) => old.slice(0, -1))}
              >
                <Text>←</Text>
                <Text>返回上一题</Text>
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          <View className="result-card">
            <View className="result-orbit">
              <Text>{result.code}</Text>
            </View>
            <View>
              <Text className="eyebrow">孩子的学习风格</Text>
              <Text>{result.code}</Text>
              <Text>{result.label}</Text>
            </View>
            <View onClick={() => setAnswers([])}>
              <Text>重新测试 ↻</Text>
            </View>
          </View>
          <Text className="disclaimer">
            这是学习风格参考，不是心理诊断，也不代表孩子的能力上限。
          </Text>
          <View className="match-explainer">
            <Text>✦</Text>
            <View>
              <Text>为什么这样匹配？</Text>
              <View>
                {result.advice.map((line) => (
                  <View key={line}>
                    <Text>{line}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <View className="matched-title">
            <View>
              <Text className="eyebrow">PERSONALIZED</Text>
              <Text>为他匹配的老师</Text>
            </View>
            <Text>共 {matched.length} 位</Text>
          </View>
          <View className="match-list">
            {matched.slice(0, 3).map((t) => (
              <View key={t.name} className="mini-teacher">
                <View className="mini-avatar" style={{ backgroundColor: t.color }}>
                  {t.avatar ? <Image src={t.avatar} /> : <Text>{t.name[0]}</Text>}
                </View>
                <View>
                  <Text>
                    {t.name}
                    <Text>✓</Text>
                  </Text>
                  <Text>
                    {t.subject} · {t.tags[0]} · ¥{t.price} 起
                  </Text>
                  <Text>
                    ★ {t.rating} · {t.slots[0]} 可约
                  </Text>
                </View>
                <View onClick={() => setBookFor(t)}>
                  <Text>约试听</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {bookFor && (
        <BookSheet
          teacher={bookFor}
          onClose={() => setBookFor(null)}
          onBook={(teacherName, slot) => {
            dispatch({ type: "SET_BOOKED", booked: { teacher: teacherName, slot } });
          }}
        />
      )}
    </View>
  );
}
