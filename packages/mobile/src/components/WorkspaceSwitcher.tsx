import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useAppStore } from "@/store";
import { workspacesFor, type Workspace } from "@/config/workspaces";

/** 家长端首页入口 */
const PARENT_ENTRY = "/pages/smart/index";
/** 老师端工作台入口（页面由后续任务创建） */
const TEACHER_ENTRY = "/pages/teacher-work/index";

export interface WorkspaceSwitcherProps {
  /** 当前用户身份信息，用于判断是否具备老师工作区 */
  user: { teacherProfile?: { serviceStatus: string } | null };
}

/**
 * 工作区切换组件。
 *
 * 仅当用户同时具备 ACTIVE 老师身份时才显示切换入口；普通家长不弹角色选择。
 * 点击切换：更新 store 中的 workspace，并通过 Taro.reLaunch 跳转到目标工作区首页。
 */
export function WorkspaceSwitcher({ user }: WorkspaceSwitcherProps) {
  const { state, dispatch } = useAppStore();
  const available = workspacesFor(user);
  // 只有 APPROVED 且 ACTIVE 的老师才能看到工作区切换
  if (!available.includes("teacher")) return null;

  const current: Workspace = state.workspace === "teacher" ? "teacher" : "parent";
  const target: Workspace = current === "teacher" ? "parent" : "teacher";
  const targetLabel = target === "teacher" ? "老师工作台" : "家长端";

  const handleSwitch = () => {
    dispatch({ type: "SET_WORKSPACE", workspace: target });
    Taro.reLaunch({ url: target === "teacher" ? TEACHER_ENTRY : PARENT_ENTRY });
  };

  return (
    <View
      onClick={handleSwitch}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 16px",
        borderRadius: "999px",
        backgroundColor: "#EEE9FF",
        color: "#7056BD",
        fontSize: "13px",
        fontWeight: 600,
      }}
    >
      <Text>切换到{targetLabel}</Text>
    </View>
  );
}

export default WorkspaceSwitcher;
