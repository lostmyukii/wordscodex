import type {
  MistakeListItem,
  MistakeListResponse,
  MistakeMasteryState,
  QuestionType,
  StudyPlan,
  StudySession,
  Word,
} from '@wordscodex/contracts'
import { sortDueReviewCandidates } from '@wordscodex/domain'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  EmptyMistakeSessionError,
  NoActiveMistakePlanError,
} from './mistake-routes.js'

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

type MistakeProgressRecord = {
  wordId: string
  masteryState: MistakeMasteryState
  repetitions: number
  correctCount: number
  incorrectCount: number
  lastReviewedAt: Date | null
  nextReviewAt: Date | null
  lastErrorType: QuestionType | null
  updatedAt: Date
  word: WordRecord
}

type SessionRecord = {
  id: string
  userId: string
  mode: 'mistake_drill'
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

const mistakeStates = ['fuzzy', 'mistake', 'lapsed'] as const

export class PrismaMistakeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listMistakes(userId: string, now: Date): Promise<MistakeListResponse> {
    const plan = await this.findActivePlan(userId)
    if (!plan) return emptyMistakeList()

    const progress = await this.findMistakeProgress(
      userId,
      plan.vocabularyBookId,
    )
    const items = sortMistakeProgress(progress).map(toMistakeListItem)

    return {
      plan: toStudyPlan(plan),
      summary: {
        total: items.length,
        dueNow: items.filter((item) => isDueNow(item, now)).length,
      },
      items,
    }
  }

  async createMistakeDrillSession(input: {
    userId: string
    limit: number
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

      if (!plan) throw new NoActiveMistakePlanError()

      const progress = await tx.userWordProgress.findMany({
        where: {
          userId: input.userId,
          masteryState: {
            in: [...mistakeStates],
          },
          word: {
            vocabularyBookId: plan.vocabularyBookId,
          },
        },
        include: {
          word: true,
        },
      })
      const selectedProgress = sortMistakeProgress(
        progress as MistakeProgressRecord[],
      ).slice(0, input.limit)

      if (selectedProgress.length === 0) throw new EmptyMistakeSessionError()

      const session = await tx.studySession.create({
        data: {
          userId: input.userId,
          mode: 'mistake_drill',
          status: 'active',
          startedAt: input.now,
          items: {
            create: selectedProgress.map((item, index) => ({
              wordId: item.wordId,
              position: index + 1,
              questionType: 'word_to_meaning',
            })),
          },
        },
        include: sessionInclude,
      })

      return toStudySession(session as SessionRecord)
    })
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

  private findMistakeProgress(userId: string, vocabularyBookId: string) {
    return this.prisma.userWordProgress.findMany({
      where: {
        userId,
        masteryState: {
          in: [...mistakeStates],
        },
        word: {
          vocabularyBookId,
        },
      },
      include: {
        word: true,
      },
    }) as Promise<MistakeProgressRecord[]>
  }
}

function emptyMistakeList(): MistakeListResponse {
  return {
    plan: null,
    summary: {
      total: 0,
      dueNow: 0,
    },
    items: [],
  }
}

function sortMistakeProgress(progress: MistakeProgressRecord[]) {
  return sortDueReviewCandidates(
    progress.map((record) => ({
      record,
      wordId: record.wordId,
      masteryState: record.masteryState,
      nextReviewAt: record.nextReviewAt?.toISOString() ?? null,
      updatedAt: record.updatedAt.toISOString(),
    })),
  ).map((candidate) => candidate.record)
}

function toMistakeListItem(record: MistakeProgressRecord): MistakeListItem {
  return {
    word: toWord(record.word),
    masteryState: record.masteryState,
    repetitions: record.repetitions,
    correctCount: record.correctCount,
    incorrectCount: record.incorrectCount,
    lastReviewedAt: record.lastReviewedAt?.toISOString() ?? null,
    nextReviewAt: record.nextReviewAt?.toISOString() ?? null,
    lastErrorType: record.lastErrorType,
    updatedAt: record.updatedAt.toISOString(),
  }
}

function isDueNow(item: MistakeListItem, now: Date) {
  return item.nextReviewAt !== null && new Date(item.nextReviewAt) <= now
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
