import type { RequestContext } from "@lightning-tiger/shared";

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
