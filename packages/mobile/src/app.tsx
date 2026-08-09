import Taro, { useLaunch } from "@tarojs/taro";
import { AppProvider } from "@/store";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { ReactNode } from "react";
import "./app.scss";

/**
 * P0-1 字体加载：运行时加载 Noto Serif SC（衬线大标题）+ Ma Shan Zheng（毛笔手写体）
 *
 * DM Mono 已 base64 内嵌（_dm-mono.scss），离线可用。
 * Noto Serif SC / Ma Shan Zheng 因中文字体体积大（几 MB），无法 base64 内嵌，
 * 改用 Taro.loadFontFace 运行时加载，加载完成前降级到系统字体栈
 * （Songti SC/STSong/STKaiti/KaiTi）。
 *
 * 生产环境需在小程序后台配置 downloadFile 合法域名：
 *   - cdn.jsdelivr.net（字体文件 CDN）
 *
 * 字体加载失败不影响功能，仅视觉降级。
 */
const FONT_FACE_LIST = [
  {
    family: "Noto Serif SC",
    source:
      'url("https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.0.18/files/noto-serif-sc-chinese-simplified-600-normal.woff2")',
    weight: "600",
  },
  {
    family: "Noto Serif SC",
    source:
      'url("https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.0.18/files/noto-serif-sc-chinese-simplified-700-normal.woff2")',
    weight: "700",
  },
  {
    family: "Ma Shan Zheng",
    source:
      'url("https://cdn.jsdelivr.net/npm/@fontsource/ma-shan-zheng@5.0.0/files/ma-shan-zheng-chinese-simplified-400-normal.woff2")',
    weight: "400",
  },
] as const;

function App({ children }: { children: ReactNode }) {
  useLaunch(() => {
    console.log("闪电虎小程序启动");
    // 运行时加载衬线与手写字体（降级到系统字体栈，不阻塞渲染）
    FONT_FACE_LIST.forEach((font) => {
      Taro.loadFontFace({
        family: font.family,
        source: font.source,
        global: true,
        success: () => console.log(`[font] ${font.family} ${font.weight} loaded`),
        fail: (err) =>
          console.warn(`[font] ${font.family} ${font.weight} failed, fallback to system font`, err),
      });
    });
  });

  return (
    <ErrorBoundary>
      <AppProvider>{children}</AppProvider>
    </ErrorBoundary>
  );
}

export default App;
