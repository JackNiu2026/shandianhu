import { useEffect } from "react";
import Taro from "@tarojs/taro";
import { useAppStore } from "@/store";

export function useActiveChild() {
  const { state } = useAppStore();

  useEffect(() => {
    if (state.hydrated && !state.activeChild) {
      Taro.switchTab({ url: "/pages/me/index" });
    }
  }, [state.activeChild, state.hydrated]);

  return state.activeChild;
}
