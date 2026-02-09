-- AlterTable
ALTER TABLE "quiz_groups" ADD COLUMN     "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "IsScheduled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ScheduledAt" TIMESTAMP(3),
ADD COLUMN     "Status" TEXT NOT NULL DEFAULT 'published',
ALTER COLUMN "PublishedAt" DROP NOT NULL,
ALTER COLUMN "PublishedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "quiz_groups_Status_idx" ON "quiz_groups"("Status");

-- CreateIndex
CREATE INDEX "quiz_groups_ScheduledAt_idx" ON "quiz_groups"("ScheduledAt");
