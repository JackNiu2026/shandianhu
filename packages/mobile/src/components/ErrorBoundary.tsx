import { Component, ReactNode } from "react";
import { View, Text } from "@tarojs/components";
import "./ErrorBoundary.scss";

/**
 * 全局错误边界
 *
 * 捕获子组件树中未处理的 JavaScript 异常，
 * 防止整个页面白屏，渲染友好的错误兜底 UI。
 *
 * 用法：在 app.tsx 中包裹整个应用
 *   <ErrorBoundary><AppProvider>{children}</AppProvider></ErrorBoundary>
 */
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error("[ErrorBoundary] 捕获异常:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    // 刷新当前页面（小程序中等同于重启）
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="error-boundary">
          <View className="error-icon">
            <Text>⚡</Text>
          </View>
          <Text className="error-title">页面出了点小问题</Text>
          <Text className="error-desc">
            闪电虎遇到了一个意外错误，请尝试刷新页面。
            {"\n"}如果问题持续出现，请退出小程序后重新进入。
          </Text>
          <View className="error-btn" onClick={this.handleReload}>
            <Text>刷新页面</Text>
          </View>
          <Text className="error-foot">
            {this.state.error?.message || "未知错误"}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}
