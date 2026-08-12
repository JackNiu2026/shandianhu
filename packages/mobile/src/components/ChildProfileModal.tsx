import { useState } from "react";
import { Input, Picker, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import type { Grade } from "@lightning-tiger/shared";
import { grades } from "@lightning-tiger/shared/constants";
import { createChild } from "@/services/api";
import type { AppAction, AppState } from "@/store";
import "./ChildProfileModal.scss";

const GRADES: Grade[] = grades;

type Props = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
};

export default function ChildProfileModal({ state, dispatch }: Props) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<Grade>("一年级");
  const [birthMonth, setBirthMonth] = useState("");
  const [saving, setSaving] = useState(false);

  const currentPath = Taro.getCurrentInstance().router?.path ?? "";
  if (!state.hydrated || state.activeChild || state.workspace === "teacher" || currentPath.startsWith("pages/teacher-")) return null;

  const save = async () => {
    const displayName = name.trim();
    if (!displayName) {
      Taro.showToast({ title: "请输入孩子昵称", icon: "none" });
      return;
    }
    if (!state.session) {
      Taro.showToast({ title: "正在连接微信，请稍候", icon: "none" });
      return;
    }

    setSaving(true);
    try {
      if (!birthMonth) {
        Taro.showToast({ title: "请选择出生年月", icon: "none" });
        return;
      }
      const child = await createChild(displayName, grade, birthDateForMonth(birthMonth));
      dispatch({ type: "SET_ACTIVE_CHILD", activeChild: child });
      Taro.showToast({ title: "孩子档案已保存", icon: "success" });
    } catch {
      Taro.showToast({ title: "保存失败，请重试", icon: "none" });
    } finally {
      setSaving(false);
    }
  };

  return <View className="child-profile-backdrop">
    <View className="child-profile-sheet">
      <View className="child-profile-handle" />
      <Text className="child-profile-eyebrow">WELCOME TO LIGHTNING TIGER</Text>
      <Text className="child-profile-title">先认识一下孩子</Text>
      <Text className="child-profile-note">完善基本信息，为孩子匹配更合适的学习内容与老师。</Text>

      <Text className="child-profile-label">孩子昵称</Text>
      <Input className="child-profile-input" value={name} placeholder="例如：小闪" maxlength={20} onInput={(event) => setName(event.detail.value)} />

      <Text className="child-profile-label">孩子年级</Text>
      <View className="child-profile-options">{GRADES.map((item) => <View key={item} className={grade === item ? "selected" : ""} onClick={() => setGrade(item)}><Text>{item}</Text></View>)}</View>

      <Text className="child-profile-label">出生年月</Text>
      <Picker mode="date" fields="month" value={birthMonth} end={new Date().toISOString().slice(0, 10)} onChange={(event) => setBirthMonth(event.detail.value)}>
        <View className={`child-profile-input child-profile-picker ${birthMonth ? "" : "placeholder"}`}><Text>{birthMonth || "请选择出生年月"}</Text></View>
      </Picker>
      <View className={`child-profile-submit ${state.authStatus === "connecting" || saving ? "disabled" : ""}`} onClick={state.authStatus === "error" ? () => dispatch({ type: "RETRY_AUTH" }) : save}>
        <Text>{saving ? "保存中…" : state.session ? "开启孩子的学习旅程" : state.authStatus === "error" ? "重新连接微信" : "正在连接微信…"}</Text>
      </View>
    </View>
  </View>;
}

function birthDateForMonth(value: string): string {
  return `${value}-01T00:00:00.000Z`;
}
