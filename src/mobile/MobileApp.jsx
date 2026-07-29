import { useState, useEffect, useCallback, useRef } from 'react'
import WelcomePage from './pages/WelcomePage'
import MyStopsPage from './pages/MyStopsPage'
import AlertsPage from './pages/AlertsPage'
import SettingsPage from './pages/SettingsPage'
import AddStopPanel from './pages/AddStopPanel'
import TabBar from './components/TabBar'
import { fetchAlerts } from './services/alerts'
import './mobile.css'

// ── localStorage keys ──
const STORAGE_KEYS = {
  stops: 'msn_stops',
  stopNames: 'msn_stop_names',
  stopGtfsNames: 'msn_stop_gtfs_names',
  stopHiddenBadges: 'msn_stop_hidden_badges',
  theme: 'msn_theme',
  highContrast: 'msn_high_contrast',
  tempUnit: 'msn_temp_unit',
  weatherZip: 'msn_weather_zip',
  showWeather: 'msn_show_weather',
  showTunnels: 'msn_show_tunnels',
  tunnels: 'msn_tunnels',
  tunnelDirection: 'msn_tunnel_direction',
  alertBadge: 'msn_alert_badge',
  alertStaleness: 'msn_alert_staleness',
  alertToggles: 'msn_alert_toggles',
  onboarded: 'msn_onboarded',
  lastStopResolve: 'msn_last_stop_resolve',
}

function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}

// Derive alert source IDs from the user's configured stops — granular per-line/route
// Returns a Map of category → Set of individual source IDs
// e.g. { bus: Set(['bus_126', 'bus_119']), mta: Set(['mta_B', 'mta_D', 'mta_F']), ... }
const ALERT_CATEGORY_LABELS = {
  tunnel: '🚗 Tunnels',
  bus: '🚌 NJT Bus',
  path: '🚇 PATH',
  mta: '🔵 MTA Subway',
  ferry: '⛴️ NY Waterway',
  nycferry: '⛴️ NYC Ferry',
  rail: '🚆 NJT Rail',
  hblr: '🚃 HBLR',
  lirr: '🚆 LIRR',
  mnr: '🚆 Metro-North',
  mtabus: '🚌 MTA Bus',
}

const ALERT_SOURCE_DISPLAY = {
  tunnel_lincoln: 'Lincoln Tunnel',
  tunnel_holland: 'Holland Tunnel',
  tunnel_gwb_upper: 'GW Bridge (Upper)',
  tunnel_gwb_lower: 'GW Bridge (Lower)',
  tunnel_goethals: 'Goethals Bridge',
  tunnel_bayonne: 'Bayonne Bridge',
  path_hob33: 'HOB–33rd',
  path_jsq33: 'JSQ–33rd',
  ferry: 'NY Waterway',
  nycferry: 'NYC Ferry',
  hblr: 'HBLR',
  rail: 'NJT Rail',
  lirr: 'LIRR',
  mnr: 'Metro-North',
  mtabus: 'MTA Bus',
}

function deriveAlertSources(stops, showTunnels, tunnelList) {
  // Returns { category → Set(sourceIds) }
  const grouped = {}
  function add(cat, id) {
    if (!grouped[cat]) grouped[cat] = new Set()
    grouped[cat].add(id)
  }

  if (showTunnels && tunnelList) {
    for (const t of tunnelList) {
      add('tunnel', `tunnel_${t}`)
    }
  }

  for (const id of stops) {
    // NJT Bus: bus:STOP_ID:ROUTE1,ROUTE2
    if (id.startsWith('bus:')) {
      const routes = (id.split(':')[2] || '').split(',').filter(Boolean)
      for (const r of routes) add('bus', `bus_${r}`)
    }
    // Legacy bus stops
    else if (['clinton', 'willow', 'washington', 'pabt_willow', 'pabt_washington'].includes(id)) {
      add('bus', 'bus_126')
      if (id === 'willow' || id === 'washington') add('bus', 'bus_89')
      if (id === 'washington') add('bus', 'bus_22')
    }
    else if (id === 'pabt_119') {
      add('bus', 'bus_119')
    }
    else if (/^\d/.test(id)) {
      const parts = id.split(':')
      if (parts.length >= 2) add('bus', `bus_${parts[1]}`)
    }

    // MTA Subway: mta:STATIONS:DIR:LINES
    if (id.startsWith('mta:')) {
      const lines = (id.split(':')[3] || '').split(',').filter(Boolean)
      for (const l of lines) {
        // Skip express variants (6X, 7X, FX) — same alerts as base line
        const base = l.replace(/X$/, '')
        add('mta', `mta_${base}`)
      }
    }

    // PATH
    if (id.startsWith('path:')) {
      const route = id.split(':')[1] || ''
      const routeIds = route.split(',')
      if (routeIds.some(r => r === '862' || r === '860')) add('path', 'path_hob33')
      if (routeIds.some(r => r === '861' || r === '1024')) add('path', 'path_jsq33')
    }
    if (id === 'path_hob33' || id === 'path_33hob' || id === 'path_hobwtc' || id === 'path_wtchob') {
      add('path', 'path_hob33')
    }
    if (id === 'path_33newport') add('path', 'path_jsq33')

    // Ferry (single source per type)
    if (id.startsWith('ferry:') || id.startsWith('ferry_')) add('ferry', 'ferry')
    if (id.startsWith('nycferry:')) add('nycferry', 'nycferry')

    // Rail modes (single source)
    if (id.startsWith('rail:')) add('rail', 'rail')
    if (id.startsWith('hblr:')) add('hblr', 'hblr')
    if (id.startsWith('lirr:')) add('lirr', 'lirr')
    if (id.startsWith('mnr:')) add('mnr', 'mnr')
    if (id.startsWith('mtabus:')) add('mtabus', 'mtabus')
  }

  return grouped
}

// Determine which source ID an alert maps to for toggle filtering
function getAlertSourceIds(alert) {
  const id = alert.id || ''
  const sources = []

  if (id.startsWith('tunnel-')) {
    // tunnel-Lincoln-..., tunnel-Holland-..., tunnel-GWB Upper-...
    // Normalize to match config IDs (lincoln, holland, gwb_upper, etc.)
    const match = id.match(/^tunnel-([^-]+)-/)
    if (match) {
      const name = match[1].toLowerCase().replace(/\s+/g, '_')
      sources.push(`tunnel_${name}`)
    }
  } else if (id.startsWith('bus-')) {
    // bus alerts have routes array
    if (alert.routes) {
      for (const r of alert.routes) sources.push(`bus_${r}`)
    }
  } else if (id.startsWith('mta-')) {
    // MTA alerts have badges with line letters
    if (alert.badges) {
      for (const b of alert.badges) {
        if (b.label && b.label.length <= 2) sources.push(`mta_${b.label}`)
      }
    }
  } else if (id.startsWith('path-')) {
    // PATH is a single source
    sources.push('path_hob33', 'path_jsq33') // show if either PATH is enabled
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

export default function MobileApp() {
  // ── Navigation state ──
  const [page, setPage] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.onboarded) ? 'stops' : 'welcome'
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addStopOpen, setAddStopOpen] = useState(false)
  const [editingStop, setEditingStop] = useState(null) // { stopId, displayName } when editing

  // ── User settings ──
  const [stops, setStops] = useState(() => loadJSON(STORAGE_KEYS.stops, []))
  const [stopNames, setStopNames] = useState(() => loadJSON(STORAGE_KEYS.stopNames, {}))
  const [stopGtfsNames, setStopGtfsNames] = useState(() => loadJSON(STORAGE_KEYS.stopGtfsNames, {}))
  const [stopHiddenBadges, setStopHiddenBadges] = useState(() => loadJSON(STORAGE_KEYS.stopHiddenBadges, {}))
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEYS.theme) || 'auto')
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem(STORAGE_KEYS.highContrast) === 'true')
  const [tempUnit, setTempUnit] = useState(() => localStorage.getItem(STORAGE_KEYS.tempUnit) || 'F')
  const [weatherZip, setWeatherZip] = useState(() => localStorage.getItem(STORAGE_KEYS.weatherZip) || '')
  const [showWeather, setShowWeather] = useState(() => loadJSON(STORAGE_KEYS.showWeather, true))
  const [showTunnels, setShowTunnels] = useState(() => loadJSON(STORAGE_KEYS.showTunnels, true))
  const [tunnels, setTunnels] = useState(() => loadJSON(STORAGE_KEYS.tunnels, ['lincoln', 'holland']))
  const [tunnelDirection, setTunnelDirection] = useState(() => localStorage.getItem(STORAGE_KEYS.tunnelDirection) || 'both')
  const [alertBadge, setAlertBadge] = useState(() => localStorage.getItem(STORAGE_KEYS.alertBadge) || 'count')
  const [alertStaleness, setAlertStaleness] = useState(() => localStorage.getItem(STORAGE_KEYS.alertStaleness) || 'off')
  const [alertToggles, setAlertToggles] = useState(() => loadJSON(STORAGE_KEYS.alertToggles, {}))

  // ── Alerts state ──
  const [alerts, setAlerts] = useState([])
  const [dismissedAlerts, setDismissedAlerts] = useState([])
  const [alertHighlightSource, setAlertHighlightSource] = useState(null)

  // ── Persist settings ──
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.stops, JSON.stringify(stops)) }, [stops])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.stopNames, JSON.stringify(stopNames)) }, [stopNames])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.stopGtfsNames, JSON.stringify(stopGtfsNames)) }, [stopGtfsNames])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.stopHiddenBadges, JSON.stringify(stopHiddenBadges)) }, [stopHiddenBadges])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.theme, theme) }, [theme])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.highContrast, highContrast) }, [highContrast])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.tempUnit, tempUnit) }, [tempUnit])
  useEffect(() => { if (weatherZip) localStorage.setItem(STORAGE_KEYS.weatherZip, weatherZip); else localStorage.removeItem(STORAGE_KEYS.weatherZip) }, [weatherZip])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.showWeather, JSON.stringify(showWeather)) }, [showWeather])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.showTunnels, JSON.stringify(showTunnels)) }, [showTunnels])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.tunnels, JSON.stringify(tunnels)) }, [tunnels])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.tunnelDirection, tunnelDirection) }, [tunnelDirection])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.alertBadge, alertBadge) }, [alertBadge])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.alertStaleness, alertStaleness) }, [alertStaleness])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.alertToggles, JSON.stringify(alertToggles)) }, [alertToggles])

  // ── Theme application ──
  useEffect(() => {
    let resolved = theme
    if (theme === 'auto') {
      const h = new Date().getHours()
      resolved = (h < 7 || h >= 18) ? 'dark' : 'light'
    }
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.setAttribute('data-high-contrast', highContrast ? 'true' : 'false')
  }, [theme, highContrast])

  // ── Dev shortcut: press "t" to toggle light/dark ──
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 't' && !e.target.closest('input, textarea')) {
        const current = document.documentElement.getAttribute('data-theme')
        const next = current === 'light' ? 'dark' : 'light'
        document.documentElement.setAttribute('data-theme', next)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // ── Bus stop ID re-resolution (every 8h) ──
  // NJT rotates GTFS stop IDs with each data update; this keeps saved stops current.
  useEffect(() => {
    if (stops.length === 0) return
    const RESOLVE_INTERVAL = 8 * 60 * 60 * 1000 // 8 hours
    const lastResolve = parseInt(localStorage.getItem(STORAGE_KEYS.lastStopResolve) || '0', 10)
    if (Date.now() - lastResolve < RESOLVE_INTERVAL) return

    const busStops = stops.filter(s => s.startsWith('bus:'))
    if (busStops.length === 0) {
      localStorage.setItem(STORAGE_KEYS.lastStopResolve, String(Date.now()))
      return
    }

    // Build query: GTFS_NAME|IDS:ROUTES for each bus stop that has a saved GTFS name
    const resolveEntries = [] // { entry: string, stopId: string }
    for (const stopId of busStops) {
      const parts = stopId.split(':')
      const ids = parts[1] || ''
      const routes = parts[2] || ''
      const gtfsName = stopGtfsNames[stopId]
      if (!gtfsName || !ids) continue // Skip stops without saved GTFS name (no-op)
      resolveEntries.push({
        entry: `${encodeURIComponent(gtfsName)}|${ids}:${routes}`,
        stopId,
      })
    }

    if (resolveEntries.length === 0) {
      localStorage.setItem(STORAGE_KEYS.lastStopResolve, String(Date.now()))
      return
    }

    fetch(`/api/bus/resolve-stops?stops=${resolveEntries.map(e => e.entry).join(';')}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.resolved) return
        let updated = false
        const newStops = [...stops]
        const newNames = { ...stopNames }
        const newGtfsNames = { ...stopGtfsNames }
        const newBadges = { ...stopHiddenBadges }

        for (let i = 0; i < data.resolved.length; i++) {
          const result = data.resolved[i]
          if (!result.changed) continue
          const matchStop = resolveEntries[i]?.stopId
          if (!matchStop) continue

          // Only update the IDs portion — preserve headsign filter, display name, and GTFS name
          const parts = matchStop.split(':')
          const newStopId = `bus:${result.ids.join(',')}:${parts.slice(2).join(':')}`
          const idx = newStops.indexOf(matchStop)
          if (idx >= 0) {
            newStops[idx] = newStopId
            // Re-key all metadata to new stop ID
            if (newNames[matchStop]) { newNames[newStopId] = newNames[matchStop]; delete newNames[matchStop] }
            if (newGtfsNames[matchStop]) { newGtfsNames[newStopId] = newGtfsNames[matchStop]; delete newGtfsNames[matchStop] }
            if (newBadges[matchStop]) { newBadges[newStopId] = newBadges[matchStop]; delete newBadges[matchStop] }
            updated = true
          }
        }

        if (updated) {
          setStops(newStops)
          setStopNames(newNames)
          setStopGtfsNames(newGtfsNames)
          setStopHiddenBadges(newBadges)
          console.log('[Resolve] Updated stale bus stop IDs')
        }
        localStorage.setItem(STORAGE_KEYS.lastStopResolve, String(Date.now()))
      })
      .catch(() => { /* silent — retry next session */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run once on mount — interval gated by localStorage timestamp

  // ── Alerts polling ──
  const alertsInterval = useRef(null)
  useEffect(() => {
    if (stops.length === 0) return

    const pollAlerts = async () => {
      try {
        const liveAlerts = await fetchAlerts(stops)
        // Replace active alerts with current live feed (deduped by ID)
        // Alerts no longer in the feed are automatically removed
        const dismissedIds = new Set(dismissedAlerts.map(a => a.id))
        const seen = new Set()
        const deduped = []
        const now = Date.now()
        for (const a of liveAlerts) {
          if (dismissedIds.has(a.id) || seen.has(a.id)) continue
          seen.add(a.id)
          // Stamp receivedAt if not already set
          deduped.push({ ...a, receivedAt: a.receivedAt || now })
        }
        // Preserve receivedAt from existing alerts
        setAlerts(prev => {
          const prevMap = new Map(prev.map(p => [p.id, p]))
          return deduped.map(a => ({
            ...a,
            receivedAt: prevMap.get(a.id)?.receivedAt || a.receivedAt,
          }))
        })
      } catch {
        // Alert polling failed — keep existing alerts
      }
    }

    pollAlerts()
    alertsInterval.current = setInterval(pollAlerts, 60_000) // poll every 60s
    return () => clearInterval(alertsInterval.current)
  }, [stops, dismissedAlerts])

  // ── Remove tunnel alerts when tunnels toggled off or tunnel selection changes ──
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!showTunnels) {
      setAlerts(prev => prev.filter(a => !a.id?.startsWith('tunnel-')))
    } else {
      setAlerts(prev => prev.filter(a => {
        if (!a.id?.startsWith('tunnel-')) return true
        return tunnels.some(t => a.id.includes(`tunnel-${t}`))
      }))
    }
  }, [showTunnels, tunnels])
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Navigation helpers ──
  const navigate = useCallback((p) => {
    if (p === 'settings') {
      setSettingsOpen(true)
    } else {
      if (p === 'alerts') setAlertHighlightSource(null)
      setPage(p)
    }
  }, [])

  const completeOnboarding = useCallback((selectedStops, names) => {
    setStops(selectedStops)
    if (names) setStopNames(prev => ({ ...prev, ...names }))
    localStorage.setItem(STORAGE_KEYS.onboarded, '1')
    setPage('stops')
  }, [])

  const addStop = useCallback((stopId, displayName, gtfsName) => {
    setStops(prev => {
      if (prev.includes(stopId)) return prev
      return [...prev, stopId]
    })
    if (displayName) {
      setStopNames(prev => ({ ...prev, [stopId]: displayName }))
    }
    if (gtfsName) {
      setStopGtfsNames(prev => ({ ...prev, [stopId]: gtfsName }))
    }
    setAddStopOpen(false)
    setEditingStop(null)
  }, [])

  const updateStop = useCallback((oldStopId, newStopId, displayName, hiddenBadges, gtfsName) => {
    setStops(prev => {
      const idx = prev.indexOf(oldStopId)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = newStopId
      return next
    })
    // Remove old name entry if stop ID changed
    if (oldStopId !== newStopId) {
      setStopNames(prev => {
        const next = { ...prev }
        delete next[oldStopId]
        next[newStopId] = displayName
        return next
      })
      setStopGtfsNames(prev => {
        const next = { ...prev }
        delete next[oldStopId]
        if (gtfsName) next[newStopId] = gtfsName
        return next
      })
      setStopHiddenBadges(prev => {
        const next = { ...prev }
        delete next[oldStopId]
        if (hiddenBadges && hiddenBadges.length > 0) next[newStopId] = hiddenBadges
        return next
      })
    } else {
      setStopNames(prev => ({ ...prev, [newStopId]: displayName }))
      if (gtfsName) setStopGtfsNames(prev => ({ ...prev, [newStopId]: gtfsName }))
      setStopHiddenBadges(prev => {
        if (!hiddenBadges || hiddenBadges.length === 0) {
          const next = { ...prev }
          delete next[newStopId]
          return next
        }
        return { ...prev, [newStopId]: hiddenBadges }
      })
    }
    setAddStopOpen(false)
    setEditingStop(null)
  }, [])

  const openEditStop = useCallback((stopId) => {
    setEditingStop({ stopId, displayName: stopNames[stopId] || stopId, hiddenBadges: stopHiddenBadges[stopId] || [], gtfsName: stopGtfsNames[stopId] || null })
    setAddStopOpen(true)
  }, [stopNames, stopHiddenBadges, stopGtfsNames])

  const removeStop = useCallback((stopId) => {
    setStops(prev => prev.filter(s => s !== stopId))
  }, [])

  const reorderStops = useCallback((fromIndex, toIndex) => {
    setStops(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
    setStops([])
    setStopNames({})
    setStopHiddenBadges({})
    setTheme('auto')
    setTempUnit('F')
    setShowWeather(true)
    setShowTunnels(true)
    setTunnels(['lincoln', 'holland'])
    setTunnelDirection('both')
    setAlertBadge('count')
    setAlertStaleness('off')
    setAlertToggles({})
    setAlerts([])
    setDismissedAlerts([])
    setSettingsOpen(false)
    setPage('welcome')
  }, [])

  const dismissAlert = useCallback((alert) => {
    setAlerts(prev => prev.filter(a => a !== alert))
    setDismissedAlerts(prev => [...prev, alert])
  }, [])

  const dismissAllAlerts = useCallback(() => {
    setDismissedAlerts(prev => [...prev, ...alerts])
    setAlerts([])
  }, [alerts])

  const restoreAlert = useCallback((alert) => {
    setDismissedAlerts(prev => prev.filter(a => a !== alert))
    setAlerts(prev => [...prev, alert])
  }, [])

  const showTabBar = page !== 'welcome'

  // Filter alerts by staleness setting and alert source toggles
  /* eslint-disable react-hooks/purity */
  const alertSourceGroups = deriveAlertSources(stops, showTunnels, tunnels)
  // Flat set of all configured source IDs for checking membership
  const allConfiguredSources = new Set()
  for (const ids of Object.values(alertSourceGroups)) {
    for (const id of ids) allConfiguredSources.add(id)
  }
  const filteredAlerts = (() => {
    let result = alerts
    // Filter by per-source toggles (granular: bus_126, mta_B, tunnel_lincoln, etc.)
    result = result.filter(a => {
      const sourceIds = getAlertSourceIds(a)
      if (sourceIds.length === 0) return true // unknown source = keep
      // Only consider source IDs that exist in the user's config
      const relevantIds = sourceIds.filter(sid => allConfiguredSources.has(sid))
      if (relevantIds.length === 0) return false // alert source not in user config = hide
      // Alert shows if ANY of its relevant source IDs are toggled on (not explicitly false)
      return relevantIds.some(sid => alertToggles[sid] !== false)
    })
    // Filter by staleness
    if (alertStaleness !== 'off') {
      const maxMinutes = parseInt(alertStaleness, 10)
      if (maxMinutes) {
        const now = Date.now()
        result = result.filter(a => {
          if (!a.receivedAt) return true
          const ageMin = (now - a.receivedAt) / 60000
          return ageMin <= maxMinutes
        })
      }
    }
    return result
  })()
  /* eslint-enable react-hooks/purity */

  const alertCount = filteredAlerts.length

  return (
    <div className="mobile-app">
      {page === 'welcome' && (
        <WelcomePage
          onComplete={completeOnboarding}
          onManual={() => {
            localStorage.setItem(STORAGE_KEYS.onboarded, '1')
            // Check GPS — if not available/denied, hide weather & tunnels
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                () => { /* GPS granted — keep weather/tunnels on */ },
                () => { setShowWeather(false); setShowTunnels(false) },
                { timeout: 3000 }
              )
            } else {
              setShowWeather(false)
              setShowTunnels(false)
            }
            setPage('stops')
          }}
        />
      )}
      {page === 'stops' && (
        <MyStopsPage
          stops={stops}
          stopNames={stopNames}
          stopHiddenBadges={stopHiddenBadges}
          showWeather={showWeather}
          showTunnels={showTunnels}
          tunnels={tunnels}
          tempUnit={tempUnit}
          weatherZip={weatherZip}
          alerts={filteredAlerts}
          dismissedAlerts={dismissedAlerts}
          setAlerts={setAlerts}
          onNavigateToAlerts={(stopId) => { setAlertHighlightSource(stopId || null); setPage('alerts') }}
        />
      )}
      {page === 'alerts' && (
        <AlertsPage
          alerts={filteredAlerts}
          dismissedAlerts={dismissedAlerts}
          onDismiss={dismissAlert}
          onDismissAll={dismissAllAlerts}
          onRestore={restoreAlert}
          highlightSource={alertHighlightSource}
        />
      )}

      <SettingsPage
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        highContrast={highContrast}
        setHighContrast={setHighContrast}
        tempUnit={tempUnit}
        setTempUnit={setTempUnit}
        weatherZip={weatherZip}
        setWeatherZip={setWeatherZip}
        showWeather={showWeather}
        setShowWeather={setShowWeather}
        showTunnels={showTunnels}
        setShowTunnels={setShowTunnels}
        tunnels={tunnels}
        setTunnels={setTunnels}
        alertBadge={alertBadge}
        setAlertBadge={setAlertBadge}
        alertStaleness={alertStaleness}
        setAlertStaleness={setAlertStaleness}
        alertToggles={alertToggles}
        setAlertToggles={setAlertToggles}
        alertSourceGroups={alertSourceGroups}
        stops={stops}
        stopNames={stopNames}
        stopHiddenBadges={stopHiddenBadges}
        onRemoveStop={removeStop}
        onReorderStops={reorderStops}
        onEditStop={openEditStop}
        onOpenAddStop={() => setAddStopOpen(true)}
        onReset={resetAll}
      />

      <AddStopPanel
        open={addStopOpen}
        onClose={() => { setAddStopOpen(false); setEditingStop(null) }}
        onAdd={addStop}
        editingStop={editingStop}
        onUpdate={updateStop}
      />

      {showTabBar && (
        <TabBar
          activePage={page}
          onNavigate={navigate}
          alertCount={alertCount}
          alertBadge={alertBadge}
        />
      )}
    </div>
  )
}
