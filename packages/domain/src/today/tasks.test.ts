import { describe, expect, it } from 'vitest'
import { buildTodayTasks } from './tasks.js'

describe('buildTodayTasks', () => {
  it('orders due reviews before new words and applies daily limits', () => {
    const result = buildTodayTasks({
      hasActivePlan: true,
      dueReviewCount: 42,
      newWordsAvailable: 12,
      dailyNewWordTarget: 8,
      dailyReviewLimit: 30,
    })

    expect(result).toEqual([
      {
        type: 'review',
        title: '到期复习',
        count: 30,
        description: '优先完成已经到期的复习词。',
      },
      {
        type: 'new_words',
        title: '今日新词',
        count: 8,
        description: '学习计划安排的新词任务。',
      },
    ])
  })

  it('uses the available new word count when fewer words remain', () => {
    const result = buildTodayTasks({
      hasActivePlan: true,
      dueReviewCount: 0,
      newWordsAvailable: 3,
      dailyNewWordTarget: 10,
      dailyReviewLimit: 30,
    })

    expect(result).toEqual([
      {
        type: 'new_words',
        title: '今日新词',
        count: 3,
        description: '学习计划安排的新词任务。',
      },
    ])
  })

  it('returns no tasks when there is no active plan', () => {
    expect(
      buildTodayTasks({
        hasActivePlan: false,
        dueReviewCount: 99,
        newWordsAvailable: 99,
        dailyNewWordTarget: 50,
        dailyReviewLimit: 80,
      }),
    ).toEqual([])
  })
})
