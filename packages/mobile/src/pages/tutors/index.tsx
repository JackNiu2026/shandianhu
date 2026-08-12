import { useCallback, useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import type { RecommendationItem } from "@lightning-tiger/shared/api";
import { useAppStore } from "@/store";
import TopBar from "@/components/TopBar";
import { ActionIcon, FilterIcon } from "@/components/Icons";
import {
  listAllTutors,
  recommendTutors,
  type SubjectCode,
  type TeacherProfileDetail,
} from "@/services/api";
import "./index.scss";

const SUBJECTS: Array<{ key: SubjectCode; label: string }> = [
  { key: "MATH", label: "数学" },
  { key: "ENGLISH", label: "英语" },
  { key: "CHINESE", label: "语文" },
  { key: "PHYSICS", label: "物理" },
  { key: "CHEMISTRY", label: "化学" },
];

type SchoolStage = "PRIMARY" | "MIDDLE" | "HIGH";

const SCHOOL_STAGES: Array<{ key: SchoolStage | null; label: string }> = [
  { key: null, label: "不限" },
  { key: "PRIMARY", label: "小学" },
  { key: "MIDDLE", label: "初中" },
  { key: "HIGH", label: "高中" },
];

const BUDGETS = [
  { value: null, label: "不限" },
  { value: 100, label: "¥100 内" },
  { value: 200, label: "¥200 内" },
  { value: 300, label: "¥300 内" },
] as const;

type TutorCard = {
  id: string;
  displayName: string;
  subjects: SubjectCode[];
  schoolStages: string[];
  experienceYears: number;
  pricePerHour: number;
  teachingModes: string[];
  teachingTags: string[];
  avgRating: number | null;
  reviewCount: number;
  reasons: string[];
  score: number | null;
  nextSlot: string | null;
};

const EMPTY_TUTOR: TutorCard = {
  id: "",
  displayName: "待匹配老师",
  subjects: [],
  schoolStages: [],
  experienceYears: 0,
  pricePerHour: 0,
  teachingModes: [],
  teachingTags: [],
  avgRating: null,
  reviewCount: 0,
  reasons: [],
  score: null,
  nextSlot: null,
};

export default function TutorsPage() {
  const { state, dispatch } = useAppStore();
  const [subject, setSubject] = useState<SubjectCode>("MATH");
  const [schoolStage, setSchoolStage] = useState<SchoolStage | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftSubject, setDraftSubject] = useState<SubjectCode>("MATH");
  const [draftStage, setDraftStage] = useState<SchoolStage | null>(null);
  const [draftBudget, setDraftBudget] = useState<number | null>(null);
  const [platformCount, setPlatformCount] = useState<number | null>(null);
  const [items, setItems] = useState<TutorCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (state.activeChild) {
        try {
          const result = await recommendTutors({ childId: state.activeChild.id, subject });
          const recommended = result.items.map(fromRecommendation)
            .filter((item) => !schoolStage || item.schoolStages.includes(schoolStage))
            .filter((item) => budget == null || item.pricePerHour <= budget);
          setItems(recommended);
          return;
        } catch {
          // Recommendation can be unavailable before a profile exists; browsing remains useful.
        }
      }
      const tutors = await listAllTutors({ subject, schoolStage: schoolStage ?? undefined, limit: 20 });
      setItems(tutors.map(fromProfile).filter((item) => budget == null || item.pricePerHour <= budget));
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [state.activeChild?.id, subject, schoolStage, budget]);

  useEffect(() => { void load(); }, [load]);
  useDidShow(() => { void load(); });
  useEffect(() => { setCursor(0); setHistory([]); }, [subject, schoolStage, budget]);

  useEffect(() => {
    let active = true;
    void Promise.all(SUBJECTS.map((item) => listAllTutors({ subject: item.key, limit: 50 })))
      .then((groups) => {
        if (!active) return;
        setPlatformCount(new Set(groups.flat().map((teacher) => teacher.id)).size);
      })
      .catch(() => { if (active) setPlatformCount(null); });
    return () => { active = false; };
  }, []);

  const teacher = items[cursor];
  const visibleTeacher = teacher ?? EMPTY_TUTOR;
  const isEmpty = !loading && items.length === 0;
  const openTeacher = (id: string) => Taro.navigateTo({ url: `/pages/tutor-detail/index?id=${id}` });
  const bookTeacher = (item: TutorCard) => Taro.navigateTo({
    url: `/pages/trial-booking/index?teacherId=${item.id}&subject=${item.subjects[0] ?? subject}`,
  });
  const advance = () => {
    if (!items.length) return;
    setHistory((old) => [...old, cursor]);
    setCursor((value) => value + 1);
  };
  const undo = () => {
    const previous = history[history.length - 1];
    if (previous == null) return;
    setCursor(previous);
    setHistory((old) => old.slice(0, -1));
  };
  const openFilters = () => {
    setDraftSubject(subject);
    setDraftStage(schoolStage);
    setDraftBudget(budget);
    setFilterOpen(true);
  };
  const applyFilters = () => {
    setSubject(draftSubject);
    setSchoolStage(draftStage);
    setBudget(draftBudget);
    setFilterOpen(false);
  };
  return (
    <View className="tutors-root lt-page">
      <TopBar />
      <View className="lt-content tutors-content">
        <View className="match-intro">
          <Text className="match-title">已有 <Text className="match-count">{platformCount ?? 0}</Text> 位优秀老师入驻平台</Text>
          <View className="platform-filter" onClick={openFilters}><FilterIcon /><Text>筛选</Text></View>
        </View>

        {loading ? <View className="tutor-card tutor-card-skeleton lt-card"><View className="skeleton-identity" /><View className="skeleton-body"><View /><View /><View /></View></View> : items.length > 0 && !teacher ? (
          <View className="deck-end lt-card"><Text className="deck-end-title">本轮老师已经看完</Text><Text className="deck-end-copy">可以重新浏览，或调整筛选条件继续寻找。</Text><View className="deck-restart" onClick={() => { setCursor(0); setHistory([]); }}><Text>重新浏览</Text></View></View>
        ) : <>
              <View key={visibleTeacher.id || `empty-${subject}`} className={`teacher-card hero-card ${isEmpty ? "teacher-card-empty" : ""}`} onClick={() => { if (teacher) void openTeacher(teacher.id); }}>
                <View className="teacher-identity">
                  <View className="identity-top"><Text>{labelSubject(visibleTeacher.subjects[0] ?? subject)} · {teacher ? labelStage(teacher.schoolStages) : "学段待匹配"}</Text></View>
                  <View className="identity-main">
                    <View className="teacher-avatar"><Text>{teacher ? teacher.displayName.slice(0, 1) : "师"}</Text></View>
                    <View className="teacher-profile">
                      <View className="name-line"><Text className="teacher-name">{visibleTeacher.displayName}</Text>{teacher && <Text className="verified">✓</Text>}</View>
                      <Text className="school">{teacher ? `${teacher.teachingModes.map(labelMode).join(" / ")}授课 · ${teacher.experienceYears} 年教龄` : "老师资料接入后将在这里展示"}</Text>
                    </View>
                  </View>
                  <View className="credential-tags">
                    {teacher && teacher.teachingTags.length ? teacher.teachingTags.slice(0, 4).map((tag, index) => <Text className={index < 2 ? "credential" : ""} key={tag}>{tag}</Text>) : <><Text className="credential">教学资质</Text><Text className="credential">专业背景</Text><Text>授课特点</Text></>}
                  </View>
                </View>
                <View className="compact-body">
                  <View className="teacher-meta"><Text>★ {teacher?.avgRating?.toFixed(1) ?? "暂无评分"}</Text><View className="meta-dot" /><Text>{teacher?.reviewCount ? `${teacher.reviewCount} 条家长原话` : teacher ? "新入驻老师" : "评价资料待补充"}</Text></View>
                  {teacher ? <Text className="teacher-note">{teacher.reasons[0] ? `“${teacher.reasons[0]}”` : "老师的教学介绍正在完善中"}</Text> : <View className="teacher-empty-message"><Text>{error ? "老师列表暂时不可用" : "当前条件下暂无可服务老师"}</Text><Text>{error ? "请检查网络后重新加载" : "可以切换学科，或稍后回来查看"}</Text></View>}
                  <View className="decision-grid">
                    <View><Text className="decision-value">{teacher ? `${teacher.experienceYears} 年` : "--"}</Text><Text>教龄</Text></View>
                    <View><Text className="decision-value">{teacher ? `¥${teacher.pricePerHour}` : "--"}</Text><Text>起 / 60 分钟</Text></View>
                    <View><Text className="decision-value">{teacher?.nextSlot ?? "待更新"}</Text><Text>最近可约</Text></View>
                  </View>
                  <View className="trust-line"><Text>{teacher ? "✓ 公开资料已核验" : "资料核验后展示"}</Text><Text>{teacher?.reviewCount ? `✓ ${teacher.reviewCount} 条家长原话` : "✓ 支持先试听"}</Text><Text>{teacher ? "查看保障详情 ›" : "匹配中"}</Text></View>
                  <View className="lesson-video">
                    <View className="lesson-placeholder"><Text className="play-mark">▶</Text></View>
                    <View className="video-label"><Text className="video-title">试听片段</Text><Text>{teacher ? "进入详情了解 TA 的课堂" : "老师课堂资料将在这里展示"}</Text></View>
                  </View>
                  <View className="contact-row">
                    <View className="contact-status"><Text className="contact-icon">☎</Text><View><Text className="contact-label">联系方式</Text><Text className="contact-copy">{teacher ? "完成试听后即可聊天" : "匹配成功后可预约试听"}</Text></View></View>
                    <View className={`book-button ${teacher ? "" : "disabled"}`} onClick={(event) => { event.stopPropagation(); if (teacher) void bookTeacher(teacher); else if (error) void load(); }}><Text>{teacher ? "预约免费试听" : error ? "重新加载" : "暂不可预约"}</Text><Text>›</Text></View>
                  </View>
                </View>
              </View>
              <View className="swipe-actions">
                <View className={`swipe-button pass ${teacher ? "" : "disabled"}`} onClick={advance}><ActionIcon name="pass" /><Text>不合适</Text></View>
                <View className={`swipe-button undo ${history.length ? "" : "disabled"}`} onClick={undo}><ActionIcon name="undo" /><Text>撤回</Text></View>
                <View className={`swipe-button like ${teacher ? "" : "disabled"}`} onClick={() => { if (teacher) void openTeacher(teacher.id); }}><ActionIcon name="like" /><Text>感兴趣</Text></View>
              </View>
              <Text className="deck-progress">{teacher ? `${cursor + 1} / ${items.length} · 左右选择，点击卡片查看详情` : "老师数据接入后，卡片内容会自动完整显示"}</Text>
            </>}
      </View>
      {filterOpen && <View className="filter-backdrop" onClick={() => setFilterOpen(false)}>
        <View className="filter-sheet" onClick={(event) => event.stopPropagation()}>
          <View className="filter-handle" />
          <Text className="filter-eyebrow">FIND THE RIGHT TUTOR</Text>
          <Text className="filter-title">筛选老师</Text>
          <Text className="filter-note">选择科目、学段与单次课预算。</Text>
          <Text className="filter-label">辅导科目</Text>
          <View className="filter-options">{SUBJECTS.map((item) => <View key={item.key} className={draftSubject === item.key ? "selected" : ""} onClick={() => setDraftSubject(item.key)}><Text>{item.label}</Text></View>)}</View>
          <Text className="filter-label">孩子学段</Text>
          <View className="filter-options">{SCHOOL_STAGES.map((item) => <View key={item.label} className={draftStage === item.key ? "selected" : ""} onClick={() => setDraftStage(item.key)}><Text>{item.label}</Text></View>)}</View>
          <Text className="filter-label">单次课预算（60 分钟）</Text>
          <View className="filter-options">{BUDGETS.map((item) => <View key={item.label} className={draftBudget === item.value ? "selected" : ""} onClick={() => setDraftBudget(item.value)}><Text>{item.label}</Text></View>)}</View>
          <View className="filter-submit" onClick={applyFilters}><Text>开始为孩子找老师</Text></View>
          <Text className="filter-cancel" onClick={() => setFilterOpen(false)}>取消</Text>
        </View>
      </View>}
    </View>
  );
}

function fromRecommendation(item: RecommendationItem): TutorCard {
  return { id: item.teacherId, displayName: item.displayName, subjects: item.subjects, schoolStages: item.schoolStages, experienceYears: item.experienceYears, pricePerHour: item.pricePerHour, teachingModes: item.teachingModes, teachingTags: item.teachingTags, avgRating: null, reviewCount: 0, reasons: item.reasons.map((reason) => reason.text), score: item.score, nextSlot: item.availabilitySlots[0] ? formatSlot(item.availabilitySlots[0].startsAt) : null };
}

function fromProfile(item: TeacherProfileDetail): TutorCard {
  return { id: item.id, displayName: item.displayName, subjects: item.subjects, schoolStages: item.schoolStages, experienceYears: item.experienceYears, pricePerHour: item.pricePerHour, teachingModes: item.teachingModes, teachingTags: item.teachingTags, avgRating: item.avgRating, reviewCount: item.reviewCount, reasons: item.bio ? [item.bio] : [], score: null, nextSlot: item.availabilityPreview[0] ? formatSlot(item.availabilityPreview[0].startsAt) : null };
}

function labelSubject(value: string): string { return SUBJECTS.find((item) => item.key === value)?.label ?? value; }
function labelStage(values: string[]): string { return values.map((value) => ({ PRIMARY: "小学", MIDDLE: "初中", HIGH: "高中" }[value] ?? value)).join(" / "); }
function labelMode(value: string): string { return ({ ONLINE: "线上", IN_HOME: "上门", IN_CENTER: "中心" }[value] ?? value); }
function formatSlot(value: string): string { const date = new Date(value); return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`; }
