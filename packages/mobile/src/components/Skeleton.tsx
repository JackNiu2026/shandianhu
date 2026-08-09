import { View } from "@tarojs/components";
import "./Skeleton.scss";

/**
 * Skeleton 骨架屏组件
 *
 * 用途：数据加载期间用灰色块占位，模拟卡片轮廓，
 * 替代"加载中..."纯文本，消除白屏硬切感。
 *
 * 用法：
 *   <Skeleton variant="teacher-card" />
 *   <Skeleton variant="profile-hero" />
 *   <Skeleton variant="text" width="60%" />
 */

type Variant = "teacher-card" | "profile-hero" | "text" | "avatar" | "list-item";

interface SkeletonProps {
  variant?: Variant;
  count?: number;
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({
  variant = "text",
  count = 1,
  width,
  height,
  className = "",
}: SkeletonProps) {
  const items = Array.from({ length: count });

  if (variant === "teacher-card") {
    return (
      <View className={`skeleton-teacher-card ${className}`}>
        <View className="skel-identity">
          <View className="skel-avatar" />
          <View className="skel-identity-text">
            <View className="skel-line skel-w60" />
            <View className="skel-line skel-w40" />
          </View>
        </View>
        <View className="skel-tags">
          <View className="skel-tag" />
          <View className="skel-tag" />
          <View className="skel-tag" />
        </View>
        <View className="skel-body">
          <View className="skel-line skel-w80" />
          <View className="skel-line skel-w60" />
          <View className="skel-grid">
            <View className="skel-grid-cell" />
            <View className="skel-grid-cell" />
            <View className="skel-grid-cell" />
          </View>
        </View>
      </View>
    );
  }

  if (variant === "profile-hero") {
    return (
      <View className={`skeleton-profile-hero ${className}`}>
        <View className="skel-avatar-lg" />
        <View className="skel-hero-text">
          <View className="skel-line skel-w50" />
          <View className="skel-line skel-w70" />
          <View className="skel-line skel-w40" />
        </View>
        <View className="skel-stats-row">
          <View className="skel-stat" />
          <View className="skel-stat" />
          <View className="skel-stat" />
        </View>
      </View>
    );
  }

  if (variant === "list-item") {
    return (
      <View className={`skeleton-list ${className}`}>
        {items.map((_, i) => (
          <View key={i} className="skel-list-item">
            <View className="skel-avatar-sm" />
            <View className="skel-list-text">
              <View className="skel-line skel-w50" />
              <View className="skel-line skel-w80" />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (variant === "avatar") {
    return <View className="skel-avatar" style={{ width: width || "47px", height: height || "47px" }} />;
  }

  // text（默认）
  return (
    <View className={`skeleton-text ${className}`}>
      {items.map((_, i) => (
        <View
          key={i}
          className="skel-line"
          style={{ width: width || "100%", height: height || "13px" }}
        />
      ))}
    </View>
  );
}
