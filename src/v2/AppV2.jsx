import { useState, useEffect, useCallback } from 'react'
import './AppV2.css'
import TabBar from './components/TabBar.jsx'
import Ticker from './components/Ticker.jsx'
import MyStops from './tabs/MyStops.jsx'
import Alerts from './tabs/Alerts.jsx'
import Explore from './tabs/Explore.jsx'
import Settings from './tabs/Settings.jsx'

function useClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

const STORAGE_KEY = 'mystopnow-v2-settings'
const STOP_NAMES_KEY = 'mystopnow-v2-stop-names'

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

function loadStopNames() {
  try {
    const raw = localStorage.getItem(STOP_NAMES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveStopName(id, name) {
  const names = loadStopNames()
  names[id] = name
  localStorage.setItem(STOP_NAMES_KEY, JSON.stringify(names))
}

function Clock() {
  const time = useClock()
  const formatted = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
  const date = time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return (
    <div className="v2-clock">
      <span className="v2-clock-time">{formatted}</span>
      <span className="v2-clock-date">{date}</span>
    </div>
  )
}

export default function AppV2() {
  const [activeTab, setActiveTab] = useState('stops')
  const [settings, setSettings] = useState(() => loadSettings() || {
    stops: [],
    showWeather: true,
    showTunnels: true,
    darkMode: 'auto',
  })
  const [stopNames, setStopNames] = useState(loadStopNames)
  const [alerts, setAlerts] = useState([])

  // Auto dark mode
  useEffect(() => {
    if (settings.darkMode === 'auto') {
      const hour = new Date().getHours()
      const isDark = hour < 7 || hour >= 18
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    } else {
      document.documentElement.setAttribute('data-theme', settings.darkMode)
    }
  }, [settings.darkMode])

  // Persist settings
  useEffect(() => { saveSettings(settings) }, [settings])

  function updateSettings(patch) {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  function addStop(stopKey, name) {
    if (settings.stops.includes(stopKey)) return
    setSettings(prev => ({ ...prev, stops: [...prev.stops, stopKey] }))
    if (name) {
      saveStopName(stopKey, name)
      setStopNames(prev => ({ ...prev, [stopKey]: name }))
    }
  }

  function removeStop(stopKey) {
    setSettings(prev => ({ ...prev, stops: prev.stops.filter(s => s !== stopKey) }))
  }

  function reorderStops(newOrder) {
    setSettings(prev => ({ ...prev, stops: newOrder }))
  }

  return (
    <div className="v2-app">
      {/* Desktop header — only visible on larger screens */}
      <header className="v2-header">
        <div className="v2-logo">MY<span className="v2-logo-accent">STOP</span>NOW</div>
        <nav className="v2-nav">
          <button className={`v2-nav-item ${activeTab === 'stops' ? 'active' : ''}`} onClick={() => setActiveTab('stops')}>My Stops</button>
          <button className={`v2-nav-item ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => setActiveTab('alerts')}>Alerts</button>
          <button className={`v2-nav-item ${activeTab === 'explore' ? 'active' : ''}`} onClick={() => setActiveTab('explore')}>Explore</button>
          <button className={`v2-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
        </nav>
        <Clock />
      </header>

      {/* Ticker — desktop only, shows on My Stops tab */}
      {activeTab === 'stops' && alerts.length > 0 && (
        <Ticker alerts={alerts} />
      )}

      {/* Tab content */}
      <main className="v2-content">
        {activeTab === 'stops' && (
          <MyStops
            stops={settings.stops}
            stopNames={stopNames}
            showWeather={settings.showWeather}
            showTunnels={settings.showTunnels}
            onAlertsUpdate={setAlerts}
            onAddStop={addStop}
          />
        )}
        {activeTab === 'alerts' && (
          <Alerts alerts={alerts} />
        )}
        {activeTab === 'explore' && (
          <Explore onAddStop={addStop} existingStops={settings.stops} />
        )}
        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            stopNames={stopNames}
            onUpdate={updateSettings}
            onRemoveStop={removeStop}
            onReorderStops={reorderStops}
            onNavigateExplore={() => setActiveTab('explore')}
          />
        )}
      </main>

      {/* Mobile tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} alertCount={alerts.length} />
    </div>
  )
}
