const MIGRATIONS = [
  { oldKey: 'hoboken-commuter-settings', newKey: 'msn-settings' },
  { oldKey: 'hoboken-commuter-stop-names', newKey: 'msn-stop-names' },
]

/**
 * Migrates localStorage keys from the old "hoboken-commuter-*" prefix
 * to the new "msn-*" prefix. Runs once on app load before settings are read.
 *
 * - Copies old key value to new key, then removes old key
 * - If new key already exists, removes old key without overwriting
 * - Validates JSON before migrating; skips corrupted data
 * - Wrapped in try/catch for localStorage unavailability (private browsing)
 */
export function migrateLocalStorage() {
  try {
    for (const { oldKey, newKey } of MIGRATIONS) {
      const oldValue = localStorage.getItem(oldKey)
      if (oldValue === null) continue

      // If new key already exists, just remove old
      if (localStorage.getItem(newKey) !== null) {
        localStorage.removeItem(oldKey)
        continue
      }

      // Validate JSON before migrating
      try {
        JSON.parse(oldValue)
        localStorage.setItem(newKey, oldValue)
      } catch {
        // Corrupted data — skip migration
      }
      localStorage.removeItem(oldKey)
    }
  } catch {
    // localStorage unavailable (e.g., private browsing) — skip migration entirely
  }
}
