import { useCallback, useEffect, useState } from "react";
import { View, Text, Image, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { GearIcon, WorkIcon } from "@/components/Icons";
import { TopBar } from "@/components/TopBar";
import { Skeleton } from "@/components/Skeleton";
import { RoleModal, SettingsModal, PosterModal, SubscribeModal, BookSheet, ReviewSheet } from "@/components/Modals";
import { LoginModal } from "@/components/LoginModal";
import { useAppStore } from "@/store";
import { fetchParentInfo, createBooking, createReview } from "@/services/api";
import type { Teacher } from "@lightning-tiger/shared";
import "./index.scss";

/* ============ 家长工作台 ============ */
function ParentDashboard({
  liked,
  booked,
  openConnected,
  setOpenConnected,
  openLiked,
  setOpenLiked,
  onBook,
  onSubscribe,
  onOpenUtility,
  onReview,
}: {
  liked: Teacher[];
  booked: { teacher: string; slot: string } | null;
  openConnected: boolean;
  setOpenConnected: (open: boolean) => void;
  openLiked: boolean;
  setOpenLiked: (open: boolean) => void;
  onBook: (teacher: Teacher) => void;
  onSubscribe: () => void;
  onOpenUtility: (title: string) => void;
  onReview: () => void;
}) {
  return (
    <View className="dashboard card-dashboard">
      <View className="dashboard-title">
        <View>
          <Text className="eyebrow">PARENT SPACE</Text>
          <Text className="h2">为孩子管理学习</Text>
        </View>
      </View>

      <View className="workbench-grid">
        <View className={`function-card ${openConnected ? "expanded" : ""}`}>
          <View className="function-trigger" onClick={() => setOpenConnected(!openConnected)}>
            <View className="card-icon coral">
              <WorkIcon name="users" />
            </View>
            <Text className="span">
              <Text className="small">老师管理</Text>
              <Text className="b">已对接老师</Text>
              <Text className="em">
                {booked
                  ? `${booked.teacher}老师 · 试听 ${booked.slot}`
                  : "暂未预约试听，去发现页找老师"}
              </Text>
            </Text>
            <Text className="i">{openConnected ? "⌃" : "›"}</Text>
          </View>
          {openConnected && (
            <View className="teacher-expand">
              <View className="article">
                <View className="mini-avatar orange">
                  <Text>{booked?.teacher?.[0] || "师"}</Text>
                </View>
                <View>
                  <Text className="h3">
                    {booked ? booked.teacher : "未对接"}老师 {booked && <Text className="i">✓</Text>}
                  </Text>
                  <Text className="p">
                    {booked
                      ? `免费试听已预约 · ${booked.slot}`
                      : "预约试听后可在此查看老师信息"}
                  </Text>
                </View>
              </View>
              <View className="teacher-expand-actions">
                <View className="button" onClick={onReview}>
                  <Text>★ 评价老师</Text>
                </View>
                <View className="button" onClick={() => onOpenUtility("打赏老师")}>
                  <Text>¥ 打赏老师</Text>
                </View>
                <View className="button" onClick={() => onOpenUtility("查看课程")}>
                  <Text>查看课程</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View className={`function-card ${openLiked ? "expanded" : ""}`}>
          <View className="function-trigger" onClick={() => setOpenLiked(!openLiked)}>
            <View className="card-icon blush">
              <WorkIcon name="heart" />
            </View>
            <Text className="span">
              <Text className="small">我的收藏</Text>
              <Text className="b">感兴趣的老师</Text>
              <Text className="em">
                {liked.length
                  ? `已收藏 ${liked.length} 位，可展开对比`
                  : "右滑心动的老师会出现在这里"}
              </Text>
            </Text>
            <Text className="i">{openLiked ? "⌃" : "›"}</Text>
          </View>
          {openLiked && (
            <View className="teacher-expand">
              {liked.length
                ? liked.map((t) => (
                    <View key={t.name} className="compare-row article">
                      <View className="mini-avatar" style={{ backgroundColor: t.color }}>
                        {t.avatar ? <Image src={t.avatar} mode="aspectFill" /> : <Text>{t.name[0]}</Text>}
                      </View>
                      <View className="compare-main">
                        <Text className="h3">
                          {t.name}老师 <Text className="i">✓</Text>
                        </Text>
                        <Text className="p">
                          {t.subject} · {t.years}教龄 · ¥{t.price} 起 · {t.slots[0]} 可约
                        </Text>
                      </View>
                      <View className="button" onClick={() => onBook(t)}>
                        <Text>约试听</Text>
                      </View>
                    </View>
                  ))
                : (
                  <Text className="expand-empty">
                    还没有收藏。在「发现」里右滑，或点 ♥ 收藏喜欢的老师。
                  </Text>
                )}
              {liked.length > 1 && (
                <View className="compare-more" onClick={onSubscribe}>
                  <Text>同时约多位老师对比 ›</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View
          className="function-card function-trigger"
          onClick={() => onOpenUtility("成长记录")}
        >
          <View className="card-icon mint">
            <WorkIcon name="chart" />
          </View>
          <Text className="span">
            <Text className="small">成长记录</Text>
            <Text className="b">学习动态</Text>
            <Text className="em">本周学习报告已生成</Text>
          </Text>
          <Text className="i">›</Text>
        </View>

        <View
          className="function-card function-trigger"
          onClick={() => onOpenUtility("孩子档案")}
        >
          <View className="card-icon lilac">
            <WorkIcon name="folder" />
          </View>
          <Text className="span">
            <Text className="small">孩子档案</Text>
            <Text className="b">孩子的成长档案</Text>
            <Text className="em">学习风格已更新 · 7 月 26 日</Text>
          </Text>
          <Text className="i">›</Text>
        </View>
      </View>
    </View>
  );
}

/* ============ 老师工作台 ============ */
function TeacherDashboard({
  onSettings,
  onOpenPoster,
  onOpenUtility,
  name,
  avatar,
  school,
}: {
  onSettings: () => void;
  onOpenPoster: () => void;
  onOpenUtility: (title: string) => void;
  name: string;
  avatar: string;
  school?: string;
}) {
  return (
    <>
      <View className="teacher-profile-card">
        <View className="teacher-profile-top">
          <View className="button" onClick={onSettings}>
            <GearIcon />
          </View>
        </View>
        <View className="teacher-profile-main">
          <View className="teacher-big-avatar">
            <Text>{avatar}</Text>
          </View>
          <View>
            <Text className="h1">
              {name} <Text className="i">✓</Text>
            </Text>
            <Text className="small">{school || "—"}</Text>
          </View>
        </View>
        <View className="teacher-profile-tags">
          <Text className="span">985 / 211</Text>
          <Text className="span">中考数学</Text>
          <Text className="span">竞赛启蒙</Text>
        </View>
        <View className="teacher-profile-stats">
          <Text className="span">
            <Text className="b">暂不可用</Text>
            <Text className="small">累计学生</Text>
          </Text>
          <Text className="span">
            <Text className="b">暂不可用</Text>
            <Text className="small">综合评分</Text>
          </Text>
          <Text className="span">
            <Text className="b">建设中</Text>
            <Text className="small">授课课时</Text>
          </Text>
        </View>
      </View>

      <View className="revenue-card">
        <View className="revenue-head">
          <View>
            <Text className="p">收益概览</Text>
            <Text className="b">本月授课收益</Text>
          </View>
        </View>
        <View className="revenue-grid">
          <Text className="span">
            <Text className="small">总佣金</Text>
            <Text className="b">暂不可用</Text>
          </Text>
          <Text className="span">
            <Text className="small">待入账</Text>
            <Text className="b">—</Text>
          </Text>
          <Text className="span">
            <Text className="small">可提现</Text>
            <Text className="b">—</Text>
          </Text>
        </View>
      </View>

      <View className="dashboard teacher-dashboard">
        <View className="dashboard-title">
          <View>
            <Text className="eyebrow">TEACHER DESK</Text>
            <Text className="h2">我的教学工作台</Text>
          </View>
        </View>
        <View className="workbench-grid">
          <View
            className="function-card function-trigger"
            onClick={() => onOpenUtility("学生管理")}
          >
            <View className="card-icon coral">
              <WorkIcon name="users" />
            </View>
            <Text className="span">
              <Text className="small">学生管理</Text>
              <Text className="b">已对接家长</Text>
              <Text className="em">数据暂不可用 · 功能建设中</Text>
            </Text>
            <Text className="i">›</Text>
          </View>
          <View
            className="function-card function-trigger"
            onClick={() => onOpenUtility("课程安排")}
          >
            <View className="card-icon mint">
              <WorkIcon name="calendar" />
            </View>
            <Text className="span">
              <Text className="small">课程安排</Text>
              <Text className="b">本周课程</Text>
              <Text className="em">查看本周课程安排</Text>
            </Text>
            <Text className="i">›</Text>
          </View>
          <View
            className="function-card function-trigger"
            onClick={() => onOpenUtility("我的资料")}
          >
            <View className="card-icon lilac">
              <WorkIcon name="edit" />
            </View>
            <Text className="span">
              <Text className="small">我的资料</Text>
              <Text className="b">授课信息与展示页</Text>
              <Text className="em">完善资料，提升家长匹配度</Text>
            </Text>
            <Text className="i">›</Text>
          </View>
          <View
            className="function-card function-trigger"
            onClick={() => onOpenUtility("专业成长")}
          >
            <View className="card-icon blush">
              <WorkIcon name="star" />
            </View>
            <Text className="span">
              <Text className="small">专业成长</Text>
              <Text className="b">教学评价</Text>
              <Text className="em">评价数据暂不可用</Text>
            </Text>
            <Text className="i">›</Text>
          </View>
          <View
            className="function-card function-trigger personal-card"
            onClick={onOpenPoster}
          >
            <View className="card-icon lilac">
              <WorkIcon name="shield" />
            </View>
            <Text className="span">
              <Text className="small">个人名片</Text>
              <Text className="b">生成介绍海报</Text>
              <Text className="em">分享给有需要的家长</Text>
            </Text>
            <Text className="i">›</Text>
          </View>
        </View>
      </View>
    </>
  );
}

/* ============ 我的页面 ============ */
export default function MePage() {
  const { state, dispatch } = useAppStore();
  const { role, liked, booked, parentName, parentAvatar, teacherName, teacherAvatar } = state;

  const [roleOpen, setRoleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [openConnected, setOpenConnected] = useState(false);
  const [openLiked, setOpenLiked] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [bookFor, setBookFor] = useState<Teacher | null>(null);
  const [reviewFor, setReviewFor] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [parentInfo, setParentInfo] = useState<{
    bookingCount: number;
    likedTeachers: string[];
  } | null>(null);
  const [parentLoading, setParentLoading] = useState(false);
  const [parentError, setParentError] = useState("");

  // 是否已登录（家长端：有 parentId 且有 token）
  const isLoggedIn = !!state.parentId && !!Taro.getStorageSync("auth-token");

  useEffect(() => {
    if (!role) setRoleOpen(true);
  }, []);

  const loadParentInfo = useCallback(async () => {
    if (!state.parentId) return;
    setParentLoading(true);
    setParentError("");
    try {
      const data = await fetchParentInfo();
      setParentInfo({
        bookingCount: data.bookingCount,
        likedTeachers: data.likedTeachers,
      });
      if (data.name) dispatch({ type: "SET_PARENT_NAME", name: data.name });
    } catch (err) {
      setParentInfo(null);
      setParentError("个人资料加载失败，请检查网络后重试");
      console.error("[Me] parent profile load failed", err);
    } finally {
      setParentLoading(false);
    }
  }, [dispatch, state.parentId]);

  useEffect(() => {
    loadParentInfo();
  }, [loadParentInfo]);

  const onOpenUtility = (title: string) => {
    Taro.showToast({ title: `${title}功能正在开发中，敬请期待`, icon: "none" });
  };

  // P1-1: 老师端演示数据（后端 API 就绪前用硬编码，展示完整 UI 效果）
  const teacherProfile: Teacher = {
    name: teacherName,
    age: "",
    school: "复旦大学",
    subject: "数学",
    grades: ["初中"],
    mode: "线上",
    tags: ["985/211", "中考数学", "竞赛启蒙"],
    color: "#967AE9",
    note: "用心陪伴每一位学生，让数学不再可怕",
    rating: "4.9",
    students: "32",
    years: "6年",
    price: 220,
    slots: ["周六 10:00", "周日 14:00"],
    video: "",
    checks: ["教师资格证", "学历认证", "无犯罪记录"],
    reviews: [],
  };

  return (
    <View className="me-screen">
      <TopBar />
      {role === "teacher" ? (
        <TeacherDashboard
          onSettings={() => setSettingsOpen(true)}
          onOpenPoster={() => setPosterOpen(true)}
          onOpenUtility={onOpenUtility}
          name={teacherName}
          avatar={teacherAvatar}
          school={teacherProfile.school}
        />
      ) : (
        <>
          {isLoggedIn && parentLoading && !parentInfo ? (
            <Skeleton variant="profile-hero" />
          ) : isLoggedIn && parentError ? (
            <View className="data-state profile-data-state">
              <Text className="b">暂时无法加载个人资料</Text>
              <Text className="p">{parentError}</Text>
              <View className="button primary" onClick={loadParentInfo}>
                <Text>重新加载</Text>
              </View>
            </View>
          ) : (
            <View className="profile-banner profile-hero">
            <View
              className="profile-setting button"
              onClick={() => (isLoggedIn ? setSettingsOpen(true) : setLoginOpen(true))}
            >
              <GearIcon />
            </View>
            <View className="my-avatar" onClick={() => !isLoggedIn && setLoginOpen(true)}>
              <Text>{isLoggedIn ? parentAvatar : "⚡"}</Text>
            </View>
            <View className="profile-info" onClick={() => !isLoggedIn && setLoginOpen(true)}>
              <Text className="p">{isLoggedIn ? `下午好，${parentName}` : "未登录"}</Text>
              <Text className="h1">
                {isLoggedIn ? "正在陪孩子 " : "登录后查看 "}
                <Text className="span">{isLoggedIn ? "家长" : "点击登录"}</Text>
              </Text>
              <Text className="small">
                {isLoggedIn
                  ? parentInfo
                    ? `已陪伴孩子学习 ${parentInfo.bookingCount} 次课程`
                    : "查看档案 ›"
                  : "登录后管理孩子的学习、收藏老师、预约试听"}
              </Text>
            </View>
            <View className="profile-stats">
              <Text className="span">
                <Text className="b">{isLoggedIn && parentInfo ? String(parentInfo.bookingCount).padStart(2, "0") : "—"}</Text>
                <Text className="small">完成课程</Text>
              </Text>
              <Text className="span">
                <Text className="b">{isLoggedIn ? String(liked.length).padStart(2, "0") : "—"}</Text>
                <Text className="small">收藏老师</Text>
              </Text>
              <Text className="span">
                <Text className="b">—</Text>
                <Text className="small">学习天数</Text>
              </Text>
            </View>
          </View>
          )}
          <ParentDashboard
            liked={liked}
            booked={booked}
            openConnected={openConnected}
            setOpenConnected={(v) => (isLoggedIn ? setOpenConnected(v) : setLoginOpen(true))}
            openLiked={openLiked}
            setOpenLiked={(v) => (isLoggedIn ? setOpenLiked(v) : setLoginOpen(true))}
            onBook={(t) => (isLoggedIn ? setBookFor(t) : setLoginOpen(true))}
            onSubscribe={() => (isLoggedIn ? setSubscribeOpen(true) : setLoginOpen(true))}
            onOpenUtility={(title) => (isLoggedIn ? onOpenUtility(title) : setLoginOpen(true))}
            onReview={() => (isLoggedIn ? setReviewFor(true) : setLoginOpen(true))}
          />
        </>
      )}

      {roleOpen && (
        <RoleModal
          onSelect={(r) => {
            dispatch({ type: "SET_ROLE", role: r });
            setRoleOpen(false);
          }}
          hasRole={!!role}
          onClose={() => setRoleOpen(false)}
        />
      )}

      {settingsOpen && !!role && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onSwitchRole={() => {
            setSettingsOpen(false);
            setRoleOpen(true);
          }}
        />
      )}

      {posterOpen && (
        <PosterModal teacher={teacherProfile} onClose={() => setPosterOpen(false)} />
      )}

      {subscribeOpen && <SubscribeModal onClose={() => setSubscribeOpen(false)} />}

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
              setOpenConnected(true);
              Taro.showToast({ title: "预约成功", icon: "success" });
            } catch {
              Taro.showToast({ title: "预约失败，请重试", icon: "none" });
            }
          }}
        />
      )}

      {reviewFor && state.booked && (
        <ReviewSheet
          teacherName={state.booked.teacher}
          onClose={() => setReviewFor(false)}
          onSubmit={async (rating, text) => {
            if (!state.booked?.teacherId) {
              Taro.showToast({ title: "老师信息异常", icon: "none" });
              return;
            }
            try {
              await createReview({
                teacherId: state.booked.teacherId,
                text,
                rating,
              });
              Taro.showToast({ title: "评价成功", icon: "success" });
            } catch {
              Taro.showToast({ title: "评价失败，请重试", icon: "none" });
            }
          }}
        />
      )}

      {loginOpen && (
        <LoginModal onClose={() => setLoginOpen(false)} />
      )}
    </View>
  );
}
