import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("V2 learning-style route", () => {
  it("uses public server services with authentication and Zod validation only", () => {
    const routePath = path.resolve(__dirname, "..", "app", "api", "v2", "assessments", "learning-style", "route.ts");
    const source = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";

    expect(source).toContain("LearningStyleAssessmentService");
    expect(source).toContain("authenticatedUserId");
    expect(source).toContain("z.object");
    expect(source).toContain("toHttpResponse");
    expect(source).not.toMatch(/@prisma\/client|db\/client|server\/src/);
  });
});
