export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export type MasteryState =
  | 'new'
  | 'learning'
  | 'fuzzy'
  | 'mistake'
  | 'mastered'
  | 'lapsed'

export type QuestionType =
  | 'word_to_meaning'
  | 'meaning_to_word'
  | 'spelling'
  | 'listening'

export type SrsProgressSnapshot = {
  masteryState: MasteryState
  repetitions: number
  consecutiveCorrect: number
  correctCount: number
  incorrectCount: number
  easeFactor: number
  intervalDays: number
  lastReviewedAt: string | null
  nextReviewAt: string | null
  averageResponseMs: number | null
  lastErrorType: QuestionType | null
}

export type CalculateSrsReviewInput = {
  previous: SrsProgressSnapshot | null
  rating: ReviewRating
  isCorrect: boolean
  responseMs: number
  questionType: QuestionType
  reviewedAt: Date
}

const initialEaseFactor = 2.3
const minimumEaseFactor = 1.3
const maximumEaseFactor = 3.0
const minutesForAgain = 10

export function calculateSrsReview(
  input: CalculateSrsReviewInput,
): SrsProgressSnapshot {
  const previous = input.previous ?? createInitialProgress()
  const effectiveCorrect = input.isCorrect && input.rating !== 'again'
  const easeFactor = clampEaseFactor(
    previous.easeFactor + easeAdjustmentFor(input.rating),
  )
  const intervalDays = calculateIntervalDays(
    input.rating,
    previous.intervalDays,
    previous.easeFactor,
  )
  const nextReviewAt =
    input.rating === 'again'
      ? addMinutes(input.reviewedAt, minutesForAgain)
      : addDays(input.reviewedAt, intervalDays)
  const repetitions = previous.repetitions + 1
  const consecutiveCorrect = effectiveCorrect
    ? previous.consecutiveCorrect + 1
    : 0
  const correctCount = previous.correctCount + (effectiveCorrect ? 1 : 0)
  const incorrectCount = previous.incorrectCount + (effectiveCorrect ? 0 : 1)

  return {
    masteryState: resolveMasteryState({
      previousState: previous.masteryState,
      rating: input.rating,
      effectiveCorrect,
      consecutiveCorrect,
      intervalDays,
    }),
    repetitions,
    consecutiveCorrect,
    correctCount,
    incorrectCount,
    easeFactor,
    intervalDays,
    lastReviewedAt: input.reviewedAt.toISOString(),
    nextReviewAt: nextReviewAt.toISOString(),
    averageResponseMs: calculateAverageResponseMs(
      previous.averageResponseMs,
      previous.repetitions,
      input.responseMs,
    ),
    lastErrorType: effectiveCorrect ? null : input.questionType,
  }
}

function createInitialProgress(): SrsProgressSnapshot {
  return {
    masteryState: 'new',
    repetitions: 0,
    consecutiveCorrect: 0,
    correctCount: 0,
    incorrectCount: 0,
    easeFactor: initialEaseFactor,
    intervalDays: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    averageResponseMs: null,
    lastErrorType: null,
  }
}

function easeAdjustmentFor(rating: ReviewRating) {
  switch (rating) {
    case 'again':
      return -0.2
    case 'hard':
      return -0.1
    case 'good':
      return 0
    case 'easy':
      return 0.1
  }
}

function calculateIntervalDays(
  rating: ReviewRating,
  previousIntervalDays: number,
  previousEaseFactor: number,
) {
  if (previousIntervalDays === 0) {
    switch (rating) {
      case 'again':
        return 0
      case 'hard':
        return 1
      case 'good':
        return 2
      case 'easy':
        return 4
    }
  }

  switch (rating) {
    case 'again':
      return 0
    case 'hard':
      return Math.ceil(Math.max(1, previousIntervalDays * 1.2))
    case 'good':
      return Math.ceil(Math.max(2, previousIntervalDays * previousEaseFactor))
    case 'easy':
      return Math.ceil(
        Math.max(4, previousIntervalDays * previousEaseFactor * 1.3),
      )
  }
}

function resolveMasteryState(input: {
  previousState: MasteryState
  rating: ReviewRating
  effectiveCorrect: boolean
  consecutiveCorrect: number
  intervalDays: number
}): MasteryState {
  if (!input.effectiveCorrect) {
    return input.previousState === 'mastered' ? 'lapsed' : 'mistake'
  }

  if (input.rating === 'hard') return 'fuzzy'

  if (input.consecutiveCorrect >= 3 && input.intervalDays >= 14) {
    return 'mastered'
  }

  return 'learning'
}

function clampEaseFactor(value: number) {
  return Number(
    Math.min(maximumEaseFactor, Math.max(minimumEaseFactor, value)).toFixed(2),
  )
}

function calculateAverageResponseMs(
  previousAverageResponseMs: number | null,
  previousRepetitions: number,
  responseMs: number,
) {
  if (previousAverageResponseMs === null || previousRepetitions === 0) {
    return responseMs
  }

  return Math.round(
    (previousAverageResponseMs * previousRepetitions + responseMs) /
      (previousRepetitions + 1),
  )
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}
