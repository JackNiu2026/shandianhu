import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("package boundaries", () => {
  it("declares the server package before it is consumed by other workspaces", () => {
    expect(
      fs.existsSync(path.resolve(__dirname, "../../package.json")),
    ).toBe(true);
  });

  it("keeps Prisma out of v2 admin route handlers", () => {
    const root = path.resolve(__dirname, "../../../../admin/src/app/api/v2");
    const source = fs.existsSync(root)
      ? fs
          .readdirSync(root, { recursive: true })
          .filter((name) => String(name).endsWith(".ts"))
          .map((name) => fs.readFileSync(path.join(root, String(name)), "utf8"))
          .join("\n")
      : "";

    expect(source).not.toMatch(/@prisma\/client|from ["']@\/lib\/prisma/);
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
});
