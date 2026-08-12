import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

const models = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
);
const enums = new Map(
  Prisma.dmmf.datamodel.enums.map((schemaEnum) => [schemaEnum.name, schemaEnum]),
);
const migrationDir = path.resolve(
  __dirname,
  "../../prisma/migrations/20260809120000_v2_2_tutoring",
);
const migration = fs.readFileSync(path.join(migrationDir, "migration.sql"), "utf8");

function field(modelName: string, fieldName: string) {
  const model = models.get(modelName);
  expect(model, `${modelName} must exist`).toBeDefined();

  const schemaField = model?.fields.find((candidate) => candidate.name === fieldName);
  expect(schemaField, `${modelName}.${fieldName} must exist`).toBeDefined();
  return schemaField!;
}

describe("V2.2 Prisma schema contract", () => {
  it("contains tutoring configuration, conversation and quota ledgers", () => {
    expect([...models.keys()]).toEqual(
      expect.arrayContaining([
        "AgentConfig",
        "AgentPromptVersion",
        "AgentPromptTest",
        "TutorConversation",
        "TutorMessage",
        "MessageAttachment",
        "TutoringSummary",
        "TutorQuotaAccount",
        "TutorQuotaLedger",
      ]),
    );
  });

  it("defines the approved V2.2 enums", () => {
    expect(enums.get("Subject")?.values.map((v) => v.name)).toEqual(
      expect.arrayContaining(["CHINESE", "MATH", "ENGLISH", "PHYSICS", "CHEMISTRY"]),
    );
    expect(enums.get("SchoolStage")?.values.map((v) => v.name)).toEqual(
      expect.arrayContaining(["PRIMARY", "MIDDLE", "HIGH"]),
    );
    expect(enums.get("AgentStatus")?.values.map((v) => v.name)).toEqual(
      expect.arrayContaining(["ENABLED", "DISABLED"]),
    );
    expect(enums.get("PromptStatus")?.values.map((v) => v.name)).toEqual(
      expect.arrayContaining(["DRAFT", "TESTING", "TESTED", "PUBLISHED", "SUPERSEDED"]),
    );
    expect(enums.get("ConversationStatus")?.values.map((v) => v.name)).toEqual(
      expect.arrayContaining(["ACTIVE", "ARCHIVED"]),
    );
    expect(enums.get("TutorMessageRole")?.values.map((v) => v.name)).toEqual(
      expect.arrayContaining(["USER", "ASSISTANT"]),
    );
    expect(enums.get("MessageGenerationStatus")?.values.map((v) => v.name)).toEqual(
      expect.arrayContaining([
        "PENDING",
        "COMPLETE",
        "PARTIAL",
        "INTERRUPTED",
        "FAILED",
        "CANCELLED",
      ]),
    );
    expect(enums.get("QuotaLedgerKind")?.values.map((v) => v.name)).toEqual(
      expect.arrayContaining(["RESERVE", "SETTLE", "RELEASE", "ADJUSTMENT"]),
    );
  });

  it("extends V2.1 enums with V2.2 values", () => {
    expect(enums.get("FilePurpose")?.values.map((v) => v.name)).toContain("TUTOR_INPUT");
    expect(enums.get("EvidenceSource")?.values.map((v) => v.name)).toContain("AI_TUTOR_SUMMARY");
    expect(enums.get("AsyncJobType")?.values.map((v) => v.name)).toContain("TUTORING_SUMMARY");
    expect(enums.get("ModelUsagePurpose")?.values.map((v) => v.name)).toEqual(
      expect.arrayContaining(["AI_TUTORING", "PROMPT_TEST"]),
    );
    expect(enums.get("AuditEntityType")?.values.map((v) => v.name)).toEqual(
      expect.arrayContaining([
        "AGENT_CONFIG",
        "AGENT_PROMPT_VERSION",
        "TUTOR_CONVERSATION",
        "TUTOR_QUOTA_ACCOUNT",
      ]),
    );
  });

  it("binds agent config to a unique subject-stage slot with disabled default", () => {
    expect(field("AgentConfig", "subject")).toMatchObject({ type: "Subject" });
    expect(field("AgentConfig", "schoolStage")).toMatchObject({ type: "SchoolStage" });
    expect(field("AgentConfig", "status")).toMatchObject({ type: "AgentStatus" });
    expect(models.get("AgentConfig")?.uniqueFields).toContainEqual([
      "subject",
      "schoolStage",
    ]);
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "AgentConfig_subject_schoolStage_key"',
    );
    expect(migration).toContain("DEFAULT 'DISABLED'");
  });

  it("versions prompts with immutable sequence and checksum", () => {
    expect(field("AgentPromptVersion", "agentId")).toMatchObject({ type: "String" });
    expect(field("AgentPromptVersion", "sequence")).toMatchObject({ type: "Int" });
    expect(field("AgentPromptVersion", "content")).toMatchObject({ type: "String" });
    expect(field("AgentPromptVersion", "checksum")).toMatchObject({ type: "String" });
    expect(field("AgentPromptVersion", "status")).toMatchObject({ type: "PromptStatus" });
    expect(models.get("AgentPromptVersion")?.uniqueFields).toContainEqual([
      "agentId",
      "sequence",
    ]);
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "AgentPromptVersion_agentId_sequence_key"',
    );
  });

  it("links published prompt version to agent via composite foreign key", () => {
    expect(field("AgentConfig", "publishedPromptVersion")).toMatchObject({
      type: "AgentPromptVersion",
      relationFromFields: ["id", "publishedPromptVersionId"],
      relationToFields: ["agentId", "id"],
    });
    expect(migration).toContain(
      'FOREIGN KEY ("id", "publishedPromptVersionId") REFERENCES "AgentPromptVersion"("agentId", "id")',
    );
  });

  it("pins conversation prompt version via composite key to prevent drift", () => {
    expect(field("TutorConversation", "agentId")).toMatchObject({ type: "String" });
    expect(field("TutorConversation", "promptVersionId")).toMatchObject({ type: "String" });
    expect(field("TutorConversation", "promptVersion")).toMatchObject({
      type: "AgentPromptVersion",
      relationFromFields: ["agentId", "promptVersionId"],
      relationToFields: ["agentId", "id"],
    });
    expect(migration).toContain(
      'FOREIGN KEY ("agentId", "promptVersionId") REFERENCES "AgentPromptVersion"("agentId", "id")',
    );
  });

  it("deduplicates messages by clientMessageId and orders by sequence", () => {
    expect(field("TutorMessage", "clientMessageId")).toMatchObject({ type: "String" });
    expect(field("TutorMessage", "sequence")).toMatchObject({ type: "Int" });
    expect(field("TutorMessage", "generationStatus")).toMatchObject({
      type: "MessageGenerationStatus",
    });
    expect(models.get("TutorMessage")?.uniqueFields).toContainEqual([
      "conversationId",
      "clientMessageId",
    ]);
    expect(models.get("TutorMessage")?.uniqueFields).toContainEqual([
      "conversationId",
      "sequence",
    ]);
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "TutorMessage_conversationId_clientMessageId_key"',
    );
  });

  it("references file objects in attachments without storing signed URLs", () => {
    expect(field("MessageAttachment", "fileObjectId")).toMatchObject({ type: "String" });
    expect(field("MessageAttachment", "ordinal")).toMatchObject({ type: "Int" });
    expect(models.get("MessageAttachment")?.uniqueFields).toContainEqual([
      "messageId",
      "ordinal",
    ]);
  });

  it("keeps a one-to-one link between summary and evidence", () => {
    expect(field("TutoringSummary", "evidenceId")).toMatchObject({
      type: "String",
      isRequired: false,
      isUnique: true,
    });
    expect(field("TutoringSummary", "evidence")).toMatchObject({
      type: "LearningEvidence",
      relationFromFields: ["childId", "evidenceId"],
      relationToFields: ["childId", "id"],
    });
    expect(migration).toContain(
      'FOREIGN KEY ("childId", "evidenceId") REFERENCES "LearningEvidence"("childId", "id")',
    );
  });

  it("maintains a family-shared quota account with optimistic lock version", () => {
    expect(field("TutorQuotaAccount", "parentProfileId")).toMatchObject({
      type: "String",
      isUnique: true,
    });
    expect(field("TutorQuotaAccount", "availablePoints")).toMatchObject({ type: "BigInt" });
    expect(field("TutorQuotaAccount", "reservedPoints")).toMatchObject({ type: "BigInt" });
    expect(field("TutorQuotaAccount", "version")).toMatchObject({ type: "Int" });
  });

  it("enforces idempotent ledger entries via unique operationKey", () => {
    expect(field("TutorQuotaLedger", "operationKey")).toMatchObject({
      type: "String",
      isUnique: true,
    });
    expect(field("TutorQuotaLedger", "kind")).toMatchObject({ type: "QuotaLedgerKind" });
    expect(field("TutorQuotaLedger", "points")).toMatchObject({ type: "BigInt" });
    expect(field("TutorQuotaLedger", "balanceAfter")).toMatchObject({ type: "BigInt" });
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "TutorQuotaLedger_operationKey_key"',
    );
  });

  it("creates all V2.2 tables in the migration", () => {
    for (const table of [
      "AgentConfig",
      "AgentPromptVersion",
      "AgentPromptTest",
      "TutorConversation",
      "TutorMessage",
      "MessageAttachment",
      "TutoringSummary",
      "TutorQuotaAccount",
      "TutorQuotaLedger",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
  });
});
