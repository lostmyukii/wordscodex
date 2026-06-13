export type TodayTaskType = 'review' | 'new_words'

export type TodayTask = {
  type: TodayTaskType
  title: string
  count: number
  description: string
}

export type BuildTodayTasksInput = {
  hasActivePlan: boolean
  dueReviewCount: number
  newWordsAvailable: number
  dailyNewWordTarget: number
  dailyReviewLimit: number
}

export function buildTodayTasks(input: BuildTodayTasksInput): TodayTask[] {
  if (!input.hasActivePlan) return []

  const reviewCount = Math.min(
    normalizeCount(input.dueReviewCount),
    normalizeCount(input.dailyReviewLimit),
  )
  const newWordCount = Math.min(
    normalizeCount(input.newWordsAvailable),
    normalizeCount(input.dailyNewWordTarget),
  )
  const tasks: TodayTask[] = []

  if (reviewCount > 0) {
    tasks.push({
      type: 'review',
      title: '到期复习',
      count: reviewCount,
      description: '优先完成已经到期的复习词。',
    })
  }

  if (newWordCount > 0) {
    tasks.push({
      type: 'new_words',
      title: '今日新词',
      count: newWordCount,
      description: '学习计划安排的新词任务。',
    })
  }

  return tasks
}

function normalizeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}
