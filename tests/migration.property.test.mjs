/**
 * @vitest-environment jsdom
 */

/**
 * Property-Based Test: localStorage migration preserves data
 *
 * Feature: app-rebrand-deployment, Property 2: localStorage migration preserves data
 *
 * For any valid JSON string stored under an old localStorage key
 * (either `hoboken-commuter-settings` or `hoboken-commuter-stop-names`),
 * after running the migration function, the corresponding new key
 * (`msn-settings` or `msn-stop-names`) SHALL contain a byte-for-byte
 * identical copy of the original value, and the old key SHALL no longer
 * exist in localStorage.
 *
 * Validates: Requirements 9.1, 9.2
 */

import { describe, it, beforeEach, beforeAll } from 'vitest'
import fc from 'fast-check'
import { migrateLocalStorage } from '../src/utils/migrateStorage.js'

// Polyfill localStorage for jsdom environments that don't provide it (Node 25+/jsdom 29)
beforeAll(() => {
  if (typeof window !== 'undefined' && !window.localStorage) {
    const store = new Map()
    const storage = {
      getItem: (key) => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
      get length() { return store.size },
      key: (index) => [...store.keys()][index] ?? null,
    }
    Object.defineProperty(window, 'localStorage', { value: storage, writable: true })
    // Also expose on globalThis so bare `localStorage` references work
    if (typeof globalThis.localStorage === 'undefined') {
      Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true })
    }
  }
})

const KEY_PAIRS = [
  { oldKey: 'hoboken-commuter-settings', newKey: 'msn-settings' },
  { oldKey: 'hoboken-commuter-stop-names', newKey: 'msn-stop-names' },
]

describe('Feature: app-rebrand-deployment, Property 2: localStorage migration preserves data', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  /**
   * **Validates: Requirements 9.1, 9.2**
   *
   * For any valid JSON value stored under an old key, migration copies
   * the stringified value byte-for-byte to the new key and removes the old key.
   */
  it('migrated value under new key is byte-for-byte identical to original, and old key is removed', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          { arbitrary: fc.constant(KEY_PAIRS[0]), weight: 1 },
          { arbitrary: fc.constant(KEY_PAIRS[1]), weight: 1 }
        ),
        fc.jsonValue(),
        ({ oldKey, newKey }, jsonValue) => {
          // Setup: store a valid JSON string under the old key
          const storedValue = JSON.stringify(jsonValue)
          localStorage.clear()
          localStorage.setItem(oldKey, storedValue)

          // Act: run migration
          migrateLocalStorage()

          // Assert: new key has byte-for-byte identical value
          const newValue = localStorage.getItem(newKey)
          if (newValue !== storedValue) {
            return false
          }

          // Assert: old key is removed
          if (localStorage.getItem(oldKey) !== null) {
            return false
          }

          return true
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 9.1, 9.2**
   *
   * Both key pairs are migrated correctly in a single migration call
   * when both old keys contain valid JSON.
   */
  it('both key pairs are migrated simultaneously preserving data for each', () => {
    fc.assert(
      fc.property(
        fc.jsonValue(),
        fc.jsonValue(),
        (jsonValue1, jsonValue2) => {
          const stored1 = JSON.stringify(jsonValue1)
          const stored2 = JSON.stringify(jsonValue2)

          localStorage.clear()
          localStorage.setItem('hoboken-commuter-settings', stored1)
          localStorage.setItem('hoboken-commuter-stop-names', stored2)

          migrateLocalStorage()

          // Both new keys have identical copies
          if (localStorage.getItem('msn-settings') !== stored1) return false
          if (localStorage.getItem('msn-stop-names') !== stored2) return false

          // Both old keys are removed
          if (localStorage.getItem('hoboken-commuter-settings') !== null) return false
          if (localStorage.getItem('hoboken-commuter-stop-names') !== null) return false

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
