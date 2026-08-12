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

  it("uses real database and Redis readiness checks for application containers", () => {
    const dockerfile = adminSource("../Dockerfile");
    const compose = workspaceSource("docker-compose.yml");
    const workerDockerfile = workspaceSource("packages/worker/Dockerfile");
    const adminReadiness = adminSource("app/api/health/ready/route.ts");
    const workerMain = workspaceSource("packages/worker/src/main.ts");

    expect(dockerfile).toContain("/api/health/ready");
    expect(workerDockerfile).toContain("127.0.0.1:3001/ready");
    expect(compose).not.toContain('node -e \\"process.exit(0)\\"');
    expect(adminReadiness).toContain("SELECT 1");
    expect(adminReadiness).toContain("redis.ping()");
    expect(workerMain).toContain('request.url === "/ready"');
  });

  it("publishes immutable images and keeps migrations separate from seed", () => {
    const compose = workspaceSource("docker-compose.yml");
    const release = workspaceSource(".github/workflows/release.yml");
    const deploy = workspaceSource(".github/workflows/deploy.yml");
    const deploymentScript = workspaceSource("scripts/deploy-compose.sh");

    expect(compose).toContain("lightning-tiger-admin:${IMAGE_TAG");
    expect(compose).toContain("lightning-tiger-worker:${IMAGE_TAG");
    expect(compose).toContain("lightning-tiger-migrator:${IMAGE_TAG");
    expect(compose).not.toContain("db:seed");
    expect(release).toContain("sha-${{ github.event.workflow_run.head_sha }}");
    expect(deploy).toContain("^sha-[0-9a-f]{40}$");
    expect(deploy).toContain("environment:");
    expect(deploymentScript).toContain("rolling application containers back");
  });

  it("runs mobile tests and production container smoke checks in CI", () => {
    const workflow = workspaceSource(".github/workflows/ci.yml");
    const smoke = workspaceSource("scripts/container-smoke.sh");
    const v22Smoke = workspaceSource("scripts/v2-2-smoke.mjs");

    expect(workflow).toContain("workspace: admin");
    expect(workflow).toContain("workspace: mobile");
    expect(workflow).toContain("workspace: server");
    expect(workflow).toContain("workspace: worker");
    expect(workflow).toContain('pnpm --filter "${{ matrix.filter }}" test');
    expect(workflow).toContain("Build and run production containers");
    expect(smoke).toContain("lightning-tiger-migrator:ci");
    expect(smoke).toContain("wait_for_health lt-ci-admin");
    expect(smoke).toContain("wait_for_health lt-ci-worker");
    expect(v22Smoke).toContain("AGENT_CATALOG");
    expect(v22Smoke).not.toContain("worker/dist");
    expect(v22Smoke).not.toContain('"JUNIOR"');
  });
});
