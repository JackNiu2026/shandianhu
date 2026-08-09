import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";

const MAX_ACTIVE_CHILDREN = 5;

export type ChildRecord = {
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

export type ChildWorkspace = {
  activeChildId: string | null;
  children: ChildRecord[];
};

type ParentProfileRecord = {
  id: string;
  userId: string;
  activeChildId: string | null;
};

export type ChildInput = {
  displayName?: string;
  grade?: string | null;
  birthDate?: Date | null;
  schoolName?: string | null;
  learningGoals?: string[];
};

type TransactionClient = {
  parentProfile: {
    findUnique(args: { where: { userId: string } }): Promise<ParentProfileRecord | null>;
    update(args: {
      where: { id: string };
      data: { activeChildId: string | null };
    }): Promise<ParentProfileRecord>;
  };
  child: {
    count(args: { where: { parentProfileId: string; deletedAt: null } }): Promise<number>;
    create(args: {
      data: {
        parentProfileId: string;
        name: string;
        grade?: string | null;
        birthDate?: Date | null;
        schoolName?: string | null;
        learningGoals?: string[];
      };
    }): Promise<ChildRecord>;
    findUnique(args: { where: { id: string } }): Promise<ChildRecord | null>;
    findMany(args: {
      where: { parentProfileId: string; deletedAt: null };
      orderBy: { createdAt: "asc" | "desc" };
    }): Promise<ChildRecord[]>;
    update(args: {
      where: { id: string };
      data: Partial<Pick<ChildRecord, "name" | "grade" | "birthDate" | "schoolName" | "learningGoals" | "deletedAt">>;
    }): Promise<ChildRecord>;
  };
};

export interface ChildServiceDatabase {
  $transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

export class ChildService {
  constructor(private readonly database: ChildServiceDatabase = prisma as unknown as ChildServiceDatabase) {}

  async listChildren(userId: string): Promise<ChildRecord[]> {
    return (await this.getChildWorkspace(userId)).children;
  }

  async getChildWorkspace(userId: string): Promise<ChildWorkspace> {
    return this.database.$transaction(async (tx) => {
      const parent = await this.requireParent(tx, userId);
      const children = await tx.child.findMany({
          where: { parentProfileId: parent.id, deletedAt: null },
          orderBy: { createdAt: "asc" },
        });
      return { activeChildId: parent.activeChildId, children };
    });
  }

  async createChild(userId: string, input: ChildInput & { displayName: string }): Promise<ChildRecord> {
    const displayName = input.displayName.trim();
    if (!displayName) {
      throw new AppError("VALIDATION_ERROR", 400, "Child name is required");
    }

    return this.database.$transaction(async (tx) => {
      const parent = await this.requireParent(tx, userId);
      const activeChildCount = await tx.child.count({
        where: { parentProfileId: parent.id, deletedAt: null },
      });
      if (activeChildCount >= MAX_ACTIVE_CHILDREN) {
        throw new AppError("RESOURCE_CONFLICT", 409, "A family can have at most five active children");
      }

      const child = await tx.child.create({
        data: {
          parentProfileId: parent.id,
          name: displayName,
          grade: input.grade,
          birthDate: input.birthDate,
          schoolName: input.schoolName,
          learningGoals: input.learningGoals,
        },
      });

      if (!parent.activeChildId) {
        await tx.parentProfile.update({
          where: { id: parent.id },
          data: { activeChildId: child.id },
        });
      }

      return child;
    });
  }

  async updateChild(userId: string, childId: string, input: ChildInput): Promise<ChildRecord> {
    return this.database.$transaction(async (tx) => {
      const parent = await this.requireParent(tx, userId);
      const child = await this.requireOwnedChild(tx, parent.id, childId);
      const data = this.childUpdateData(input);

      if (Object.keys(data).length === 0) return child;
      return tx.child.update({ where: { id: child.id }, data });
    });
  }

  async setActiveChild(userId: string, childId: string): Promise<ChildRecord> {
    return this.database.$transaction(async (tx) => {
      const parent = await this.requireParent(tx, userId);
      const child = await this.requireOwnedChild(tx, parent.id, childId);
      await tx.parentProfile.update({
        where: { id: parent.id },
        data: { activeChildId: child.id },
      });
      return child;
    });
  }

  async softDeleteChild(userId: string, childId: string): Promise<void> {
    await this.database.$transaction(async (tx) => {
      const parent = await this.requireParent(tx, userId);
      const child = await this.requireOwnedChild(tx, parent.id, childId);
      await tx.child.update({ where: { id: child.id }, data: { deletedAt: new Date() } });

      if (parent.activeChildId === child.id) {
        const [replacement] = await tx.child.findMany({
          where: { parentProfileId: parent.id, deletedAt: null },
          orderBy: { createdAt: "desc" },
        });
        await tx.parentProfile.update({
          where: { id: parent.id },
          data: { activeChildId: replacement?.id ?? null },
        });
      }
    });
  }

  private async requireParent(tx: TransactionClient, userId: string): Promise<ParentProfileRecord> {
    const parent = await tx.parentProfile.findUnique({ where: { userId } });
    if (!parent) throw new AppError("NOT_FOUND", 404, "Parent profile not found");
    return parent;
  }

  private async requireOwnedChild(
    tx: TransactionClient,
    parentProfileId: string,
    childId: string,
  ): Promise<ChildRecord> {
    const child = await tx.child.findUnique({ where: { id: childId } });
    if (!child) throw new AppError("NOT_FOUND", 404, "Child not found");
    if (child.parentProfileId !== parentProfileId) {
      throw new AppError("FORBIDDEN", 403, "You cannot access this child");
    }
    if (child.deletedAt) throw new AppError("NOT_FOUND", 404, "Child not found");
    return child;
  }

  private childUpdateData(input: ChildInput): Partial<ChildRecord> {
    const data: Partial<ChildRecord> = {};
    if (input.displayName !== undefined) {
      const displayName = input.displayName.trim();
      if (!displayName) throw new AppError("VALIDATION_ERROR", 400, "Child name is required");
      data.name = displayName;
    }
    if (input.grade !== undefined) data.grade = input.grade;
    if (input.birthDate !== undefined) data.birthDate = input.birthDate;
    if (input.schoolName !== undefined) data.schoolName = input.schoolName;
    if (input.learningGoals !== undefined) data.learningGoals = input.learningGoals;
    return data;
  }
}
