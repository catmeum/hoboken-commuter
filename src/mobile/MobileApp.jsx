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
  theme: 'msn_theme',
  tempUnit: 'msn_temp_unit',
  showWeather: 'msn_show_weather',
  showTunnels: 'msn_show_tunnels',
  tunnels: 'msn_tunnels',
  alertBadge: 'msn_alert_badge',
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

  // ── User settings ──
  const [stops, setStops] = useState(() => loadJSON(STORAGE_KEYS.stops, []))
  const [stopNames, setStopNames] = useState(() => loadJSON(STORAGE_KEYS.stopNames, {}))
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEYS.theme) || 'auto')
  const [tempUnit, setTempUnit] = useState(() => localStorage.getItem(STORAGE_KEYS.tempUnit) || 'F')
  const [showWeather, setShowWeather] = useState(() => loadJSON(STORAGE_KEYS.showWeather, true))
  const [showTunnels, setShowTunnels] = useState(() => loadJSON(STORAGE_KEYS.showTunnels, true))
  const [tunnels, setTunnels] = useState(() => loadJSON(STORAGE_KEYS.tunnels, ['lincoln', 'holland']))
  const [alertBadge, setAlertBadge] = useState(() => localStorage.getItem(STORAGE_KEYS.alertBadge) || 'count')

  // ── Alerts state ──
  const [alerts, setAlerts] = useState([])
  const [dismissedAlerts, setDismissedAlerts] = useState([])

  // ── Persist settings ──
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.stops, JSON.stringify(stops)) }, [stops])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.stopNames, JSON.stringify(stopNames)) }, [stopNames])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.theme, theme) }, [theme])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.tempUnit, tempUnit) }, [tempUnit])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.showWeather, JSON.stringify(showWeather)) }, [showWeather])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.showTunnels, JSON.stringify(showTunnels)) }, [showTunnels])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.tunnels, JSON.stringify(tunnels)) }, [tunnels])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.alertBadge, alertBadge) }, [alertBadge])

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
        // Only add new alerts not already dismissed
        setAlerts(prev => {
          const dismissedIds = new Set(dismissedAlerts.map(a => a.id))
          const existingIds = new Set(prev.map(a => a.id))
          const newAlerts = liveAlerts.filter(a => !dismissedIds.has(a.id) && !existingIds.has(a.id))
          if (newAlerts.length === 0) return prev
          return [...prev, ...newAlerts]
        })
      } catch {
        // Alert polling failed — silent
      }
    }

    pollAlerts()
    alertsInterval.current = setInterval(pollAlerts, 60_000) // poll every 60s
    return () => clearInterval(alertsInterval.current)
  }, [stops, dismissedAlerts])

  // ── Navigation helpers ──
  const navigate = useCallback((p) => {
    if (p === 'settings') {
      setSettingsOpen(true)
    } else {
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
  }, [])

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
    setTheme('auto')
    setTempUnit('F')
    setShowWeather(true)
    setShowTunnels(true)
    setTunnels(['lincoln', 'holland'])
    setAlertBadge('count')
    setAlerts([])
    setDismissedAlerts([])
    setSettingsOpen(false)
    setPage('welcome')
  }, [])

  const dismissAlert = useCallback((alert) => {
    setAlerts(prev => prev.filter(a => a !== alert))
    setDismissedAlerts(prev => [...prev, alert])
  }, [])

  const restoreAlert = useCallback((alert) => {
    setDismissedAlerts(prev => prev.filter(a => a !== alert))
    setAlerts(prev => [...prev, alert])
  }, [])

  const showTabBar = page !== 'welcome'
  const alertCount = alerts.length

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
          showWeather={showWeather}
          showTunnels={showTunnels}
          tunnels={tunnels}
          tempUnit={tempUnit}
          alerts={alerts}
          setAlerts={setAlerts}
        />
      )}
      {page === 'alerts' && (
        <AlertsPage
          alerts={alerts}
          dismissedAlerts={dismissedAlerts}
          onDismiss={dismissAlert}
          onRestore={restoreAlert}
          alertBadge={alertBadge}
        />
      )}

      <SettingsPage
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        tempUnit={tempUnit}
        setTempUnit={setTempUnit}
        showWeather={showWeather}
        setShowWeather={setShowWeather}
        showTunnels={showTunnels}
        setShowTunnels={setShowTunnels}
        tunnels={tunnels}
        setTunnels={setTunnels}
        alertBadge={alertBadge}
        setAlertBadge={setAlertBadge}
        stops={stops}
        stopNames={stopNames}
        onRemoveStop={removeStop}
        onReorderStops={reorderStops}
        onOpenAddStop={() => setAddStopOpen(true)}
        onReset={resetAll}
      />

      <AddStopPanel
        open={addStopOpen}
        onClose={() => setAddStopOpen(false)}
        onAdd={addStop}
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
