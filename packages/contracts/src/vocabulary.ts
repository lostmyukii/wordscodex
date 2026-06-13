import { z } from 'zod'

export const vocabularyCategorySchema = z.enum([
  'k12',
  'college',
  'postgraduate',
  'overseas',
  'workplace',
])

export const vocabularyBookSchema = z.object({
  id: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(80),
  category: vocabularyCategorySchema,
  description: z.string().min(1).max(500),
  wordCount: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const vocabularyBookListResponseSchema = z.object({
  books: z.array(vocabularyBookSchema),
})

export const vocabularyBookDetailResponseSchema = z.object({
  book: vocabularyBookSchema,
})

export const vocabularyBookSearchQuerySchema = z.object({
  q: z.preprocess((value) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }, z.string().min(1).max(80).optional()),
})

export type VocabularyCategory = z.infer<typeof vocabularyCategorySchema>
export type VocabularyBook = z.infer<typeof vocabularyBookSchema>
export type VocabularyBookListResponse = z.infer<
  typeof vocabularyBookListResponseSchema
>
export type VocabularyBookDetailResponse = z.infer<
  typeof vocabularyBookDetailResponseSchema
>
export type VocabularyBookSearchQuery = z.infer<
  typeof vocabularyBookSearchQuerySchema
>
