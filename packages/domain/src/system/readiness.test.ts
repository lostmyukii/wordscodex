import { describe, expect, it } from 'vitest'
import { getSystemReadiness } from './readiness.js'

describe('getSystemReadiness', () => {
  it('reports ready when every dependency is reachable', () => {
    expect(
      getSystemReadiness({
        database: true,
        cache: true,
      }),
    ).toEqual({
      ready: true,
      unavailable: [],
    })
  })

  it('lists unavailable dependencies', () => {
    expect(
      getSystemReadiness({
        database: false,
        cache: true,
      }),
    ).toEqual({
      ready: false,
      unavailable: ['database'],
    })
  })
})
