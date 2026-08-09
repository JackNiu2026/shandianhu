import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { parseActiveChildId } from "../app/api/v2/children/child-route-helpers";

const routeRoot = resolve(__dirname, "../app/api/v2/children");
const routeFiles = ["route.ts", "[id]/route.ts", "active/route.ts"];

describe("v2 child route boundaries", () => {
  it("uses the public server API and shared HTTP adapter without Prisma", () => {
    for (const relativePath of routeFiles) {
      const file = resolve(routeRoot, relativePath);
      expect(existsSync(file)).toBe(true);

      const source = readFileSync(file, "utf8");
      expect(source).toContain('from "@lightning-tiger/server"');
      expect(source).toContain('from "@/lib/v2-handler"');
      expect(source).not.toMatch(/@prisma\/client|server\/src|db\/client/);
    }
  });

  it("maps malformed active-child input to the stable validation contract", async () => {
    const request = new NextRequest("http://localhost/api/v2/children/active", {
      method: "PUT",
      body: "not-json",
    });

    await expect(parseActiveChildId(request)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });
});
