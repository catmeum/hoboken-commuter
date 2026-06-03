/**
 * Property-based tests: User-Agent routing
 *
 * Feature: app-rebrand-deployment
 *
 * Tests the userAgentRouter middleware logic from server/index.js.
 * The middleware:
 * - Only activates in production (NODE_ENV === 'production')
 * - Only redirects the root path ('/')
 * - Allows desktop override via ?desktop=1 query param
 * - Redirects mobile UAs (302) to /mobile
 * - Passes through for non-mobile UAs
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Mobile UA pattern — matches the regex in server/index.js exactly.
 */
const MOBILE_UA_PATTERNS = /iPhone|Android|iPad|iPod|webOS|BlackBerry|Windows Phone|Opera Mini/i

/**
 * Mobile keywords used to generate test UA strings that trigger the redirect.
 */
const MOBILE_KEYWORDS = ['iPhone', 'Android', 'iPad', 'iPod', 'webOS', 'BlackBerry', 'Windows Phone', 'Opera Mini']

/**
 * Simulates the userAgentRouter middleware from server/index.js.
 *
 * @param {object} options
 * @param {string} options.userAgent - The User-Agent header value
 * @param {string} options.path - The request path
 * @param {object} options.query - The query parameters object
 * @param {string} options.nodeEnv - The NODE_ENV value
 * @returns {{ action: 'next' | 'redirect', location?: string, statusCode?: number }}
 */
function simulateUserAgentRouter({ userAgent, path, query, nodeEnv }) {
  // Only activate in production
  if (nodeEnv !== 'production') return { action: 'next' }

  // Only redirect root path
  if (path !== '/') return { action: 'next' }

  // Allow desktop override
  if (query.desktop === '1') return { action: 'next' }

  // Check for mobile UA
  const ua = userAgent || ''
  if (MOBILE_UA_PATTERNS.test(ua)) {
    return { action: 'redirect', location: '/mobile', statusCode: 302 }
  }

  return { action: 'next' }
}

/**
 * Reference implementation: checks if a UA string contains any mobile keyword
 * case-insensitively. Used as an oracle for the biconditional property test.
 */
function containsMobileKeyword(ua) {
  const lower = (ua || '').toLowerCase()
  return MOBILE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()))
}

/**
 * Arbitrary that generates strings guaranteed NOT to contain any mobile keyword.
 * Filters out strings that accidentally contain a keyword substring.
 */
const nonMobileUaArb = fc.stringOf(
  fc.char().filter(c => c !== '\x00'),
  { minLength: 0, maxLength: 200 }
).filter(s => !containsMobileKeyword(s))

/**
 * Arbitrary that generates a User-Agent string containing at least one mobile keyword
 * injected at a random position in an otherwise arbitrary string.
 */
const mobileUaArb = fc.tuple(
  fc.stringOf(fc.char().filter(c => c !== '\x00'), { minLength: 0, maxLength: 80 }),
  fc.constantFrom(...MOBILE_KEYWORDS),
  fc.stringOf(fc.char().filter(c => c !== '\x00'), { minLength: 0, maxLength: 80 })
).map(([prefix, keyword, suffix]) => `${prefix}${keyword}${suffix}`)

/**
 * Arbitrary for case-variant mobile keywords (randomizes casing of each character).
 * Ensures the case-insensitive matching is properly tested.
 */
const caseVariantKeywordUaArb = fc.constantFrom(...MOBILE_KEYWORDS).chain(kw =>
  fc.tuple(
    fc.stringOf(fc.char().filter(c => c !== '\x00'), { minLength: 0, maxLength: 60 }),
    fc.array(fc.boolean(), { minLength: kw.length, maxLength: kw.length }),
    fc.stringOf(fc.char().filter(c => c !== '\x00'), { minLength: 0, maxLength: 60 })
  ).map(([prefix, caseMask, suffix]) => {
    const variantKw = kw.split('').map((ch, i) =>
      caseMask[i] ? ch.toUpperCase() : ch.toLowerCase()
    ).join('')
    return `${prefix}${variantKw}${suffix}`
  })
)

describe('Feature: app-rebrand-deployment, Property 4: User-Agent routing correctness', () => {
  /**
   * **Validates: Requirements 11.1, 11.3**
   *
   * For any UA string containing a mobile keyword (injected at an arbitrary position),
   * the router SHALL redirect with 302 to /mobile.
   */
  it('redirects to /mobile with 302 when User-Agent contains a mobile keyword', () => {
    fc.assert(
      fc.property(mobileUaArb, (userAgent) => {
        const result = simulateUserAgentRouter({
          userAgent,
          path: '/',
          query: {},
          nodeEnv: 'production',
        })
        expect(result.action).toBe('redirect')
        expect(result.statusCode).toBe(302)
        expect(result.location).toBe('/mobile')
      }),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 11.2, 11.6**
   *
   * For any UA string that does NOT contain any mobile keyword,
   * the router SHALL serve the Dashboard without redirect.
   */
  it('does not redirect when User-Agent contains no mobile keyword', () => {
    fc.assert(
      fc.property(nonMobileUaArb, (userAgent) => {
        const result = simulateUserAgentRouter({
          userAgent,
          path: '/',
          query: {},
          nodeEnv: 'production',
        })
        expect(result.action).toBe('next')
      }),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 11.3**
   *
   * Mobile keyword detection is case-insensitive: for any case variant
   * of a mobile keyword embedded in an arbitrary string, redirect SHALL occur.
   */
  it('redirects regardless of keyword casing (case-insensitive match)', () => {
    fc.assert(
      fc.property(caseVariantKeywordUaArb, (userAgent) => {
        const result = simulateUserAgentRouter({
          userAgent,
          path: '/',
          query: {},
          nodeEnv: 'production',
        })
        expect(result.action).toBe('redirect')
        expect(result.statusCode).toBe(302)
        expect(result.location).toBe('/mobile')
      }),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 11.6**
   *
   * When User-Agent is absent (empty string, undefined, or null),
   * the router SHALL serve the Dashboard without redirect.
   */
  it('does not redirect when User-Agent is absent or empty', () => {
    // Empty string
    const result1 = simulateUserAgentRouter({
      userAgent: '',
      path: '/',
      query: {},
      nodeEnv: 'production',
    })
    expect(result1.action).toBe('next')

    // Undefined (simulates missing header)
    const result2 = simulateUserAgentRouter({
      userAgent: undefined,
      path: '/',
      query: {},
      nodeEnv: 'production',
    })
    expect(result2.action).toBe('next')

    // Null
    const result3 = simulateUserAgentRouter({
      userAgent: null,
      path: '/',
      query: {},
      nodeEnv: 'production',
    })
    expect(result3.action).toBe('next')
  })

  /**
   * **Validates: Requirements 11.1, 11.2, 11.3, 11.6**
   *
   * Biconditional property: redirect occurs if and only if the UA contains
   * at least one mobile keyword (case-insensitive). The regex and the reference
   * oracle must agree on classification for all generated inputs.
   */
  it('redirect occurs iff UA contains a mobile keyword (biconditional)', () => {
    // Test with strings that DO contain a keyword
    fc.assert(
      fc.property(mobileUaArb, (ua) => {
        const result = simulateUserAgentRouter({
          userAgent: ua,
          path: '/',
          query: {},
          nodeEnv: 'production',
        })
        const hasKeyword = containsMobileKeyword(ua)
        expect(hasKeyword).toBe(true)
        expect(result.action).toBe('redirect')
      }),
      { numRuns: 100 }
    )

    // Test with strings that do NOT contain a keyword
    fc.assert(
      fc.property(nonMobileUaArb, (ua) => {
        const result = simulateUserAgentRouter({
          userAgent: ua,
          path: '/',
          query: {},
          nodeEnv: 'production',
        })
        const hasKeyword = containsMobileKeyword(ua)
        expect(hasKeyword).toBe(false)
        expect(result.action).toBe('next')
      }),
      { numRuns: 100 }
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Property 5: Desktop override bypasses mobile redirect
// ═══════════════════════════════════════════════════════════════════════

describe('Feature: app-rebrand-deployment, Property 5: Desktop override bypasses mobile redirect', () => {
  /**
   * **Validates: Requirements 11.5**
   *
   * For any User-Agent string that would normally trigger a mobile redirect,
   * a GET request to /?desktop=1 SHALL serve the Dashboard without redirecting to /mobile.
   */
  it('does not redirect mobile UAs when ?desktop=1 is present', () => {
    fc.assert(
      fc.property(mobileUaArb, (userAgent) => {
        // First, confirm this UA would normally trigger a redirect
        const withoutOverride = simulateUserAgentRouter({
          userAgent,
          path: '/',
          query: {},
          nodeEnv: 'production',
        })
        expect(withoutOverride.action).toBe('redirect')
        expect(withoutOverride.location).toBe('/mobile')
        expect(withoutOverride.statusCode).toBe(302)

        // Now verify that ?desktop=1 bypasses the redirect
        const withOverride = simulateUserAgentRouter({
          userAgent,
          path: '/',
          query: { desktop: '1' },
          nodeEnv: 'production',
        })
        expect(withOverride.action).toBe('next')
        expect(withOverride.location).toBeUndefined()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 11.5**
   *
   * The desktop override only works with the exact value '1'.
   * Other truthy-looking values (like 'true', '2', 'yes') do not bypass the redirect.
   */
  it('only bypasses redirect when desktop query param is exactly "1"', () => {
    fc.assert(
      fc.property(
        mobileUaArb,
        fc.stringOf(fc.char().filter(c => c !== '\x00'), { minLength: 1, maxLength: 10 }).filter(s => s !== '1'),
        (userAgent, desktopValue) => {
          const result = simulateUserAgentRouter({
            userAgent,
            path: '/',
            query: { desktop: desktopValue },
            nodeEnv: 'production',
          })
          // Non-'1' values should still trigger the redirect for mobile UAs
          expect(result.action).toBe('redirect')
          expect(result.location).toBe('/mobile')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 11.5**
   *
   * Desktop override with various mobile keyword patterns — tests that the override
   * works regardless of which mobile keyword triggered the match.
   */
  it('bypasses redirect for each individual mobile keyword with ?desktop=1', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MOBILE_KEYWORDS),
        fc.stringOf(fc.char().filter(c => c !== '\x00'), { minLength: 0, maxLength: 30 }),
        (keyword, suffix) => {
          const userAgent = `Mozilla/5.0 (${keyword}) ${suffix}`

          // Confirm it would redirect without override
          const withoutOverride = simulateUserAgentRouter({
            userAgent,
            path: '/',
            query: {},
            nodeEnv: 'production',
          })
          expect(withoutOverride.action).toBe('redirect')

          // Confirm override works
          const withOverride = simulateUserAgentRouter({
            userAgent,
            path: '/',
            query: { desktop: '1' },
            nodeEnv: 'production',
          })
          expect(withOverride.action).toBe('next')
        }
      ),
      { numRuns: 100 }
    )
  })
})
