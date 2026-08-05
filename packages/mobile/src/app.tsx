import { useLaunch } from "@tarojs/taro";
import { AppProvider } from "@/store";
import type { ReactNode } from "react";
import "./app.scss";

function App({ children }: { children: ReactNode }) {
  useLaunch(() => {
    console.log("闪电虎小程序启动");
  });

  return <AppProvider>{children}</AppProvider>;
}

export default App;
