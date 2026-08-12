import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import Taro from "@tarojs/taro";
import type { Grade, Prefs, Role, Teacher, BookedInfo } from "@lightning-tiger/shared";
import { hasAuthToken, wechatLogin } from "@/services/api";
import ChildProfileModal from "@/components/ChildProfileModal";

const STORAGE_KEY = "lightning-tiger-state";

export interface AppState {
  session: { token: string; userId: string } | null;
  workspace: "account" | "parent" | "teacher";
  parent: { id: string; displayName: string } | null;
  activeChild: { id: string; displayName: string; grade: Grade; birthDate: string | null } | null;
  hydrated: boolean;
  authStatus: "idle" | "connecting" | "ready" | "error";
}

// These legacy values keep untouched V1 screens renderable, but are deliberately not persisted.
type LegacyUiState = {
  role: Role;
  prefs: Prefs | null;
  liked: Teacher[];
  booked: BookedInfo | null;
  parentId: string | null;
  parentName: string;
  parentAvatar: string;
  teacherName: string;
  teacherAvatar: string;
};

type StoreState = AppState & LegacyUiState;

export type AppAction =
  | { type: "SET_SESSION"; session: AppState["session"] }
  | { type: "SET_WORKSPACE"; workspace: AppState["workspace"] }
  | { type: "SET_PARENT_PROFILE"; parent: AppState["parent"] }
  | { type: "SET_ACTIVE_CHILD"; activeChild: AppState["activeChild"] }
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
  | { type: "SET_AUTH_STATUS"; status: AppState["authStatus"] }
  | { type: "RETRY_AUTH" }
  | { type: "RESET" };

const initialState: StoreState = {
  session: null,
  workspace: "account",
  parent: null,
  activeChild: null,
  hydrated: false,
  authStatus: "idle",
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

function appReducer(state: StoreState, action: AppAction): StoreState {
  switch (action.type) {
    case "SET_SESSION":
      return { ...state, session: action.session, authStatus: action.session ? "ready" : "idle" };
    case "SET_AUTH_STATUS":
      return { ...state, authStatus: action.status };
    case "RETRY_AUTH":
      return { ...state, authStatus: "idle" };
    case "SET_WORKSPACE":
      return { ...state, workspace: action.workspace };
    case "SET_PARENT_PROFILE":
      return { ...state, parent: action.parent };
    case "SET_ACTIVE_CHILD":
      return { ...state, activeChild: action.activeChild };
    case "SET_ROLE":
      return { ...state, role: action.role };
    case "SET_PREFS":
      return { ...state, prefs: action.prefs };
    case "ADD_LIKED":
      return {
        ...state,
        liked: state.liked.some((teacher) => teacher.name === action.teacher.name)
          ? state.liked
          : [...state.liked, action.teacher],
      };
    case "REMOVE_LIKED":
      return { ...state, liked: state.liked.filter((teacher) => teacher.name !== action.name) };
    case "SET_BOOKED":
      return { ...state, booked: action.booked };
    case "SET_PARENT":
      return {
        ...state,
        parentId: action.id,
        parentName: action.name,
        parentAvatar: action.avatar,
        parent: { id: action.id, displayName: action.name },
        workspace: "parent",
      };
    case "SET_PARENT_NAME":
      return {
        ...state,
        parentName: action.name,
        parent: state.parent ? { ...state.parent, displayName: action.name } : state.parent,
      };
    case "SET_PARENT_AVATAR":
      return { ...state, parentAvatar: action.avatar };
    case "SET_TEACHER_NAME":
      return { ...state, teacherName: action.name };
    case "SET_TEACHER_AVATAR":
      return { ...state, teacherAvatar: action.avatar };
    case "HYDRATE":
      return { ...state, ...action.state, hydrated: true };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

function persistedState(state: StoreState): AppState {
  return {
    session: state.session,
    workspace: state.workspace,
    parent: state.parent,
    activeChild: state.activeChild,
    hydrated: true,
    authStatus: state.session ? "ready" : state.authStatus,
  };
}

interface AppContextValue {
  state: StoreState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    try {
      const saved = Taro.getStorageSync(STORAGE_KEY);
      const parsed = typeof saved === "string" ? JSON.parse(saved) : saved;
      if (parsed) {
        dispatch({
          type: "HYDRATE",
          state: {
            session: parsed.session && hasAuthToken() ? parsed.session : null,
            workspace: parsed.workspace ?? "account",
            parent: parsed.parent ?? null,
            activeChild: parsed.activeChild ?? null,
            hydrated: true,
            authStatus: parsed.session && hasAuthToken() ? "ready" : "idle",
          },
        });
      } else {
        dispatch({ type: "HYDRATE", state: { ...persistedState(initialState), hydrated: true } });
      }
    } catch {
      dispatch({ type: "HYDRATE", state: { ...persistedState(initialState), hydrated: true } });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated || state.session || state.authStatus !== "idle") return;
    let active = true;
    dispatch({ type: "SET_AUTH_STATUS", status: "connecting" });

    void Taro.login()
      .then((result) => {
        if (!result.code) throw new Error("微信登录未返回 code");
        return wechatLogin(result.code);
      })
      .then((session) => {
        if (active) dispatch({ type: "SET_SESSION", session });
      })
      .catch((error) => {
        console.warn("[auth] wechat login failed", error);
        if (active) dispatch({ type: "SET_AUTH_STATUS", status: "error" });
      });

    return () => { active = false; };
  }, [state.hydrated, state.session, state.authStatus]);

  useEffect(() => {
    const expired = () => dispatch({ type: "SET_SESSION", session: null });
    Taro.eventCenter.on("auth:expired", expired);
    return () => { Taro.eventCenter.off("auth:expired", expired); };
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      Taro.setStorageSync(STORAGE_KEY, JSON.stringify(persistedState(state)));
    } catch (error) {
      console.warn("[Storage] state save failed", error);
    }
  }, [state]);

  return <AppContext.Provider value={{ state, dispatch }}>
    {children}
    <ChildProfileModal state={state} dispatch={dispatch} />
  </AppContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppStore must be used within AppProvider");
  return context;
}
