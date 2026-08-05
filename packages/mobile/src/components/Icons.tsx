import { Text } from "@tarojs/components";
import type { ReactNode } from "react";

export function Icon({ children }: { children: ReactNode }) {
  return <Text className="icon">{children}</Text>;
}

export function ActionIcon({ name }: { name: "pass" | "like" | "undo" | "arrow" }) {
  const map: Record<string, string> = {
    pass: "×",
    like: "♥",
    undo: "↶",
    arrow: "›",
  };
  return <Text className="action-icon">{map[name]}</Text>;
}

export function WorkIcon({ name }: { name: "users" | "heart" | "chart" | "folder" | "calendar" | "edit" | "star" | "shield" }) {
  const map: Record<string, string> = {
    users: "👥",
    heart: "♥",
    chart: "📊",
    folder: "📁",
    calendar: "📅",
    edit: "✎",
    star: "★",
    shield: "🛡",
  };
  return <Text className="work-icon-svg">{map[name]}</Text>;
}

export function GearIcon() {
  return <Text className="gear-icon">⚙</Text>;
}

export function NavIcon({ name }: { name: "discover" | "assessment" | "chat" | "profile" }) {
  const map: Record<string, string> = {
    discover: "✦",
    assessment: "▣",
    chat: "✉",
    profile: "◉",
  };
  return <Text className="nav-symbol">{map[name]}</Text>;
}
