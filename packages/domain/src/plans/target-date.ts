type CalculatePlanTargetDateInput = {
  startDate: Date
  wordCount: number
  dailyNewWordTarget: number
}

export function calculatePlanTargetDate(input: CalculatePlanTargetDateInput) {
  if (
    !Number.isFinite(input.dailyNewWordTarget) ||
    input.dailyNewWordTarget <= 0
  ) {
    throw new Error('dailyNewWordTarget must be greater than 0')
  }

  const startAtUtcMidnight = new Date(
    Date.UTC(
      input.startDate.getUTCFullYear(),
      input.startDate.getUTCMonth(),
      input.startDate.getUTCDate(),
    ),
  )
  const daysNeeded =
    input.wordCount <= 0
      ? 1
      : Math.ceil(input.wordCount / input.dailyNewWordTarget)
  const targetDate = new Date(startAtUtcMidnight)
  targetDate.setUTCDate(targetDate.getUTCDate() + Math.max(0, daysNeeded - 1))

  return targetDate
}
