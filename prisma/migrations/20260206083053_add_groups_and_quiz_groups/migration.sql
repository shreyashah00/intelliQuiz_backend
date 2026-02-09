-- CreateTable
CREATE TABLE "groups" (
    "GroupID" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Description" TEXT,
    "CreatedBy" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("GroupID")
);

-- CreateTable
CREATE TABLE "group_members" (
    "GroupMemberID" SERIAL NOT NULL,
    "GroupID" INTEGER NOT NULL,
    "UserID" INTEGER NOT NULL,
    "Status" TEXT NOT NULL DEFAULT 'pending',
    "InvitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "AcceptedAt" TIMESTAMP(3),
    "RejectedAt" TIMESTAMP(3),

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("GroupMemberID")
);

-- CreateTable
CREATE TABLE "quiz_groups" (
    "QuizGroupID" SERIAL NOT NULL,
    "QuizID" INTEGER NOT NULL,
    "GroupID" INTEGER NOT NULL,
    "PublishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_groups_pkey" PRIMARY KEY ("QuizGroupID")
);

-- CreateIndex
CREATE INDEX "groups_CreatedBy_idx" ON "groups"("CreatedBy");

-- CreateIndex
CREATE INDEX "group_members_GroupID_idx" ON "group_members"("GroupID");

-- CreateIndex
CREATE INDEX "group_members_UserID_idx" ON "group_members"("UserID");

-- CreateIndex
CREATE INDEX "group_members_Status_idx" ON "group_members"("Status");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_GroupID_UserID_key" ON "group_members"("GroupID", "UserID");

-- CreateIndex
CREATE INDEX "quiz_groups_QuizID_idx" ON "quiz_groups"("QuizID");

-- CreateIndex
CREATE INDEX "quiz_groups_GroupID_idx" ON "quiz_groups"("GroupID");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_groups_QuizID_GroupID_key" ON "quiz_groups"("QuizID", "GroupID");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_CreatedBy_fkey" FOREIGN KEY ("CreatedBy") REFERENCES "users"("UserID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_GroupID_fkey" FOREIGN KEY ("GroupID") REFERENCES "groups"("GroupID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_UserID_fkey" FOREIGN KEY ("UserID") REFERENCES "users"("UserID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_groups" ADD CONSTRAINT "quiz_groups_QuizID_fkey" FOREIGN KEY ("QuizID") REFERENCES "quizzes"("QuizID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_groups" ADD CONSTRAINT "quiz_groups_GroupID_fkey" FOREIGN KEY ("GroupID") REFERENCES "groups"("GroupID") ON DELETE CASCADE ON UPDATE CASCADE;
