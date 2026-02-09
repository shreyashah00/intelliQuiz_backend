-- CreateTable
CREATE TABLE "quiz_responses" (
    "ResponseID" SERIAL NOT NULL,
    "QuizID" INTEGER NOT NULL,
    "UserID" INTEGER NOT NULL,
    "Score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "Percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TimeSpent" INTEGER,
    "Status" TEXT NOT NULL DEFAULT 'completed',
    "StartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CompletedAt" TIMESTAMP(3),
    "AIInsightsGenerated" BOOLEAN NOT NULL DEFAULT false,
    "AIInsights" JSONB,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_responses_pkey" PRIMARY KEY ("ResponseID")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "AnswerID" SERIAL NOT NULL,
    "ResponseID" INTEGER NOT NULL,
    "QuestionID" INTEGER NOT NULL,
    "SelectedOptionID" INTEGER,
    "AnswerText" TEXT,
    "IsCorrect" BOOLEAN NOT NULL DEFAULT false,
    "PointsEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TimeTaken" INTEGER,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("AnswerID")
);

-- CreateIndex
CREATE INDEX "quiz_responses_QuizID_idx" ON "quiz_responses"("QuizID");

-- CreateIndex
CREATE INDEX "quiz_responses_UserID_idx" ON "quiz_responses"("UserID");

-- CreateIndex
CREATE INDEX "quiz_responses_Status_idx" ON "quiz_responses"("Status");

-- CreateIndex
CREATE INDEX "quiz_answers_ResponseID_idx" ON "quiz_answers"("ResponseID");

-- CreateIndex
CREATE INDEX "quiz_answers_QuestionID_idx" ON "quiz_answers"("QuestionID");

-- AddForeignKey
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_QuizID_fkey" FOREIGN KEY ("QuizID") REFERENCES "quizzes"("QuizID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_UserID_fkey" FOREIGN KEY ("UserID") REFERENCES "users"("UserID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_ResponseID_fkey" FOREIGN KEY ("ResponseID") REFERENCES "quiz_responses"("ResponseID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_QuestionID_fkey" FOREIGN KEY ("QuestionID") REFERENCES "questions"("QuestionID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_SelectedOptionID_fkey" FOREIGN KEY ("SelectedOptionID") REFERENCES "options"("OptionID") ON DELETE SET NULL ON UPDATE CASCADE;
