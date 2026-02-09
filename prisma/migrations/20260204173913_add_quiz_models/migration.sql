-- CreateTable
CREATE TABLE "quizzes" (
    "QuizID" SERIAL NOT NULL,
    "Title" TEXT NOT NULL,
    "Description" TEXT,
    "Difficulty" TEXT NOT NULL,
    "Subject" TEXT,
    "TimeLimit" INTEGER,
    "TotalQuestions" INTEGER NOT NULL DEFAULT 0,
    "CreatedBy" INTEGER NOT NULL,
    "IsPublished" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("QuizID")
);

-- CreateTable
CREATE TABLE "questions" (
    "QuestionID" SERIAL NOT NULL,
    "QuizID" INTEGER NOT NULL,
    "QuestionText" TEXT NOT NULL,
    "QuestionType" TEXT NOT NULL DEFAULT 'multiple_choice',
    "Points" INTEGER NOT NULL DEFAULT 1,
    "OrderIndex" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("QuestionID")
);

-- CreateTable
CREATE TABLE "options" (
    "OptionID" SERIAL NOT NULL,
    "QuestionID" INTEGER NOT NULL,
    "OptionText" TEXT NOT NULL,
    "IsCorrect" BOOLEAN NOT NULL DEFAULT false,
    "OrderIndex" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "options_pkey" PRIMARY KEY ("OptionID")
);

-- CreateIndex
CREATE INDEX "quizzes_CreatedBy_idx" ON "quizzes"("CreatedBy");

-- CreateIndex
CREATE INDEX "quizzes_IsPublished_idx" ON "quizzes"("IsPublished");

-- CreateIndex
CREATE INDEX "questions_QuizID_idx" ON "questions"("QuizID");

-- CreateIndex
CREATE INDEX "options_QuestionID_idx" ON "options"("QuestionID");

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_CreatedBy_fkey" FOREIGN KEY ("CreatedBy") REFERENCES "users"("UserID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_QuizID_fkey" FOREIGN KEY ("QuizID") REFERENCES "quizzes"("QuizID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options" ADD CONSTRAINT "options_QuestionID_fkey" FOREIGN KEY ("QuestionID") REFERENCES "questions"("QuestionID") ON DELETE CASCADE ON UPDATE CASCADE;
