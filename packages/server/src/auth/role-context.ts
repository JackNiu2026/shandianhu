import type { RequestContext } from "@lightning-tiger/shared";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";

type UserWorkspace = Extract<RequestContext["actor"], { kind: "user" }>["workspace"];
type UserProfileContext = Pick<
  Extract<RequestContext["actor"], { kind: "user" }>,
  "parentProfileId" | "teacherProfileId"
>;

export function createUserRequestContext(
  requestId: string,
  userId: string,
  workspace: UserWorkspace,
  profile: UserProfileContext = {},
): RequestContext {
  return {
    requestId,
    actor: { kind: "user", userId, workspace, ...profile },
  };
}

export function createAdminRequestContext(
  requestId: string,
  adminUserId: string,
): RequestContext {
  return { requestId, actor: { kind: "admin", adminUserId } };
}

// ─── V2.3 角色上下文解析 ───────────────────────────────────

/** 工作区：家长端 / 老师端 */
export type Workspace = "parent" | "teacher";

/** 解析后的角色上下文：携带当前会话在指定工作区下的身份信息 */
export interface ResolvedRoleContext {
  userId: string;
  workspace: Workspace;
  parentProfileId: string | null;
  teacherProfileId: string | null;
  teacherServiceStatus: "ACTIVE" | "PAUSED" | "BANNED" | null;
}

/** 管理端上下文（独立于会话角色上下文） */
export interface AdminContext {
  adminUserId: string;
  adminRole: string;
}

/** 角色上下文解析所需的数据库访问接口（便于测试注入 mock） */
export interface RoleContextDatabase {
  user: {
    findUnique(args: {
      where: { id: string };
      select: {
        parentProfile: { select: { id: true } };
        teacherProfile: { select: { id: true; serviceStatus: true } };
      };
    }): Promise<{
      parentProfile: { id: string } | null;
      teacherProfile: { id: string; serviceStatus: "ACTIVE" | "PAUSED" | "BANNED" } | null;
    } | null>;
  };
}

/**
 * 解析当前会话在指定工作区下的角色上下文。
 *
 * 安全约束：不能信任请求头自报的角色，必须从数据库验证用户的真实身份与老师服务状态。
 * - workspace="parent"：要求 parentProfile 存在，返回 parentProfileId
 * - workspace="teacher"：要求 teacherProfile 存在且 serviceStatus=ACTIVE，返回 teacherProfileId
 * 工作区与身份不匹配时抛 FORBIDDEN。
 *
 * opts.childId 为预留的家长工作区儿童作用域参数，当前不做额外校验。
 */
export async function resolveRoleContext(
  session: { userId: string },
  workspace: Workspace,
  opts?: { childId?: string },
  database: RoleContextDatabase = prisma,
): Promise<ResolvedRoleContext> {
  // 不信任 header 自报角色，从数据库读取真实身份
  const user = await database.user.findUnique({
    where: { id: session.userId },
    select: {
      parentProfile: { select: { id: true } },
      teacherProfile: { select: { id: true, serviceStatus: true } },
    },
  });

  if (!user) {
    throw new AppError("UNAUTHENTICATED", 401, "Authentication required");
  }

  const parentProfileId = user.parentProfile?.id ?? null;
  const teacherProfileId = user.teacherProfile?.id ?? null;
  const teacherServiceStatus = user.teacherProfile?.serviceStatus ?? null;

  if (workspace === "parent") {
    // 家长工作区需要 parentProfile 存在
    if (!parentProfileId) {
      throw new AppError("FORBIDDEN", 403, "Parent profile not available");
    }
  } else {
    // 老师工作区需要 teacherProfile 存在且服务状态为 ACTIVE
    if (!teacherProfileId) {
      throw new AppError("FORBIDDEN", 403, "Teacher profile not available");
    }
    if (teacherServiceStatus !== "ACTIVE") {
      throw new AppError("FORBIDDEN", 403, "Teacher service is not active");
    }
  }

  return {
    userId: session.userId,
    workspace,
    parentProfileId,
    teacherProfileId,
    teacherServiceStatus,
  };
}

/** 断言当前上下文为家长工作区且存在 parentProfileId */
export function assertParentContext(ctx: ResolvedRoleContext): void {
  if (ctx.workspace !== "parent" || !ctx.parentProfileId) {
    throw new AppError("FORBIDDEN", 403, "Parent workspace required");
  }
}

/** 断言当前上下文为老师工作区、存在 teacherProfileId 且服务状态为 ACTIVE */
export function assertTeacherContext(ctx: ResolvedRoleContext): void {
  if (ctx.workspace !== "teacher" || !ctx.teacherProfileId || ctx.teacherServiceStatus !== "ACTIVE") {
    throw new AppError("FORBIDDEN", 403, "Active teacher workspace required");
  }
}
