import { useEffect, useState } from "react";
import { View, Text, Image, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { GearIcon, WorkIcon } from "@/components/Icons";
import { TopBar } from "@/components/TopBar";
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
            <Text className="card-icon coral">
              <WorkIcon name="users" />
            </Text>
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
                <View className="button">
                  <Text>¥ 打赏老师</Text>
                </View>
                <View className="button">
                  <Text>查看课程</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View className={`function-card ${openLiked ? "expanded" : ""}`}>
          <View className="function-trigger" onClick={() => setOpenLiked(!openLiked)}>
            <Text className="card-icon blush">
              <WorkIcon name="heart" />
            </Text>
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
          <Text className="card-icon mint">
            <WorkIcon name="chart" />
          </Text>
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
          <Text className="card-icon lilac">
            <WorkIcon name="folder" />
          </Text>
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
  students,
  rating,
  totalLessons,
  revenue,
}: {
  onSettings: () => void;
  onOpenPoster: () => void;
  onOpenUtility: (title: string) => void;
  name: string;
  avatar: string;
  school?: string;
  students?: string;
  rating?: string;
  totalLessons?: string;
  revenue?: string;
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
            <Text className="b">{students || "—"}</Text>
            <Text className="small">累计学生</Text>
          </Text>
          <Text className="span">
            <Text className="b">{rating || "—"}</Text>
            <Text className="small">综合评分</Text>
          </Text>
          <Text className="span">
            <Text className="b">{totalLessons || "—"}</Text>
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
            <Text className="b">{revenue || "—"}</Text>
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
            <Text className="card-icon coral">
              <WorkIcon name="users" />
            </Text>
            <Text className="span">
              <Text className="small">学生管理</Text>
              <Text className="b">已对接家长</Text>
              <Text className="em">{students || "—"} 位家长 · 学生正在学习</Text>
            </Text>
            <Text className="i">›</Text>
          </View>
          <View
            className="function-card function-trigger"
            onClick={() => onOpenUtility("课程安排")}
          >
            <Text className="card-icon mint">
              <WorkIcon name="calendar" />
            </Text>
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
            <Text className="card-icon lilac">
              <WorkIcon name="edit" />
            </Text>
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
            <Text className="card-icon blush">
              <WorkIcon name="star" />
            </Text>
            <Text className="span">
              <Text className="small">专业成长</Text>
              <Text className="b">教学评价</Text>
              <Text className="em">{rating ? `${rating} 综合评分` : "完善资料提升匹配度"}</Text>
            </Text>
            <Text className="i">›</Text>
          </View>
          <View
            className="function-card function-trigger personal-card"
            onClick={onOpenPoster}
          >
            <Text className="card-icon lilac">
              <WorkIcon name="shield" />
            </Text>
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

  // 是否已登录（家长端：有 parentId 且有 token）
  const isLoggedIn = !!state.parentId && !!Taro.getStorageSync("auth-token");

  useEffect(() => {
    if (!role) setRoleOpen(true);
  }, []);

  useEffect(() => {
    if (state.parentId) {
      fetchParentInfo()
        .then((data) => {
          setParentInfo({
            bookingCount: data.bookingCount,
            likedTeachers: data.likedTeachers,
          });
          if (data.name) {
            dispatch({ type: "SET_PARENT_NAME", name: data.name });
          }
        })
        .catch((err) => {
          console.error("[Me] 获取家长信息失败", err);
        });
    }
  }, [state.parentId]);

  const onOpenUtility = (title: string) => {
    Taro.showToast({ title, icon: "none" });
  };

  const teacherProfile: Teacher = {
    name: teacherName,
    age: "",
    school: "",
    subject: "",
    grades: [],
    mode: "",
    tags: [],
    color: "#967AE9",
    note: "",
    rating: "",
    students: "",
    years: "",
    price: 0,
    slots: [],
    video: "",
    checks: [],
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
          students={teacherProfile.students}
          rating={teacherProfile.rating}
        />
      ) : isLoggedIn ? (
        <>
          <View className="profile-banner profile-hero">
            <View className="profile-setting button" onClick={() => setSettingsOpen(true)}>
              <GearIcon />
            </View>
            <View className="my-avatar">
              <Text>{parentAvatar}</Text>
            </View>
            <View className="profile-info">
              <Text className="p">下午好，{parentName}</Text>
              <Text className="h1">
                正在陪孩子 <Text className="span">家长</Text>
              </Text>
              <Text className="small">{parentInfo ? `已陪伴孩子学习 ${parentInfo.bookingCount} 次课程` : "查看档案 ›"}</Text>
            </View>
            <View className="profile-stats">
              <Text className="span">
                <Text className="b">{String(parentInfo?.bookingCount || 0).padStart(2, "0")}</Text>
                <Text className="small">完成课程</Text>
              </Text>
              <Text className="span">
                <Text className="b">{String(liked.length).padStart(2, "0")}</Text>
                <Text className="small">收藏老师</Text>
              </Text>
              <Text className="span">
                <Text className="b">—</Text>
                <Text className="small">学习天数</Text>
              </Text>
            </View>
          </View>
          <ParentDashboard
            liked={liked}
            booked={booked}
            openConnected={openConnected}
            setOpenConnected={setOpenConnected}
            openLiked={openLiked}
            setOpenLiked={setOpenLiked}
            onBook={setBookFor}
            onSubscribe={() => setSubscribeOpen(true)}
            onOpenUtility={onOpenUtility}
            onReview={() => setReviewFor(true)}
          />
        </>
      ) : (
        <View className="guest-banner">
          <View className="guest-icon">
            <Text>⚡</Text>
          </View>
          <Text className="guest-title">登录后查看</Text>
          <Text className="guest-desc">登录或注册后，可以管理孩子的学习、收藏老师和预约试听课程</Text>
          <Button className="guest-login-btn" onClick={() => setLoginOpen(true)}>
            登录 / 注册
          </Button>
        </View>
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
