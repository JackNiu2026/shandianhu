import { describe, expect, it } from "vitest";
import type { Subject, SchoolStage } from "@prisma/client";
import type { TeachingMode } from "@lightning-tiger/shared/api";
import { RecommendationService, type RecommendationDatabase } from "./recommendation-service";

// ─── 测试夹具 ─────────────────────────────────────────────

type ChildRecord = {
  id: string;
  parentProfileId: string;
  name: string;
  grade: string | null;
  learningGoals: string[];
  deletedAt: Date | null;
};

type ParentRecord = {
  id: string;
  userId: string;
  serviceAreaCode: string | null;
};

type TeacherRecord = {
  id: string;
  displayName: string;
  bio: string;
  subjects: Subject[];
  schoolStages: SchoolStage[];
  teachingModes: TeachingMode[];
  serviceAreaCodes: string[];
  teachingTags: string[];
  experienceYears: number;
  pricePerHour: number;
  serviceStatus: "ACTIVE" | "PAUSED" | "BANNED";
};

type RuleRecord = {
  id: string;
  teacherProfileId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
};

type ExceptionRecord = {
  id: string;
  teacherProfileId: string;
  date: Date;
  type: "AVAILABLE" | "UNAVAILABLE";
  startMinute: number | null;
  endMinute: number | null;
};

type ReservationRecord = {
  id: string;
  teacherProfileId: string;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
};

type SummaryRecord = {
  id: string;
  childId: string;
  summary: unknown;
  createdAt: Date;
};

interface FixtureState {
  parents: ParentRecord[];
  children: ChildRecord[];
  teachers: TeacherRecord[];
  rules: RuleRecord[];
  exceptions: ExceptionRecord[];
  reservations: ReservationRecord[];
  summaries: SummaryRecord[];
}

function createDatabase(state: FixtureState): RecommendationDatabase {
  return {
    parentProfile: {
      findUnique: async ({ where: { id } }) =>
        state.parents.find((parent) => parent.id === id) ?? null,
    },
    child: {
      findUnique: async ({ where: { id } }) =>
        state.children.find((child) => child.id === id) ?? null,
    },
    teacherProfile: {
      findMany: async ({ where }: { where?: { serviceStatus?: "ACTIVE" | "PAUSED" | "BANNED"; subjects?: { has: Subject } } }) => {
        let items = state.teachers.slice();
        if (where?.serviceStatus) {
          items = items.filter((teacher) => teacher.serviceStatus === where.serviceStatus);
        }
        if (where?.subjects?.has) {
          items = items.filter((teacher) => teacher.subjects.includes(where.subjects!.has));
        }
        return items;
      },
    },
    teacherAvailabilityRule: {
      findMany: async ({ where: { teacherProfileId: { in: ids } } }) =>
        state.rules.filter((rule) => ids.includes(rule.teacherProfileId)),
    },
    teacherAvailabilityException: {
      findMany: async ({ where: { teacherProfileId: { in: ids }, date: { gte, lte } } }) =>
        state.exceptions.filter((exception) => {
          if (!ids.includes(exception.teacherProfileId)) return false;
          if (gte && exception.date < gte) return false;
          if (lte && exception.date > lte) return false;
          return true;
        }),
    },
    scheduleReservation: {
      findMany: async ({ where: { teacherProfileId: { in: ids }, active, startsAt: { gte, lte } } }) =>
        state.reservations.filter((reservation) => {
          if (!ids.includes(reservation.teacherProfileId)) return false;
          if (active !== undefined && reservation.active !== active) return false;
          if (gte && reservation.startsAt < gte) return false;
          if (lte && reservation.startsAt > lte) return false;
          return true;
        }),
    },
    tutoringSummary: {
      findMany: async ({ where: { childId }, orderBy, take }) => {
        let items = state.summaries.filter((summary) => summary.childId === childId);
        if (orderBy?.createdAt === "desc") {
          items = items.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (take !== undefined) items = items.slice(0, take);
        return items;
      },
    },
    parentReview: {
      aggregate: async () => ({ _avg: { rating: null }, _count: { rating: 0 } }),
    },
  };
}

function makeTeacher(id: string, overrides: Partial<TeacherRecord> = {}): TeacherRecord {
  return {
    id,
    displayName: `Teacher ${id}`,
    bio: "experienced",
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

function defaultState(): FixtureState {
  return {
    parents: [{ id: "parent-1", userId: "user-1", serviceAreaCode: "BJ-CY" }],
    children: [
      {
        id: "child-1",
        parentProfileId: "parent-1",
        name: "Ada",
        grade: "三年级",
        learningGoals: ["逻辑思维"],
        deletedAt: null,
      },
    ],
    teachers: [],
    rules: [],
    exceptions: [],
    reservations: [],
    summaries: [],
  };
}

const FIXED_NOW = new Date("2026-08-11T00:00:00Z");

describe("RecommendationService.recommend", () => {
  it("returns only ACTIVE teachers matching the requested subject", async () => {
    const state = defaultState();
    state.teachers = [
      makeTeacher("t-active-match", { teachingTags: ["step-by-step", "fraction"] }),
      makeTeacher("t-paused", { serviceStatus: "PAUSED" }),
      makeTeacher("t-banned", { serviceStatus: "BANNED" }),
      makeTeacher("t-wrong-subject", { subjects: ["ENGLISH"] as Subject[] }),
      makeTeacher("t-wrong-stage", { schoolStages: ["HIGH"] as SchoolStage[] }),
    ];
    const service = new RecommendationService(createDatabase(state), () => FIXED_NOW);

    const result = await service.recommend({
      parentProfileId: "parent-1",
      childId: "child-1",
      subject: "MATH" as Subject,
    });

    expect(result.items.map((item) => item.teacherId)).toEqual(["t-active-match"]);
    expect(result.items[0].subjects).toContain("MATH");
    expect(result.items[0].schoolStages).toContain("PRIMARY");
  });

  it("reports the hard filtered count", async () => {
    const state = defaultState();
    state.teachers = [
      makeTeacher("t-keep", { teachingTags: ["step-by-step", "fraction"] }),
      makeTeacher("t-wrong-stage", { schoolStages: ["HIGH"] as SchoolStage[] }),
      makeTeacher("t-wrong-subject", { subjects: ["ENGLISH"] as Subject[] }),
      makeTeacher("t-paused", { serviceStatus: "PAUSED" }),
    ];
    const service = new RecommendationService(createDatabase(state), () => FIXED_NOW);

    const result = await service.recommend({
      parentProfileId: "parent-1",
      childId: "child-1",
      subject: "MATH" as Subject,
    });

    expect(result.items).toHaveLength(1);
    expect(result.hardFilteredCount).toBe(3);
  });

  it("produces explainable and non-sensitive reasons", async () => {
    const state = defaultState();
    state.teachers = [
      makeTeacher("t-1", {
        teachingTags: ["step-by-step", "fraction"],
        experienceYears: 8,
        teachingModes: ["IN_HOME"] as TeachingMode[],
      }),
    ];
    state.rules = [
      {
        id: "rule-1",
        teacherProfileId: "t-1",
        weekday: 6,
        startMinute: 9 * 60,
        endMinute: 11 * 60,
      },
    ];
    state.summaries = [
      {
        id: "summary-1",
        childId: "child-1",
        summary: { knowledgePoints: [{ name: "fraction", performance: "WEAK" }] },
        createdAt: new Date("2026-08-01"),
      },
    ];
    const service = new RecommendationService(createDatabase(state), () => FIXED_NOW);

    const result = await service.recommend({
      parentProfileId: "parent-1",
      childId: "child-1",
      subject: "MATH" as Subject,
      preferredMode: "IN_HOME" as TeachingMode,
    });

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.reasons.length).toBeGreaterThan(0);
    expect(item.reasons.length).toBeLessThanOrEqual(3);
    const joined = item.reasons.map((r) => r.text).join(" ");
    expect(joined).not.toMatch(/MBTI|INTJ|ENTP|心理|诊断|精神/);
    expect(item.score).toBeGreaterThan(0);
    // 应当附带可用时段
    expect(item.availabilitySlots.length).toBeGreaterThan(0);
  });

  it("rejects when child does not belong to the parent", async () => {
    const state = defaultState();
    state.children.push({
      id: "child-other",
      parentProfileId: "parent-other",
      name: "Other",
      grade: "三年级",
      learningGoals: [],
      deletedAt: null,
    });
    const service = new RecommendationService(createDatabase(state), () => FIXED_NOW);

    await expect(
      service.recommend({
        parentProfileId: "parent-1",
        childId: "child-other",
        subject: "MATH" as Subject,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects when grade is unrecognized", async () => {
    const state = defaultState();
    state.children[0].grade = "幼儿园";
    const service = new RecommendationService(createDatabase(state), () => FIXED_NOW);

    await expect(
      service.recommend({
        parentProfileId: "parent-1",
        childId: "child-1",
        subject: "MATH" as Subject,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });
});

describe("RecommendationService.listAll", () => {
  it("returns only ACTIVE teachers matching subject, applying stage filter", async () => {
    const state = defaultState();
    state.teachers = [
      makeTeacher("t-active-math-primary"),
      makeTeacher("t-active-math-middle", { schoolStages: ["MIDDLE"] as SchoolStage[] }),
      makeTeacher("t-paused", { serviceStatus: "PAUSED" }),
      makeTeacher("t-wrong-subject", { subjects: ["ENGLISH"] as Subject[] }),
    ];
    const service = new RecommendationService(createDatabase(state), () => FIXED_NOW);

    const result = await service.listAll({ subject: "MATH" as Subject });

    // service 把 where:{serviceStatus:"ACTIVE", subjects:{has:"MATH"}} 传给 DB，
    // mock 忠实实现该 where 子句，因此只返回 ACTIVE + 数学 老师
    expect(result.map((item) => item.id).sort()).toEqual(
      ["t-active-math-primary", "t-active-math-middle"].sort(),
    );
  });

  it("respects the schoolStage filter", async () => {
    const state = defaultState();
    state.teachers = [
      makeTeacher("t-primary", { schoolStages: ["PRIMARY"] as SchoolStage[] }),
      makeTeacher("t-middle", { schoolStages: ["MIDDLE"] as SchoolStage[] }),
    ];
    const service = new RecommendationService(createDatabase(state), () => FIXED_NOW);

    const result = await service.listAll({ subject: "MATH" as Subject, schoolStage: "MIDDLE" as SchoolStage });

    expect(result.map((item) => item.id)).toEqual(["t-middle"]);
  });
});
