import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = path.resolve(__dirname, "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(mobileRoot, relativePath), "utf8");
const readAll = (directory: string): string => fs.readdirSync(path.join(mobileRoot, directory), { recursive: true })
  .filter((entry) => String(entry).endsWith(".ts") || String(entry).endsWith(".tsx"))
  .filter((entry) => !String(entry).includes("__tests__"))
  .map((entry) => fs.readFileSync(path.join(mobileRoot, directory, String(entry)), "utf8"))
  .join("\n");

describe("v2.1 parent navigation", () => {
  it("uses the approved four parent tabs", () => {
    const config = read("src/app.config.ts");
    expect(config).toMatch(/pages\/smart\/index/);
    expect(config).toMatch(/pages\/tutors\/index/);
    expect(config).toMatch(/pages\/learning\/index/);
    expect(config).toMatch(/pages\/me\/index/);
    expect([...config.matchAll(/text:\s*"([^"\n]+)"/g)].map((match) => match[1])).toEqual(expect.arrayContaining(["智学", "家教", "学情", "我的"]));
  });

  it("exposes child switching only from the me page", () => {
    const me = read("src/pages/me/index.tsx");
    const otherPages = read("src/pages/smart/index.tsx") + read("src/pages/tutors/index.tsx") + read("src/pages/learning/index.tsx");
    expect(me).toContain("setActiveChild");
    expect(otherPages).not.toContain("setActiveChild");
  });

  it("keeps the tutor card framework visible when teacher data is empty", () => {
    const tutors = read("src/pages/tutors/index.tsx");
    expect(tutors).toContain("EMPTY_TUTOR");
    expect(tutors).toContain("teacher-card-empty");
    expect(tutors).toContain("老师数据接入后，卡片内容会自动完整显示");
  });

  it("preserves the original home teacher-card hierarchy", () => {
    const tutors = read("src/pages/tutors/index.tsx");
    for (const className of ["teacher-identity", "credential-tags", "decision-grid", "trust-line", "lesson-video", "contact-row", "swipe-actions"]) {
      expect(tutors).toContain(className);
    }
  });

  it("matches the Figma home header without persistent category tabs", () => {
    const tutors = read("src/pages/tutors/index.tsx");
    expect(tutors).toContain("位优秀老师入驻平台");
    expect(tutors).toContain("platform-filter");
    expect(tutors).not.toContain("tutor-filter-item");
    expect(tutors).not.toContain("scrollX");
  });

  it("collects child nickname, real grade, and birth month on first parent entry", () => {
    const modal = read("src/components/ChildProfileModal.tsx");
    expect(modal).toContain("孩子昵称");
    expect(modal).toContain("孩子年级");
    expect(modal).toContain("出生年月");
    expect(modal).toContain("createChild(displayName, grade, birthDateForMonth(birthMonth)");
  });

  it("does not block the teacher workspace with parent onboarding", () => {
    const modal = read("src/components/ChildProfileModal.tsx");
    expect(modal).toContain('state.workspace === "teacher"');
  });

  it("opens AI history from smart and books only real tutor slots", () => {
    const smart = read("src/pages/smart/index.tsx");
    const booking = read("src/pages/trial-booking/index.tsx");
    const api = read("src/services/api.ts");
    expect(smart).toContain("/pages/chat-history/index");
    expect(booking).toContain("availabilityPreview");
    expect(booking).not.toContain('placeholder="YYYY-MM-DD"');
    expect(api).toContain('if ("teacher" in result)');
    expect(api).toContain("apiError?.message");
  });

  it("stores the WeChat session before enabling initial child creation", () => {
    const store = read("src/store/index.tsx");
    const modal = read("src/components/ChildProfileModal.tsx");
    expect(store).toContain('dispatch({ type: "SET_SESSION", session })');
    expect(store).toContain("<ChildProfileModal");
    expect(modal).toContain("正在连接微信");
  });

  it("removes v1 password and public teacher clients", () => {
    const sources = readAll("src");
    expect(sources).not.toMatch(/auth\/parent\/(login|register)/);
    expect(sources).not.toMatch(/api\/public\/(teachers|stats|bookings|reviews)/);
    expect(sources).not.toMatch(/\/api\/diagnose/);
  });
});
