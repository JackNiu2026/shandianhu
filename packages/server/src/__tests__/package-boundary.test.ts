import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const directPrismaImport = /@prisma\/client|from ["']@\/lib\/prisma/;
const v2RouteRoot = path.resolve(__dirname, "../../../admin/src/app/api/v2");

function collectTypeScriptSource(root: string): string {
  return fs.existsSync(root)
    ? fs
        .readdirSync(root, { recursive: true })
        .filter((name) => String(name).endsWith(".ts"))
        .map((name) => fs.readFileSync(path.join(root, String(name)), "utf8"))
        .join("\n")
    : "";
}

describe("package boundaries", () => {
  it("declares the server package before it is consumed by other workspaces", () => {
    expect(
      fs.existsSync(path.resolve(__dirname, "../../package.json")),
    ).toBe(true);
  });

  it("keeps Prisma out of v2 admin route handlers", () => {
    const source = collectTypeScriptSource(v2RouteRoot);

    expect(source).not.toMatch(directPrismaImport);
  });

  it("collects direct Prisma imports from a temporary v2 route handler", () => {
    const actualRouteRoot = path.resolve(
      __dirname,
      "../../../admin/src/app/api/v2",
    );
    const routeRootExisted = fs.existsSync(actualRouteRoot);
    fs.mkdirSync(actualRouteRoot, { recursive: true });
    const fixtureDirectory = fs.mkdtempSync(
      path.join(actualRouteRoot, ".package-boundary-"),
    );

    try {
      fs.writeFileSync(
        path.join(fixtureDirectory, "route.ts"),
        'import { PrismaClient } from "@prisma/client";\nimport { prisma } from "@/lib/prisma";\n',
      );

      expect(collectTypeScriptSource(v2RouteRoot)).toMatch(directPrismaImport);
    } finally {
      fs.rmSync(fixtureDirectory, { recursive: true, force: true });
      if (!routeRootExisted) {
        fs.rmSync(actualRouteRoot, { recursive: true, force: true });
      }
    }
  });

  it("bridges Prisma commands to the legacy schema until the v2 schema exists", () => {
    const serverPackage = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const rootPackage = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../../../package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(serverPackage.scripts["prisma:generate"]).toBe(
      "prisma generate --schema ../admin/prisma/schema.prisma",
    );
    expect(serverPackage.scripts["db:migrate"]).toBe(
      "prisma migrate deploy --schema ../admin/prisma/schema.prisma",
    );
    expect(serverPackage.scripts["db:push"]).toBe(
      "prisma db push --schema ../admin/prisma/schema.prisma",
    );
    expect(rootPackage.scripts["db:generate"]).toBe(
      "pnpm --filter @lightning-tiger/server prisma:generate",
    );
    expect(rootPackage.scripts["db:migrate"]).toBe(
      "pnpm --filter @lightning-tiger/server db:migrate",
    );
    expect(rootPackage.scripts["db:push"]).toBe(
      "pnpm --filter @lightning-tiger/server db:push",
    );
    expect(rootPackage.scripts["db:seed"]).toBe("pnpm --filter admin db:seed");
  });

  it("runs server and worker checks in CI", () => {
    const ci = fs.readFileSync(
      path.resolve(__dirname, "../../../../.github/workflows/ci.yml"),
      "utf8",
    );

    expect(ci).toContain("pnpm --filter @lightning-tiger/server prisma:generate");
    expect(ci).toContain("pnpm --filter @lightning-tiger/server typecheck");
    expect(ci).toContain("pnpm --filter @lightning-tiger/server test");
    expect(ci).toContain("pnpm --filter @lightning-tiger/worker typecheck");
    expect(ci).toContain("pnpm --filter @lightning-tiger/worker test");
  });
});
