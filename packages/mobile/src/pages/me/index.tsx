import { useCallback, useEffect, useState } from "react";
import { Button, Input, Picker, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { TopBar } from "@/components/TopBar";
import { WorkIcon } from "@/components/Icons";
import { useAppStore } from "@/store";
import {
  createChild,
  deleteChild,
  fetchDeletedChildren,
  fetchChildren,
  fetchDashboard,
  fetchNotifications,
  listParentGrants,
  listParentLessons,
  listParentTrials,
  markNotificationsRead,
  setActiveChild,
  restoreChild,
  revokeGrant,
  updateChild,
  type ChildSummary,
  type DeletedChildSummary,
  type DataGrantSummary,
  type LessonSummary,
  type TrialBookingSummary,
  type NotificationItem,
  type ParentDashboardData,
} from "@/services/api";
import type { Grade } from "@lightning-tiger/shared";
import { grades } from "@lightning-tiger/shared/constants";
import "./index.scss";

const DEFAULT_GRADE: Grade = "一年级";

export default function MePage() {
  const { state, dispatch } = useAppStore();
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftGrade, setDraftGrade] = useState<Grade>(DEFAULT_GRADE);
  const [draftBirthMonth, setDraftBirthMonth] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<ParentDashboardData | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [deletedChildren, setDeletedChildren] = useState<DeletedChildSummary[]>([]);
  const [grants, setGrants] = useState<DataGrantSummary[]>([]);
  const [trials, setTrials] = useState<TrialBookingSummary[]>([]);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);

  const loadChildren = useCallback(async () => {
    if (!state.session) return;
    setLoading(true);
    try {
      const workspace = await fetchChildren();
      setChildren(workspace.children);
      const activeChild = workspace.children.find((child) => child.id === workspace.activeChildId) ?? null;
      dispatch({ type: "SET_ACTIVE_CHILD", activeChild });
    } catch {
      Taro.showToast({ title: "孩子档案加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, [dispatch, state.session]);

  const loadDashboard = useCallback(async () => {
    if (!state.session) return;
    try {
      setDashboard(await fetchDashboard());
    } catch {
      // 仪表盘加载失败不阻断儿童管理流程，静默处理
    }
  }, [state.session]);

  const loadWorkspaceData = useCallback(async () => {
    if (!state.session) return;
    const [deleted, grantItems, trialItems, lessonItems] = await Promise.all([
      fetchDeletedChildren().catch(() => []), listParentGrants().catch(() => []), listParentTrials().catch(() => []), listParentLessons().catch(() => []),
    ]);
    setDeletedChildren(deleted); setGrants(grantItems); setTrials(trialItems); setLessons(lessonItems);
  }, [state.session]);

  useEffect(() => {
    loadChildren();
    loadDashboard();
    loadWorkspaceData();
  }, [loadChildren, loadDashboard, loadWorkspaceData]);

  const saveChild = async () => {
    const displayName = draftName.trim();
    if (!displayName) {
      Taro.showToast({ title: "请输入孩子称呼", icon: "none" });
      return;
    }
    if (!draftBirthMonth) { Taro.showToast({ title: "请选择出生年月", icon: "none" }); return; }

    try {
      const child = editing && state.activeChild
        ? await updateChild(state.activeChild.id, { displayName, grade: draftGrade, birthDate: `${draftBirthMonth}-01T00:00:00.000Z` })
        : await createChild(displayName, draftGrade, `${draftBirthMonth}-01T00:00:00.000Z`);
      dispatch({ type: "SET_ACTIVE_CHILD", activeChild: child });
      setDraftName("");
      setEditing(false);
      setDraftBirthMonth("");
      await loadChildren();
    } catch {
      Taro.showToast({ title: "孩子档案保存失败", icon: "none" });
    }
  };

  const chooseActiveChild = async () => {
    if (!children.length) return;
    const result = await Taro.showActionSheet({ itemList: children.map((child) => child.displayName) });
    const child = children[result.tapIndex];
    if (!child) return;

    try {
      const activeChild = await setActiveChild(child.id);
      dispatch({ type: "SET_ACTIVE_CHILD", activeChild });
    } catch {
      Taro.showToast({ title: "切换失败，请重试", icon: "none" });
    }
  };

  const beginRename = () => {
    if (!state.activeChild) return;
    setDraftName(state.activeChild.displayName);
    setDraftGrade(state.activeChild.grade);
    setDraftBirthMonth(state.activeChild.birthDate?.slice(0, 7) ?? "");
    setEditing(true);
  };

  const removeActiveChild = async () => {
    if (!state.activeChild) return;
    const confirmed = await Taro.showModal({ title: "删除孩子档案", content: "删除后 30 天内可以恢复，相关入口会立即隐藏。", confirmText: "确认删除", confirmColor: "#C44732" });
    if (!confirmed.confirm) return;
    await deleteChild(state.activeChild.id);
    dispatch({ type: "SET_ACTIVE_CHILD", activeChild: null });
    await Promise.all([loadChildren(), loadWorkspaceData()]);
  };

  const recoverChild = async (child: DeletedChildSummary) => {
    await restoreChild(child.id); await Promise.all([loadChildren(), loadWorkspaceData()]);
  };

  const removeGrant = async (grant: DataGrantSummary) => {
    const confirmed = await Taro.showModal({ title: "撤销数据授权", content: `撤销后，${grant.teacherDisplayName || "该老师"}将无法继续查看孩子学习需求。`, confirmText: "确认撤销", confirmColor: "#C44732" });
    if (!confirmed.confirm) return;
    await revokeGrant(grant.id); await loadWorkspaceData();
  };

  const toggleNotifications = async () => {
    if (!showNotifications && notifications.length === 0) {
      try {
        const result = await fetchNotifications();
        setNotifications(result.items);
      } catch {
        Taro.showToast({ title: "通知加载失败", icon: "none" });
        return;
      }
    }
    setShowNotifications((value) => !value);
  };

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, status: "READ" })));
      await loadDashboard();
    } catch {
      Taro.showToast({ title: "操作失败，请重试", icon: "none" });
    }
  };

  const notificationMessage = (item: NotificationItem): string => {
    const body = item.body ?? {};
    if (typeof body.message === "string") return body.message;
    if (typeof body.title === "string") return body.title;
    return item.type;
  };

  const openNotification = async (item: NotificationItem) => {
    if (item.status === "UNREAD") { await markNotificationsRead(item.id); setNotifications((old) => old.map((entry) => entry.id === item.id ? { ...entry, status: "READ" } : entry)); }
    if (!item.targetRoute) return;
    const params = new URLSearchParams(Object.entries(item.targetParams ?? {}).map(([key, value]) => [key, String(value)]));
    void Taro.navigateTo({ url: `${item.targetRoute}${params.toString() ? `?${params}` : ""}` });
  };

  const parentName = state.parent?.displayName || "我的家庭";

  return (
    <View className="me-screen lt-page">
      <TopBar />
      <View className="lt-content me-content">
        <Text className="lt-eyebrow">FAMILY WORKSPACE</Text>
        <Text className="lt-page-title">我的</Text>

        <View className="family-card lt-card">
          <View className="family-head"><Text className="family-label">{parentName}</Text><Text className="family-badge">家庭空间</Text></View>
            <View className="child-row">
              <View className="child-avatar"><Text>{state.activeChild?.displayName.slice(0, 1) ?? "家"}</Text></View>
            <View className="child-copy"><Text className="child-name">{state.activeChild?.displayName ?? "尚未设置孩子档案"}</Text><Text className="child-grade">{state.activeChild ? `${state.activeChild.grade}${state.activeChild.birthDate ? ` · ${ageLabel(state.activeChild.birthDate)}` : ""}` : "添加后即可使用智学、家教与学情"}</Text></View>
            {state.session && <Button className="child-switch" onClick={chooseActiveChild} disabled={!children.length || loading}>切换</Button>}
          </View>
          <View className="family-stats"><View><Text className="stat-value">{children.length}</Text><Text className="stat-label">孩子档案</Text></View><View><Text className="stat-value">{dashboard?.recentReports.length ?? 0}</Text><Text className="stat-label">学习报告</Text></View><View><Text className="stat-value">{dashboard?.unreadNotifications ?? 0}</Text><Text className="stat-label">未读通知</Text></View></View>
        </View>

        {!state.session ? <View className="lt-empty account-state">微信登录后管理家庭与孩子档案</View> : <>
          <View className="lt-section-head"><Text className="lt-section-title">孩子管理</Text></View>
          <View className="child-editor lt-card">
            <View className="editor-icon"><WorkIcon name="edit" /></View>
            <View className="editor-field"><Text>{editing ? "修改当前孩子档案" : "添加孩子档案"}</Text><Input value={draftName} placeholder="请输入孩子称呼" onInput={(event) => setDraftName(event.detail.value)} /><Picker mode="selector" range={grades} value={Math.max(0, grades.indexOf(draftGrade))} onChange={(event) => setDraftGrade(grades[Number(event.detail.value)] ?? DEFAULT_GRADE)}><Text className="editor-picker">{draftGrade}</Text></Picker><Picker mode="date" fields="month" value={draftBirthMonth} end={new Date().toISOString().slice(0, 10)} onChange={(event) => setDraftBirthMonth(event.detail.value)}><Text className="editor-picker">{draftBirthMonth || "选择出生年月"}</Text></Picker></View>
            <Button className="editor-save" onClick={saveChild} disabled={loading}>{editing ? "保存" : "添加"}</Button>
          </View>
          {state.activeChild && !editing && <View className="editor-links"><Text className="rename-link" onClick={beginRename}>修改当前孩子档案</Text><Text className="danger-link" onClick={removeActiveChild}>删除当前孩子</Text></View>}
          {deletedChildren.length > 0 && <View className="deleted-list lt-card"><Text className="lt-section-title">可恢复档案</Text>{deletedChildren.map((child) => <View className="deleted-row" key={child.id}><Text>{child.displayName} · {child.grade ?? "年级待完善"}</Text><Button onClick={() => void recoverChild(child)}>恢复</Button></View>)}</View>}

          <View className="lt-section-head"><Text className="lt-section-title">最近报告</Text></View>
          <View className="report-list">
            {dashboard?.recentReports.length ? dashboard.recentReports.slice(0, 3).map((report) => <View className="report-row" key={report.id} onClick={() => Taro.navigateTo({ url: `/pages/report/index?id=${report.id}` })}><View className="report-icon"><WorkIcon name="chart" /></View><View className="report-copy"><Text>学习情况报告 · 第 {report.sequence} 版</Text><Text>{new Date(report.createdAt).toLocaleDateString()} · {report.status}</Text></View><Text className="row-arrow">›</Text></View>) : <View className="lt-empty">完成评估后，学习报告会显示在这里</View>}
          </View>

          <View className="lt-section-head"><Text className="lt-section-title">通知</Text>{dashboard && dashboard.unreadNotifications > 0 && <Text className="lt-section-action" onClick={handleMarkAllRead}>全部已读</Text>}</View>
          <View className="notification-panel lt-card">
            <View className="notification-trigger" onClick={toggleNotifications}><View className="notification-icon"><WorkIcon name="folder" /></View><View><Text className="notification-title">站内通知</Text><Text className="notification-meta">{dashboard?.unreadNotifications ?? 0} 条未读</Text></View><Text className="row-arrow">{showNotifications ? "⌃" : "⌄"}</Text></View>
            {showNotifications && <View className="notification-list">{notifications.length ? notifications.map((item) => <View className="notification-row" key={item.id} onClick={() => void openNotification(item)}><Text>{notificationMessage(item)}</Text><Text>{new Date(item.createdAt).toLocaleString()}</Text></View>) : <Text className="notification-empty">暂无通知</Text>}</View>}
          </View>
          <View className="lt-section-head"><Text className="lt-section-title">我的试听与课程</Text></View>
          <View className="report-list">{trials.slice(0, 5).map((item) => <View className="report-row" key={`trial-${item.id}`} onClick={() => Taro.navigateTo({ url: `/pages/trial-status/index?trialId=${item.id}` })}><View className="report-icon"><WorkIcon name="calendar" /></View><View className="report-copy"><Text>试听 · {labelSubject(item.subject)}</Text><Text>{item.teacherDisplayName ?? "老师"} · {labelTrialStatus(item.status)} · {new Date(item.startsAt).toLocaleString()}</Text></View><Text className="row-arrow">›</Text></View>)}{lessons.filter((item) => item.status === "COMPLETED" && !item.hasReview).slice(0, 3).map((item) => <View className="report-row" key={`lesson-${item.id}`} onClick={() => Taro.navigateTo({ url: `/pages/lesson-review/index?lessonId=${item.id}` })}><View className="report-icon"><WorkIcon name="star" /></View><View className="report-copy"><Text>待评价课程 · {labelSubject(item.subject)}</Text><Text>{item.teacherDisplayName}</Text></View><Text className="row-arrow">›</Text></View>)}</View>
          <View className="lt-section-head"><Text className="lt-section-title">数据授权</Text></View>
          <View className="report-list">{grants.filter((grant) => !grant.revokedAt).length ? grants.filter((grant) => !grant.revokedAt).map((grant) => <View className="report-row" key={grant.id}><View className="report-copy"><Text>{grant.teacherDisplayName || "老师"}</Text><Text>{grant.scopes.join("、")} · {grant.validUntil ? `有效至 ${new Date(grant.validUntil).toLocaleDateString()}` : "长期有效"}</Text></View><Button className="editor-save" onClick={() => void removeGrant(grant)}>撤销</Button></View>) : <View className="lt-empty">暂无生效中的老师授权</View>}</View>
        </>}
      </View>
    </View>
  );
}

function ageLabel(birthDate: string): string {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "年龄待完善";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return `${Math.max(0, age)}岁`;
}

function labelSubject(subject: string): string { return ({ CHINESE: "语文", MATH: "数学", ENGLISH: "英语", PHYSICS: "物理", CHEMISTRY: "化学" } as Record<string, string>)[subject] ?? subject; }
function labelTrialStatus(status: string): string { return ({ REQUESTED: "待老师确认", ACCEPTED: "已接受", RESCHEDULE_PROPOSED: "待确认改期", PARENT_CONFIRMED: "已确认", READY: "已就绪", COMPLETED: "已完成", REJECTED: "已拒绝", CANCELLED: "已取消" } as Record<string, string>)[status] ?? status; }
