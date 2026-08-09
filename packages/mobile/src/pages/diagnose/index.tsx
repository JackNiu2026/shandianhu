import { useState, useCallback } from "react";
import { View, Text, Image, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { TopBar } from "@/components/TopBar";
import { useAppStore } from "@/store";
import { submitDiagnosis } from "@/services/api";
import { subjects, grades } from "@lightning-tiger/shared";
import type { DiagnosisReport } from "@lightning-tiger/shared";
import "./index.scss";

const MAX_IMAGES = 9;
const ANALYZING_TIPS = [
  "正在识别错题内容…",
  "分析错误类型与知识点…",
  "生成个性化诊断报告…",
];

export default function DiagnosePage() {
  const { state } = useAppStore();
  const [images, setImages] = useState<string[]>([]);
  const [subject, setSubject] = useState<string>(subjects[1]);
  const [grade, setGrade] = useState<string>(state.prefs?.grade || grades[1]);
  const [analyzing, setAnalyzing] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [report, setReport] = useState<DiagnosisReport | null>(null);

  const chooseImages = useCallback(() => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      Taro.showToast({ title: `最多上传 ${MAX_IMAGES} 张`, icon: "none" });
      return;
    }
    Taro.chooseMedia({
      count: remaining,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const newPaths = res.tempFiles.map((f) => f.tempFilePath);
        setImages((prev) => [...prev, ...newPaths].slice(0, MAX_IMAGES));
      },
    });
  }, [images.length]);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const startDiagnosis = async () => {
    if (images.length === 0) {
      Taro.showToast({ title: "请先上传错题照片", icon: "none" });
      return;
    }
    setAnalyzing(true);
    setTipIndex(0);

    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % ANALYZING_TIPS.length);
    }, 2000);

    try {
      const result = await submitDiagnosis({ subject, grade, images });
      setReport(result);
    } catch {
      Taro.showToast({ title: "诊断失败，请重试", icon: "none" });
    } finally {
      clearInterval(tipTimer);
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setReport(null);
    setImages([]);
  };

  /* ---- 报告视图 ---- */
  if (report) {
    return (
      <View className="diagnose-screen">
        <TopBar />
        <ScrollView scrollY className="report-scroll">
          <View className="report-header">
            <View className="report-score-wrap">
              <View className="report-score-ring">
                <Text className="report-score-num">{report.overallScore}</Text>
                <Text className="report-score-unit">分</Text>
              </View>
              <View className="report-score-info">
                <Text className="tiny-label">AI 学情诊断报告</Text>
                <Text className="report-level">{report.level}</Text>
                <Text className="report-meta">
                  {report.subject} · {report.grade} · {report.questionAnalysis.length} 道错题
                </Text>
              </View>
            </View>
          </View>

          <View className="report-section">
            <Text className="section-title">知识点掌握情况</Text>
            <View className="weak-points">
              {report.weakPoints.map((wp, i) => (
                <View className="weak-point-row" key={i}>
                  <Text className="weak-point-label">{wp.topic}</Text>
                  <View className="weak-point-bar">
                    <View
                      className="weak-point-fill"
                      style={{ width: `${wp.mastery}%`, background: wp.mastery < 50 ? "#ed7358" : wp.mastery < 75 ? "#f0b860" : "#685f9c" }}
                    />
                  </View>
                  <Text className="weak-point-pct">{wp.mastery}%</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="report-section">
            <Text className="section-title">错误类型分布</Text>
            <View className="error-types">
              {report.errorTypes.map((et, i) => (
                <View className="error-type-row" key={i}>
                  <View className="error-type-bar-bg">
                    <View className="error-type-bar-fill" style={{ width: `${et.ratio}%` }} />
                  </View>
                  <View className="error-type-info">
                    <Text className="error-type-name">{et.type}</Text>
                    <Text className="error-type-count">{et.count} 题 · {et.ratio}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="report-section">
            <Text className="section-title">逐题分析</Text>
            <View className="question-list">
              {report.questionAnalysis.map((qa, i) => (
                <View className="question-card" key={i}>
                  <View className="question-card-head">
                    <Text className="question-no">第 {i + 1} 题</Text>
                    <Text className="question-error-tag">{qa.errorType}</Text>
                  </View>
                  <Text className="question-content">{qa.question}</Text>
                  <View className="question-analysis-box">
                    <Text className="analysis-label">错因分析</Text>
                    <Text className="analysis-text">{qa.analysis}</Text>
                  </View>
                  <View className="question-correct-box">
                    <Text className="analysis-label correct">正确思路</Text>
                    <Text className="analysis-text">{qa.correctApproach}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="report-section">
            <Text className="section-title">学习建议</Text>
            <View className="suggestion-list">
              {report.suggestions.map((s, i) => (
                <View className="suggestion-item" key={i}>
                  <Text className="suggestion-num">{i + 1}</Text>
                  <Text className="suggestion-text">{s}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="report-actions">
            <View className="report-btn primary" onClick={reset}>
              <Text>重新诊断</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ---- 分析中视图 ---- */
  if (analyzing) {
    return (
      <View className="diagnose-screen">
        <TopBar />
        <View className="analyzing-card">
          <View className="analyzing-animation">
            <View className="analyzing-pulse" />
            <Text className="analyzing-icon">AI</Text>
          </View>
          <Text className="analyzing-title">正在生成诊断报告</Text>
          <Text className="analyzing-tip">{ANALYZING_TIPS[tipIndex]}</Text>
          <View className="analyzing-dots">
            <View className={tipIndex >= 0 ? "dot active" : "dot"} />
            <View className={tipIndex >= 1 ? "dot active" : "dot"} />
            <View className={tipIndex >= 2 ? "dot active" : "dot"} />
          </View>
        </View>
      </View>
    );
  }

  /* ---- 空状态 + 上传视图 ---- */
  return (
    <View className="diagnose-screen">
      <TopBar />

      <View className="diagnose-hero">
        <Text className="tiny-label">AI 学情诊断</Text>
        <Text className="h1">
          上传错题照片，{"\n"}
          <Text className="em">AI 帮你找到薄弱点</Text>
        </Text>
        <Text className="diagnose-desc">
          拍下孩子的错题，AI 会逐题分析错误原因，定位知识盲区，生成专属诊断报告和学习建议。
        </Text>
        <View className="diagnose-benefits">
          <View className="benefit-item">
            <Text className="benefit-icon">📷</Text>
            <Text className="benefit-label">多张上传</Text>
          </View>
          <View className="benefit-item">
            <Text className="benefit-icon">🤖</Text>
            <Text className="benefit-label">AI 分析</Text>
          </View>
          <View className="benefit-item">
            <Text className="benefit-icon">📋</Text>
            <Text className="benefit-label">诊断报告</Text>
          </View>
        </View>
      </View>

      <View className="upload-section">
        {images.length > 0 ? (
          <>
            <View className="photo-grid">
              {images.map((img, index) => (
                <View className="photo-thumb" key={index}>
                  <Image src={img} mode="aspectFill" />
                  <View className="photo-delete" onClick={() => removeImage(index)}>
                    <Text>×</Text>
                  </View>
                </View>
              ))}
              {images.length < MAX_IMAGES && (
                <View className="photo-add" onClick={chooseImages}>
                  <Text className="photo-add-icon">+</Text>
                  <Text className="photo-add-label">添加</Text>
                </View>
              )}
            </View>

            <View className="diagnose-options">
              <View className="option-row">
                <Text className="option-label">学科</Text>
                <View className="option-tags">
                  {subjects.map((s) => (
                    <View
                      key={s}
                      className={subject === s ? "option-tag active" : "option-tag"}
                      onClick={() => setSubject(s)}
                    >
                      <Text>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View className="option-row">
                <Text className="option-label">年级</Text>
                <View className="option-tags">
                  {grades.map((g) => (
                    <View
                      key={g}
                      className={grade === g ? "option-tag active" : "option-tag"}
                      onClick={() => setGrade(g)}
                    >
                      <Text>{g}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className="start-diagnosis-btn" onClick={startDiagnosis}>
              <Text>开始 AI 诊断（{images.length} 张）</Text>
            </View>
          </>
        ) : (
          <View className="upload-empty" onClick={chooseImages}>
            <View className="upload-icon-wrap">
              <Text className="upload-icon">📷</Text>
            </View>
            <Text className="upload-title">上传错题照片</Text>
            <Text className="upload-hint">支持拍照或从相册选择，最多 {MAX_IMAGES} 张</Text>
          </View>
        )}
      </View>
    </View>
  );
}
