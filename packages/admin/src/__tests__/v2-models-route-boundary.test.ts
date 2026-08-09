import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("V2 model configuration route", () => {
  it("uses only public server APIs and never returns encrypted key fields", () => {
    const routePath = path.resolve(__dirname, "..", "app", "api", "v2", "admin", "models", "route.ts");
    const source = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";

    expect(source).toMatch(/from ["']@lightning-tiger\/server["']/);
    expect(source).toContain("ModelConfigService");
    expect(source).toContain("authenticateAdmin");
    expect(source).toContain("toHttpResponse");
    expect(source).toContain("z.object");
    expect(source).toContain('role !== "SUPERADMIN"');
    expect(source).not.toMatch(/@prisma\/client|db\/client|server\/src|apiKeyCiphertext|apiKeyIv|apiKeyTag/);
  });
});
