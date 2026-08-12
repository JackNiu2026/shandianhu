import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("v2.1 operational sidebar", () => {
  it("shows the approved operating domains and no finance or membership links", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../components/dashboard/sidebar.tsx"), "utf8");
    const labels = [...source.matchAll(/label:\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(labels).toEqual(expect.arrayContaining(["运营概览", "家庭管理", "学情中心", "教务管理", "智能体中心", "通知监控", "安全审计", "系统设置"]));
    expect(labels).not.toEqual(expect.arrayContaining(["财务管理", "会员管理", "老师管理"]));
  });
});
