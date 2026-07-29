import { describe, it, expect } from 'vitest'

/**
 * Integration tests for /api/bus/resolve-stops endpoint.
 * Requires the server to be running on localhost:3001 with GTFS loaded.
 *
 * Run with: npm run test:mobile
 */

const BASE = 'http://localhost:3001'

async function resolveStops(stopsQuery) {
  const res = await fetch(`${BASE}/api/bus/resolve-stops?stops=${encodeURIComponent(stopsQuery)}`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

describe('resolve-stops endpoint', () => {
  it('returns empty array for no input', async () => {
    const data = await resolveStops('')
    expect(data.resolved).toEqual([])
  })

  it('resolves a known stop by name and returns current IDs', async () => {
    // WILLOW AVE AT 15TH ST should resolve to valid IDs serving route 126
    const data = await resolveStops('WILLOW AVE AT 15TH ST|8001,16157:126')
    expect(data.resolved).toHaveLength(1)
    expect(data.resolved[0].changed).toBe(false)
    expect(data.resolved[0].ids).toContain('8001')
    expect(data.resolved[0].ids).toContain('16157')
  })

  it('detects stale IDs and resolves to new ones', async () => {
    // Old IDs 7940,16135 used to be WILLOW AVE AT 15TH ST but NJT reassigned them
    // Name-based resolution should find the correct current IDs
    const data = await resolveStops('WILLOW AVE AT 15TH ST|7940,16135:126')
    expect(data.resolved).toHaveLength(1)
    expect(data.resolved[0].changed).toBe(true)
    expect(data.resolved[0].ids).toContain('8001')
    expect(data.resolved[0].ids).toContain('16157')
  })

  it('handles multiple stops separated by semicolons', async () => {
    const data = await resolveStops('WILLOW AVE AT 15TH ST|8001,16157:126;CLINTON ST AT 11TH ST|7917:126')
    expect(data.resolved).toHaveLength(2)
  })

  it('returns changed:false when IDs are already correct', async () => {
    // First resolve to get current IDs, then re-resolve with those — should be unchanged
    const first = await resolveStops('WILLOW AVE AT 15TH ST|8001,16157:126')
    const currentIds = first.resolved[0].ids.join(',')
    const second = await resolveStops(`WILLOW AVE AT 15TH ST|${currentIds}:126`)
    expect(second.resolved[0].changed).toBe(false)
  })

  it('handles unknown stop name gracefully', async () => {
    const data = await resolveStops('NONEXISTENT FAKE STOP|99999:126')
    expect(data.resolved).toHaveLength(1)
    // Can't resolve — returns original IDs unchanged
    expect(data.resolved[0].ids).toEqual(['99999'])
    expect(data.resolved[0].changed).toBe(false)
  })

  it('falls back to ID-based lookup when no name provided', async () => {
    // Legacy format without name (just IDs:ROUTES)
    const data = await resolveStops('7917:126')
    expect(data.resolved).toHaveLength(1)
    // Should look up name from ID, then resolve
    expect(data.resolved[0].ids).toContain('7917')
  })
})
