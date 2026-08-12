/** 工作区：家长端 / 老师端 */
export type Workspace = "parent" | "teacher";

/**
 * 根据用户身份返回其可访问的工作区列表。
 *
 * 普通家长始终只返回 ["parent"]；只有具备 ACTIVE 老师身份的用户才会追加 "teacher"。
 */
export function workspacesFor(user: { teacherProfile?: { serviceStatus: string } | null }): Workspace[] {
  const list: Workspace[] = ["parent"];
  if (user.teacherProfile && user.teacherProfile.serviceStatus === "ACTIVE") {
    list.push("teacher");
  }
  return list;
}
