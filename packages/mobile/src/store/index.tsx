import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { Role, Prefs, Teacher, BookedInfo } from "@lightning-tiger/shared";

export interface AppState {
  role: Role;
  prefs: Prefs | null;
  liked: Teacher[];
  booked: BookedInfo | null;
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
  | { type: "SET_PARENT_NAME"; name: string }
  | { type: "SET_PARENT_AVATAR"; avatar: string }
  | { type: "SET_TEACHER_NAME"; name: string }
  | { type: "SET_TEACHER_AVATAR"; avatar: string };

const initialState: AppState = {
  role: null,
  prefs: null,
  liked: [],
  booked: null,
  parentName: "陈晓彤",
  parentAvatar: "陈",
  teacherName: "林知夏",
  teacherAvatar: "林",
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
    case "SET_PARENT_NAME":
      return { ...state, parentName: action.name };
    case "SET_PARENT_AVATAR":
      return { ...state, parentAvatar: action.avatar };
    case "SET_TEACHER_NAME":
      return { ...state, teacherName: action.name };
    case "SET_TEACHER_AVATAR":
      return { ...state, teacherAvatar: action.avatar };
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
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppStore must be used within AppProvider");
  return ctx;
}
