export type CheckinDay = {
  dateKey: string
}

export type RecentCheckinDay = {
  dateKey: string
  checkedIn: boolean
}

type CalculateCurrentStreakInput = {
  todayKey: string
  checkins: CheckinDay[]
}

type BuildRecentCheckinDaysInput = {
  todayKey: string
  days: number
  checkins: CheckinDay[]
}

export function calculateCurrentStreak(input: CalculateCurrentStreakInput) {
  const checkedDateKeys = new Set(input.checkins.map((day) => day.dateKey))
  let streak = 0
  let cursor = parseDateKey(input.todayKey)

  while (checkedDateKeys.has(formatDateKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

export function buildRecentCheckinDays(
  input: BuildRecentCheckinDaysInput,
): RecentCheckinDay[] {
  const checkedDateKeys = new Set(input.checkins.map((day) => day.dateKey))
  const today = parseDateKey(input.todayKey)
  const length = Math.max(0, input.days)

  return Array.from({ length }, (_, index) => {
    const offset = index - length + 1
    const dateKey = formatDateKey(addDays(today, offset))

    return {
      dateKey,
      checkedIn: checkedDateKeys.has(dateKey),
    }
  })
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`)
  }

  const [, year, month, day] = match
  if (!year || !month || !day) {
    throw new Error(`Invalid date key: ${dateKey}`)
  }

  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0),
  )
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function formatDateKey(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
