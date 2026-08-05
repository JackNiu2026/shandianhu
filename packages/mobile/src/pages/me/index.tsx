import { useEffect, useState } from "react";
import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { GearIcon, WorkIcon } from "@/components/Icons";
import { RoleModal, SettingsModal, PosterModal, SubscribeModal, BookSheet } from "@/components/Modals";
import { useAppStore } from "@/store";
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
}) {
  return (
    <View className="dashboard card-dashboard">
      <View className="dashboard-title">
        <View>
          <Text className="eyebrow">PARENT SPACE</Text>
          <Text>为孩子管理学习</Text>
        </View>
      </View>

      <View className="workbench-grid">
        <View className={`function-card ${openConnected ? "expanded" : ""}`}>
          <View className="function-trigger" onClick={() => setOpenConnected(!openConnected)}>
            <Text className="card-icon coral">
              <WorkIcon name="users" />
            </Text>
            <Text>
              <Text>老师管理</Text>
              <Text>已对接老师</Text>
              <Text>
                {booked
                  ? `${booked.teacher}老师 · 试听 ${booked.slot}`
                  : "林知夏老师 · 下次课周六 14:00"}
              </Text>
            </Text>
            <Text>{openConnected ? "⌃" : "›"}</Text>
          </View>
          {openConnected && (
            <View className="teacher-expand">
              <View>
                <View className="mini-avatar orange">
                  <Text>林</Text>
                </View>
                <View>
                  <Text>
                    {booked ? booked.teacher : "林知夏"}老师 <Text>✓</Text>
                  </Text>
                  <Text>
                    {booked
                      ? `免费试听已预约 · ${booked.slot}`
                      : "数学 · 已陪伴孩子 24 天"}
                  </Text>
                </View>
              </View>
              <View className="teacher-expand-actions">
                <View>
                  <Text>★ 评价老师</Text>
                </View>
                <View>
                  <Text>¥ 打赏老师</Text>
                </View>
                <View>
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
            <Text>
              <Text>我的收藏</Text>
              <Text>感兴趣的老师</Text>
              <Text>
                {liked.length
                  ? `已收藏 ${liked.length} 位，可展开对比`
                  : "右滑心动的老师会出现在这里"}
              </Text>
            </Text>
            <Text>{openLiked ? "⌃" : "›"}</Text>
          </View>
          {openLiked && (
            <View className="teacher-expand">
              {liked.length
                ? liked.map((t) => (
                    <View key={t.name} className="compare-row">
                      <View className="mini-avatar" style={{ backgroundColor: t.color }}>
                        {t.avatar ? <Image src={t.avatar} /> : <Text>{t.name[0]}</Text>}
                      </View>
                      <View>
                        <Text>
                          {t.name}老师 <Text>✓</Text>
                        </Text>
                        <Text>
                          {t.subject} · {t.years}教龄 · ¥{t.price} 起 · {t.slots[0]} 可约
                        </Text>
                      </View>
                      <View onClick={() => onBook(t)}>
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
          <Text>
            <Text>成长记录</Text>
            <Text>学习动态</Text>
            <Text>本周学习报告已生成</Text>
          </Text>
          <Text>›</Text>
        </View>

        <View
          className="function-card function-trigger"
          onClick={() => onOpenUtility("孩子档案")}
        >
          <Text className="card-icon lilac">
            <WorkIcon name="folder" />
          </Text>
          <Text>
            <Text>孩子档案</Text>
            <Text>孩子的成长档案</Text>
            <Text>学习风格已更新 · 7 月 26 日</Text>
          </Text>
          <Text>›</Text>
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
}: {
  onSettings: () => void;
  onOpenPoster: () => void;
  onOpenUtility: (title: string) => void;
  name: string;
  avatar: string;
}) {
  return (
    <>
      <View className="teacher-profile-card">
        <View className="teacher-profile-top">
          <View onClick={onSettings}>
            <GearIcon />
          </View>
        </View>
        <View className="teacher-profile-main">
          <View className="teacher-big-avatar">
            <Text>{avatar}</Text>
          </View>
          <View>
            <Text>
              {name} <Text>✓</Text>
            </Text>
            <Text>复旦大学 · 数学与应用数学</Text>
          </View>
        </View>
        <View className="teacher-profile-tags">
          <Text>985 / 211</Text>
          <Text>中考数学</Text>
          <Text>竞赛启蒙</Text>
        </View>
        <View className="teacher-profile-stats">
          <Text>
            <Text>32</Text>
            <Text>累计学生</Text>
          </Text>
          <Text>
            <Text>4.9</Text>
            <Text>综合评分</Text>
          </Text>
          <Text>
            <Text>186</Text>
            <Text>授课课时</Text>
          </Text>
        </View>
      </View>

      <View className="revenue-card">
        <View className="revenue-head">
          <View>
            <Text>收益概览</Text>
            <Text>本月授课收益</Text>
          </View>
        </View>
        <View className="revenue-grid">
          <Text>
            <Text>总佣金</Text>
            <Text>¥12,680</Text>
          </Text>
          <Text>
            <Text>待入账</Text>
            <Text>¥2,460</Text>
          </Text>
          <Text>
            <Text>可提现</Text>
            <Text>¥8,920</Text>
          </Text>
        </View>
      </View>

      <View className="dashboard teacher-dashboard">
        <View className="dashboard-title">
          <View>
            <Text className="eyebrow">TEACHER DESK</Text>
            <Text>我的教学工作台</Text>
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
            <Text>
              <Text>学生管理</Text>
              <Text>已对接家长</Text>
              <Text>12 位家长 · 16 名学生正在学习</Text>
            </Text>
            <Text>›</Text>
          </View>
          <View
            className="function-card function-trigger"
            onClick={() => onOpenUtility("课程安排")}
          >
            <Text className="card-icon mint">
              <WorkIcon name="calendar" />
            </Text>
            <Text>
              <Text>课程安排</Text>
              <Text>本周课程</Text>
              <Text>今日 2 节课，下一节 14:00 开始</Text>
            </Text>
            <Text>›</Text>
          </View>
          <View
            className="function-card function-trigger"
            onClick={() => onOpenUtility("我的资料")}
          >
            <Text className="card-icon lilac">
              <WorkIcon name="edit" />
            </Text>
            <Text>
              <Text>我的资料</Text>
              <Text>授课信息与展示页</Text>
              <Text>完善资料，提升家长匹配度</Text>
            </Text>
            <Text>›</Text>
          </View>
          <View
            className="function-card function-trigger"
            onClick={() => onOpenUtility("专业成长")}
          >
            <Text className="card-icon blush">
              <WorkIcon name="star" />
            </Text>
            <Text>
              <Text>专业成长</Text>
              <Text>教学评价</Text>
              <Text>98% 家长愿意推荐给朋友</Text>
            </Text>
            <Text>›</Text>
          </View>
          <View
            className="function-card function-trigger personal-card"
            onClick={onOpenPoster}
          >
            <Text className="card-icon lilac">
              <WorkIcon name="shield" />
            </Text>
            <Text>
              <Text>个人名片</Text>
              <Text>生成介绍海报</Text>
              <Text>分享给有需要的家长</Text>
            </Text>
            <Text>›</Text>
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

  useEffect(() => {
    if (!role) setRoleOpen(true);
  }, []);

  const onOpenUtility = (title: string) => {
    Taro.showToast({ title, icon: "none" });
  };

  return (
    <View className="me-screen">
      {role === "teacher" ? (
        <TeacherDashboard
          onSettings={() => setSettingsOpen(true)}
          onOpenPoster={() => setPosterOpen(true)}
          onOpenUtility={onOpenUtility}
          name={teacherName}
          avatar={teacherAvatar}
        />
      ) : (
        <>
          <View className="profile-banner profile-hero">
            <View className="profile-setting" onClick={() => setSettingsOpen(true)}>
              <GearIcon />
            </View>
            <View className="my-avatar">
              <Text>{parentAvatar}</Text>
            </View>
            <View className="profile-info">
              <Text>下午好，{parentName}</Text>
              <Text>
                正在陪孩子 <Text>家长</Text>
              </Text>
              <Text>已陪伴孩子学习第 128 天 · 查看档案 ›</Text>
            </View>
            <View className="profile-stats">
              <Text>
                <Text>08</Text>
                <Text>完成课程</Text>
              </Text>
              <Text>
                <Text>{String(liked.length).padStart(2, "0")}</Text>
                <Text>收藏老师</Text>
              </Text>
              <Text>
                <Text>12</Text>
                <Text>学习天数</Text>
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
        <PosterModal teacherName={teacherName} onClose={() => setPosterOpen(false)} />
      )}

      {subscribeOpen && <SubscribeModal onClose={() => setSubscribeOpen(false)} />}

      {bookFor && (
        <BookSheet
          teacher={bookFor}
          onClose={() => setBookFor(null)}
          onBook={(teacherName, slot) => {
            dispatch({ type: "SET_BOOKED", booked: { teacher: teacherName, slot } });
            setOpenConnected(true);
          }}
        />
      )}
    </View>
  );
}
