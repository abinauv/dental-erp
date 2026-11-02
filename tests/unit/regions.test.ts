import { describe, it, expect } from 'vitest'
import { getRegions, hasRegions } from '@/lib/geo/regions'

describe('geo/regions', () => {
  it('returns Indian states/UTs for IN', () => {
    const r = getRegions('IN')
    expect(r).toContain('Tamil Nadu')
    expect(r).toContain('Delhi')
    expect(r.length).toBe(36) // 28 states + 8 UTs
  })

  it('returns US states + DC for US (case-insensitive)', () => {
    const r = getRegions('us')
    expect(r).toContain('California')
    expect(r).toContain('District of Columbia')
    expect(r.length).toBe(51)
  })

  it('returns an empty list (free-text) for unknown/empty country', () => {
    expect(getRegions('FR')).toEqual([])
    expect(getRegions(undefined)).toEqual([])
    expect(hasRegions('FR')).toBe(false)
    expect(hasRegions('IN')).toBe(true)
  })
})
