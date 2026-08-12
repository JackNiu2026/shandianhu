import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const adminSourceRoot = path.resolve(__dirname, "..");
const retiredRuntimePaths = [
  "app/api/auth/parent",
  "app/api/teachers",
  "app/api/parents",
  "app/api/bookings",
  "app/api/reviews",
  "app/api/memberships",
  "app/api/finance",
  "app/api/public",
  "app/api/diagnose",
  "app/api/dashboard",
  "app/api/content",
  "app/(dashboard)/parents",
  "app/(dashboard)/bookings",
  "app/(dashboard)/reviews",
  "app/(dashboard)/memberships",
  "app/(dashboard)/finance",
  "app/(dashboard)/content",
  "lib/data.ts",
  "lib/prisma.ts",
];

function readRuntimeSources(): string {
  return fs
    .readdirSync(adminSourceRoot, { recursive: true })
    .filter((name) => /\.(ts|tsx)$/.test(String(name)))
    .filter((name) => !String(name).includes("__tests__"))
    .map((name) => fs.readFileSync(path.join(adminSourceRoot, String(name)), "utf8"))
    .join("\n");
}

describe("legacy runtime contract", () => {
  it("does not compile runtime code against removed v1 models", () => {
    const source = readRuntimeSources();

    expect(source).not.toMatch(
      /prisma\.(parent|teacher|booking|review|membership|withdrawal|order|diagnosisReport)\b/,
    );
    expect(source).not.toMatch(/@lightning-tiger\/shared["'][^"']*teachers/);
    expect(source).not.toContain("@/lib/prisma");
  });

  it("removes retired V1 APIs, dashboard pages, and adapters", () => {
    for (const runtimePath of retiredRuntimePaths) {
      expect(fs.existsSync(path.join(adminSourceRoot, runtimePath))).toBe(false);
    }
  });
});
