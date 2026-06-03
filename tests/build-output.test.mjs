import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DIST_DASHBOARD = path.join(ROOT, 'dist', 'dashboard')
const DIST_MOBILE = path.join(ROOT, 'dist', 'mobile')

describe('Build output structure', () => {
  beforeAll(() => {
    execSync('npm run build', { cwd: ROOT, stdio: 'pipe', timeout: 60_000 })
  }, 90_000)

  it('dist/dashboard/index.html exists', () => {
    expect(fs.existsSync(path.join(DIST_DASHBOARD, 'index.html'))).toBe(true)
  })

  it('dist/mobile/mobile.html exists', () => {
    expect(fs.existsSync(path.join(DIST_MOBILE, 'mobile.html'))).toBe(true)
  })

  it('dashboard bundle does not contain mobile-exclusive source references', () => {
    // Walk all JS files in dist/dashboard and check none reference src/mobile/ paths
    const jsFiles = getAllFiles(DIST_DASHBOARD).filter(f => f.endsWith('.js'))
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8')
      // Mobile-exclusive components that should NOT appear in dashboard bundle
      expect(content).not.toContain('MobileApp')
      expect(content).not.toContain('TabBar')
      expect(content).not.toContain('AddStopPanel')
      expect(content).not.toContain('WelcomePage')
      expect(content).not.toContain('MyStopsPage')
    }
  })

  it('mobile bundle does not contain dashboard-exclusive source references', () => {
    // Walk all JS files in dist/mobile and check none reference desktop-exclusive code
    const jsFiles = getAllFiles(DIST_MOBILE).filter(f => f.endsWith('.js'))
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8')
      // Desktop-exclusive patterns from src/App.jsx that should NOT appear in mobile bundle
      expect(content).not.toContain('DynamicBusCard')
      expect(content).not.toContain('DynamicPathCard')
      expect(content).not.toContain('DynamicRailCard')
      expect(content).not.toContain('PRECONFIGURED_STOP_NAMES')
    }
  })
})

/** Recursively collect all files in a directory */
function getAllFiles(dir) {
  const results = []
  if (!fs.existsSync(dir)) return results
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath))
    } else {
      results.push(fullPath)
    }
  }
  return results
}
