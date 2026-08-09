import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

const models = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
);
const migration = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../prisma/migrations/20260809090000_v2_baseline/migration.sql",
  ),
  "utf8",
);
const seed = fs.readFileSync(path.resolve(__dirname, "../../prisma/seed.mjs"), "utf8");

function field(modelName: string, fieldName: string) {
  const model = models.get(modelName);
  expect(model, `${modelName} must exist`).toBeDefined();

  const schemaField = model?.fields.find((candidate) => candidate.name === fieldName);
  expect(schemaField, `${modelName}.${fieldName} must exist`).toBeDefined();
  return schemaField!;
}

describe("V2.1 Prisma schema contract", () => {
  it("contains the complete V2.1 learning foundation model set", () => {
    expect([...models.keys()]).toEqual(
      expect.arrayContaining([
        "User",
        "ParentProfile",
        "Child",
        "AuthSession",
        "AdminUser",
        "AdminSession",
        "FileObject",
        "AsyncJob",
        "Notification",
        "AuditLog",
        "ModelConfig",
        "ModelUsageLedger",
        "AssessmentDefinition",
        "AssessmentVersion",
        "AssessmentRun",
        "AssessmentArtifact",
        "AssessmentResult",
        "LearningEvidence",
        "LearningProfile",
        "LearningProfileVersion",
        "LearningProfileVersionEvidence",
        "LearningReport",
        "ReportShare",
      ]),
    );
  });

  it("models WeChat parents, children, and opaque sessions with typed relations", () => {
    expect(field("User", "wechatOpenId")).toMatchObject({ isUnique: true, type: "String" });
    expect(field("ParentProfile", "userId")).toMatchObject({ isUnique: true, type: "String" });
    expect(field("ParentProfile", "activeChildId")).toMatchObject({ type: "String", isRequired: false });
    expect(field("Child", "parentProfileId")).toMatchObject({ type: "String" });
    expect(field("AuthSession", "userId")).toMatchObject({ type: "String" });
    expect(field("AuthSession", "tokenHash")).toMatchObject({ isUnique: true, type: "String" });
    expect(field("AdminSession", "adminUserId")).toMatchObject({ type: "String" });
    expect(field("AdminSession", "tokenHash")).toMatchObject({ isUnique: true, type: "String" });
  });

  it("enforces active-child ownership with a composite relation and foreign key", () => {
    expect(field("ParentProfile", "activeChild")).toMatchObject({
      type: "Child",
      relationFromFields: ["id", "activeChildId"],
      relationToFields: ["parentProfileId", "id"],
    });
    expect(models.get("Child")?.uniqueFields).toContainEqual([
      "parentProfileId",
      "id",
    ]);
    expect(migration).toContain(
      'FOREIGN KEY ("id", "activeChildId") REFERENCES "Child"("parentProfileId", "id")',
    );
  });

  it("keeps private files, jobs, notifications, audit, and model usage relational", () => {
    expect(field("FileObject", "ownerUserId")).toMatchObject({ type: "String" });
    expect(field("FileObject", "parentProfileId")).toMatchObject({
      type: "String",
      isRequired: false,
    });
    expect(field("FileObject", "childId")).toMatchObject({ type: "String", isRequired: false });
    expect(field("FileObject", "purpose")).toMatchObject({ type: "FilePurpose" });
    expect(field("FileObject", "status")).toMatchObject({ type: "FileStatus" });
    expect(field("FileObject", "deletedAt")).toMatchObject({ type: "DateTime", isRequired: false });
    expect(field("FileObject", "revokedAt")).toMatchObject({ type: "DateTime", isRequired: false });
    expect(field("FileObject", "child")).toMatchObject({
      type: "Child",
      relationFromFields: ["parentProfileId", "childId"],
      relationToFields: ["parentProfileId", "id"],
    });
    expect(field("AsyncJob", "requestedByUserId")).toMatchObject({ type: "String", isRequired: false });
    expect(field("AsyncJob", "dedupeKey")).toMatchObject({ isUnique: true, type: "String" });
    expect(field("AsyncJob", "attempt")).toMatchObject({ type: "Int" });
    expect(field("AsyncJob", "maxAttempts")).toMatchObject({ type: "Int" });
    expect(field("AsyncJob", "retryAt")).toMatchObject({ type: "DateTime", isRequired: false });
    expect(field("Notification", "userId")).toMatchObject({ type: "String" });
    expect(field("AuditLog", "actorUserId")).toMatchObject({ type: "String", isRequired: false });
    expect(field("ModelUsageLedger", "modelConfigId")).toMatchObject({ type: "String" });
  });

  it("connects assessment execution, evidence, immutable profile versions, and reports", () => {
    expect(field("AssessmentVersion", "assessmentDefinitionId")).toMatchObject({ type: "String" });
    expect(field("AssessmentRun", "assessmentVersionId")).toMatchObject({ type: "String" });
    expect(field("AssessmentRun", "childId")).toMatchObject({ type: "String" });
    expect(field("AssessmentRun", "idempotencyKey")).toMatchObject({ type: "String" });
    expect(models.get("AssessmentRun")?.uniqueFields).toContainEqual([
      "childId",
      "idempotencyKey",
    ]);
    expect(field("AssessmentArtifact", "fileObjectId")).toMatchObject({ type: "String" });
    expect(field("AssessmentResult", "assessmentRunId")).toMatchObject({ isUnique: true, type: "String" });
    expect(field("LearningEvidence", "childId")).toMatchObject({ type: "String" });
    expect(field("LearningEvidence", "sourceId")).toMatchObject({ type: "String" });
    expect(field("LearningEvidence", "revokedAt")).toMatchObject({
      type: "DateTime",
      isRequired: false,
    });
    expect(models.get("LearningEvidence")?.uniqueFields).toContainEqual([
      "childId",
      "source",
      "sourceId",
    ]);
    expect(field("LearningEvidence", "assessmentRun")).toMatchObject({
      type: "AssessmentRun",
      relationFromFields: ["childId", "assessmentRunId"],
      relationToFields: ["childId", "id"],
    });
    expect(models.get("LearningEvidence")?.uniqueFields).toContainEqual([
      "childId",
      "id",
    ]);
    expect(field("LearningProfile", "childId")).toMatchObject({ isUnique: true, type: "String" });
    expect(field("LearningProfileVersion", "learningProfileId")).toMatchObject({ type: "String" });
    expect(field("LearningProfile", "currentVersion")).toMatchObject({
      type: "LearningProfileVersion",
      relationFromFields: ["id", "currentVersionId"],
      relationToFields: ["learningProfileId", "id"],
    });
    expect(models.get("LearningProfileVersion")?.uniqueFields).toContainEqual([
      "learningProfileId",
      "id",
    ]);
    expect(field("LearningProfileVersionEvidence", "learningProfileVersion")).toMatchObject({
      type: "LearningProfileVersion",
      relationFromFields: ["learningProfileId", "learningProfileVersionId"],
      relationToFields: ["learningProfileId", "id"],
    });
    expect(field("LearningProfileVersionEvidence", "learningEvidence")).toMatchObject({
      type: "LearningEvidence",
      relationFromFields: ["childId", "learningEvidenceId"],
      relationToFields: ["childId", "id"],
    });
    expect(field("LearningProfileVersionEvidence", "learningProfile")).toMatchObject({
      type: "LearningProfile",
      relationFromFields: ["childId", "learningProfileId"],
      relationToFields: ["childId", "id"],
    });
    expect(field("LearningReport", "learningProfileId")).toMatchObject({ type: "String" });
    expect(field("LearningReport", "childId")).toMatchObject({ type: "String" });
    expect(field("LearningReport", "sequence")).toMatchObject({ type: "Int" });
    expect(models.get("LearningReport")?.uniqueFields).toContainEqual([
      "childId",
      "sequence",
    ]);
    expect(field("LearningReport", "learningProfile")).toMatchObject({
      type: "LearningProfile",
      relationFromFields: ["childId", "learningProfileId"],
      relationToFields: ["childId", "id"],
    });
    expect(field("LearningReport", "learningProfileVersion")).toMatchObject({
      type: "LearningProfileVersion",
      relationFromFields: ["learningProfileId", "learningProfileVersionId"],
      relationToFields: ["learningProfileId", "id"],
    });
    expect(migration).toContain(
      'FOREIGN KEY ("id", "currentVersionId") REFERENCES "LearningProfileVersion"("learningProfileId", "id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("learningProfileId", "learningProfileVersionId") REFERENCES "LearningProfileVersion"("learningProfileId", "id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("childId", "learningProfileId") REFERENCES "LearningProfile"("childId", "id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("childId", "assessmentRunId") REFERENCES "AssessmentRun"("childId", "id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("childId", "learningEvidenceId") REFERENCES "LearningEvidence"("childId", "id")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "LearningEvidence_assessment_source_key" ON "LearningEvidence"("source", "sourceId") WHERE "source" = \'ASSESSMENT\'',
    );
    expect(migration).toContain(
      'CONSTRAINT "FileObject_child_requires_parent_profile_check" CHECK ("childId" IS NULL OR "parentProfileId" IS NOT NULL)',
    );
    expect(migration).toContain('CREATE TRIGGER "LearningProfileVersion_immutable"');
    expect(migration).toContain('current_setting(\'app.allow_learning_profile_version_purge\', true)');
    expect(field("ReportShare", "tokenHash")).toMatchObject({ isUnique: true, type: "String" });
  });

  it("supports child soft deletion without deleting their learning history", () => {
    expect(field("Child", "deletedAt")).toMatchObject({
      type: "DateTime",
      isRequired: false,
    });
    expect(migration).toContain(
      'CREATE INDEX "Child_parentProfileId_deletedAt_idx" ON "Child"("parentProfileId", "deletedAt")',
    );
  });

  it("enforces child ownership for uploaded artifacts and report PDFs", () => {
    expect(models.get("FileObject")?.uniqueFields).toContainEqual(["childId", "id"]);
    expect(field("AssessmentArtifact", "childId")).toMatchObject({ type: "String" });
    expect(field("AssessmentArtifact", "assessmentRun")).toMatchObject({
      relationFromFields: ["childId", "assessmentRunId"],
      relationToFields: ["childId", "id"],
    });
    expect(field("AssessmentArtifact", "fileObject")).toMatchObject({
      relationFromFields: ["childId", "fileObjectId"],
      relationToFields: ["childId", "id"],
    });
    expect(field("LearningReport", "fileObject")).toMatchObject({
      relationFromFields: ["childId", "fileObjectId"],
      relationToFields: ["childId", "id"],
    });
    expect(migration).toContain(
      'FOREIGN KEY ("childId", "fileObjectId") REFERENCES "FileObject"("childId", "id")',
    );
  });

  it("keeps notification routing and ownership as queryable data", () => {
    expect(field("Notification", "parentProfileId")).toMatchObject({
      type: "String",
      isRequired: false,
    });
    expect(field("Notification", "childId")).toMatchObject({ type: "String", isRequired: false });
    expect(field("Notification", "dedupeKey")).toMatchObject({ isUnique: true, type: "String" });
    expect(field("Notification", "targetRoute")).toMatchObject({ type: "String", isRequired: false });
    expect(field("Notification", "targetParams")).toMatchObject({ type: "Json", isRequired: false });
    expect(field("Notification", "child")).toMatchObject({
      relationFromFields: ["parentProfileId", "childId"],
      relationToFields: ["parentProfileId", "id"],
    });
    expect(migration).toContain(
      'CONSTRAINT "Notification_child_requires_parent_profile_check" CHECK ("childId" IS NULL OR "parentProfileId" IS NOT NULL)',
    );
  });

  it("records audit actors and entities without an unbounded sensitive body", () => {
    expect(field("AuditLog", "actorKind")).toMatchObject({ type: "AuditActorKind" });
    expect(field("AuditLog", "actorId")).toMatchObject({ type: "String", isRequired: false });
    expect(field("AuditLog", "entityType")).toMatchObject({ type: "AuditEntityType" });
    expect(field("AuditLog", "entityId")).toMatchObject({ type: "String" });
    expect(field("AuditLog", "sanitizedDiff")).toMatchObject({ type: "Json", isRequired: false });
    expect(models.get("AuditLog")?.fields.find((candidate) => candidate.name === "metadata")).toBeUndefined();
    expect(migration).toContain('CREATE INDEX "AuditLog_actorKind_actorId_createdAt_idx"');
    expect(migration).toContain('CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx"');
  });

  it("uses typed, disabled-by-default model gateway configuration and usage telemetry", () => {
    for (const name of [
      "endpointUrl",
      "apiKeyCiphertext",
      "apiKeyIv",
      "apiKeyTag",
      "modelName",
      "capabilities",
      "timeoutMs",
      "maxOutputTokens",
      "temperature",
      "inputCostMicros",
      "outputCostMicros",
      "enabled",
    ]) {
      expect(field("ModelConfig", name)).toBeDefined();
    }
    expect(models.get("ModelConfig")?.fields.find((candidate) => candidate.name === "configuration")).toBeUndefined();
    expect(field("ModelUsageLedger", "callId")).toMatchObject({ isUnique: true, type: "String" });
    expect(field("ModelUsageLedger", "purpose")).toMatchObject({ type: "ModelUsagePurpose" });
    expect(field("ModelUsageLedger", "status")).toMatchObject({ type: "ModelUsageStatus" });
    expect(field("ModelUsageLedger", "imageCount")).toMatchObject({ type: "Int" });
    expect(field("ModelUsageLedger", "latencyMs")).toMatchObject({ type: "Int" });
    expect(field("ModelUsageLedger", "microCost")).toMatchObject({ type: "BigInt" });
    expect(field("ModelUsageLedger", "sanitizedError")).toMatchObject({ type: "String", isRequired: false });
    expect(seed).toContain("provider_modelName_capabilities");
    expect(seed).not.toContain("provider_model_capability:");
    expect(seed).toContain("enabled: false");
    expect(seed).toContain("placeholder-ciphertext");
  });

  it("versions artifacts and profile-generation provenance for safe revocation", () => {
    expect(field("AssessmentArtifact", "ordinal")).toMatchObject({ type: "Int" });
    expect(models.get("AssessmentArtifact")?.uniqueFields).toContainEqual([
      "assessmentRunId",
      "ordinal",
    ]);
    expect(field("LearningProfileVersion", "ruleVersion")).toMatchObject({ type: "String" });
    expect(field("LearningProfileVersion", "modelConfigId")).toMatchObject({
      type: "String",
      isRequired: false,
    });
    expect(field("LearningProfileVersion", "confidenceBasis")).toMatchObject({ type: "Json" });
    expect(field("LearningProfileVersion", "revokedAt")).toMatchObject({
      type: "DateTime",
      isRequired: false,
    });
    expect(field("LearningProfileVersion", "modelConfig")).toMatchObject({ type: "ModelConfig" });
    expect(migration).toContain("app.allow_learning_profile_version_revocation");
    expect(migration).toContain('OLD."revokedAt" IS NULL AND NEW."revokedAt" IS NOT NULL');
  });

  it("uses server-owned migration and seed commands in CI", () => {
    const ci = fs.readFileSync(
      path.resolve(__dirname, "../../../../.github/workflows/ci.yml"),
      "utf8",
    );

    expect(ci).toContain("pnpm --filter @lightning-tiger/server db:migrate");
    expect(ci).toContain("pnpm --filter @lightning-tiger/server db:seed");
    expect(ci).not.toContain("pnpm --filter admin exec prisma db push");
    expect(ci).not.toContain("pnpm --filter admin run db:seed");
  });

  it("keeps Prisma ownership in the server package and does not migrate at admin startup", () => {
    const adminPackage = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../../admin/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const dockerfile = fs.readFileSync(
      path.resolve(__dirname, "../../../admin/Dockerfile"),
      "utf8",
    );

    expect(adminPackage.scripts["db:push"]).toBeUndefined();
    expect(adminPackage.scripts["db:seed"]).toBeUndefined();
    expect(dockerfile).toContain("COPY packages/server/package.json ./packages/server/");
    expect(dockerfile).toContain("pnpm --filter @lightning-tiger/server prisma:generate");
    expect(dockerfile).toContain("/app/packages/server/prisma");
    expect(dockerfile).toContain(
      "/app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma",
    );
    expect(dockerfile).toContain(
      "/app/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma",
    );
    expect(dockerfile).toContain('CMD ["node", "packages/admin/server.js"]');
    expect(dockerfile).not.toContain("/app/node_modules/.prisma");
    expect(dockerfile).not.toContain("packages/admin/prisma");
    expect(dockerfile).not.toContain("prisma migrate deploy");
  });
});
