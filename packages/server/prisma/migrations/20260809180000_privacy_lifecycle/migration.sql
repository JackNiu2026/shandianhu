ALTER TABLE "Child" ADD COLUMN "purgeAfter" TIMESTAMP(3);

CREATE INDEX "Child_deletedAt_purgeAfter_idx" ON "Child"("deletedAt", "purgeAfter");
