import type { VocabularyBook } from '@wordscodex/contracts'
import type { PrismaClient } from '../../../generated/prisma/client.js'

type VocabularyBookRecord = {
  id: string
  slug: string
  name: string
  category: 'k12' | 'college' | 'postgraduate' | 'overseas' | 'workplace'
  description: string
  wordCount: number
  version: number
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function toVocabularyBook(record: VocabularyBookRecord): VocabularyBook {
  return {
    ...record,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export class PrismaVocabularyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listBooks(input: { q?: string }) {
    const search = input.q
    const records = await this.prisma.vocabularyBook.findMany({
      where: {
        publishedAt: {
          not: null,
        },
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                  },
                },
                {
                  slug: {
                    contains: search.toLowerCase(),
                  },
                },
                {
                  description: {
                    contains: search,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    return records.map(toVocabularyBook)
  }

  async findBook(bookId: string) {
    const record = await this.prisma.vocabularyBook.findFirst({
      where: {
        publishedAt: {
          not: null,
        },
        OR: [{ id: bookId }, { slug: bookId }],
      },
    })

    return record ? toVocabularyBook(record) : null
  }
}
