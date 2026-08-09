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
});
