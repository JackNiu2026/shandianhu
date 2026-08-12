import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminSource = (relativePath: string) =>
  readFileSync(resolve(__dirname, "..", relativePath), "utf8");
const workspaceSource = (relativePath: string) =>
  readFileSync(resolve(__dirname, "../../../..", relativePath), "utf8");

describe("release hardening", () => {
  it("uses opaque, hashed AdminSession tokens instead of JWTs", () => {
    const auth = adminSource("lib/auth.ts");
    const apiAuth = adminSource("lib/api-auth.ts");
    const login = adminSource("app/api/auth/login/route.ts");

    expect(auth).toContain('AUTH_COOKIE_NAME = "admin-session"');
    expect(auth).not.toContain("jsonwebtoken");
    expect(login).toContain("authenticateAdminCredentials");
    expect(login).toContain("issueAdminSession");
    expect(apiAuth).toContain("resolveAdminSession");
  });

  it("keeps authorization in Node handlers and only performs routing/CORS in middleware", () => {
    const middleware = adminSource("middleware.ts");
    const layout = adminSource("app/(dashboard)/layout.tsx");

    expect(middleware).not.toContain("@prisma/client");
    expect(middleware).not.toContain("@lightning-tiger/server");
    expect(middleware).not.toContain("verifyToken");
    expect(middleware).toContain("CORS_ALLOWED_ORIGINS");
    expect(middleware).toContain("Access-Control-Allow-Credentials");
    expect(layout).toContain("resolveAdminSession");
  });

  it("revokes sessions on logout and password changes", () => {
    const logout = adminSource("app/api/auth/logout/route.ts");
    const changePassword = adminSource("app/api/auth/change-password/route.ts");

    expect(logout).toContain("revokeAdminSession");
    expect(changePassword).toContain("changeAdminPassword");
    expect(changePassword).toContain("clearAuthCookie");
  });

  it("keeps Prisma behind the server public admin-session service", () => {
    const authRuntimeSources = [
      adminSource("lib/api-auth.ts"),
      adminSource("app/api/auth/login/route.ts"),
      adminSource("app/api/auth/logout/route.ts"),
      adminSource("app/api/auth/change-password/route.ts"),
    ];

    for (const source of authRuntimeSources) {
      expect(source).not.toContain("@lightning-tiger/server/src/db/client");
      expect(source).not.toMatch(/\\bprisma\\./);
      expect(source).toContain("@lightning-tiger/server");
    }
  });

  it("keeps Docker health checks on an existing unauthenticated endpoint", () => {
    const dockerfile = adminSource("../Dockerfile");
    const compose = workspaceSource("docker-compose.yml");

    expect(dockerfile).toContain("http://localhost:3000/login");
    expect(compose).toContain("http://localhost:3000/login");
    expect(compose).not.toContain("/api/public/stats");
  });
});
