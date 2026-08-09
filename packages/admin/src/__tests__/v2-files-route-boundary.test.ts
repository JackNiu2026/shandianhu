import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = path.resolve(__dirname, "..");

function readRoute(relativePath: string) {
  const file = path.join(adminRoot, "app", "api", "v2", "files", relativePath, "route.ts");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

describe("V2 file routes", () => {
  it("uses the public server package and the common HTTP adapter", () => {
    const source = `${readRoute("upload-url")}\n${readRoute("[id]/download-url")}`;

    expect(source).toMatch(/from ["']@lightning-tiger\/server["']/);
    expect(source).toMatch(/FileService/);
    expect(source).toMatch(/toHttpResponse/);
    expect(source).not.toMatch(/@prisma\/client|db\/client|server\/src/);
  });
});
