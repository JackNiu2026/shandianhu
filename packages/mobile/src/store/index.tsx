import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react";
import Taro from "@tarojs/taro";
import type { Role, Prefs, Teacher, BookedInfo } from "@lightning-tiger/shared";

const STORAGE_KEY = "lightning-tiger-state";

export interface AppState {
  role: Role;
  prefs: Prefs | null;
  liked: Teacher[];
  booked: BookedInfo | null;
  parentId: string | null;
  parentName: string;
  parentAvatar: string;
  teacherName: string;
  teacherAvatar: string;
}

export type AppAction =
  | { type: "SET_ROLE"; role: Role }
  | { type: "SET_PREFS"; prefs: Prefs }
  | { type: "ADD_LIKED"; teacher: Teacher }
  | { type: "REMOVE_LIKED"; name: string }
  | { type: "SET_BOOKED"; booked: BookedInfo }
  | { type: "SET_PARENT"; id: string; name: string; avatar: string }
  | { type: "SET_PARENT_NAME"; name: string }
  | { type: "SET_PARENT_AVATAR"; avatar: string }
  | { type: "SET_TEACHER_NAME"; name: string }
  | { type: "SET_TEACHER_AVATAR"; avatar: string }
  | { type: "HYDRATE"; state: AppState }
  | { type: "RESET" };

const initialState: AppState = {
  role: null,
  prefs: null,
  liked: [],
  booked: null,
  parentId: null,
  parentName: "",
  parentAvatar: "",
  teacherName: "",
  teacherAvatar: "",
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_ROLE":
      return { ...state, role: action.role };
    case "SET_PREFS":
      return { ...state, prefs: action.prefs };
    case "ADD_LIKED":
      return {
        ...state,
        liked: state.liked.some((t) => t.name === action.teacher.name)
          ? state.liked
          : [...state.liked, action.teacher],
      };
    case "REMOVE_LIKED":
      return { ...state, liked: state.liked.filter((t) => t.name !== action.name) };
    case "SET_BOOKED":
      return { ...state, booked: action.booked };
    case "SET_PARENT":
      return { ...state, parentId: action.id, parentName: action.name, parentAvatar: action.avatar };
    case "SET_PARENT_NAME":
      return { ...state, parentName: action.name };
    case "SET_PARENT_AVATAR":
      return { ...state, parentAvatar: action.avatar };
    case "SET_TEACHER_NAME":
      return { ...state, teacherName: action.name };
    case "SET_TEACHER_AVATAR":
      return { ...state, teacherAvatar: action.avatar };
    case "HYDRATE":
      return action.state;
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 启动时从本地存储恢复状态
  useEffect(() => {
    try {
      const saved = Taro.getStorageSync(STORAGE_KEY);
      if (saved) {
        const parsed = typeof saved === "string" ? JSON.parse(saved) : saved;
        dispatch({ type: "HYDRATE", state: { ...initialState, ...parsed } });
      }
    } catch (e) {
      console.warn("[Storage] 恢复状态失败", e);
    }
  }, []);

  // 状态变化时持久化
  useEffect(() => {
    try {
      Taro.setStorageSync(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("[Storage] 保存状态失败", e);
    }
  }, [state]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppStore must be used within AppProvider");
  return ctx;
}
