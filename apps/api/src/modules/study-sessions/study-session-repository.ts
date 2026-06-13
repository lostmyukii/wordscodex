import type {
  CompleteStudySessionResponse,
  QuestionType,
  ReviewProgress,
  SubmitReviewRequest,
  SubmitReviewResult,
  StudySession,
  StudySessionMode,
  StudySessionResult,
  StudySessionResultItem,
  Word,
} from '@wordscodex/contracts'
import {
  calculateSrsReview,
  sortDueReviewCandidates,
  type SrsProgressSnapshot,
} from '@wordscodex/domain'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  EmptyStudySessionError,
  IncompleteStudySessionError,
  NoActiveStudyPlanError,
  type TodayOverview,
} from './study-session-routes.js'
import type { StudyPlan } from '@wordscodex/contracts'

type WordRecord = {
  id: string
  lemma: string
  partOfSpeech: string
  definitionZh: string
  definitionEn: string | null
  phoneticUk: string | null
  phoneticUs: string | null
  audioUkUrl: string | null
  audioUsUrl: string | null
  imageUrl: string | null
  exampleSentence: string | null
  exampleTranslationZh: string | null
  exampleSource: string | null
}

type SessionRecord = {
  id: string
  userId: string
  mode: StudySessionMode
  status: 'active' | 'completed' | 'abandoned'
  startedAt: Date
  completedAt: Date | null
  items: Array<{
    id: string
    position: number
    questionType: QuestionType
    word: WordRecord
  }>
}

type StudyPlanRecord = {
  id: string
  userId: string
  vocabularyBookId: string
  learningGoal: 'k12' | 'college' | 'postgraduate' | 'overseas' | 'workplace'
  dailyNewWordTarget: number
  dailyReviewLimit: number
  targetDate: Date | null
  reminderEnabled: boolean
  status: 'active' | 'paused' | 'completed'
  startedAt: Date
  createdAt: Date
  updatedAt: Date
}

type ProgressRecord = {
  wordId?: string
  masteryState: SrsProgressSnapshot['masteryState']
  repetitions: number
  consecutiveCorrect: number
  correctCount: number
  incorrectCount: number
  easeFactor: number
  intervalDays: number
  lastReviewedAt: Date | null
  nextReviewAt: Date | null
  averageResponseMs: number | null
  lastErrorType: QuestionType | null
}

type ReviewLogRecord = {
  wordId: string
  questionType: QuestionType
  rating: 'again' | 'hard' | 'good' | 'easy'
  isCorrect: boolean
  responseMs: number
  answer: string | null
  reviewedAt: Date
  createdAt: Date
}

type StudySessionResultDataSource = {
  reviewLog: {
    findMany(input: {
      where: {
        sessionId: string
        userId: string
      }
      orderBy: Array<Record<string, 'asc' | 'desc'>>
    }): Promise<ReviewLogRecord[]>
  }
  userWordProgress: {
    findMany(input: {
      where: {
        userId: string
        wordId: {
          in: string[]
        }
      }
    }): Promise<Array<ProgressRecord & { wordId: string }>>
  }
}

export class PrismaStudySessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getTodayOverview(
    userId: string,
    now: Date,
  ): Promise<TodayOverview | null> {
    const plan = await this.findActivePlan(userId)
    if (!plan) return null

    const dayStart = startOfUtcDay(now)
    const dayEnd = new Date(dayStart)
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

    const [dueReviewCount, newWordsAvailable, completedSessions] =
      await this.prisma.$transaction([
        this.prisma.userWordProgress.count({
          where: {
            userId,
            nextReviewAt: {
              lte: now,
            },
            word: {
              vocabularyBookId: plan.vocabularyBookId,
            },
          },
        }),
        this.prisma.vocabularyWord.count({
          where: {
            vocabularyBookId: plan.vocabularyBookId,
            progress: {
              none: {
                userId,
              },
            },
          },
        }),
        this.prisma.studySession.count({
          where: {
            userId,
            status: 'completed',
            completedAt: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
        }),
      ])

    return {
      plan: toStudyPlan(plan),
      dueReviewCount,
      newWordsAvailable,
      completedSessions,
    }
  }

  async createSession(input: {
    userId: string
    mode: StudySessionMode
    newWordLimit: number
    reviewLimit: number
    now: Date
  }): Promise<StudySession> {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.studyPlan.findFirst({
        where: {
          userId: input.userId,
          status: 'active',
        },
        orderBy: {
          startedAt: 'desc',
        },
      })

      if (!plan) throw new NoActiveStudyPlanError()

      const words: WordRecord[] = []

      if (input.mode === 'review' || input.mode === 'mixed') {
        const dueProgress = await tx.userWordProgress.findMany({
          where: {
            userId: input.userId,
            nextReviewAt: {
              lte: input.now,
            },
            word: {
              vocabularyBookId: plan.vocabularyBookId,
            },
          },
          include: {
            word: true,
          },
        })
        const sortedDueProgress = sortDueReviewCandidates(
          dueProgress.map((progress) => ({
            record: progress,
            wordId: progress.wordId,
            masteryState: progress.masteryState,
            nextReviewAt: progress.nextReviewAt?.toISOString() ?? null,
            updatedAt: progress.updatedAt.toISOString(),
          })),
        ).slice(0, normalizeTake(input.reviewLimit))

        words.push(...sortedDueProgress.map((progress) => progress.record.word))
      }

      if (input.mode === 'new_words' || input.mode === 'mixed') {
        const newWords = await tx.vocabularyWord.findMany({
          where: {
            vocabularyBookId: plan.vocabularyBookId,
            progress: {
              none: {
                userId: input.userId,
              },
            },
          },
          orderBy: {
            position: 'asc',
          },
          take: normalizeTake(input.newWordLimit),
        })
        words.push(...newWords)
      }

      if (words.length === 0) throw new EmptyStudySessionError()

      const session = await tx.studySession.create({
        data: {
          userId: input.userId,
          mode: input.mode,
          status: 'active',
          startedAt: input.now,
          items: {
            create: words.map((word, index) => ({
              wordId: word.id,
              position: index + 1,
              questionType: 'word_to_meaning',
            })),
          },
        },
        include: sessionInclude,
      })

      return toStudySession(session)
    })
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.studySession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: sessionInclude,
    })

    return session ? toStudySession(session) : null
  }

  async submitReview(input: {
    sessionId: string
    userId: string
    idempotencyKey: string
    review: SubmitReviewRequest
    now: Date
  }): Promise<SubmitReviewResult | null> {
    return this.prisma.$transaction(async (tx) => {
      const existingReview = await tx.reviewLog.findUnique({
        where: {
          idempotencyKey: input.idempotencyKey,
        },
      })

      if (existingReview) {
        if (
          existingReview.sessionId !== input.sessionId ||
          existingReview.userId !== input.userId ||
          existingReview.wordId !== input.review.wordId
        ) {
          return null
        }

        const existingProgress = await tx.userWordProgress.findUnique({
          where: {
            userId_wordId: {
              userId: input.userId,
              wordId: input.review.wordId,
            },
          },
        })

        return existingProgress
          ? {
              progress: toReviewProgress(existingProgress),
              alreadyProcessed: true,
            }
          : null
      }

      const session = await tx.studySession.findFirst({
        where: {
          id: input.sessionId,
          userId: input.userId,
          status: 'active',
        },
        include: {
          items: {
            where: {
              wordId: input.review.wordId,
            },
            take: 1,
          },
        },
      })

      if (!session || session.items.length === 0) return null

      const previousProgress = await tx.userWordProgress.findUnique({
        where: {
          userId_wordId: {
            userId: input.userId,
            wordId: input.review.wordId,
          },
        },
      })
      const reviewedAt = new Date(input.review.reviewedAt)
      const nextProgress = calculateSrsReview({
        previous: previousProgress
          ? toSrsProgressSnapshot(previousProgress)
          : null,
        rating: input.review.rating,
        isCorrect: input.review.isCorrect,
        responseMs: input.review.responseMs,
        questionType: input.review.questionType,
        reviewedAt,
      })

      await tx.reviewLog.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          sessionId: input.sessionId,
          userId: input.userId,
          wordId: input.review.wordId,
          questionType: input.review.questionType,
          rating: input.review.rating,
          isCorrect: input.review.isCorrect,
          responseMs: input.review.responseMs,
          answer: input.review.answer,
          reviewedAt,
        },
      })

      const updatedProgress = await tx.userWordProgress.upsert({
        where: {
          userId_wordId: {
            userId: input.userId,
            wordId: input.review.wordId,
          },
        },
        create: {
          userId: input.userId,
          wordId: input.review.wordId,
          ...toProgressWriteData(nextProgress),
        },
        update: toProgressWriteData(nextProgress),
      })

      return {
        progress: toReviewProgress(updatedProgress),
        alreadyProcessed: false,
      }
    })
  }

  async completeSession(input: {
    sessionId: string
    userId: string
    now: Date
  }): Promise<CompleteStudySessionResponse | null> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.studySession.findFirst({
        where: {
          id: input.sessionId,
          userId: input.userId,
        },
        include: sessionInclude,
      })

      if (!session) return null

      if (session.status !== 'completed') {
        const reviewLogs = await tx.reviewLog.findMany({
          where: {
            sessionId: input.sessionId,
            userId: input.userId,
          },
          orderBy: [
            {
              reviewedAt: 'asc',
            },
            {
              createdAt: 'asc',
            },
          ],
        })
        const reviewedWordIds = new Set(
          reviewLogs.map((reviewLog) => reviewLog.wordId),
        )

        if (!session.items.every((item) => reviewedWordIds.has(item.word.id))) {
          throw new IncompleteStudySessionError()
        }
      }

      const completedSession =
        session.status === 'completed'
          ? session
          : await tx.studySession.update({
              where: {
                id: input.sessionId,
              },
              data: {
                status: 'completed',
                completedAt: input.now,
              },
              include: sessionInclude,
            })
      const result = await buildStudySessionResult(
        tx,
        completedSession,
        input.userId,
      )

      return {
        session: toStudySession(completedSession),
        result,
      }
    })
  }

  async getSessionResult(
    sessionId: string,
    userId: string,
  ): Promise<StudySessionResult | null> {
    const session = await this.prisma.studySession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: 'completed',
      },
      include: sessionInclude,
    })

    if (!session) return null

    return buildStudySessionResult(this.prisma, session, userId)
  }

  private findActivePlan(userId: string) {
    return this.prisma.studyPlan.findFirst({
      where: {
        userId,
        status: 'active',
      },
      orderBy: {
        startedAt: 'desc',
      },
    })
  }
}

async function buildStudySessionResult(
  dataSource: StudySessionResultDataSource,
  record: SessionRecord,
  userId: string,
): Promise<StudySessionResult> {
  const session = toStudySession(record)
  const wordIds = session.items.map((item) => item.word.id)
  const [reviewLogs, progressRecords] = await Promise.all([
    dataSource.reviewLog.findMany({
      where: {
        sessionId: session.id,
        userId,
      },
      orderBy: [
        {
          reviewedAt: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    }),
    dataSource.userWordProgress.findMany({
      where: {
        userId,
        wordId: {
          in: wordIds,
        },
      },
    }),
  ])
  const latestReviewByWordId = new Map<string, ReviewLogRecord>()
  for (const reviewLog of reviewLogs) {
    latestReviewByWordId.set(reviewLog.wordId, reviewLog)
  }
  const progressByWordId = new Map(
    progressRecords.map((progress) => [progress.wordId, progress]),
  )
  const items: StudySessionResultItem[] = session.items.flatMap((item) => {
    const reviewLog = latestReviewByWordId.get(item.word.id)
    const progress = progressByWordId.get(item.word.id)
    if (!reviewLog || !progress) return []

    return [
      {
        word: item.word,
        questionType: reviewLog.questionType,
        rating: reviewLog.rating,
        isCorrect: reviewLog.isCorrect,
        responseMs: reviewLog.responseMs,
        answer: reviewLog.answer,
        reviewedAt: reviewLog.reviewedAt.toISOString(),
        masteryState: progress.masteryState,
        nextReviewAt: progress.nextReviewAt?.toISOString() ?? null,
      },
    ]
  })
  const correctCount = items.filter((item) => item.isCorrect).length

  return {
    session,
    summary: {
      totalItems: session.items.length,
      answeredItems: items.length,
      correctCount,
      incorrectCount: items.length - correctCount,
      accuracyRate: items.length === 0 ? 0 : correctCount / items.length,
      totalResponseMs: items.reduce((sum, item) => sum + item.responseMs, 0),
      completedAt: session.completedAt,
      canCheckIn: session.status === 'completed',
    },
    items,
  }
}

function toSrsProgressSnapshot(record: ProgressRecord): SrsProgressSnapshot {
  return {
    masteryState: record.masteryState,
    repetitions: record.repetitions,
    consecutiveCorrect: record.consecutiveCorrect,
    correctCount: record.correctCount,
    incorrectCount: record.incorrectCount,
    easeFactor: record.easeFactor,
    intervalDays: record.intervalDays,
    lastReviewedAt: record.lastReviewedAt?.toISOString() ?? null,
    nextReviewAt: record.nextReviewAt?.toISOString() ?? null,
    averageResponseMs: record.averageResponseMs,
    lastErrorType: record.lastErrorType,
  }
}

function toReviewProgress(record: ProgressRecord): ReviewProgress {
  return {
    masteryState: record.masteryState,
    repetitions: record.repetitions,
    consecutiveCorrect: record.consecutiveCorrect,
    correctCount: record.correctCount,
    incorrectCount: record.incorrectCount,
    easeFactor: record.easeFactor,
    intervalDays: record.intervalDays,
    lastReviewedAt: record.lastReviewedAt?.toISOString() ?? null,
    nextReviewAt: record.nextReviewAt?.toISOString() ?? null,
    averageResponseMs: record.averageResponseMs,
    lastErrorType: record.lastErrorType,
  }
}

function toProgressWriteData(progress: SrsProgressSnapshot) {
  return {
    masteryState: progress.masteryState,
    repetitions: progress.repetitions,
    consecutiveCorrect: progress.consecutiveCorrect,
    correctCount: progress.correctCount,
    incorrectCount: progress.incorrectCount,
    easeFactor: progress.easeFactor,
    intervalDays: progress.intervalDays,
    lastReviewedAt: progress.lastReviewedAt
      ? new Date(progress.lastReviewedAt)
      : null,
    nextReviewAt: progress.nextReviewAt
      ? new Date(progress.nextReviewAt)
      : null,
    averageResponseMs: progress.averageResponseMs,
    lastErrorType: progress.lastErrorType,
  }
}

const sessionInclude = {
  items: {
    orderBy: {
      position: 'asc' as const,
    },
    include: {
      word: true,
    },
  },
}

function toStudyPlan(record: StudyPlanRecord): StudyPlan {
  return {
    ...record,
    targetDate: record.targetDate?.toISOString() ?? null,
    startedAt: record.startedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function toStudySession(record: SessionRecord): StudySession {
  return {
    id: record.id,
    userId: record.userId,
    mode: record.mode,
    status: record.status,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    items: record.items.map((item) => ({
      id: item.id,
      position: item.position,
      questionType: item.questionType,
      word: toWord(item.word),
    })),
  }
}

function toWord(record: WordRecord): Word {
  return {
    id: record.id,
    lemma: record.lemma,
    phoneticUk: record.phoneticUk,
    phoneticUs: record.phoneticUs,
    audioUkUrl: record.audioUkUrl,
    audioUsUrl: record.audioUsUrl,
    imageUrl: record.imageUrl,
    meanings: [
      {
        partOfSpeech: record.partOfSpeech,
        definitionZh: record.definitionZh,
        definitionEn: record.definitionEn,
      },
    ],
    examples:
      record.exampleSentence && record.exampleTranslationZh
        ? [
            {
              sentence: record.exampleSentence,
              translationZh: record.exampleTranslationZh,
              source: record.exampleSource,
            },
          ]
        : [],
  }
}

function normalizeTake(value: number) {
  return Math.max(0, Math.floor(value))
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}
