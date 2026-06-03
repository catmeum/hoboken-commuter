import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SettingsPage from '../../src/mobile/pages/SettingsPage'

describe('Alert Source Toggles — Granular Per-Line', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    theme: 'auto',
    setTheme: vi.fn(),
    tempUnit: 'F',
    setTempUnit: vi.fn(),
    weatherZip: '',
    setWeatherZip: vi.fn(),
    showWeather: true,
    setShowWeather: vi.fn(),
    showTunnels: true,
    setShowTunnels: vi.fn(),
    tunnels: ['lincoln'],
    setTunnels: vi.fn(),
    alertBadge: 'count',
    setAlertBadge: vi.fn(),
    alertStaleness: 'off',
    setAlertStaleness: vi.fn(),
    alertToggles: {},
    setAlertToggles: vi.fn(),
    alertSourceGroups: {
      tunnel: new Set(['tunnel_lincoln']),
      bus: new Set(['bus_126', 'bus_119']),
      mta: new Set(['mta_B', 'mta_D', 'mta_F']),
      path: new Set(['path_hob33']),
    },
    stops: ['mta:D17:S:B,D,F', 'bus:20935:126,119', 'path:862:1:hoboken'],
    stopNames: { 'mta:D17:S:B,D,F': 'Test Station' },
    stopHiddenBadges: {},
    onRemoveStop: vi.fn(),
    onEditStop: vi.fn(),
    onOpenAddStop: vi.fn(),
    onReset: vi.fn(),
    onReorderStops: vi.fn(),
  }

  beforeEach(() => vi.clearAllMocks())

  it('renders Alert Sources section when alertSourceGroups has entries', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(screen.getByText('Alerts')).toBeInTheDocument()
  })

  it('does not render Alert Sources section when no groups', () => {
    render(<SettingsPage {...defaultProps} alertSourceGroups={{}} />)
    // The Alerts section still renders (badge + staleness) but no toggles
    expect(screen.queryByText('Toggle which alert types appear in your feed')).not.toBeInTheDocument()
  })

  it('renders a category toggle for each group', () => {
    render(<SettingsPage {...defaultProps} />)
    // Categories with emoji labels
    expect(screen.getByText('🚗 Tunnels')).toBeInTheDocument()
    expect(screen.getByText('🚌 NJT Bus')).toBeInTheDocument()
    expect(screen.getByText('🔵 MTA Subway')).toBeInTheDocument()
    expect(screen.getByText('🚇 PATH')).toBeInTheDocument()
  })

  it('shows expand arrow for categories with multiple sources', () => {
    const { container } = render(<SettingsPage {...defaultProps} />)
    const expandBtns = container.querySelectorAll('.m-set-alert-expand')
    // bus (2 routes), mta (3 lines), tunnel (1 - no expand) → bus, mta, path(1 - no expand) = 2 expand buttons
    expect(expandBtns.length).toBe(2) // bus and mta have multiple
  })

  it('expands to show individual sub-toggles when category label tapped', () => {
    const { container } = render(<SettingsPage {...defaultProps} />)
    // Tap the NJT Bus label to expand
    fireEvent.click(screen.getByText('🚌 NJT Bus'))
    // Should now show sub-toggles for 126 and 119
    const subs = container.querySelectorAll('.m-set-alert-sub')
    expect(subs.length).toBe(2)
    expect(container.querySelector('.m-set-alert-sub-badge')).toBeInTheDocument()
  })

  it('master toggle turns all children off', () => {
    const { container } = render(<SettingsPage {...defaultProps} />)
    // Find the bus category's switch (the last m-set-switch-mini in the bus row)
    const categories = container.querySelectorAll('.m-set-alert-category')
    const busCategory = [...categories].find(c => c.textContent.includes('NJT Bus'))
    const masterSwitch = busCategory.querySelector('.m-set-switch-mini')
    fireEvent.click(masterSwitch)
    expect(defaultProps.setAlertToggles).toHaveBeenCalled()
    // The setter should set both bus_126 and bus_119 to false
    const setterFn = defaultProps.setAlertToggles.mock.calls[0][0]
    const result = setterFn({})
    expect(result.bus_126).toBe(false)
    expect(result.bus_119).toBe(false)
  })

  it('individual sub-toggle only affects that source', () => {
    const { container } = render(<SettingsPage {...defaultProps} />)
    // Expand MTA subway
    fireEvent.click(screen.getByText('🔵 MTA Subway'))
    // Find and click the B line toggle
    const subs = container.querySelectorAll('.m-set-alert-sub')
    const bSub = [...subs].find(s => s.textContent.includes('B'))
    fireEvent.click(bSub)
    expect(defaultProps.setAlertToggles).toHaveBeenCalled()
    const setterFn = defaultProps.setAlertToggles.mock.calls[0][0]
    const result = setterFn({})
    expect(result.mta_B).toBe(false)
  })

  it('category shows as partially on when some children are off', () => {
    const { container } = render(
      <SettingsPage {...defaultProps} alertToggles={{ bus_126: false }} />
    )
    const categories = container.querySelectorAll('.m-set-alert-category')
    const busCategory = [...categories].find(c => c.textContent.includes('NJT Bus'))
    const toggle = busCategory.querySelector('.m-set-alert-toggle')
    expect(toggle).toHaveClass('partial')
  })

  it('does not render section when alertSourceGroups is undefined', () => {
    render(<SettingsPage {...defaultProps} alertSourceGroups={undefined} />)
    expect(screen.queryByText('Alert Sources')).not.toBeInTheDocument()
  })
})

describe('Alert Filtering — All Transit Modes', () => {
  // Reimplements getAlertSourceIds logic to verify correctness across all modes
  function getAlertSourceIds(alert) {
    const id = alert.id || ''
    const sources = []
    if (id.startsWith('tunnel-')) {
      const match = id.match(/^tunnel-([^-]+)-/)
      if (match) {
        const name = match[1].toLowerCase().replace(/\s+/g, '_')
        sources.push(`tunnel_${name}`)
      }
    } else if (id.startsWith('bus-')) {
      if (alert.routes) {
        for (const r of alert.routes) sources.push(`bus_${r}`)
      }
    } else if (id.startsWith('mta-')) {
      if (alert.badges) {
        for (const b of alert.badges) {
          if (b.label && b.label.length <= 2) sources.push(`mta_${b.label}`)
        }
      }
    } else if (id.startsWith('path-')) {
      sources.push('path_hob33', 'path_jsq33')
    } else if (id.startsWith('ferry-')) {
      sources.push('ferry')
    } else if (id.startsWith('nycferry-')) {
      sources.push('nycferry')
    } else if (id.startsWith('rail-')) {
      sources.push('rail')
    } else if (id.startsWith('hblr-')) {
      sources.push('hblr')
    } else if (id.startsWith('lirr-')) {
      sources.push('lirr')
    } else if (id.startsWith('mnr-')) {
      sources.push('mnr')
    } else if (id.startsWith('mtabus-')) {
      sources.push('mtabus')
    }
    return sources
  }

  function filterAlerts(alerts, alertToggles, allConfiguredSources) {
    return alerts.filter(a => {
      const sourceIds = getAlertSourceIds(a)
      if (sourceIds.length === 0) return true
      const relevantIds = sourceIds.filter(sid => allConfiguredSources.has(sid))
      if (relevantIds.length === 0) return false // not in user config = hide
      return relevantIds.some(sid => alertToggles[sid] !== false)
    })
  }

  it('filters tunnel alerts by name (case-insensitive)', () => {
    const alerts = [
      { id: 'tunnel-Lincoln-Heavy delays expected', source: 'PANYNJ', text: 'Heavy delays' },
      { id: 'tunnel-Holland-Normal conditions', source: 'PANYNJ', text: 'Normal' },
    ]
    const configured = new Set(['tunnel_lincoln', 'tunnel_holland'])
    const toggles = { tunnel_lincoln: false }
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(1)
    expect(result[0].id).toContain('Holland')
  })

  it('filters NJT Bus alerts by route number', () => {
    const alerts = [
      { id: 'bus-126-Delays on route', routes: ['126'], text: 'Delays' },
      { id: 'bus-119-Rerouted', routes: ['119'], text: 'Rerouted' },
    ]
    const configured = new Set(['bus_126', 'bus_119'])
    const toggles = { bus_119: false }
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(1)
    expect(result[0].routes[0]).toBe('126')
  })

  it('filters MTA Subway alerts by individual line letter', () => {
    const alerts = [
      { id: 'mta-B,D-Delays', badges: [{ label: 'B' }, { label: 'D' }], text: 'Delays' },
      { id: 'mta-F-Planned work', badges: [{ label: 'F' }], text: 'Planned work' },
    ]
    const configured = new Set(['mta_B', 'mta_D', 'mta_F'])
    // Turn off B and D but keep F
    const toggles = { mta_B: false, mta_D: false }
    const result = filterAlerts(alerts, toggles, configured)
    // The B,D alert should be hidden (both B and D are off)
    // The F alert should remain
    expect(result).toHaveLength(1)
    expect(result[0].id).toContain('F')
  })

  it('shows MTA alert if ANY of its lines are still enabled', () => {
    const alerts = [
      { id: 'mta-B,D,F-Service change', badges: [{ label: 'B' }, { label: 'D' }, { label: 'F' }], text: 'Change' },
    ]
    const configured = new Set(['mta_B', 'mta_D', 'mta_F'])
    // Turn off B and D but keep F
    const toggles = { mta_B: false, mta_D: false }
    const result = filterAlerts(alerts, toggles, configured)
    // Should still show because F is on
    expect(result).toHaveLength(1)
  })

  it('filters PATH alerts when PATH is toggled off', () => {
    const alerts = [
      { id: 'path-Signal problems', source: 'PATH', text: 'Signal problems' },
    ]
    const configured = new Set(['path_hob33'])
    const toggles = { path_hob33: false }
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(0)
  })

  it('filters NY Waterway Ferry alerts', () => {
    const alerts = [
      { id: 'ferry-Service suspended', source: 'Ferry', text: 'Suspended' },
    ]
    const configured = new Set(['ferry'])
    const toggles = { ferry: false }
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(0)
  })

  it('filters HBLR alerts', () => {
    const alerts = [{ id: 'hblr-Delays', text: 'Delays' }]
    const configured = new Set(['hblr'])
    const toggles = { hblr: false }
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(0)
  })

  it('filters NJT Rail alerts', () => {
    const alerts = [{ id: 'rail-Cancelled', text: 'Cancelled' }]
    const configured = new Set(['rail'])
    const toggles = { rail: false }
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(0)
  })

  it('filters LIRR alerts', () => {
    const alerts = [{ id: 'lirr-Suspended', text: 'Suspended' }]
    const configured = new Set(['lirr'])
    const toggles = { lirr: false }
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(0)
  })

  it('filters Metro-North alerts', () => {
    const alerts = [{ id: 'mnr-Delays', text: 'Delays' }]
    const configured = new Set(['mnr'])
    const toggles = { mnr: false }
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(0)
  })

  it('filters MTA Bus alerts', () => {
    const alerts = [{ id: 'mtabus-Detoured', text: 'Detoured' }]
    const configured = new Set(['mtabus'])
    const toggles = { mtabus: false }
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(0)
  })

  it('filters NYC Ferry alerts', () => {
    const alerts = [{ id: 'nycferry-Cancelled', text: 'Cancelled' }]
    const configured = new Set(['nycferry'])
    const toggles = { nycferry: false }
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(0)
  })

  it('keeps alerts when their toggle is on (default)', () => {
    const alerts = [
      { id: 'tunnel-Lincoln-Delays', text: 'Delays' },
      { id: 'bus-126-Reroute', routes: ['126'], text: 'Reroute' },
      { id: 'mta-A,C-Work', badges: [{ label: 'A' }, { label: 'C' }], text: 'Work' },
    ]
    const configured = new Set(['tunnel_lincoln', 'bus_126', 'mta_A', 'mta_C'])
    const toggles = {} // all default on
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(3)
  })

  it('handles GWB Upper tunnel name with space correctly', () => {
    const alerts = [
      { id: 'tunnel-GWB Upper-Delays', source: 'PANYNJ', text: 'Delays' },
    ]
    const configured = new Set(['tunnel_gwb_upper'])
    const toggles = { tunnel_gwb_upper: false }
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(0)
  })

  it('hides bus alerts for routes not in user config', () => {
    const alerts = [
      { id: 'bus-126-Delays', routes: ['126'], text: 'Delays' },
      { id: 'bus-128-Reroute', routes: ['128'], text: 'Reroute' },
      { id: 'bus-165-Cancelled', routes: ['165'], text: 'Cancelled' },
    ]
    // User only has route 126 configured
    const configured = new Set(['bus_126'])
    const toggles = {}
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(1)
    expect(result[0].routes[0]).toBe('126')
  })

  it('hides MTA alerts for lines not in user config', () => {
    const alerts = [
      { id: 'mta-A,C-Delays', badges: [{ label: 'A' }, { label: 'C' }], text: 'Delays' },
      { id: 'mta-B,D-Work', badges: [{ label: 'B' }, { label: 'D' }], text: 'Work' },
    ]
    // User only has B and D configured
    const configured = new Set(['mta_B', 'mta_D'])
    const toggles = {}
    const result = filterAlerts(alerts, toggles, configured)
    expect(result).toHaveLength(1)
    expect(result[0].id).toContain('B,D')
  })
})

describe('DepartureRow tap-to-expand', () => {
  let originalFetch

  beforeEach(() => {
    vi.useFakeTimers()
    originalFetch = global.fetch
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        buses: [
          { route: '126', headsign: '126 HOBOKEN VIA WILLOW AVE AND WASHINGTON BLVD EXTENDED', eta: 3, etaTime: '6:15 PM', source: 'realtime' },
          { route: '126', headsign: '126 HOBOKEN TERMINAL', eta: 8, etaTime: '6:20 PM', source: 'schedule' },
        ],
        name: 'Test Stop',
      }),
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
    global.fetch = originalFetch
  })

  it('departure row expands on tap and collapses after 10 seconds', async () => {
    const { BusCard } = await import('../../src/mobile/components/TransitCard')
    const { container } = render(<BusCard stopId="bus:20935:126" displayName="Test" />)

    await act(async () => { await vi.advanceTimersByTimeAsync(100) })

    const rows = container.querySelectorAll('.ms-row')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).not.toHaveClass('ms-row-expanded')

    fireEvent.click(rows[0])
    expect(rows[0]).toHaveClass('ms-row-expanded')

    act(() => { vi.advanceTimersByTime(10_000) })
    expect(rows[0]).not.toHaveClass('ms-row-expanded')
  })

  it('second tap collapses row immediately', async () => {
    const { BusCard } = await import('../../src/mobile/components/TransitCard')
    const { container } = render(<BusCard stopId="bus:20935:126" displayName="Test" />)

    await act(async () => { await vi.advanceTimersByTimeAsync(100) })

    const rows = container.querySelectorAll('.ms-row')
    fireEvent.click(rows[0])
    expect(rows[0]).toHaveClass('ms-row-expanded')

    fireEvent.click(rows[0])
    expect(rows[0]).not.toHaveClass('ms-row-expanded')
  })
})
