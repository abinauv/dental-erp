import { describe, it, expect } from 'vitest'
import { ceilToUTCDay } from '@/lib/date-column'

describe('ceilToUTCDay', () => {
  it('moves a time of day to the next UTC midnight', () => {
    expect(ceilToUTCDay(new Date('2026-11-11T03:13:07.590Z')).toISOString()).toBe(
      '2026-11-12T00:00:00.000Z'
    )
  })

  it('keeps a UTC midnight as it is', () => {
    expect(ceilToUTCDay(new Date('2026-11-11T00:00:00.000Z')).toISOString()).toBe(
      '2026-11-11T00:00:00.000Z'
    )
  })

  it('treats one millisecond past midnight as a time of day', () => {
    expect(ceilToUTCDay(new Date('2026-11-11T00:00:00.001Z')).toISOString()).toBe(
      '2026-11-12T00:00:00.000Z'
    )
  })

  it('crosses month and year ends', () => {
    expect(ceilToUTCDay(new Date('2026-12-31T23:59:59.999Z')).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z'
    )
  })

  // On a DATE column, `>= t` and `< t` with a time of day meant the same as
  // `>=` / `<` the next midnight while Prisma sent full timestamps.
  it('splits days the way a full-timestamp comparison did', () => {
    const now = new Date('2026-11-11T03:13:00Z')
    const days = ['2026-11-10', '2026-11-11', '2026-11-12'].map((d) => new Date(`${d}T00:00:00Z`))
    const bound = ceilToUTCDay(now)
    expect(days.map((d) => d >= now)).toEqual(days.map((d) => d >= bound))
    expect(days.map((d) => d < now)).toEqual(days.map((d) => d < bound))
  })
})
