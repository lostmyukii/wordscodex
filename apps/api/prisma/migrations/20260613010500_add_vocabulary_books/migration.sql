-- CreateEnum
CREATE TYPE "VocabularyCategory" AS ENUM ('k12', 'college', 'postgraduate', 'overseas', 'workplace');

-- CreateTable
CREATE TABLE "VocabularyBook" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "VocabularyCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabularyBook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyBook_slug_key" ON "VocabularyBook"("slug");

-- CreateIndex
CREATE INDEX "VocabularyBook_category_idx" ON "VocabularyBook"("category");

-- CreateIndex
CREATE INDEX "VocabularyBook_publishedAt_idx" ON "VocabularyBook"("publishedAt");
