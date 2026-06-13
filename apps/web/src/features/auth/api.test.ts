import type { AuthSessionResponse } from '@wordscodex/contracts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authApi } from './api'

const sessionResponse = {
  accessToken: 'access-token',
  expiresInSeconds: 900,
  user: {
    id: 'user_123',
    email: null,
    displayName: '游客',
    role: 'learner',
    accountType: 'guest',
    timezone: 'Asia/Shanghai',
    createdAt: '2026-06-13T00:00:00.000Z',
    updatedAt: '2026-06-13T00:00:00.000Z',
  },
} satisfies AuthSessionResponse

describe('authApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not send an empty JSON content-type when refreshing a session', async () => {
    const fetchRecorder = mockJsonResponse(sessionResponse)
    vi.stubGlobal('fetch', fetchRecorder.fetchMock)

    await authApi.refresh()

    const init = fetchRecorder.getLastInit()
    const headers = new Headers(init.headers)
    expect(init.body).toBeUndefined()
    expect(headers.has('content-type')).toBe(false)
  })

  it('adds JSON content-type when a request has a body', async () => {
    const fetchRecorder = mockJsonResponse({
      accepted: true,
      expiresInSeconds: 600,
    })
    vi.stubGlobal('fetch', fetchRecorder.fetchMock)

    await authApi.requestCode('learner@example.com')

    const init = fetchRecorder.getLastInit()
    const headers = new Headers(init.headers)
    expect(headers.get('content-type')).toBe('application/json')
  })
})

function mockJsonResponse(body: unknown, status = 200) {
  let lastInit: RequestInit | undefined
  const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
    lastInit = init

    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )
  })

  return {
    fetchMock,
    getLastInit() {
      if (!lastInit) throw new Error('fetch was not called')
      return lastInit
    },
  }
}
