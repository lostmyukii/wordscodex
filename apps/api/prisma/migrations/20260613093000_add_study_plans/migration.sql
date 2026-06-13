-- CreateEnum
CREATE TYPE "LearningGoal" AS ENUM ('k12', 'college', 'postgraduate', 'overseas', 'workplace');

-- CreateEnum
CREATE TYPE "StudyPlanStatus" AS ENUM ('active', 'paused', 'completed');

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vocabularyBookId" TEXT NOT NULL,
    "learningGoal" "LearningGoal" NOT NULL,
    "dailyNewWordTarget" INTEGER NOT NULL,
    "dailyReviewLimit" INTEGER NOT NULL DEFAULT 80,
    "targetDate" TIMESTAMP(3),
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "StudyPlanStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyPlan_userId_idx" ON "StudyPlan"("userId");

-- CreateIndex
CREATE INDEX "StudyPlan_vocabularyBookId_idx" ON "StudyPlan"("vocabularyBookId");

-- CreateIndex
CREATE INDEX "StudyPlan_status_idx" ON "StudyPlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlan_active_user_unique" ON "StudyPlan"("userId") WHERE "status" = 'active';

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_vocabularyBookId_fkey" FOREIGN KEY ("vocabularyBookId") REFERENCES "VocabularyBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
