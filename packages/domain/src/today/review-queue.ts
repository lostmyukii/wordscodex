import type { MasteryState } from '../srs/schedule.js'

export type DueReviewCandidate = {
  wordId: string
  masteryState: MasteryState
  nextReviewAt: string | null
  updatedAt: string
}

const masteryPriority: Record<MasteryState, number> = {
  mistake: 0,
  lapsed: 1,
  fuzzy: 2,
  learning: 3,
  mastered: 4,
  new: 5,
}

export function sortDueReviewCandidates<T extends DueReviewCandidate>(
  candidates: readonly T[],
): T[] {
  return [...candidates].sort(compareDueReviewCandidates)
}

function compareDueReviewCandidates(
  left: DueReviewCandidate,
  right: DueReviewCandidate,
) {
  return (
    compareNumber(
      masteryPriority[left.masteryState],
      masteryPriority[right.masteryState],
    ) ||
    compareNullableDate(left.nextReviewAt, right.nextReviewAt) ||
    compareNullableDate(left.updatedAt, right.updatedAt) ||
    left.wordId.localeCompare(right.wordId)
  )
}

function compareNumber(left: number, right: number) {
  return left - right
}

function compareNullableDate(left: string | null, right: string | null) {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1

  return compareNumber(parseDate(left), parseDate(right))
}

function parseDate(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}
