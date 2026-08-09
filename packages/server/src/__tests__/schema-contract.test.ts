import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

const models = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
);

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

  it("keeps private files, jobs, notifications, audit, and model usage relational", () => {
    expect(field("FileObject", "ownerUserId")).toMatchObject({ type: "String" });
    expect(field("AsyncJob", "requestedByUserId")).toMatchObject({ type: "String", isRequired: false });
    expect(field("Notification", "userId")).toMatchObject({ type: "String" });
    expect(field("AuditLog", "actorUserId")).toMatchObject({ type: "String", isRequired: false });
    expect(field("ModelUsageLedger", "modelConfigId")).toMatchObject({ type: "String" });
  });

  it("connects assessment execution, evidence, immutable profile versions, and reports", () => {
    expect(field("AssessmentVersion", "assessmentDefinitionId")).toMatchObject({ type: "String" });
    expect(field("AssessmentRun", "assessmentVersionId")).toMatchObject({ type: "String" });
    expect(field("AssessmentRun", "childId")).toMatchObject({ type: "String" });
    expect(field("AssessmentArtifact", "fileObjectId")).toMatchObject({ type: "String" });
    expect(field("AssessmentResult", "assessmentRunId")).toMatchObject({ isUnique: true, type: "String" });
    expect(field("LearningEvidence", "childId")).toMatchObject({ type: "String" });
    expect(field("LearningProfile", "childId")).toMatchObject({ isUnique: true, type: "String" });
    expect(field("LearningProfileVersion", "learningProfileId")).toMatchObject({ type: "String" });
    expect(field("LearningReport", "learningProfileVersionId")).toMatchObject({ type: "String" });
    expect(field("ReportShare", "tokenHash")).toMatchObject({ isUnique: true, type: "String" });
  });
});
