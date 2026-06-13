-- CreateEnum
CREATE TYPE "MasteryState" AS ENUM ('new', 'learning', 'fuzzy', 'mistake', 'mastered', 'lapsed');

-- CreateEnum
CREATE TYPE "StudySessionMode" AS ENUM ('new_words', 'review', 'mistake_drill', 'mixed');

-- CreateEnum
CREATE TYPE "StudySessionStatus" AS ENUM ('active', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('word_to_meaning', 'meaning_to_word', 'spelling', 'listening');

-- CreateTable
CREATE TABLE "VocabularyWord" (
    "id" TEXT NOT NULL,
    "vocabularyBookId" TEXT NOT NULL,
    "lemma" TEXT NOT NULL,
    "partOfSpeech" TEXT NOT NULL,
    "definitionZh" TEXT NOT NULL,
    "definitionEn" TEXT,
    "phoneticUk" TEXT,
    "phoneticUs" TEXT,
    "audioUkUrl" TEXT,
    "audioUsUrl" TEXT,
    "imageUrl" TEXT,
    "exampleSentence" TEXT,
    "exampleTranslationZh" TEXT,
    "exampleSource" TEXT,
    "position" INTEGER NOT NULL,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabularyWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWordProgress" (
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "masteryState" "MasteryState" NOT NULL DEFAULT 'new',
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.3,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "averageResponseMs" INTEGER,
    "lastErrorType" "QuestionType",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWordProgress_pkey" PRIMARY KEY ("userId","wordId")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "StudySessionMode" NOT NULL,
    "status" "StudySessionStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySessionItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudySessionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyWord_vocabularyBookId_lemma_key" ON "VocabularyWord"("vocabularyBookId", "lemma");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyWord_vocabularyBookId_position_key" ON "VocabularyWord"("vocabularyBookId", "position");

-- CreateIndex
CREATE INDEX "VocabularyWord_vocabularyBookId_idx" ON "VocabularyWord"("vocabularyBookId");

-- CreateIndex
CREATE INDEX "UserWordProgress_masteryState_idx" ON "UserWordProgress"("masteryState");

-- CreateIndex
CREATE INDEX "UserWordProgress_nextReviewAt_idx" ON "UserWordProgress"("nextReviewAt");

-- CreateIndex
CREATE INDEX "StudySession_userId_idx" ON "StudySession"("userId");

-- CreateIndex
CREATE INDEX "StudySession_status_idx" ON "StudySession"("status");

-- CreateIndex
CREATE INDEX "StudySession_startedAt_idx" ON "StudySession"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudySessionItem_sessionId_position_key" ON "StudySessionItem"("sessionId", "position");

-- CreateIndex
CREATE INDEX "StudySessionItem_wordId_idx" ON "StudySessionItem"("wordId");

-- AddForeignKey
ALTER TABLE "VocabularyWord" ADD CONSTRAINT "VocabularyWord_vocabularyBookId_fkey" FOREIGN KEY ("vocabularyBookId") REFERENCES "VocabularyBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWordProgress" ADD CONSTRAINT "UserWordProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWordProgress" ADD CONSTRAINT "UserWordProgress_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "VocabularyWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionItem" ADD CONSTRAINT "StudySessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionItem" ADD CONSTRAINT "StudySessionItem_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "VocabularyWord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
