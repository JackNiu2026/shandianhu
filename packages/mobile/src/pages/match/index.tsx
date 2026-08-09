import { useEffect, useMemo, useState } from "react";
import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { ActionIcon, FilterIcon } from "@/components/Icons";
import { TopBar } from "@/components/TopBar";
import { Skeleton } from "@/components/Skeleton";
import { NeedsSheet, TrustSheet, BookSheet, VideoPlayer } from "@/components/Modals";
import { useAppStore } from "@/store";
import { useTeachers, usePlatformStats } from "@/hooks";
import { createBooking } from "@/services/api";
import { matchTeachers, isRelaxedMatch } from "@lightning-tiger/shared";
import type { Teacher } from "@lightning-tiger/shared";
import "./index.scss";

export default function MatchPage() {
  const { state, dispatch } = useAppStore();
  const { prefs, liked } = state;

  // 从 API 获取老师列表和平台统计
  const { teachers: apiTeachers, loading, error, retry } = useTeachers(prefs);
  const { stats, loading: statsLoading, error: statsError, retry: retryStats } = usePlatformStats();

  const [cursor, setCursor] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [swipeFeedback, setSwipeFeedback] = useState<"left" | "right" | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [hasShownSwipeHint, setHasShownSwipeHint] = useState(false);
  const [needsOpen, setNeedsOpen] = useState(!prefs);
  const [trustFor, setTrustFor] = useState<Teacher | null>(null);
  const [bookFor, setBookFor] = useState<Teacher | null>(null);
  const [playing, setPlaying] = useState<Teacher | null>(null);
  const [swipeHistory, setSwipeHistory] = useState<{ teacher: Teacher; direction: "left" | "right" }[]>([]);

  const matched = useMemo(() => matchTeachers(prefs, apiTeachers), [prefs, apiTeachers]);
  const relaxed = isRelaxedMatch(prefs, matched);
  const teacher = matched[cursor];

  useEffect(() => {
    setCursor(0);
  }, [prefs]);

  useEffect(() => {
    if (needsOpen || hasShownSwipeHint || !teacher) return;
    const start = setTimeout(() => setShowSwipeHint(true), 280);
    const end = setTimeout(() => {
      setShowSwipeHint(false);
      setHasShownSwipeHint(true);
    }, 2100);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [hasShownSwipeHint, needsOpen, teacher]);

  const moveCard = (direction: "left" | "right") => {
    if (!teacher) return;
    if (direction === "right") {
      dispatch({ type: "ADD_LIKED", teacher });
    }
    setSwipeHistory((history) => [...history, { teacher, direction }]);
    setSwipeDirection(direction);
    setTimeout(() => {
      setCursor((i) => i + 1);
      setSwipeDirection(null);
      setSwipeFeedback(direction);
      setTimeout(() => setSwipeFeedback(null), 720);
    }, 260);
  };

  const undoSwipe = () => {
    const last = swipeHistory[swipeHistory.length - 1];
    if (!last || cursor === 0) return;
    if (last.direction === "right") {
      dispatch({ type: "REMOVE_LIKED", name: last.teacher.name });
    }
    setSwipeHistory((history) => history.slice(0, -1));
    setCursor((index) => Math.max(0, index - 1));
  };

  return (
    <View className="match-screen">
      <TopBar />
      <View className="intro-row platform-stat">
        <Text className="h1">
          {stats ? (
            <>已有 <Text className="strong">{stats.teacherCount}</Text> 位优秀老师入驻平台</>
          ) : statsLoading ? (
            "正在加载平台老师数据"
          ) : (
            "暂未获得平台老师数据"
          )}
        </Text>
        <View className="filter-btn platform-filter" onClick={() => setNeedsOpen(true)}>
          <FilterIcon color="#263334" />
          <Text>筛选</Text>
        </View>
      </View>
      {statsError && (
        <View className="data-state data-state-inline">
          <Text>{statsError}</Text>
          <View className="button" onClick={retryStats}>
            <Text>重试</Text>
          </View>
        </View>
      )}
      {loading ? (
        <Skeleton variant="teacher-card" />
      ) : error ? (
        <View className="data-state">
          <Text className="b">暂时无法加载老师</Text>
          <Text className="p">{error}</Text>
          <View className="button primary" onClick={retry}>
            <Text>重新加载</Text>
          </View>
        </View>
      ) : apiTeachers.length === 0 ? (
        <View className="data-state">
          <Text className="b">暂未找到合适的老师</Text>
          <Text className="p">可以调整筛选条件，或稍后重新加载。</Text>
          <View className="data-state-actions">
            <View className="button" onClick={() => setNeedsOpen(true)}>
              <Text>调整筛选</Text>
            </View>
            <View className="button primary" onClick={retry}>
              <Text>重新加载</Text>
            </View>
          </View>
        </View>
      ) : relaxed && (
        <Text className="relax-note">符合预算的老师已看完，以下为放宽预算后的推荐</Text>
      )}

      {teacher ? (
        <>
          <View
            className={`teacher-card hero-card ${swipeDirection ? `swipe-${swipeDirection}` : ""} ${showSwipeHint ? "swipe-hint" : ""}`}
          >
            {showSwipeHint && (
              <View className="swipe-overlay">
                <Text className="swipe-arrow left">‹</Text>
                <Text className="swipe-guide">
                  左右滑动{"\n"}发现更多老师
                </Text>
                <Text className="swipe-arrow right">›</Text>
              </View>
            )}
            <View className="teacher-identity" style={{ backgroundColor: teacher.color }}>
              <View className="identity-top">
                <Text>
                  {teacher.subject} · {teacher.grades.join("/")}
                </Text>
              </View>
              <View className="identity-main">
                <View className="teacher-avatar">
                  {teacher.avatar ? <Image src={teacher.avatar} mode="aspectFill" /> : <Text>{teacher.name[0]}</Text>}
                </View>
                <View>
                  <View className="name-line">
                    <Text className="h2">{teacher.name}</Text>
                    <Text className="span">{teacher.age}</Text>
                    <View className="verified">
                      <Text>✓</Text>
                    </View>
                  </View>
                  <Text className="school">{teacher.school}</Text>
                </View>
              </View>
              <View className="tags credential-tags">
                {teacher.tags.map((tag, index) => (
                  <Text className={index < 2 ? "credential span" : "span"} key={tag}>
                    {tag}
                  </Text>
                ))}
              </View>
            </View>
            <View className="card-body compact-body">
              <View className="teacher-meta">
                <Text className="span">★ {teacher.rating} 评分</Text>
                <View className="i" />
                <Text className="span">已陪伴 {teacher.students} 位学生</Text>
              </View>
              <Text className="teacher-note">“{teacher.note}”</Text>
              <View className="decision-grid">
                <View className="span">
                  <Text className="b">{teacher.years}</Text>
                  <Text>教龄</Text>
                </View>
                <View className="span">
                  <Text className="b">¥{teacher.price}</Text>
                  <Text>起 / 60 分钟</Text>
                </View>
                <View className="span">
                  <Text className="b">{teacher.slots[0]}</Text>
                  <Text>最近可约</Text>
                </View>
              </View>
              <View className="trust-line" onClick={() => setTrustFor(teacher)}>
                <Text className="span">✓ 4 项资质已核验</Text>
                <Text className="span">✓ {teacher.reviews.length} 条家长原话</Text>
                <Text className="span">查看保障详情 ›</Text>
              </View>
              <View className="portrait video-cover lesson-video">
                <Image src={teacher.video} mode="aspectFill" />
                <View className="video-shade" />
                <View className="play-video" onClick={() => setPlaying(teacher)}>
                  <Text>▶</Text>
                </View>
                <View className="video-label">
                  <Text className="b">试听片段 · 02:18</Text>
                  <Text className="span">一分钟看懂 TA 的课堂</Text>
                </View>
              </View>
              <View className="contact-row">
                <View className="contact-status">
                  <Text className="contact-icon">☎</Text>
                  <Text>
                    <Text className="small">联系方式</Text>
                    <Text className="b">完成试听后即可聊天</Text>
                  </Text>
                </View>
                <View className="button" onClick={() => setBookFor(teacher)}>
                  <Text>预约免费试听 </Text>
                  <Text className="span">›</Text>
                </View>
              </View>
            </View>
          </View>
          <View className="swipe-actions">
            <View
              className={`button pass ${swipeFeedback === "left" ? "decision-feedback" : ""}`}
              onClick={() => moveCard("left")}
            >
              <ActionIcon name="pass" />
            </View>
            <View
              className={`button undo ${swipeHistory.length === 0 ? "is-disabled" : ""}`}
              onClick={() => {
                if (swipeHistory.length) undoSwipe();
              }}
            >
              <ActionIcon name="undo" />
            </View>
            <View
              className={`button like ${swipeFeedback === "right" ? "decision-feedback" : ""}`}
              onClick={() => moveCard("right")}
            >
              <ActionIcon name="like" />
            </View>
          </View>
        </>
      ) : (
        <View className="deck-end">
          <Text className="span">✦</Text>
          <Text className="b">这一轮推荐看完了</Text>
          <Text className="p">
            已收藏 {liked.length} 位老师，可以在「我的」里对比。也可以放宽条件看看更多。
          </Text>
          <View className="deck-end-actions">
            <View className="button" onClick={() => setCursor(0)}>
              <Text>重新浏览</Text>
            </View>
            <View className="button primary" onClick={() => setNeedsOpen(true)}>
              <Text>调整筛选条件</Text>
            </View>
          </View>
        </View>
      )}

      {needsOpen && (
        <NeedsSheet
          prefs={prefs}
          onDone={(next) => {
            dispatch({ type: "SET_PREFS", prefs: next });
            setNeedsOpen(false);
          }}
          onClose={prefs ? () => setNeedsOpen(false) : undefined}
        />
      )}

      {trustFor && <TrustSheet teacher={trustFor} onClose={() => setTrustFor(null)} />}

      {bookFor && (
        <BookSheet
          teacher={bookFor}
          onClose={() => setBookFor(null)}
          onBook={async (teacherName, slot) => {
            if (!state.parentId) {
              Taro.showToast({ title: "请先登录", icon: "none" });
              return;
            }
            if (!bookFor.id) {
              Taro.showToast({ title: "老师信息异常", icon: "none" });
              return;
            }
            try {
              await createBooking({
                teacherId: bookFor.id,
                subject: bookFor.subject,
                slot,
              });
              dispatch({ type: "SET_BOOKED", booked: { teacher: teacherName, slot, teacherId: bookFor.id } });
              Taro.showToast({ title: "预约成功", icon: "success" });
            } catch {
              Taro.showToast({ title: "预约失败，请重试", icon: "none" });
            }
          }}
        />
      )}

      {playing && <VideoPlayer teacher={playing} onClose={() => setPlaying(null)} />}
    </View>
  );
}
