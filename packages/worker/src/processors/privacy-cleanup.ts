export interface PrivacyObjectStorage {
  remove(objectKey: string): Promise<void>;
}

type CleanupTransaction = {
  $executeRawUnsafe(query: string): Promise<unknown>;
  fileObject: { updateMany(args: { where: { childId: string }; data: { status: "DELETED"; deletedAt: Date; revokedAt: Date } }): Promise<unknown> };
  assessmentArtifact: { deleteMany(args: { where: { childId: string } }): Promise<unknown> };
  assessmentResult: { deleteMany(args: { where: { assessmentRun: { childId: string } } }): Promise<unknown> };
  assessmentRun: { deleteMany(args: { where: { childId: string } }): Promise<unknown> };
  learningEvidence: { deleteMany(args: { where: { childId: string } }): Promise<unknown> };
  learningProfile: {
    findMany(args: { where: { childId: string }; select: { id: true } }): Promise<Array<{ id: string }>>;
    update(args: { where: { id: string }; data: { currentVersionId: null } }): Promise<unknown>;
    deleteMany(args: { where: { childId: string } }): Promise<unknown>;
  };
  learningProfileVersionEvidence: { deleteMany(args: { where: { childId: string } }): Promise<unknown> };
  learningProfileVersion: { deleteMany(args: { where: { learningProfile: { childId: string } } }): Promise<unknown> };
  reportShare: { deleteMany(args: { where: { learningReport: { childId: string } } }): Promise<unknown> };
  learningReport: { deleteMany(args: { where: { childId: string } }): Promise<unknown> };
  child: { update(args: { where: { id: string }; data: { name: string; birthDate: null; schoolName: null; learningGoals: []; purgeAfter: null } }): Promise<unknown> };
  auditLog: {
    create(args: { data: { actorKind: "SYSTEM"; entityType: "CHILD"; entityId: string; action: "DELETE"; childId: string; sanitizedDiff: { purged: true } } }): Promise<unknown>;
  };
};

export interface PrivacyCleanupDatabase {
  child: {
    findMany(args: { where: { deletedAt: { not: null }; purgeAfter: { lte: Date } }; select: { id: true } }): Promise<Array<{ id: string }>>;
  };
  fileObject: {
    findMany(args: { where: { childId: string; status: { not: "DELETED" } }; select: { id: true; objectKey: true } }): Promise<Array<{ id: string; objectKey: string }>>;
  };
  $transaction<T>(callback: (transaction: CleanupTransaction) => Promise<T>): Promise<T>;
}

export class PrivacyCleanupProcessor {
  constructor(
    private readonly database: PrivacyCleanupDatabase,
    private readonly storage: PrivacyObjectStorage,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async run(): Promise<{ purgedChildren: number; removedFiles: number }> {
    const children = await this.database.child.findMany({
      where: { deletedAt: { not: null }, purgeAfter: { lte: this.clock() } },
      select: { id: true },
    });
    let removedFiles = 0;
    for (const child of children) {
      const files = await this.database.fileObject.findMany({
        where: { childId: child.id, status: { not: "DELETED" } },
        select: { id: true, objectKey: true },
      });
      for (const file of files) {
        await this.storage.remove(file.objectKey);
        removedFiles += 1;
      }
      await this.purgeChild(child.id);
    }
    return { purgedChildren: children.length, removedFiles };
  }

  private async purgeChild(childId: string): Promise<void> {
    const now = this.clock();
    await this.database.$transaction(async (transaction) => {
      await transaction.reportShare.deleteMany({ where: { learningReport: { childId } } });
      await transaction.learningReport.deleteMany({ where: { childId } });
      const profiles = await transaction.learningProfile.findMany({ where: { childId }, select: { id: true } });
      for (const profile of profiles) {
        await transaction.learningProfile.update({ where: { id: profile.id }, data: { currentVersionId: null } });
      }
      await transaction.$executeRawUnsafe("SELECT set_config('app.allow_learning_profile_version_purge', 'on', true)");
      await transaction.learningProfileVersionEvidence.deleteMany({ where: { childId } });
      await transaction.learningProfileVersion.deleteMany({ where: { learningProfile: { childId } } });
      await transaction.learningProfile.deleteMany({ where: { childId } });
      await transaction.learningEvidence.deleteMany({ where: { childId } });
      await transaction.assessmentResult.deleteMany({ where: { assessmentRun: { childId } } });
      await transaction.assessmentArtifact.deleteMany({ where: { childId } });
      await transaction.assessmentRun.deleteMany({ where: { childId } });
      await transaction.fileObject.updateMany({
        where: { childId },
        data: { status: "DELETED", deletedAt: now, revokedAt: now },
      });
      await transaction.child.update({
        where: { id: childId },
        data: { name: "已删除", birthDate: null, schoolName: null, learningGoals: [], purgeAfter: null },
      });
      await transaction.auditLog.create({
        data: {
          actorKind: "SYSTEM",
          entityType: "CHILD",
          entityId: childId,
          action: "DELETE",
          childId,
          sanitizedDiff: { purged: true },
        },
      });
    });
  }
}
