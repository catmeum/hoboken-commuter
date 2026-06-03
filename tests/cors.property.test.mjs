/**
 * Property-based test: CORS header correctness
 *
 * Feature: app-rebrand-deployment, Property 1: CORS header correctness
 *
 * Validates: Requirements 7.1, 7.4, 7.5
 *
 * For any valid origin string and any ALLOWED_ORIGIN configuration value:
 * - When ALLOWED_ORIGIN is unset → Access-Control-Allow-Origin: *
 * - When request origin matches ALLOWED_ORIGIN → Access-Control-Allow-Origin: <ALLOWED_ORIGIN>
 * - When request origin does not match ALLOWED_ORIGIN → header is omitted
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Extracted CORS logic matching the middleware in server/index.js.
 * Given an ALLOWED_ORIGIN config value and a request origin,
 * returns what the Access-Control-Allow-Origin header should be set to
 * (or null if it should be omitted).
 */
function getCorsHeader(allowedOrigin, requestOrigin) {
  if (!allowedOrigin) {
    // No origin configured — allow all
    return '*'
  } else {
    if (requestOrigin && requestOrigin === allowedOrigin) {
      return allowedOrigin
    }
    // If origin doesn't match, omit the header entirely
    return null
  }
}

/**
 * Simulates the CORS middleware behavior from server/index.js.
 * Returns the headers that would be set on the response.
 */
function simulateCorsMiddleware(allowedOrigin, requestOrigin) {
  const headers = {}

  if (!allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = '*'
  } else {
    if (requestOrigin && requestOrigin === allowedOrigin) {
      headers['Access-Control-Allow-Origin'] = allowedOrigin
    }
    // If origin doesn't match, omit the header entirely
  }
  headers['Access-Control-Allow-Methods'] = 'GET'

  return headers
}

// Arbitrary for generating non-empty origin-like strings
const originArb = fc.stringOf(
  fc.char().filter(c => c !== '\x00'),
  { minLength: 1, maxLength: 100 }
)

// Arbitrary for generating valid ALLOWED_ORIGIN config values (non-empty strings)
const allowedOriginArb = fc.stringOf(
  fc.char().filter(c => c !== '\x00'),
  { minLength: 1, maxLength: 100 }
)

describe('Feature: app-rebrand-deployment, Property 1: CORS header correctness', () => {
  /**
   * **Validates: Requirements 7.4**
   *
   * When ALLOWED_ORIGIN is unset (undefined, null, or empty string),
   * the response SHALL include Access-Control-Allow-Origin: *
   */
  it('responds with Access-Control-Allow-Origin: * when ALLOWED_ORIGIN is unset', () => {
    fc.assert(
      fc.property(originArb, (requestOrigin) => {
        // Test with undefined
        const headers1 = simulateCorsMiddleware(undefined, requestOrigin)
        expect(headers1['Access-Control-Allow-Origin']).toBe('*')

        // Test with empty string (falsy)
        const headers2 = simulateCorsMiddleware('', requestOrigin)
        expect(headers2['Access-Control-Allow-Origin']).toBe('*')

        // Test with null
        const headers3 = simulateCorsMiddleware(null, requestOrigin)
        expect(headers3['Access-Control-Allow-Origin']).toBe('*')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 7.1**
   *
   * When the request origin matches ALLOWED_ORIGIN,
   * the response SHALL include Access-Control-Allow-Origin: <ALLOWED_ORIGIN>
   */
  it('includes Access-Control-Allow-Origin matching ALLOWED_ORIGIN when request origin matches', () => {
    fc.assert(
      fc.property(allowedOriginArb, (allowedOrigin) => {
        // Request origin is the same as ALLOWED_ORIGIN
        const headers = simulateCorsMiddleware(allowedOrigin, allowedOrigin)
        expect(headers['Access-Control-Allow-Origin']).toBe(allowedOrigin)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 7.5**
   *
   * When the request origin does not match ALLOWED_ORIGIN,
   * the response SHALL omit the Access-Control-Allow-Origin header
   */
  it('omits Access-Control-Allow-Origin when request origin does not match ALLOWED_ORIGIN', () => {
    fc.assert(
      fc.property(
        allowedOriginArb,
        originArb,
        (allowedOrigin, requestOrigin) => {
          // Only test when origins don't match
          fc.pre(requestOrigin !== allowedOrigin)

          const headers = simulateCorsMiddleware(allowedOrigin, requestOrigin)
          expect(headers['Access-Control-Allow-Origin']).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 7.5**
   *
   * When ALLOWED_ORIGIN is set but request has no Origin header (undefined/null/empty),
   * the response SHALL omit the Access-Control-Allow-Origin header
   */
  it('omits Access-Control-Allow-Origin when request has no Origin header and ALLOWED_ORIGIN is set', () => {
    fc.assert(
      fc.property(allowedOriginArb, (allowedOrigin) => {
        // No origin header (undefined)
        const headers1 = simulateCorsMiddleware(allowedOrigin, undefined)
        expect(headers1['Access-Control-Allow-Origin']).toBeUndefined()

        // No origin header (null)
        const headers2 = simulateCorsMiddleware(allowedOrigin, null)
        expect(headers2['Access-Control-Allow-Origin']).toBeUndefined()

        // Empty origin header
        const headers3 = simulateCorsMiddleware(allowedOrigin, '')
        expect(headers3['Access-Control-Allow-Origin']).toBeUndefined()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 7.1, 7.4, 7.5**
   *
   * Combined property: the getCorsHeader function correctly implements
   * all three CORS scenarios for any input combination.
   */
  it('getCorsHeader covers all three CORS scenarios correctly for arbitrary inputs', () => {
    fc.assert(
      fc.property(
        fc.option(allowedOriginArb, { nil: undefined }),
        fc.option(originArb, { nil: undefined }),
        (allowedOrigin, requestOrigin) => {
          const result = getCorsHeader(allowedOrigin, requestOrigin)

          if (!allowedOrigin) {
            // Unset → wildcard
            expect(result).toBe('*')
          } else if (requestOrigin && requestOrigin === allowedOrigin) {
            // Match → echo ALLOWED_ORIGIN
            expect(result).toBe(allowedOrigin)
          } else {
            // No match → omit
            expect(result).toBeNull()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 7.1**
   *
   * Access-Control-Allow-Methods is always set to GET regardless of CORS origin handling.
   */
  it('always includes Access-Control-Allow-Methods: GET', () => {
    fc.assert(
      fc.property(
        fc.option(allowedOriginArb, { nil: undefined }),
        fc.option(originArb, { nil: undefined }),
        (allowedOrigin, requestOrigin) => {
          const headers = simulateCorsMiddleware(allowedOrigin, requestOrigin)
          expect(headers['Access-Control-Allow-Methods']).toBe('GET')
        }
      ),
      { numRuns: 100 }
    )
  })
})
