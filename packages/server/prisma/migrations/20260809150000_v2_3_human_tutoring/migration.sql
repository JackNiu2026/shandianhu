-- V2.3 真人家教闭环 Schema 迁移
-- 创建老师申请、资质、审核、公开资料、排期、试听、课程、反馈、评价和授权模型

-- 枚举类型
CREATE TYPE "TeacherApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFO', 'APPROVED', 'PAUSED', 'BANNED');
CREATE TYPE "QualificationType" AS ENUM ('IDENTITY', 'EDUCATION', 'TEACHING_CERT', 'SUBJECT_CERT', 'OTHER');
CREATE TYPE "QualificationReviewStatus" AS ENUM ('PENDING', 'PASS', 'FAIL');
CREATE TYPE "TeacherServiceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'BANNED');
CREATE TYPE "TeachingMode" AS ENUM ('ONLINE', 'IN_HOME', 'IN_CENTER');
CREATE TYPE "ScheduleSourceType" AS ENUM ('TRIAL', 'LESSON', 'BLOCKED');
CREATE TYPE "AvailabilityExceptionType" AS ENUM ('AVAILABLE', 'UNAVAILABLE');
CREATE TYPE "TrialBookingStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'RESCHEDULE_PROPOSED', 'REJECTED', 'PARENT_CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED');
CREATE TYPE "LessonStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "DataGrantScope" AS ENUM ('BASIC_PROFILE', 'LEARNING_NEEDS');
CREATE TYPE "FeedbackPerformance" AS ENUM ('STRONG', 'STEADY', 'NEEDS_SUPPORT');

-- 扩展现有枚举
ALTER TYPE "FilePurpose" ADD VALUE IF NOT EXISTS 'TEACHER_QUALIFICATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRIAL_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRIAL_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRIAL_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRIAL_RESCHEDULE_PROPOSED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRIAL_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRIAL_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRIAL_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LESSON_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LESSON_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FEEDBACK_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REVIEW_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEACHER_AUDIT_UPDATE';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TEACHER_APPLICATION';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TEACHER_PROFILE';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TRIAL_BOOKING';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'LESSON';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'DATA_GRANT';

-- ParentProfile 增加 serviceAreaCode
ALTER TABLE "ParentProfile" ADD COLUMN IF NOT EXISTS "serviceAreaCode" TEXT;

-- btree_gist 扩展（用于排他约束）
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 老师申请
CREATE TABLE "TeacherApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TeacherApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "legalName" TEXT NOT NULL,
    "education" TEXT,
    "experienceYears" INTEGER,
    "pricePerHour" INTEGER,
    "bio" TEXT,
    "teachingModes" "TeachingMode"[] DEFAULT ARRAY[]::"TeachingMode"[],
    "serviceAreaCode" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeacherApplication_userId_status_idx" ON "TeacherApplication"("userId", "status");
CREATE INDEX "TeacherApplication_status_updatedAt_idx" ON "TeacherApplication"("status", "updatedAt");

-- 老师资质
CREATE TABLE "TeacherQualification" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "QualificationType" NOT NULL,
    "fileObjectId" TEXT NOT NULL,
    "reviewStatus" "QualificationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherQualification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherQualification_applicationId_type_fileObjectId_key" UNIQUE ("applicationId", "type", "fileObjectId")
);
CREATE INDEX "TeacherQualification_applicationId_reviewStatus_idx" ON "TeacherQualification"("applicationId", "reviewStatus");

-- 老师审核记录
CREATE TABLE "TeacherAuditRecord" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "actorAdminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAuditRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeacherAuditRecord_applicationId_createdAt_idx" ON "TeacherAuditRecord"("applicationId", "createdAt");

-- 老师公开资料
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "subjects" "Subject"[] DEFAULT ARRAY[]::"Subject"[],
    "schoolStages" "SchoolStage"[] DEFAULT ARRAY[]::"SchoolStage"[],
    "teachingModes" "TeachingMode"[] DEFAULT ARRAY[]::"TeachingMode"[],
    "serviceAreaCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "teachingTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceYears" INTEGER NOT NULL,
    "pricePerHour" INTEGER NOT NULL,
    "serviceStatus" "TeacherServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherProfile_userId_key" UNIQUE ("userId"),
    CONSTRAINT "TeacherProfile_applicationId_key" UNIQUE ("applicationId")
);
CREATE INDEX "TeacherProfile_serviceStatus_idx" ON "TeacherProfile"("serviceStatus");

-- 排期规则
CREATE TABLE "TeacherAvailabilityRule" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherAvailabilityRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAvailabilityRule_teacherProfileId_weekday_startMin_endMin_key" UNIQUE ("teacherProfileId", "weekday", "startMinute", "endMinute")
);
CREATE INDEX "TeacherAvailabilityRule_teacherProfileId_weekday_idx" ON "TeacherAvailabilityRule"("teacherProfileId", "weekday");

-- 排期例外
CREATE TABLE "TeacherAvailabilityException" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "AvailabilityExceptionType" NOT NULL,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAvailabilityException_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAvailabilityException_teacherProfileId_date_key" UNIQUE ("teacherProfileId", "date")
);
CREATE INDEX "TeacherAvailabilityException_teacherProfileId_date_idx" ON "TeacherAvailabilityException"("teacherProfileId", "date");

-- 统一日程占位（带排他约束）
CREATE TABLE "ScheduleReservation" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "sourceType" "ScheduleSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduleReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScheduleReservation_sourceType_sourceId_key" UNIQUE ("sourceType", "sourceId")
);
CREATE INDEX "ScheduleReservation_teacherProfileId_startsAt_endsAt_idx" ON "ScheduleReservation"("teacherProfileId", "startsAt", "endsAt");
-- 排他约束：同一老师同一时段不可重叠（仅 active=true 的记录）
ALTER TABLE "ScheduleReservation" ADD CONSTRAINT "ScheduleReservation_no_overlap"
  EXCLUDE USING gist (
    "teacherProfileId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("active" = true);

-- 试听预约
CREATE TABLE "TrialBooking" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "parentProfileId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "TrialBookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "mode" "TeachingMode",
    "parentNote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrialBooking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TrialBooking_parentProfileId_idempotencyKey_key" UNIQUE ("parentProfileId", "idempotencyKey")
);
CREATE INDEX "TrialBooking_teacherProfileId_startsAt_endsAt_idx" ON "TrialBooking"("teacherProfileId", "startsAt", "endsAt");
CREATE INDEX "TrialBooking_parentProfileId_status_idx" ON "TrialBooking"("parentProfileId", "status");
CREATE INDEX "TrialBooking_childId_startsAt_idx" ON "TrialBooking"("childId", "startsAt");

-- 预约变更历史
CREATE TABLE "BookingChange" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "TrialBookingStatus" NOT NULL,
    "toStatus" "TrialBookingStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "proposedStartsAt" TIMESTAMP(3),
    "proposedEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingChange_bookingId_createdAt_idx" ON "BookingChange"("bookingId", "createdAt");

-- 课程
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "trialBookingId" TEXT,
    "childId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'SCHEDULED',
    "mode" "TeachingMode",
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Lesson_trialBookingId_key" UNIQUE ("trialBookingId")
);
CREATE INDEX "Lesson_teacherProfileId_startsAt_endsAt_idx" ON "Lesson"("teacherProfileId", "startsAt", "endsAt");
CREATE INDEX "Lesson_childId_startsAt_idx" ON "Lesson"("childId", "startsAt");
CREATE INDEX "Lesson_status_idx" ON "Lesson"("status");

-- 老师反馈
CREATE TABLE "TeacherFeedback" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lessonContent" JSONB NOT NULL,
    "performance" "FeedbackPerformance" NOT NULL,
    "difficulties" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "privateTeacherNote" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "supersedesId" TEXT,
    "createdByTeacherProfileId" TEXT NOT NULL,
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherFeedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherFeedback_lessonId_sequence_key" UNIQUE ("lessonId", "sequence")
);
CREATE INDEX "TeacherFeedback_lessonId_isCurrent_idx" ON "TeacherFeedback"("lessonId", "isCurrent");
CREATE INDEX "TeacherFeedback_createdByTeacherProfileId_idx" ON "TeacherFeedback"("createdByTeacherProfileId");
-- 部分唯一索引：每个 lesson 只有一个 current 版本
CREATE UNIQUE INDEX "TeacherFeedback_one_current_per_lesson" ON "TeacherFeedback" ("lessonId") WHERE "isCurrent" = true;

-- 家长评价
CREATE TABLE "ParentReview" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "parentProfileId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "authorDisplayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParentReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ParentReview_lessonId_key" UNIQUE ("lessonId"),
    CONSTRAINT "ParentReview_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);
CREATE INDEX "ParentReview_teacherProfileId_createdAt_idx" ON "ParentReview"("teacherProfileId", "createdAt");
CREATE INDEX "ParentReview_parentProfileId_createdAt_idx" ON "ParentReview"("parentProfileId", "createdAt");

-- 数据授权
CREATE TABLE "DataGrant" (
    "id" TEXT NOT NULL,
    "parentProfileId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "scopes" "DataGrantScope"[] DEFAULT ARRAY[]::"DataGrantScope"[],
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "sourceBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataGrant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataGrant_teacherProfileId_childId_revokedAt_idx" ON "DataGrant"("teacherProfileId", "childId", "revokedAt");
CREATE INDEX "DataGrant_parentProfileId_childId_idx" ON "DataGrant"("parentProfileId", "childId");

-- 外键约束
ALTER TABLE "TeacherApplication" ADD CONSTRAINT "TeacherApplication_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "TeacherQualification" ADD CONSTRAINT "TeacherQualification_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "TeacherApplication"("id") ON DELETE CASCADE;
ALTER TABLE "TeacherQualification" ADD CONSTRAINT "TeacherQualification_fileObjectId_fkey"
  FOREIGN KEY ("fileObjectId") REFERENCES "FileObject"("id") ON DELETE RESTRICT;
ALTER TABLE "TeacherAuditRecord" ADD CONSTRAINT "TeacherAuditRecord_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "TeacherApplication"("id") ON DELETE CASCADE;
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "TeacherApplication"("id") ON DELETE RESTRICT;
ALTER TABLE "TeacherAvailabilityRule" ADD CONSTRAINT "TeacherAvailabilityRule_teacherProfileId_fkey"
  FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE;
ALTER TABLE "TeacherAvailabilityException" ADD CONSTRAINT "TeacherAvailabilityException_teacherProfileId_fkey"
  FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE;
ALTER TABLE "ScheduleReservation" ADD CONSTRAINT "ScheduleReservation_teacherProfileId_fkey"
  FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE;
ALTER TABLE "TrialBooking" ADD CONSTRAINT "TrialBooking_parentProfileId_fkey"
  FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE;
ALTER TABLE "TrialBooking" ADD CONSTRAINT "TrialBooking_teacherProfileId_fkey"
  FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT;
ALTER TABLE "TrialBooking" ADD CONSTRAINT "TrialBooking_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE;
ALTER TABLE "BookingChange" ADD CONSTRAINT "BookingChange_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "TrialBooking"("id") ON DELETE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_trialBookingId_fkey"
  FOREIGN KEY ("trialBookingId") REFERENCES "TrialBooking"("id") ON DELETE SET NULL;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_teacherProfileId_fkey"
  FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT;
ALTER TABLE "TeacherFeedback" ADD CONSTRAINT "TeacherFeedback_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE;
ALTER TABLE "TeacherFeedback" ADD CONSTRAINT "TeacherFeedback_supersedesId_fkey"
  FOREIGN KEY ("supersedesId") REFERENCES "TeacherFeedback"("id") ON DELETE SET NULL;
ALTER TABLE "ParentReview" ADD CONSTRAINT "ParentReview_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE;
ALTER TABLE "ParentReview" ADD CONSTRAINT "ParentReview_parentProfileId_fkey"
  FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE;
ALTER TABLE "ParentReview" ADD CONSTRAINT "ParentReview_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE;
ALTER TABLE "ParentReview" ADD CONSTRAINT "ParentReview_teacherProfileId_fkey"
  FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE;
ALTER TABLE "DataGrant" ADD CONSTRAINT "DataGrant_parentProfileId_fkey"
  FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE;
ALTER TABLE "DataGrant" ADD CONSTRAINT "DataGrant_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE;
ALTER TABLE "DataGrant" ADD CONSTRAINT "DataGrant_teacherProfileId_fkey"
  FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE;
