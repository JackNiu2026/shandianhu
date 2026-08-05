/**
 * Taro 类型补充声明
 * catchTap 是 Taro/微信小程序的事件捕获修饰符，
 * 阻止事件冒泡，但 @tarojs/components 类型定义中未包含。
 */
import "@tarojs/components";

declare module "@tarojs/components" {
  interface ViewProps {
    catchTap?: (() => void) | undefined;
  }
}
