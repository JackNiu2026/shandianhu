import { useEffect, useMemo, useState } from "react";
import { View, Text, Image } from "@tarojs/components";
import { ActionIcon } from "@/components/Icons";
import { NeedsSheet, TrustSheet, BookSheet, VideoPlayer } from "@/components/Modals";
import { useAppStore } from "@/store";
import { matchTeachers, isRelaxedMatch } from "@lightning-tiger/shared";
import type { Teacher } from "@lightning-tiger/shared";
import "./index.scss";

export default function MatchPage() {
  const { state, dispatch } = useAppStore();
  const { prefs, liked } = state;

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

  const matched = useMemo(() => matchTeachers(prefs), [prefs]);
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
      <View className="intro-row platform-stat">
        <Text>
          已有 <Text>856</Text> 位优秀老师入驻平台
        </Text>
        <View className="filter-btn platform-filter" onClick={() => setNeedsOpen(true)}>
          <Text>筛选</Text>
        </View>
      </View>
      {relaxed && (
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
                  {teacher.avatar ? <Image src={teacher.avatar} /> : <Text>{teacher.name[0]}</Text>}
                </View>
                <View>
                  <View className="name-line">
                    <Text>{teacher.name}</Text>
                    <Text>{teacher.age}</Text>
                    <View className="verified">
                      <Text>✓</Text>
                    </View>
                  </View>
                  <Text className="school">{teacher.school}</Text>
                </View>
              </View>
              <View className="tags credential-tags">
                {teacher.tags.map((tag, index) => (
                  <Text className={index < 2 ? "credential" : ""} key={tag}>
                    {tag}
                  </Text>
                ))}
              </View>
            </View>
            <View className="card-body compact-body">
              <View className="teacher-meta">
                <Text>★ {teacher.rating} 评分</Text>
                <View />
                <Text>已陪伴 {teacher.students} 位学生</Text>
              </View>
              <Text className="teacher-note">“{teacher.note}”</Text>
              <View className="decision-grid">
                <Text>
                  <Text>{teacher.years}</Text>教龄
                </Text>
                <Text>
                  <Text>¥{teacher.price}</Text>起 / 60 分钟
                </Text>
                <Text>
                  <Text>{teacher.slots[0]}</Text>最近可约
                </Text>
              </View>
              <View className="trust-line" onClick={() => setTrustFor(teacher)}>
                <Text>✓ 4 项资质已核验</Text>
                <Text>✓ {teacher.reviews.length} 条家长原话</Text>
                <Text>查看保障详情 ›</Text>
              </View>
              <View className="portrait video-cover lesson-video">
                <Image src={teacher.video} />
                <View className="video-shade" />
                <View className="play-video" onClick={() => setPlaying(teacher)}>
                  <Text>▶</Text>
                </View>
                <View className="video-label">
                  <Text>试听片段 · 02:18</Text>
                  <Text>一分钟看懂 TA 的课堂</Text>
                </View>
              </View>
              <View className="contact-row">
                <View className="contact-status">
                  <Text className="contact-icon">☎</Text>
                  <Text>
                    <Text>联系方式</Text>
                    <Text>完成试听后即可聊天</Text>
                  </Text>
                </View>
                <View onClick={() => setBookFor(teacher)}>
                  <Text>预约免费试听 </Text>
                  <Text>›</Text>
                </View>
              </View>
            </View>
          </View>
          <View className="swipe-actions">
            <View
              className={`pass ${swipeFeedback === "left" ? "decision-feedback" : ""}`}
              onClick={() => moveCard("left")}
            >
              <ActionIcon name="pass" />
            </View>
            <View
              className="undo"
              onClick={() => {
                if (swipeHistory.length) undoSwipe();
              }}
            >
              <ActionIcon name="undo" />
            </View>
            <View
              className={`like ${swipeFeedback === "right" ? "decision-feedback" : ""}`}
              onClick={() => moveCard("right")}
            >
              <ActionIcon name="like" />
            </View>
          </View>
        </>
      ) : (
        <View className="deck-end">
          <Text>✦</Text>
          <Text>这一轮推荐看完了</Text>
          <Text>
            已收藏 {liked.length} 位老师，可以在「我的」里对比。也可以放宽条件看看更多。
          </Text>
          <View className="deck-end-actions">
            <View onClick={() => setCursor(0)}>
              <Text>重新浏览</Text>
            </View>
            <View className="primary" onClick={() => setNeedsOpen(true)}>
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
          onBook={(teacherName, slot) => {
            dispatch({ type: "SET_BOOKED", booked: { teacher: teacherName, slot } });
          }}
        />
      )}

      {playing && <VideoPlayer teacher={playing} onClose={() => setPlaying(null)} />}
    </View>
  );
}
