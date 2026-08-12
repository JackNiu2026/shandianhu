import { describe, expect, it } from "vitest";
import type { Subject, SchoolStage } from "@prisma/client";
import type { TeachingMode } from "@lightning-tiger/shared/api";
import {
  buildReasons,
  hardFilter,
  overlap,
  rankTeachers,
  scoreCompatibility,
} from "./score";
import type {
  ChildContextForMatch,
  RecommendationRequestInternal,
  TeacherCandidate,
} from "./types";

function makeChild(overrides: Partial<ChildContextForMatch> = {}): ChildContextForMatch {
  return {
    childId: "child-1",
    grade: "三年级",
    schoolStage: "PRIMARY" as SchoolStage,
    subject: "MATH" as Subject,
    weakKnowledgePoints: ["fraction", "geometry"],
    learningGoals: ["逻辑思维"],
    teachingPreferences: ["step-by-step"],
    serviceAreaCode: "BJ-CY",
    ...overrides,
  };
}

function makeTeacher(id: string, overrides: Partial<TeacherCandidate> = {}): TeacherCandidate {
  return {
    id,
    displayName: `Teacher ${id}`,
    subjects: ["MATH"] as Subject[],
    schoolStages: ["PRIMARY"] as SchoolStage[],
    teachingModes: ["ONLINE", "IN_HOME"] as TeachingMode[],
    serviceAreaCodes: ["BJ-CY"],
    teachingTags: ["step-by-step", "fraction"],
    experienceYears: 5,
    pricePerHour: 200,
    serviceStatus: "ACTIVE",
    ...overrides,
  };
}

function makeRequest(overrides: Partial<RecommendationRequestInternal> = {}): RecommendationRequestInternal {
  return { child: makeChild(), ...overrides };
}

describe("overlap", () => {
  it("returns 0 when either side is empty", () => {
    expect(overlap([], ["a"])).toBe(0);
    expect(overlap(["a"], [])).toBe(0);
  });

  it("counts shared elements without double counting", () => {
    expect(overlap(["a", "b", "a"], ["a", "b", "c"])).toBe(2);
  });
});

describe("hardFilter", () => {
  it("drops inactive teachers", () => {
    const request = makeRequest();
    const candidates = [
      makeTeacher("t-active"),
      makeTeacher("t-paused", { serviceStatus: "PAUSED" }),
      makeTeacher("t-banned", { serviceStatus: "BANNED" }),
    ];
    expect(hardFilter(candidates, request).map((t) => t.id)).toEqual(["t-active"]);
  });

  it("drops teachers missing the requested subject", () => {
    const request = makeRequest();
    const candidates = [
      makeTeacher("t-math"),
      makeTeacher("t-english", { subjects: ["ENGLISH"] as Subject[] }),
    ];
    expect(hardFilter(candidates, request).map((t) => t.id)).toEqual(["t-math"]);
  });

  it("drops teachers missing the requested school stage", () => {
    const request = makeRequest({ child: makeChild({ schoolStage: "MIDDLE" as SchoolStage }) });
    const candidates = [
      makeTeacher("t-wrong-stage", { schoolStages: ["PRIMARY"] as SchoolStage[] }),
      makeTeacher("t-fit", { schoolStages: ["MIDDLE"] as SchoolStage[] }),
    ];
    expect(hardFilter(candidates, request).map((t) => t.id)).toEqual(["t-fit"]);
  });

  it("applies preferredMode, budget and experience soft constraints", () => {
    const request = makeRequest({
      preferredMode: "IN_HOME" as TeachingMode,
      budgetMaxPerHour: 250,
      minExperienceYears: 3,
    });
    const candidates = [
      makeTeacher("t-online-only", { teachingModes: ["ONLINE"] as TeachingMode[] }),
      makeTeacher("t-too-pricey", { pricePerHour: 500 }),
      makeTeacher("t-junior", { experienceYears: 1 }),
      makeTeacher("t-fit", { experienceYears: 4, pricePerHour: 200, teachingModes: ["IN_HOME"] as TeachingMode[] }),
    ];
    expect(hardFilter(candidates, request).map((t) => t.id)).toEqual(["t-fit"]);
  });
});

describe("scoreCompatibility", () => {
  it("returns zero score when nothing matches", () => {
    const teacher = makeTeacher("t-1", {
      teachingTags: [],
      experienceYears: 0,
      pricePerHour: 1000,
      teachingModes: ["ONLINE"] as TeachingMode[],
    });
    const request = makeRequest({
      preferredMode: "IN_HOME" as TeachingMode,
      budgetMaxPerHour: 100,
    });
    const score = scoreCompatibility(teacher, request, false);
    expect(score.schedule).toBe(0);
    expect(score.mode).toBe(0);
    expect(score.budget).toBe(0);
    expect(score.experience).toBe(0);
    expect(score.teachingFit).toBe(0);
    expect(score.subjectNeed).toBe(0);
    expect(score.total).toBe(0);
  });

  it("sums each dimension into total", () => {
    const teacher = makeTeacher("t-1", {
      teachingTags: ["step-by-step", "fraction"],
      experienceYears: 10,
      pricePerHour: 150,
      teachingModes: ["IN_HOME"] as TeachingMode[],
    });
    const request = makeRequest({
      preferredMode: "IN_HOME" as TeachingMode,
      budgetMaxPerHour: 200,
    });
    const score = scoreCompatibility(teacher, request, true);
    expect(score.total).toBe(
      score.schedule + score.mode + score.budget + score.experience + score.teachingFit + score.subjectNeed,
    );
    expect(score.total).toBeGreaterThan(0);
  });

  it("caps experience at 15", () => {
    const teacher = makeTeacher("t-1", { experienceYears: 30 });
    const score = scoreCompatibility(teacher, makeRequest(), true);
    expect(score.experience).toBe(15);
  });
});

describe("buildReasons", () => {
  it("never exposes MBTI or sensitive profile labels", () => {
    const teacher = makeTeacher("t-1", { teachingTags: ["MBTI", "INTJ", "心理诊断"] });
    const request = makeRequest({
      child: makeChild({
        weakKnowledgePoints: ["MBTI", "诊断"],
        teachingPreferences: ["心理"],
      }),
    });
    const score = scoreCompatibility(teacher, request, true);
    const reasons = buildReasons(teacher, score, request);
    const text = reasons.map((r) => r.text).join(" ");
    expect(text).not.toMatch(/MBTI|INTJ|ENTP|心理|诊断|精神/);
  });

  it("produces at most 3 reasons", () => {
    const teacher = makeTeacher("t-1", {
      teachingTags: ["step-by-step", "fraction"],
      experienceYears: 10,
      teachingModes: ["IN_HOME"] as TeachingMode[],
    });
    const request = makeRequest({
      preferredMode: "IN_HOME" as TeachingMode,
      budgetMaxPerHour: 300,
    });
    const score = scoreCompatibility(teacher, request, true);
    const reasons = buildReasons(teacher, score, request);
    expect(reasons.length).toBeLessThanOrEqual(3);
  });
});

describe("rankTeachers", () => {
  it("filters hard constraints before ranking (wrongStage, inactive, matching)", () => {
    const request = makeRequest({ child: makeChild({ schoolStage: "PRIMARY" as SchoolStage }) });
    const candidates = [
      makeTeacher("t-wrong-stage", { schoolStages: ["HIGH"] as SchoolStage[] }),
      makeTeacher("t-inactive", { serviceStatus: "PAUSED" }),
      makeTeacher("t-matching"),
    ];
    const scheduleMap = new Map([
      ["t-matching", [{ startsAt: new Date("2026-08-15T08:00:00Z"), endsAt: new Date("2026-08-15T09:00:00Z"), weekday: 6 }]],
    ]);
    const ranked = rankTeachers(candidates, request, scheduleMap);
    expect(ranked.map((item) => item.teacher.id)).toEqual(["t-matching"]);
  });

  it("produces stable ordering for the same input", () => {
    const request = makeRequest();
    const candidates = [
      makeTeacher("t-a", { experienceYears: 3, teachingTags: ["step-by-step", "fraction"] }),
      makeTeacher("t-b", { experienceYears: 5, teachingTags: ["step-by-step", "fraction"] }),
      makeTeacher("t-c", { experienceYears: 5, teachingTags: ["step-by-step", "fraction"] }),
    ];
    const scheduleMap = new Map(
      candidates.map((teacher) => [
        teacher.id,
        [{ startsAt: new Date("2026-08-15T08:00:00Z"), endsAt: new Date("2026-08-15T09:00:00Z"), weekday: 6 }],
      ]),
    );

    const firstRun = rankTeachers(candidates, request, scheduleMap);
    const secondRun = rankTeachers(candidates, request, scheduleMap);

    expect(secondRun.map((item) => item.teacher.id)).toEqual(firstRun.map((item) => item.teacher.id));
    // 同分（t-b 和 t-c）应按 id 升序，经验更高的 t-b/t-c 排在 t-a 之前
    expect(firstRun.map((item) => item.teacher.id)).toEqual(["t-b", "t-c", "t-a"]);
  });

  it("score breakdown always sums to total", () => {
    const request = makeRequest();
    const candidates = [makeTeacher("t-1"), makeTeacher("t-2", { teachingTags: [] })];
    const scheduleMap = new Map([
      ["t-1", [{ startsAt: new Date("2026-08-15T08:00:00Z"), endsAt: new Date("2026-08-15T09:00:00Z"), weekday: 6 }]],
    ]);
    for (const ranked of rankTeachers(candidates, request, scheduleMap)) {
      const sum =
        ranked.score.schedule +
        ranked.score.mode +
        ranked.score.budget +
        ranked.score.experience +
        ranked.score.teachingFit +
        ranked.score.subjectNeed;
      expect(sum).toBe(ranked.score.total);
    }
  });

  it("respects preferred time window when determining schedule fit", () => {
    const request = makeRequest({
      preferredStartsAt: new Date("2026-08-16T00:00:00Z"),
      preferredEndsAt: new Date("2026-08-16T23:59:00Z"),
    });
    const candidates = [makeTeacher("t-1")];
    const scheduleMap = new Map([
      ["t-1", [{ startsAt: new Date("2026-08-15T08:00:00Z"), endsAt: new Date("2026-08-15T09:00:00Z"), weekday: 6 }]],
    ]);
    const [ranked] = rankTeachers(candidates, request, scheduleMap);
    expect(ranked.score.schedule).toBe(0);
  });
});
