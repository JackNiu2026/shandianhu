import { View, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import logoMark from "@/assets/tiger-logo-mark.png";
import logoType from "@/assets/tiger-logo-type.png";

/**
 * 品牌顶栏(对齐 Figma .topbar + .wordmark)
 *
 * 配合 app.config.ts 的 navigationStyle: "custom" 使用:
 * - 高度按微信胶囊按钮安全区动态计算(状态栏 + 胶囊行高)
 * - 品牌图已裁白边压缩,直接 aspectFit 显示
 * - 吸顶(position: sticky),滚动时停留在顶部,与 Figma 一致
 */
export function TopBar() {
  let paddingTop = 20;
  let barHeight = 44;
  try {
    const win = Taro.getWindowInfo ? Taro.getWindowInfo() : Taro.getSystemInfoSync();
    const statusBarHeight = win.statusBarHeight ?? 20;
    const menu = Taro.getMenuButtonBoundingClientRect();
    const gap = Math.max((menu.top ?? 0) - statusBarHeight, 4);
    paddingTop = statusBarHeight;
    barHeight = (menu.height || 32) + gap * 2;
  } catch {
    // 兜底默认值即可
  }

  return (
    <View
      className="topbar custom-topbar"
      style={{ paddingTop: `${paddingTop}px`, height: `${paddingTop + barHeight}px` }}
    >
      <View className="wordmark">
        <View className="brand-mark">
          <Image src={logoMark} mode="aspectFit" />
        </View>
        <View className="brand-type">
          <Image src={logoType} mode="aspectFit" />
        </View>
      </View>
    </View>
  );
}

export default TopBar;
