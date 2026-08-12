import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

describe("V2.3 human tutoring schema contract", () => {
  it("contains the human tutor closed-loop models", () => {
    const names = Prisma.dmmf.datamodel.models.map((m) => m.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "TeacherApplication", "TeacherQualification", "TeacherAuditRecord", "TeacherProfile",
        "TeacherAvailabilityRule", "TeacherAvailabilityException", "ScheduleReservation",
        "TrialBooking", "BookingChange",
        "Lesson", "TeacherFeedback", "ParentReview", "DataGrant",
      ]),
    );
  });

  it("defines the V2.3 enums", () => {
    const enums = Prisma.dmmf.datamodel.enums.map((e) => e.name);
    expect(enums).toEqual(
      expect.arrayContaining([
        "TeacherApplicationStatus", "QualificationType", "QualificationReviewStatus",
        "TeacherServiceStatus", "TeachingMode", "ScheduleSourceType",
        "AvailabilityExceptionType", "TrialBookingStatus", "LessonStatus",
        "DataGrantScope", "FeedbackPerformance",
      ]),
    );
  });

  it("TeacherApplication has the expected fields and relations", () => {
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "TeacherApplication");
    expect(model).toBeDefined();
    const fields = model!.fields.map((f) => f.name);
    expect(fields).toEqual(
      expect.arrayContaining([
        "id", "userId", "status", "legalName", "education",
        "experienceYears", "pricePerHour", "bio", "teachingModes",
        "serviceAreaCode", "version", "submittedAt", "createdAt", "updatedAt",
        "user", "qualifications", "auditRecords", "profile",
      ]),
    );
  });

  it("TrialBooking has idempotency key and version", () => {
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "TrialBooking");
    expect(model).toBeDefined();
    const fields = model!.fields.map((f) => f.name);
    expect(fields).toContain("idempotencyKey");
    expect(fields).toContain("version");
  });

  it("Lesson has trialBookingId optional unique", () => {
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "Lesson");
    expect(model).toBeDefined();
    const trialField = model!.fields.find((f) => f.name === "trialBookingId");
    expect(trialField).toBeDefined();
    expect(trialField!.isUnique).toBe(true);
    expect(trialField!.isRequired).toBe(false);
  });

  it("TeacherFeedback has isCurrent and supersedesId for versioning", () => {
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "TeacherFeedback");
    expect(model).toBeDefined();
    const fields = model!.fields.map((f) => f.name);
    expect(fields).toContain("isCurrent");
    expect(fields).toContain("supersedesId");
    expect(fields).toContain("sequence");
  });

  it("ParentReview has unique lessonId (one review per lesson)", () => {
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "ParentReview");
    expect(model).toBeDefined();
    const lessonField = model!.fields.find((f) => f.name === "lessonId");
    expect(lessonField).toBeDefined();
    expect(lessonField!.isUnique).toBe(true);
  });

  it("DataGrant has scopes, validFrom, validUntil, revokedAt", () => {
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "DataGrant");
    expect(model).toBeDefined();
    const fields = model!.fields.map((f) => f.name);
    expect(fields).toEqual(
      expect.arrayContaining(["scopes", "validFrom", "validUntil", "revokedAt", "sourceBookingId"]),
    );
  });

  it("ScheduleReservation has sourceType and sourceId for unified conflict detection", () => {
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "ScheduleReservation");
    expect(model).toBeDefined();
    const fields = model!.fields.map((f) => f.name);
    expect(fields).toContain("sourceType");
    expect(fields).toContain("sourceId");
    expect(fields).toContain("active");
  });

  it("FilePurpose enum includes TEACHER_QUALIFICATION", () => {
    const enumDef = Prisma.dmmf.datamodel.enums.find((e) => e.name === "FilePurpose");
    expect(enumDef).toBeDefined();
    const values = enumDef!.values.map((v) => v.name);
    expect(values).toContain("TEACHER_QUALIFICATION");
  });

  it("NotificationType enum includes trial and lesson notifications", () => {
    const enumDef = Prisma.dmmf.datamodel.enums.find((e) => e.name === "NotificationType");
    expect(enumDef).toBeDefined();
    const values = enumDef!.values.map((v) => v.name);
    expect(values).toEqual(
      expect.arrayContaining([
        "TRIAL_REQUESTED", "TRIAL_ACCEPTED", "TRIAL_REJECTED",
        "TRIAL_RESCHEDULE_PROPOSED", "TRIAL_CONFIRMED", "TRIAL_CANCELLED",
        "TRIAL_COMPLETED", "LESSON_SCHEDULED", "LESSON_COMPLETED",
        "FEEDBACK_RECEIVED", "REVIEW_RECEIVED", "TEACHER_AUDIT_UPDATE",
      ]),
    );
  });

  it("ParentProfile has serviceAreaCode for in-home filtering", () => {
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "ParentProfile");
    expect(model).toBeDefined();
    const fields = model!.fields.map((f) => f.name);
    expect(fields).toContain("serviceAreaCode");
  });
});
