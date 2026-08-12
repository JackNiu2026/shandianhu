import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("V2 job status route", () => {
  it("keeps database access in the public server job service", () => {
    const routePath = path.resolve(__dirname, "..", "app", "api", "v2", "jobs", "[id]", "route.ts");
    const source = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";

    expect(source).toMatch(/from ["']@lightning-tiger\/server["']/);
    expect(source).toContain("JobService");
    expect(source).toContain("authenticatedUserId");
    expect(source).toContain("toHttpResponse");
    expect(source).not.toMatch(/@prisma\/client|db\/client|server\/src/);
  });
});
