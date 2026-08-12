import { describe, expect, it } from "vitest";
import {
  AGENT_CATALOG,
  isApprovedAgent,
  stageForGrade,
  subjectsForStage,
  type SchoolStageCode,
  type SubjectCode,
} from "./catalog";

describe("AGENT_CATALOG", () => {
  it("defines exactly the approved 13 subject-stage agents", () => {
    expect(AGENT_CATALOG).toEqual([
      ["CHINESE", "PRIMARY"], ["CHINESE", "MIDDLE"], ["CHINESE", "HIGH"],
      ["MATH", "PRIMARY"], ["MATH", "MIDDLE"], ["MATH", "HIGH"],
      ["ENGLISH", "PRIMARY"], ["ENGLISH", "MIDDLE"], ["ENGLISH", "HIGH"],
      ["PHYSICS", "MIDDLE"], ["PHYSICS", "HIGH"],
      ["CHEMISTRY", "MIDDLE"], ["CHEMISTRY", "HIGH"],
    ]);
    expect(AGENT_CATALOG).toHaveLength(13);
  });

  it("does not include physics or chemistry for primary school", () => {
    const primarySubjects = AGENT_CATALOG
      .filter(([, stage]) => stage === "PRIMARY")
      .map(([subject]) => subject);
    expect(primarySubjects).not.toContain("PHYSICS");
    expect(primarySubjects).not.toContain("CHEMISTRY");
  });
});

describe("stageForGrade", () => {
  it("maps grades 1-6 to PRIMARY", () => {
    expect(stageForGrade("1")).toBe("PRIMARY");
    expect(stageForGrade("3")).toBe("PRIMARY");
    expect(stageForGrade("6")).toBe("PRIMARY");
  });

  it("maps grades 7-9 to MIDDLE", () => {
    expect(stageForGrade("7")).toBe("MIDDLE");
    expect(stageForGrade("8")).toBe("MIDDLE");
    expect(stageForGrade("9")).toBe("MIDDLE");
  });

  it("maps grades 10-12 to HIGH", () => {
    expect(stageForGrade("10")).toBe("HIGH");
    expect(stageForGrade("11")).toBe("HIGH");
    expect(stageForGrade("12")).toBe("HIGH");
  });

  it("handles Chinese grade strings with non-digit characters", () => {
    expect(stageForGrade("三年级")).toBe("PRIMARY");
    expect(stageForGrade("初一")).toBe("MIDDLE");
    expect(stageForGrade("高一")).toBe("HIGH");
  });

  it("returns null for null or invalid grades", () => {
    expect(stageForGrade(null)).toBeNull();
    expect(stageForGrade("")).toBeNull();
    expect(stageForGrade("0")).toBeNull();
    expect(stageForGrade("13")).toBeNull();
    expect(stageForGrade("abc")).toBeNull();
  });
});

describe("subjectsForStage", () => {
  it("returns only three subjects for primary school", () => {
    expect(subjectsForStage("PRIMARY")).toEqual(["CHINESE", "MATH", "ENGLISH"]);
  });

  it("returns all five subjects for middle and high school", () => {
    expect(subjectsForStage("MIDDLE")).toEqual([
      "CHINESE", "MATH", "ENGLISH", "PHYSICS", "CHEMISTRY",
    ]);
    expect(subjectsForStage("HIGH")).toEqual([
      "CHINESE", "MATH", "ENGLISH", "PHYSICS", "CHEMISTRY",
    ]);
  });
});

describe("isApprovedAgent", () => {
  it("approves catalog entries", () => {
    expect(isApprovedAgent("CHINESE", "PRIMARY")).toBe(true);
    expect(isApprovedAgent("PHYSICS", "HIGH")).toBe(true);
    expect(isApprovedAgent("CHEMISTRY", "MIDDLE")).toBe(true);
  });

  it("rejects physics and chemistry for primary school", () => {
    expect(isApprovedAgent("PHYSICS", "PRIMARY" as SchoolStageCode)).toBe(false);
    expect(isApprovedAgent("CHEMISTRY", "PRIMARY" as SchoolStageCode)).toBe(false);
  });

  it("rejects unknown subjects", () => {
    expect(isApprovedAgent("BIOLOGY" as SubjectCode, "HIGH")).toBe(false);
  });
});
