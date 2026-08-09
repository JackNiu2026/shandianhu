/**
 * API 请求封装（类型定义层）
 *
 * 跨端 API 客户端的实际实现位于各端代码中：
 * - 移动端（Taro）：packages/mobile/src/services/api.ts
 * - 管理后台（Next.js）：packages/admin/src/lib/data.ts
 *
 * 共享类型定义在此导出，供两端复用。
 */

/** 列表接口统一响应格式 */
export interface ListResponse<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

/** 平台统计数据 */
export interface PlatformStats {
  teacherCount: number;
  parentCount: number;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "QUOTA_EXCEEDED"
  | "RESOURCE_CONFLICT"
  | "MODEL_UNAVAILABLE"
  | "JOB_FAILED"
  | "INTERNAL_ERROR";

export type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | {
      ok: false;
      error: { code: ApiErrorCode; message: string; requestId: string };
    };
