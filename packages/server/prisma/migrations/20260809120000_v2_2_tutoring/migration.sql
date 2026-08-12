-- V2.2 智学系统：扩展枚举并新增智能体、会话、积分账本表

-- Extend existing enums with V2.2 values
ALTER TYPE "FilePurpose" ADD VALUE IF NOT EXISTS 'TUTOR_INPUT';
ALTER TYPE "AsyncJobType" ADD VALUE IF NOT EXISTS 'TUTORING_SUMMARY';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'AGENT_CONFIG';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'AGENT_PROMPT_VERSION';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TUTOR_CONVERSATION';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TUTOR_QUOTA_ACCOUNT';
ALTER TYPE "ModelUsagePurpose" ADD VALUE IF NOT EXISTS 'AI_TUTORING';
ALTER TYPE "ModelUsagePurpose" ADD VALUE IF NOT EXISTS 'PROMPT_TEST';
ALTER TYPE "EvidenceSource" ADD VALUE IF NOT EXISTS 'AI_TUTOR_SUMMARY';

-- New V2.2 enums
DO $$ BEGIN
    CREATE TYPE "Subject" AS ENUM ('CHINESE', 'MATH', 'ENGLISH', 'PHYSICS', 'CHEMISTRY');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "SchoolStage" AS ENUM ('PRIMARY', 'MIDDLE', 'HIGH');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "AgentStatus" AS ENUM ('ENABLED', 'DISABLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'TESTING', 'TESTED', 'PUBLISHED', 'SUPERSEDED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TutorMessageRole" AS ENUM ('USER', 'ASSISTANT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "MessageGenerationStatus" AS ENUM ('PENDING', 'COMPLETE', 'PARTIAL', 'INTERRUPTED', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "QuotaLedgerKind" AS ENUM ('RESERVE', 'SETTLE', 'RELEASE', 'ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AgentConfig
CREATE TABLE IF NOT EXISTS "AgentConfig" (
    "id" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "schoolStage" "SchoolStage" NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'DISABLED',
    "publishedPromptVersionId" TEXT,
    "primaryModelConfigId" TEXT,
    "fallbackModelConfigId" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 2048,
    "updatedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentConfig_subject_schoolStage_key" ON "AgentConfig"("subject", "schoolStage");

-- AgentPromptVersion
CREATE TABLE IF NOT EXISTS "AgentPromptVersion" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPromptVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentPromptVersion_agentId_sequence_key" ON "AgentPromptVersion"("agentId", "sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentPromptVersion_agentId_id_key" ON "AgentPromptVersion"("agentId", "id");

-- AgentPromptTest
CREATE TABLE IF NOT EXISTS "AgentPromptTest" (
    "id" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "modelUsageLedgerId" TEXT NOT NULL,
    "createdById" TEXT,
    "status" "PromptStatus" NOT NULL DEFAULT 'TESTING',
    "inputPreview" TEXT,
    "outputPreview" TEXT,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPromptTest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentPromptTest_modelUsageLedgerId_key" ON "AgentPromptTest"("modelUsageLedgerId");
CREATE INDEX IF NOT EXISTS "AgentPromptTest_promptVersionId_createdAt_idx" ON "AgentPromptTest"("promptVersionId", "createdAt");

-- TutorConversation
CREATE TABLE IF NOT EXISTS "TutorConversation" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorConversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TutorConversation_childId_lastActivityAt_idx" ON "TutorConversation"("childId", "lastActivityAt");
CREATE INDEX IF NOT EXISTS "TutorConversation_agentId_status_idx" ON "TutorConversation"("agentId", "status");

-- TutorMessage
CREATE TABLE IF NOT EXISTS "TutorMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "role" "TutorMessageRole" NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "generationStatus" "MessageGenerationStatus" NOT NULL DEFAULT 'COMPLETE',
    "modelCallId" TEXT,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TutorMessage_conversationId_clientMessageId_key" ON "TutorMessage"("conversationId", "clientMessageId");
CREATE UNIQUE INDEX IF NOT EXISTS "TutorMessage_conversationId_sequence_key" ON "TutorMessage"("conversationId", "sequence");
CREATE INDEX IF NOT EXISTS "TutorMessage_conversationId_createdAt_idx" ON "TutorMessage"("conversationId", "createdAt");

-- MessageAttachment
CREATE TABLE IF NOT EXISTS "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileObjectId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageAttachment_messageId_ordinal_key" ON "MessageAttachment"("messageId", "ordinal");
CREATE INDEX IF NOT EXISTS "MessageAttachment_fileObjectId_idx" ON "MessageAttachment"("fileObjectId");

-- TutoringSummary
CREATE TABLE IF NOT EXISTS "TutoringSummary" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    "modelCallId" TEXT,
    "evidenceId" TEXT,
    "asyncJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutoringSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TutoringSummary_conversationId_version_key" ON "TutoringSummary"("conversationId", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "TutoringSummary_evidenceId_key" ON "TutoringSummary"("evidenceId");
CREATE INDEX IF NOT EXISTS "TutoringSummary_childId_createdAt_idx" ON "TutoringSummary"("childId", "createdAt");

-- TutorQuotaAccount
CREATE TABLE IF NOT EXISTS "TutorQuotaAccount" (
    "id" TEXT NOT NULL,
    "parentProfileId" TEXT NOT NULL,
    "availablePoints" BIGINT NOT NULL DEFAULT 0,
    "reservedPoints" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorQuotaAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TutorQuotaAccount_parentProfileId_key" ON "TutorQuotaAccount"("parentProfileId");

-- TutorQuotaLedger
CREATE TABLE IF NOT EXISTS "TutorQuotaLedger" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "childId" TEXT,
    "modelCallId" TEXT,
    "kind" "QuotaLedgerKind" NOT NULL,
    "points" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "reservationId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorQuotaLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TutorQuotaLedger_operationKey_key" ON "TutorQuotaLedger"("operationKey");
CREATE INDEX IF NOT EXISTS "TutorQuotaLedger_accountId_createdAt_idx" ON "TutorQuotaLedger"("accountId", "createdAt");
CREATE INDEX IF NOT EXISTS "TutorQuotaLedger_childId_createdAt_idx" ON "TutorQuotaLedger"("childId", "createdAt");
CREATE INDEX IF NOT EXISTS "TutorQuotaLedger_reservationId_idx" ON "TutorQuotaLedger"("reservationId");

-- Foreign keys: AgentConfig
ALTER TABLE "AgentConfig"
    ADD CONSTRAINT "AgentConfig_publishedPromptVersionId_fkey"
    FOREIGN KEY ("id", "publishedPromptVersionId") REFERENCES "AgentPromptVersion"("agentId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentConfig"
    ADD CONSTRAINT "AgentConfig_primaryModelConfigId_fkey"
    FOREIGN KEY ("primaryModelConfigId") REFERENCES "ModelConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentConfig"
    ADD CONSTRAINT "AgentConfig_fallbackModelConfigId_fkey"
    FOREIGN KEY ("fallbackModelConfigId") REFERENCES "ModelConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentConfig"
    ADD CONSTRAINT "AgentConfig_updatedByAdminId_fkey"
    FOREIGN KEY ("updatedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: AgentPromptVersion
ALTER TABLE "AgentPromptVersion"
    ADD CONSTRAINT "AgentPromptVersion_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "AgentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPromptVersion"
    ADD CONSTRAINT "AgentPromptVersion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentPromptVersion"
    ADD CONSTRAINT "AgentPromptVersion_supersedesId_fkey"
    FOREIGN KEY ("agentId", "supersedesId") REFERENCES "AgentPromptVersion"("agentId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: AgentPromptTest
ALTER TABLE "AgentPromptTest"
    ADD CONSTRAINT "AgentPromptTest_promptVersionId_fkey"
    FOREIGN KEY ("promptVersionId") REFERENCES "AgentPromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPromptTest"
    ADD CONSTRAINT "AgentPromptTest_modelUsageLedgerId_fkey"
    FOREIGN KEY ("modelUsageLedgerId") REFERENCES "ModelUsageLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentPromptTest"
    ADD CONSTRAINT "AgentPromptTest_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: TutorConversation
ALTER TABLE "TutorConversation"
    ADD CONSTRAINT "TutorConversation_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutorConversation"
    ADD CONSTRAINT "TutorConversation_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "AgentConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TutorConversation"
    ADD CONSTRAINT "TutorConversation_promptVersionId_fkey"
    FOREIGN KEY ("agentId", "promptVersionId") REFERENCES "AgentPromptVersion"("agentId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: TutorMessage
ALTER TABLE "TutorMessage"
    ADD CONSTRAINT "TutorMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "TutorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: MessageAttachment
ALTER TABLE "MessageAttachment"
    ADD CONSTRAINT "MessageAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "TutorMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageAttachment"
    ADD CONSTRAINT "MessageAttachment_fileObjectId_fkey"
    FOREIGN KEY ("fileObjectId") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: TutoringSummary
ALTER TABLE "TutoringSummary"
    ADD CONSTRAINT "TutoringSummary_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "TutorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutoringSummary"
    ADD CONSTRAINT "TutoringSummary_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutoringSummary"
    ADD CONSTRAINT "TutoringSummary_modelCallId_fkey"
    FOREIGN KEY ("modelCallId") REFERENCES "ModelUsageLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TutoringSummary"
    ADD CONSTRAINT "TutoringSummary_evidenceId_fkey"
    FOREIGN KEY ("childId", "evidenceId") REFERENCES "LearningEvidence"("childId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TutoringSummary"
    ADD CONSTRAINT "TutoringSummary_asyncJobId_fkey"
    FOREIGN KEY ("asyncJobId") REFERENCES "AsyncJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: TutorQuotaAccount
ALTER TABLE "TutorQuotaAccount"
    ADD CONSTRAINT "TutorQuotaAccount_parentProfileId_fkey"
    FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: TutorQuotaLedger
ALTER TABLE "TutorQuotaLedger"
    ADD CONSTRAINT "TutorQuotaLedger_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "TutorQuotaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutorQuotaLedger"
    ADD CONSTRAINT "TutorQuotaLedger_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;
