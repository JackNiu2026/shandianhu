import { describe, expect, it } from "vitest";
import { ChildService, type ChildServiceDatabase } from "./child-service";

type ParentRecord = {
  id: string;
  userId: string;
  activeChildId: string | null;
};

type ChildRecord = {
  id: string;
  parentProfileId: string;
  name: string;
  grade: string | null;
  birthDate: Date | null;
  schoolName: string | null;
  learningGoals: string[];
  deletedAt: Date | null;
  createdAt: Date;
};

function createDatabase(
  parents: ParentRecord[],
  children: ChildRecord[],
): ChildServiceDatabase {
  let nextId = children.length + 1;

  return {
    $transaction: async (callback) => callback({
      parentProfile: {
        findUnique: async ({ where: { userId } }) =>
          parents.find((parent) => parent.userId === userId) ?? null,
        update: async ({ where: { id }, data }) => {
          const parent = parents.find((item) => item.id === id);
          if (!parent) throw new Error("missing parent");
          parent.activeChildId = data.activeChildId;
          return parent;
        },
      },
      child: {
        count: async ({ where }) => children.filter((child) =>
          child.parentProfileId === where.parentProfileId && child.deletedAt === where.deletedAt,
        ).length,
        create: async ({ data }) => {
          const child: ChildRecord = {
            id: `child-${nextId++}`,
            parentProfileId: data.parentProfileId,
            name: data.name,
            grade: data.grade ?? null,
            birthDate: data.birthDate ?? null,
            schoolName: data.schoolName ?? null,
            learningGoals: data.learningGoals ?? [],
            deletedAt: null,
            createdAt: new Date(),
          };
          children.push(child);
          return child;
        },
        findUnique: async ({ where: { id } }) => children.find((child) => child.id === id) ?? null,
        findMany: async ({ where, orderBy }) => children
          .filter((child) => child.parentProfileId === where.parentProfileId && child.deletedAt === where.deletedAt)
          .sort((left, right) => orderBy.createdAt === "desc"
            ? right.createdAt.getTime() - left.createdAt.getTime()
            : left.createdAt.getTime() - right.createdAt.getTime()),
        update: async ({ where: { id }, data }) => {
          const child = children.find((item) => item.id === id);
          if (!child) throw new Error("missing child");
          Object.assign(child, data);
          return child;
        },
      },
    }),
  };
}

function child(id: string, parentProfileId: string, createdAt: string): ChildRecord {
  return {
    id,
    parentProfileId,
    name: id,
    grade: "小学",
    birthDate: null,
    schoolName: null,
    learningGoals: [],
    deletedAt: null,
    createdAt: new Date(createdAt),
  };
}

describe("ChildService", () => {
  it("cannot activate another family's child", async () => {
    const parents = [
      { id: "parent-a", userId: "user-a", activeChildId: null },
      { id: "parent-b", userId: "user-b", activeChildId: null },
    ];
    const children = [child("child-b", "parent-b", "2026-01-01")];
    const service = new ChildService(createDatabase(parents, children));

    await expect(service.setActiveChild("user-a", "child-b"))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("limits a family to five active children", async () => {
    const parents = [{ id: "parent-a", userId: "user-a", activeChildId: "child-1" }];
    const children = Array.from({ length: 5 }, (_, index) =>
      child(`child-${index + 1}`, "parent-a", `2026-01-0${index + 1}`),
    );
    const service = new ChildService(createDatabase(parents, children));

    await expect(service.createChild("user-a", { displayName: "Sixth child" }))
      .rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });

  it("activates the first child during its creation transaction", async () => {
    const parents = [{ id: "parent-a", userId: "user-a", activeChildId: null }];
    const children: ChildRecord[] = [];
    const service = new ChildService(createDatabase(parents, children));

    const created = await service.createChild("user-a", {
      displayName: "Ada",
      grade: "小学",
      learningGoals: ["reading"],
    });

    expect(parents[0].activeChildId).toBe(created.id);
    await expect(service.listChildren("user-a")).resolves.toEqual([created]);
  });

  it("lists only children owned by the authenticated parent", async () => {
    const parents = [
      { id: "parent-a", userId: "user-a", activeChildId: "child-a" },
      { id: "parent-b", userId: "user-b", activeChildId: "child-b" },
    ];
    const children = [
      child("child-a", "parent-a", "2026-01-01"),
      child("child-b", "parent-b", "2026-01-02"),
    ];
    const service = new ChildService(createDatabase(parents, children));

    await expect(service.listChildren("user-a")).resolves.toEqual([children[0]]);
  });

  it("only updates children owned by the authenticated parent", async () => {
    const parents = [
      { id: "parent-a", userId: "user-a", activeChildId: null },
      { id: "parent-b", userId: "user-b", activeChildId: "child-b" },
    ];
    const children = [child("child-b", "parent-b", "2026-01-01")];
    const service = new ChildService(createDatabase(parents, children));

    await expect(service.updateChild("user-a", "child-b", { displayName: "Renamed" }))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(children[0].name).toBe("child-b");
  });

  it("replaces a deleted active child with the newest remaining child", async () => {
    const parents = [{ id: "parent-a", userId: "user-a", activeChildId: "child-current" }];
    const children = [
      child("child-old", "parent-a", "2026-01-01"),
      child("child-new", "parent-a", "2026-02-01"),
      child("child-current", "parent-a", "2026-03-01"),
    ];
    const service = new ChildService(createDatabase(parents, children));

    await service.softDeleteChild("user-a", "child-current");

    expect(children.find((item) => item.id === "child-current")?.deletedAt).toBeInstanceOf(Date);
    expect(parents[0].activeChildId).toBe("child-new");
  });

  it("clears activeChild when the final child is deleted", async () => {
    const parents = [{ id: "parent-a", userId: "user-a", activeChildId: "child-only" }];
    const children = [child("child-only", "parent-a", "2026-01-01")];
    const service = new ChildService(createDatabase(parents, children));

    await service.softDeleteChild("user-a", "child-only");

    expect(parents[0].activeChildId).toBeNull();
  });
});
