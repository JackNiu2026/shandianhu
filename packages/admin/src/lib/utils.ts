/**
 * 类名合并工具 — 过滤 falsy 值后用空格连接
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * 格式化货币
 */
export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString("zh-CN")}`;
}

/**
 * 格式化日期
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dateStr = formatDate(d);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dateStr} ${h}:${min}`;
}

/**
 * 相对时间
 */
export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  return formatDate(d);
}

/**
 * 状态映射到 Badge variant
 */
export function statusToVariant(status: string): "success" | "notice" | "danger" | "default" {
  const map: Record<string, "success" | "notice" | "danger" | "default"> = {
    active: "success",
    verified: "success",
    confirmed: "success",
    completed: "success",
    approved: "success",
    有效: "success",
    已通过: "success",
    已确认: "success",
    已完成: "success",
    pending: "notice",
    待确认: "notice",
    待审核: "notice",
    待处理: "notice",
    expired: "default",
    cancelled: "danger",
    rejected: "danger",
    已取消: "danger",
    已拒绝: "danger",
    blocked: "danger",
  };
  return map[status] || "default";
}
