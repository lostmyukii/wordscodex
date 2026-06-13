import type {
  AnalyticsEventName,
  AnalyticsProperties,
  CreateAnalyticsEventRequest,
  CreateAnalyticsEventResponse,
} from '@wordscodex/contracts'
import { analyticsApi } from './api'
import {
  analyticsEventQueue,
  type AnalyticsEventQueueClient as AnalyticsQueueClient,
} from './analytics-event-queue'

export type AnalyticsClient = {
  send(
    input: CreateAnalyticsEventRequest,
    accessToken?: string,
  ): Promise<CreateAnalyticsEventResponse>
}

export type AnalyticsEventQueueClient = AnalyticsQueueClient

export type TrackAnalyticsEventInput = {
  name: AnalyticsEventName
  properties?: AnalyticsProperties
}

export const analyticsEventQueuedEventName = 'wordscodex:analytics-event-queued'

type BrowserEventTarget = Pick<EventTarget, 'dispatchEvent'>

type TrackAnalyticsEventOptions = TrackAnalyticsEventInput & {
  accessToken?: string
  client?: AnalyticsClient
  queue?: AnalyticsQueueClient
  createEventId?: () => string
  eventTarget?: BrowserEventTarget | null
  isOnline?: () => boolean
  now?: () => Date
}

export type TrackAnalyticsEvent = (
  input: TrackAnalyticsEventInput,
) => Promise<void>

export async function trackEvent(input: TrackAnalyticsEventInput) {
  await trackAnalyticsEvent(input)
}

export async function trackAnalyticsEvent({
  accessToken,
  client = analyticsApi,
  queue = analyticsEventQueue,
  createEventId = createDefaultEventId,
  eventTarget = getDefaultEventTarget(),
  isOnline = getDefaultOnlineStatus,
  now = () => new Date(),
  name,
  properties = {},
}: TrackAnalyticsEventOptions): Promise<{ status: 'sent' | 'queued' }> {
  const payload: CreateAnalyticsEventRequest = {
    clientEventId: createEventId(),
    name,
    occurredAt: now().toISOString(),
    properties,
  }

  if (!isOnline()) {
    await queue.enqueue({
      ...payload,
      lastError: '浏览器离线，埋点已暂存。',
    })
    dispatchAnalyticsEventQueued(eventTarget)
    return { status: 'queued' }
  }

  try {
    await client.send(payload, accessToken)
    return { status: 'sent' }
  } catch (error) {
    await queue.enqueue({
      ...payload,
      lastError: getErrorMessage(error),
    })
    dispatchAnalyticsEventQueued(eventTarget)
    return { status: 'queued' }
  }
}

function createDefaultEventId() {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return `evt_${random}`
}

function getDefaultOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

function getDefaultEventTarget(): BrowserEventTarget | null {
  return typeof window === 'undefined' ? null : window
}

function dispatchAnalyticsEventQueued(eventTarget: BrowserEventTarget | null) {
  eventTarget?.dispatchEvent(new Event(analyticsEventQueuedEventName))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : '埋点暂时无法发送，已写入本地队列。'
}
