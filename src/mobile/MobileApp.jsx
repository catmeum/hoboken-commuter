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
  stopHiddenBadges: 'msn_stop_hidden_badges',
  theme: 'msn_theme',
  tempUnit: 'msn_temp_unit',
  weatherZip: 'msn_weather_zip',
  showWeather: 'msn_show_weather',
  showTunnels: 'msn_show_tunnels',
  tunnels: 'msn_tunnels',
  tunnelDirection: 'msn_tunnel_direction',
  alertBadge: 'msn_alert_badge',
  alertStaleness: 'msn_alert_staleness',
  onboarded: 'msn_onboarded',
}

function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
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
  const [stopHiddenBadges, setStopHiddenBadges] = useState(() => loadJSON(STORAGE_KEYS.stopHiddenBadges, {}))
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEYS.theme) || 'auto')
  const [tempUnit, setTempUnit] = useState(() => localStorage.getItem(STORAGE_KEYS.tempUnit) || 'F')
  const [weatherZip, setWeatherZip] = useState(() => localStorage.getItem(STORAGE_KEYS.weatherZip) || '')
  const [showWeather, setShowWeather] = useState(() => loadJSON(STORAGE_KEYS.showWeather, true))
  const [showTunnels, setShowTunnels] = useState(() => loadJSON(STORAGE_KEYS.showTunnels, true))
  const [tunnels, setTunnels] = useState(() => loadJSON(STORAGE_KEYS.tunnels, ['lincoln', 'holland']))
  const [tunnelDirection, setTunnelDirection] = useState(() => localStorage.getItem(STORAGE_KEYS.tunnelDirection) || 'both')
  const [alertBadge, setAlertBadge] = useState(() => localStorage.getItem(STORAGE_KEYS.alertBadge) || 'count')
  const [alertStaleness, setAlertStaleness] = useState(() => localStorage.getItem(STORAGE_KEYS.alertStaleness) || 'off')

  // ── Alerts state ──
  const [alerts, setAlerts] = useState([])
  const [dismissedAlerts, setDismissedAlerts] = useState([])
  const [alertHighlightSource, setAlertHighlightSource] = useState(null)

  // ── Persist settings ──
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.stops, JSON.stringify(stops)) }, [stops])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.stopNames, JSON.stringify(stopNames)) }, [stopNames])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.stopHiddenBadges, JSON.stringify(stopHiddenBadges)) }, [stopHiddenBadges])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.theme, theme) }, [theme])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.tempUnit, tempUnit) }, [tempUnit])
  useEffect(() => { if (weatherZip) localStorage.setItem(STORAGE_KEYS.weatherZip, weatherZip); else localStorage.removeItem(STORAGE_KEYS.weatherZip) }, [weatherZip])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.showWeather, JSON.stringify(showWeather)) }, [showWeather])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.showTunnels, JSON.stringify(showTunnels)) }, [showTunnels])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.tunnels, JSON.stringify(tunnels)) }, [tunnels])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.tunnelDirection, tunnelDirection) }, [tunnelDirection])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.alertBadge, alertBadge) }, [alertBadge])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.alertStaleness, alertStaleness) }, [alertStaleness])

  // ── Theme application ──
  useEffect(() => {
    let resolved = theme
    if (theme === 'auto') {
      const h = new Date().getHours()
      resolved = (h < 7 || h >= 18) ? 'dark' : 'light'
    }
    document.documentElement.setAttribute('data-theme', resolved)
  }, [theme])

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

  const addStop = useCallback((stopId, displayName) => {
    setStops(prev => {
      if (prev.includes(stopId)) return prev
      return [...prev, stopId]
    })
    if (displayName) {
      setStopNames(prev => ({ ...prev, [stopId]: displayName }))
    }
    setAddStopOpen(false)
    setEditingStop(null)
  }, [])

  const updateStop = useCallback((oldStopId, newStopId, displayName, hiddenBadges) => {
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
      setStopHiddenBadges(prev => {
        const next = { ...prev }
        delete next[oldStopId]
        if (hiddenBadges && hiddenBadges.length > 0) next[newStopId] = hiddenBadges
        return next
      })
    } else {
      setStopNames(prev => ({ ...prev, [newStopId]: displayName }))
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
    setEditingStop({ stopId, displayName: stopNames[stopId] || stopId, hiddenBadges: stopHiddenBadges[stopId] || [] })
    setAddStopOpen(true)
  }, [stopNames, stopHiddenBadges])

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

  // Filter alerts by staleness setting
  /* eslint-disable react-hooks/purity */
  const filteredAlerts = (() => {
    if (alertStaleness === 'off') return alerts
    const maxMinutes = parseInt(alertStaleness, 10)
    if (!maxMinutes) return alerts
    const now = Date.now()
    return alerts.filter(a => {
      if (!a.receivedAt) return true // no timestamp = keep it
      const ageMin = (now - a.receivedAt) / 60000
      return ageMin <= maxMinutes
    })
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
