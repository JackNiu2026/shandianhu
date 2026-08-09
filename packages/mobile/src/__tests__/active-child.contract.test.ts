import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = resolve(__dirname, "..");

describe("active child mobile contract", () => {
  it("persists only session and active-child workspace state", () => {
    const store = readFileSync(resolve(mobileRoot, "store/index.tsx"), "utf8");

    expect(store).toContain("session:");
    expect(store).toContain("workspace:");
    expect(store).toContain("activeChild:");
    expect(store).toContain("hydrated:");
    const persistedProjection = store.match(/function persistedState[\s\S]*?\n}/)?.[0] ?? "";
    expect(persistedProjection).toContain("session: state.session");
    expect(persistedProjection).toContain("workspace: state.workspace");
    expect(persistedProjection).toContain("parent: state.parent");
    expect(persistedProjection).toContain("activeChild: state.activeChild");
    expect(persistedProjection).not.toContain("liked");
    expect(persistedProjection).not.toContain("booked");
  });

  it("redirects pages without a child to Me and keeps child controls there", () => {
    const hookPath = resolve(mobileRoot, "hooks/useActiveChild.ts");
    expect(existsSync(hookPath)).toBe(true);
    const hook = readFileSync(hookPath, "utf8");
    const mePage = readFileSync(resolve(mobileRoot, "pages/me/index.tsx"), "utf8");

    expect(hook).toContain('Taro.switchTab({ url: "/pages/me/index" })');
    expect(mePage).toContain("setActiveChild");
    expect(mePage).toContain("createChild");
  });
});
