import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Car,
  Bus,
  CloudSun,
  Newspaper,
  AlertTriangle,
  Droplets,
  Wind,
  Ship,
  TrainFront,
  Sun,
  Moon,
  Gauge,
  MapPin,
  WifiOff,
  ArrowLeftRight,
  Settings,
  X,
  GripVertical,
  Plus,
  Minus,
  Bell,
  BellOff,
} from 'lucide-react'
import { fetchTunnels } from './services/tunnels'
import { fetchWeather } from './services/weather'
import { fetchBusArrivals, fetchDynamicStop } from './services/bus'
import { fetchPath } from './services/path'
import { fetchFerry } from './services/ferry'
import './App.css'

// ── Theme logic ──
function isDaytime() {
  const now = new Date()
  const mins = now.getHours() * 60 + now.getMinutes()
  return mins >= 450 && mins < 1080
}

// ── Polling hook — clears data when fetchFn changes (e.g. direction switch) ──
function usePolling(fetchFn, intervalMs, refreshKey = 0) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const poll = useCallback(async () => {
    try {
      const result = await fetchFn()
      setData(result)
      setError(null)
    } catch (e) {
      console.error(`Polling error: ${e.message}`)
      setError(e.message)
    }
  }, [fetchFn])

  useEffect(() => {
    setData(null) // clear stale data immediately
    poll()
    const id = setInterval(poll, intervalMs)
    return () => clearInterval(id)
  }, [poll, intervalMs, refreshKey])

  return { data, error }
}

// ── Helpers ──
function etaClass(min) {
  if (min <= 5) return 'soon'
  if (min <= 15) return 'moderate'
  return 'later'
}

function etaTime(min) {
  const d = new Date(Date.now() + min * 60_000)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// Shorten NJT stop names: "WASHINGTON ST AT 11TH ST" → "Washington / 11th"
function shortenStopName(name) {
  if (!name) return name
  let s = name
    .replace(/\bST\b(?!\w)/gi, '') // remove standalone "ST" (street)
    .replace(/\bAVE?\b/gi, '')     // remove AVE/AV
    .replace(/\bBLVD\b/gi, '')     // remove BLVD
    .replace(/\bPL\b/gi, '')       // remove PL (place)
    .replace(/\bRD\b/gi, '')       // remove RD
    .replace(/\bDR\b/gi, '')       // remove DR
    .replace(/\bAT\b/gi, '/')      // AT → /
    .replace(/\bAND\b/gi, '/')     // AND → /
    .replace(/&/g, '/')            // & → /
    .replace(/\s*\/\s*/g, ' / ')   // normalize slashes
    .replace(/\s{2,}/g, ' ')       // collapse whitespace
    .trim()
  // Title case
  s = s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  // Fix ordinals: 11Th → 11th, 1St → 1st
  s = s.replace(/(\d+)(St|Nd|Rd|Th)\b/gi, (_, n, suf) => n + suf.toLowerCase())
  return s
}

function capacityLabel(cap) {
  if (cap === 'empty') return 'Seats'
  if (cap === 'some') return 'Standing'
  if (cap === 'full') return 'Full'
  return null // unknown — don't render
}

// ── Fallbacks ──
const TUNNEL_FALLBACK = {
  direction: 'Loading…',
  tunnels: [
    { name: 'Lincoln', crossingMinutes: '--', speed: null, severity: 'moderate', trafficText: 'Loading…', closed: false, timestamp: null, alerts: [] },
    { name: 'Holland', crossingMinutes: '--', speed: null, severity: 'moderate', trafficText: 'Loading…', closed: false, timestamp: null, alerts: [] },
  ],
}

const WEATHER_FALLBACK = {
  label: 'Hoboken',
  periods: [
    { label: 'Now', icon: '⏳', temp: '--', desc: 'Loading…', wind: '--', precip: '--', humidity: '--' },
    { label: 'Midday', icon: '⏳', temp: '--', desc: 'Loading…', wind: '--', precip: '--', humidity: '--' },
    { label: 'Evening', icon: '⏳', temp: '--', desc: 'Loading…', wind: '--', precip: '--', humidity: '--' },
  ],
}

// ── Bus stop fallback ──
const BUS_FALLBACK = {
  _stopOrder: ['clinton', 'willow', 'washington'],
  _alerts: [],
  clinton: { name: 'Clinton St & 11th', buses: [], serviceNote: 'Weekdays only · AM 5:40–9:45 · PM 4:09–8:29' },
  willow: { name: 'Willow Ave & 15th', buses: [], serviceNote: null },
  washington: { name: 'Washington St & 11th', buses: [], serviceNote: null },
}

const BUS_FALLBACK_INBOUND = {
  _stopOrder: ['pabt_willow', 'pabt_washington', 'pabt_119'],
  _alerts: [],
  pabt_willow: { name: 'PABT · 126 Willow / Hamilton Pk', buses: [], serviceNote: 'Peak hours only · check NJT for schedule', gate: '214', gateSchedule: { day: '214', late: '323', overnight: '79' } },
  pabt_washington: { name: 'PABT · 126 Washington', buses: [], serviceNote: 'Peak hours only · check NJT for schedule', gate: '213', gateSchedule: { day: '213', late: '323', overnight: '79' } },
  pabt_119: { name: 'PABT · 119', buses: [], serviceNote: null, gate: '210', gateSchedule: { day: '210', late: '322', overnight: '80' } },
}

const FERRY_FALLBACK = {
  alert: null,
  departures: [],
}

const PATH_FALLBACK = {
  alert: null,
  departures: [],
}

// Derive which alert sources are active based on the transit cards currently on the dashboard.
// Tunnels are always on the dashboard so they always appear, but can be toggled off.
// Bus/ferry/PATH/subway alerts only show if a matching card is present.
function deriveActiveAlertSources(stops) {
  const sources = new Set()
  // Tunnels always present on dashboard
  sources.add('lincoln_tunnel')
  sources.add('holland_tunnel')

  for (const id of stops) {
    // Ferry cards
    if (id === 'ferry_hob14' || id === 'ferry_w39' || id.startsWith('ferry:')) {
      sources.add('ferry')
    }
    // PATH cards
    if (id === 'path_hob33' || id === 'path_33hob' || id === 'path_hobwtc' || id === 'path_wtchob') {
      sources.add('path_hob33')
    }
    if (id === 'path_33newport') {
      sources.add('path_jsq33')
    }
    if (id.startsWith('path:')) {
      const route = id.split(':')[1]
      if (route === '862' || route === '860') sources.add('path_hob33')
      if (route === '861') sources.add('path_jsq33')
    }
    // Bus cards — preconfigured stops serve known routes
    if (id === 'clinton' || id === 'washington' || id === 'willow' ||
        id === 'pabt_washington' || id === 'pabt_willow') {
      sources.add('bus_126')
    }
    if (id === 'willow' || id === 'pabt_119') {
      sources.add('bus_119')
    }
    if (id === 'washington' || id === 'willow') {
      sources.add('bus_89')
    }
    if (id === 'washington') {
      sources.add('bus_22')
    }
    // Dynamic bus stops — new format: bus:STOP_ID:ROUTE1,ROUTE2
    if (id.startsWith('bus:')) {
      const routes = id.split(':')[2]
      if (routes) {
        routes.split(',').forEach(r => sources.add(`bus_${r}`))
      }
    }
    // Legacy dynamic bus stops — format is "STOP_ID:ROUTE" or just numeric STOP_ID
    else if (/^\d/.test(id)) {
      const parts = id.split(':')
      if (parts.length >= 2) {
        sources.add(`bus_${parts[1]}`)
      }
    }
    // MTA subway
    if (id.startsWith('mta:')) {
      sources.add('mta_subway')
    }
    // NJT Rail
    if (id.startsWith('rail:')) {
      sources.add('njt_rail')
    }
    // HBLR
    if (id.startsWith('hblr:')) {
      sources.add('hblr')
    }
    // LIRR
    if (id.startsWith('lirr:')) {
      sources.add('lirr')
    }
    // Metro-North
    if (id.startsWith('mnr:')) {
      sources.add('mnr')
    }
    // MTA Bus
    if (id.startsWith('mtabus:')) {
      sources.add('mta_bus')
    }
    // NYC Ferry
    if (id.startsWith('nycferry:')) {
      sources.add('nycferry')
    }
  }
  return sources
}

function buildTickerItems(tunnelData, ferryData, pathData, busData, mtaAlerts, railAlerts, alertSettings, activeAlertSources) {
  const items = []
  // An alert shows only if: (1) its source is on the dashboard, AND (2) the user hasn't toggled it off
  const on = (id) => activeAlertSources.has(id) && alertSettings[id] !== false

  // Tunnel alerts — all alerts go to ticker (including stale ones)
  if (tunnelData?.tunnels) {
    for (const t of tunnelData.tunnels) {
      const alertId = t.name.toLowerCase() === 'lincoln' ? 'lincoln_tunnel' : 'holland_tunnel'
      if (on(alertId) && t.allAlerts && t.allAlerts.length > 0) {
        items.push({ source: 'PANYNJ', cls: 'panynj', text: t.allAlerts[0] })
      }
    }
  }

  // Bus alerts (live from NJT GTFS-RT)
  if (busData?._alerts) {
    busData._alerts.forEach((a) => {
      const routeAlertIds = a.routes.map(r => `bus_${r}`)
      if (routeAlertIds.some(id => on(id))) {
        items.push({ source: 'NJT', cls: 'njtransit', text: `Rt ${a.routes.join(',')}: ${a.text}` })
      }
    })
  }

  // Ferry alert (live from Connexionz)
  if (on('ferry') && ferryData?.alert) {
    items.push({ source: 'Ferry', cls: 'ferry', text: ferryData.alert })
  }

  // PATH alert (live from PANYNJ)
  if ((on('path_hob33') || on('path_jsq33')) && pathData?.alert) {
    items.push({ source: 'PATH', cls: 'path', text: pathData.alert })
  }

  // MTA Subway alerts
  if (on('mta_subway') && mtaAlerts && mtaAlerts.length > 0) {
    for (const a of mtaAlerts.slice(0, 3)) {
      items.push({ source: 'MTA', cls: 'mta', text: a.text })
    }
  }

  // NJT Rail alerts
  if (on('njt_rail') && railAlerts && railAlerts.length > 0) {
    for (const a of railAlerts.slice(0, 2)) {
      items.push({ source: 'NJT Rail', cls: 'njtransit', text: a.text })
    }
  }

  // If no live alerts, show "No alerts"
  if (items.length === 0) {
    items.push({ source: '', cls: '', text: 'No active alerts' })
  }

  return items
}

// ── Shared inline alert ──
function InlineAlert({ text }) {
  if (!text) return null
  return (
    <div className="inline-alert">
      <AlertTriangle className="inline-alert-icon" />
      <span>{text}</span>
    </div>
  )
}

// ── Connectivity banner ──
function ConnectivityBanner({ errors }) {
  const hasError = errors.some(Boolean)
  if (!hasError) return null
  return (
    <div className="connectivity-banner">
      <WifiOff className="connectivity-icon" />
      <span>Connection issue — data may be stale</span>
    </div>
  )
}

// ── Components ──
function CurrentTime() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="header-time">
      {time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
    </span>
  )
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <Moon className="theme-toggle-icon" /> : <Sun className="theme-toggle-icon" />}
    </button>
  )
}

function TunnelCard({ data, alertSettings, activeAlertSources, inlineAlertDuration }) {
  const on = (id) => activeAlertSources.has(id) && alertSettings[id] !== false
  const maxAge = inlineAlertDuration === 0 ? 0 : inlineAlertDuration === Infinity ? Infinity : (inlineAlertDuration ?? 60)
  return (
    <div className="card tunnel-card">
      <div className="card-header">
        <Car className="card-icon" />
        <span className="card-title">Tunnels</span>
        <span className="card-title-sep">·</span>
        <span className="card-title-stop">{data.direction}</span>
      </div>
      <div className="card-body">
        <div className="tunnel-grid">
          {data.tunnels.map((t) => {
            const alertId = t.name.toLowerCase() === 'lincoln' ? 'lincoln_tunnel' : 'holland_tunnel'
            const inlineAlerts = on(alertId) && t.alertsWithAge
              ? t.alertsWithAge.filter(a => maxAge === Infinity || a.ageMinutes < maxAge)
              : []
            return (
              <div key={t.name} className="tunnel-entry">
                <div className="tunnel-entry-name">{t.name}</div>
                <div className="tunnel-entry-stats">
                  <span className={`tunnel-time ${t.severity}`}>{t.crossingMinutes}</span>
                  <span className="tunnel-unit">min</span>
                  {t.speed != null && (
                    <span className="tunnel-speed">
                      <Gauge className="tunnel-speed-icon" />
                      {t.speed} mph
                    </span>
                  )}
                </div>
                {inlineAlerts.length > 0 && (
                  <InlineAlert text={inlineAlerts[0].text} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function WeatherCard({ weatherData, location }) {
  const periods = weatherData?.periods || WEATHER_FALLBACK.periods
  const label = weatherData?.label || WEATHER_FALLBACK.label

  return (
    <div className="card weather-card">
      <div className="card-header">
        <CloudSun className="card-icon" />
        <span className="card-title">Weather</span>
        <span className="weather-location-toggle" style={{ cursor: 'default' }}>
          <MapPin className="weather-location-icon" />
          <span>{label}</span>
        </span>
      </div>
      <div className="card-body">
        <div className="weather-periods">
          {periods.map((p) => (
            <div key={p.label} className="weather-period">
              <span className="weather-period-label">{p.label}</span>
              <span className="weather-icon">{p.icon}</span>
              <span className="weather-temp">{p.temp}°</span>
              <span className="weather-detail">
                <Droplets className="weather-detail-icon" /> {p.humidity}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BusStopCard({ stop }) {
  const cardRef = useRef(null)
  const [visibleCount, setVisibleCount] = useState(6)
  const [showGateInfo, setShowGateInfo] = useState(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height
        const headerHeight = 60
        const available = h - headerHeight
        const rowHeight = Math.max(20, h * 0.1)
        const count = Math.floor(available / rowHeight)
        setVisibleCount(Math.max(2, Math.min(6, count)))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const hasBuses = stop.buses && stop.buses.length > 0
  const hasRealtime = hasBuses && stop.buses.some((b) => b.source === 'realtime')
  const sourceLabel = hasRealtime ? 'LIVE' : hasBuses ? 'SCHED' : null

  // Show service note if: no buses, OR only 1 bus that's 20+ min away
  const showServiceNote = stop.serviceNote && (
    !hasBuses || (stop.buses.length === 1 && stop.buses[0].eta >= 20)
  )

  return (
    <div className="card bus-card" ref={cardRef}>
      <div className="card-header">
        <Bus className="card-icon" />
        <span className="card-title">Bus</span>
        <span className="card-title-sep">·</span>
        <span className="card-title-stop">{stop.name}</span>
        {stop.gate && (
          <>
            <span className="card-title-sep">|</span>
            <button
              className="bus-gate-header"
              onClick={() => setShowGateInfo((v) => !v)}
              title="Click for gate schedule"
            >
              Gate {stop.gate}
            </button>
          </>
        )}
        {sourceLabel && (
          <span className={`bus-source-badge ${hasRealtime ? 'live' : 'sched'}`}>
            {sourceLabel}
          </span>
        )}
      </div>
      {showGateInfo && stop.gateSchedule && (
        <div className="gate-tooltip" onClick={() => setShowGateInfo(false)}>
          <div className="gate-tooltip-content" onClick={(e) => e.stopPropagation()}>
            <div className="gate-tooltip-title">{stop.name}</div>
            <div className="gate-tooltip-row">
              <span className="gate-tooltip-time">6 AM – 10 PM</span>
              <span className="gate-tooltip-gate">Gate {stop.gateSchedule.day}</span>
            </div>
            <div className="gate-tooltip-row">
              <span className="gate-tooltip-time">10 PM – 1 AM</span>
              <span className="gate-tooltip-gate">Gate {stop.gateSchedule.late}</span>
            </div>
            <div className="gate-tooltip-row">
              <span className="gate-tooltip-time">1 AM – 6 AM</span>
              <span className="gate-tooltip-gate">Gate {stop.gateSchedule.overnight}</span>
            </div>
          </div>
        </div>
      )}
      <div className="card-body">
        {hasBuses ? (
          <>
            <div className="bus-list">
              {stop.buses.slice(0, visibleCount).map((b, i) => (
                <div key={i} className="bus-row">
                  <span className={`bus-route ${b.cls}`}>{b.route}</span>
                  <span className="bus-eta-group">
                    <span className={`bus-eta-min ${etaClass(b.eta)}`}>{b.eta} min</span>
                    <span className="bus-eta-divider">|</span>
                    <span className="bus-eta-clock">{b.etaTime || etaTime(b.eta)}</span>
                  </span>
                  {capacityLabel(b.capacity) && (
                    <span className={`bus-capacity ${b.capacity}`}>{capacityLabel(b.capacity)}</span>
                  )}
                  {b.source === 'schedule' && (
                    <span className="bus-sched-indicator" title="Scheduled time">~</span>
                  )}
                </div>
              ))}
            </div>
            {showServiceNote && (
              <div className="bus-service-note">{stop.serviceNote}</div>
            )}
          </>
        ) : (
          <div className="bus-empty">
            <span>No upcoming buses</span>
            {showServiceNote && (
              <span className="bus-service-note">{stop.serviceNote}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Self-polling bus card for dynamically added stops
// Supports new format: bus:STOP_ID:ROUTE1,ROUTE2 and legacy: STOP_ID or STOP_ID:ROUTE
function DynamicBusCard({ stopId, displayName }) {
  const fetcher = useCallback(() => fetchDynamicStop(stopId), [stopId])
  const { data } = usePolling(fetcher, 30_000)

  const fallbackName = displayName || stopId
  if (!data) {
    return <BusStopCard stop={{ name: fallbackName, buses: [], serviceNote: null, gate: null, gateSchedule: null }} />
  }
  // Use the cached display name (formatted during picker), fall back to shortened server name
  const name = displayName || (data.isPabt ? `PABT · ${data.buses?.[0]?.route || ''}` : shortenStopName(data.name))
  return <BusStopCard stop={{ ...data, name }} />
}

// Self-polling PATH card for dynamically added PATH stops
// ID format: path:ROUTE:DIR:STOP (e.g. path:862:1:26727)
function DynamicPathCard({ stopId, displayName, alertSettings, activeAlertSources, inlineAlertDuration }) {
  const fetcher = useCallback(async () => {
    const parts = stopId.split(':')
    if (parts.length < 4) return null
    const [, route, direction, stop] = parts
    const res = await fetch(`/api/path/query?route=${route}&direction=${direction}&stop=${stop}`)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 15_000)

  const pathData = data || { departures: [], alert: null }
  const name = displayName || data?.stationName || null
  return <PathCard data={pathData} displayName={name} alertSettings={alertSettings} activeAlertSources={activeAlertSources} inlineAlertDuration={inlineAlertDuration} />
}

// Self-polling ferry card for dynamically added ferry stops
// ID format: ferry:STOP_TAG:ROUTE_NO:DEST_MATCH (e.g. ferry:10:19:Midtown)
function DynamicFerryCard({ stopId, displayName, alertSettings, activeAlertSources, inlineAlertDuration }) {
  const fetcher = useCallback(async () => {
    const parts = stopId.split(':')
    if (parts.length < 3) return null
    const [, stopTag, routeNo, destMatch] = parts
    let url = `/api/ferry/query?stop=${stopTag}`
    if (routeNo) url += `&route=${routeNo}`
    if (destMatch) url += `&dest=${destMatch}`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)

  const ferryData = data || { departures: [], alert: null }
  return <FerryCard data={ferryData} displayName={displayName} alertSettings={alertSettings} activeAlertSources={activeAlertSources} inlineAlertDuration={inlineAlertDuration} />
}

// Self-polling MTA Subway card
// ID format: mta:STATION_IDS:DIRECTION:LINES (e.g. mta:D17,R17:S:B,D,F,N,Q,R,W)
function DynamicMtaCard({ stopId, displayName, alertSettings, activeAlertSources, inlineAlertDuration }) {
  const fetcher = useCallback(async () => {
    const parts = stopId.split(':')
    if (parts.length < 3) return null
    const [, stationIds, dir, lines] = parts
    // Build stop param: for "all" direction, pass base IDs; for N/S, append suffix
    let stopParam = stationIds
    if (dir === 'N' || dir === 'S') {
      stopParam = stationIds.split(',').map(id => id + dir).join(',')
    }
    let url = `/api/mta/query?stop=${stopParam}`
    if (lines) url += `&lines=${lines}`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)

  const departures = data?.departures || []
  const alerts = data?.alerts || []
  const stationName = displayName || data?.stationName || stopId
  const showAlerts = inlineAlertDuration !== 0 && activeAlertSources?.has('mta_subway') && alertSettings?.mta_subway !== false

  return (
    <div className="card subway-card">
      <div className="card-header">
        <span className="subway-card-icon"><MtaGlobeIcon size={20} /></span>
        <span className="card-title">Subway</span>
        <span className="card-title-sep">·</span>
        <span className="card-title-stop">{stationName}</span>
      </div>
      <div className="card-body" style={{ justifyContent: 'flex-start' }}>
        {showAlerts && alerts.length > 0 && (
          <InlineAlert text={alerts[0]} />
        )}
        {departures.length > 0 ? (
          <div className="transit-list">
            {departures.map((d, i) => (
              <div key={i} className="transit-row">
                <SubwayBadge line={d.route || d.dest?.split(' ')[0]} size={20} />
                <span className="transit-dest">{d.dest}</span>
                <span className={`transit-time ${etaClass(d.eta)}`}>{d.eta} min</span>
                <span className="transit-eta-clock">{d.etaTime}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bus-empty">No upcoming trains</div>
        )}
      </div>
    </div>
  )
}

// Self-polling NJT Rail card
// ID format: rail:STATION_CODE:LINE1,LINE2 (e.g. rail:HB:GS,ML)
function DynamicRailCard({ stopId, displayName, alertSettings, activeAlertSources, inlineAlertDuration }) {
  const fetcher = useCallback(async () => {
    const parts = stopId.split(':')
    if (parts.length < 2) return null
    const [, station, lines] = parts
    let url = `/api/rail/query?station=${station}`
    if (lines) url += `&lines=${lines}`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 60_000) // poll every 60s (rate limit aware)

  const departures = data?.departures || []
  const alerts = data?.alerts || []
  const stationName = displayName || data?.stationName || stopId
  const showAlerts = inlineAlertDuration !== 0 && activeAlertSources?.has('njt_rail') && alertSettings?.njt_rail !== false

  return (
    <div className="card path-card">
      <div className="card-header">
        <TrainFront className="card-icon" />
        <span className="card-title">NJT Rail</span>
        <span className="card-title-sep">·</span>
        <span className="card-title-stop">{stationName}</span>
      </div>
      <div className="card-body" style={{ justifyContent: 'flex-start' }}>
        {showAlerts && alerts.length > 0 && (
          <InlineAlert text={alerts[0]} />
        )}
        {departures.length > 0 ? (
          <div className="transit-list">
            {departures.map((d, i) => (
              <div key={i} className="transit-row">
                <span className="transit-badge" style={{ background: d.lineColor, fontSize: 'clamp(6px, 0.8vw, 11px)' }}>{d.lineName}</span>
                <span className="transit-dest">{d.dest}</span>
                <span className={`transit-time ${etaClass(d.eta)}`}>{d.eta} min</span>
                <span className="transit-eta-clock">{d.etaTime}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bus-empty">No upcoming trains</div>
        )}
      </div>
    </div>
  )
}

// Self-polling HBLR card — uses bus GTFS-RT (route "HBLR")
// ID format: hblr:STOP_ID:DIR (e.g. hblr:30189:south)
function DynamicHblrCard({ stopId, displayName, alertSettings, activeAlertSources }) {
  const fetcher = useCallback(async () => {
    const parts = stopId.split(':')
    if (parts.length < 2) return null
    const [, gtfsStop] = parts
    const res = await fetch(`/api/bus/stops?ids=${gtfsStop}&routes=HBLR`)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)

  const buses = data?.buses || []
  const name = displayName || shortenStopName(data?.stop) || stopId

  // Backfill the stop name into persistent cache so settings panel shows it after reload
  useEffect(() => {
    if (data?.stop && !displayName) {
      persistDynamicStopName(stopId, shortenStopName(data.stop))
    }
  }, [data?.stop, stopId, displayName])
  const showAlerts = activeAlertSources?.has('hblr') && alertSettings?.hblr !== false

  return (
    <div className="card path-card">
      <div className="card-header">
        <LightRailIcon className="card-icon" />
        <span className="card-title">HBLR</span>
        <span className="card-title-sep">·</span>
        <span className="card-title-stop">{name}</span>
      </div>
      <div className="card-body" style={{ justifyContent: 'flex-start' }}>
        {buses.length > 0 ? (
          <div className="transit-list">
            {buses.map((b, i) => (
              <div key={i} className="transit-row">
                <span className="transit-badge" style={{ background: '#6B3FA0' }}>HBLR</span>
                <span className="transit-dest">{b.headsign || b.variant || '—'}</span>
                <span className={`transit-time ${etaClass(b.eta)}`}>{b.eta} min</span>
                <span className="transit-eta-clock">{b.etaTime}</span>
                {b.source === 'schedule' && <span className="bus-sched-indicator">~</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="bus-empty">No upcoming trains</div>
        )}
      </div>
    </div>
  )
}

// Self-polling LIRR card
// ID format: lirr:STOP_ID (e.g. lirr:102)
function DynamicLirrCard({ stopId, displayName, inlineAlertDuration }) {
  const fetcher = useCallback(async () => {
    const id = stopId.split(':')[1]
    const res = await fetch(`/api/lirr/query?stop=${id}`)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)
  const departures = data?.departures || []
  const stationName = displayName || data?.stationName || stopId
  return (
    <div className="card path-card">
      <div className="card-header">
        <HeavyRailIcon className="card-icon" />
        <span className="card-title">LIRR</span>
        <span className="card-title-sep">·</span>
        <span className="card-title-stop">{stationName}</span>
      </div>
      <div className="card-body" style={{ justifyContent: 'flex-start' }}>
        {departures.length > 0 ? (
          <div className="transit-list">
            {departures.map((d, i) => (
              <div key={i} className="transit-row">
                <span className="transit-badge" style={{ background: d.lineColor, fontSize: 'clamp(6px, 0.8vw, 10px)' }}>{d.dest?.split(' ')[0]}</span>
                <span className="transit-dest">{d.dest}</span>
                <span className={`transit-time ${etaClass(d.eta)}`}>{d.eta} min</span>
                <span className="transit-eta-clock">{d.etaTime}</span>
              </div>
            ))}
          </div>
        ) : <div className="bus-empty">No upcoming trains</div>}
      </div>
    </div>
  )
}

// Self-polling Metro-North card
// ID format: mnr:STOP_ID (e.g. mnr:1)
function DynamicMnrCard({ stopId, displayName, inlineAlertDuration }) {
  const fetcher = useCallback(async () => {
    const id = stopId.split(':')[1]
    const res = await fetch(`/api/mnr/query?stop=${id}`)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)
  const departures = data?.departures || []
  const stationName = displayName || data?.stationName || stopId
  return (
    <div className="card path-card">
      <div className="card-header">
        <GrandCentralClock size={20} />
        <span className="card-title">Metro-North</span>
        <span className="card-title-sep">·</span>
        <span className="card-title-stop">{stationName}</span>
      </div>
      <div className="card-body" style={{ justifyContent: 'flex-start' }}>
        {departures.length > 0 ? (
          <div className="transit-list">
            {departures.map((d, i) => (
              <div key={i} className="transit-row">
                <span className="transit-badge" style={{ background: d.lineColor, fontSize: 'clamp(6px, 0.8vw, 10px)' }}>{d.dest?.split(' ')[0]}</span>
                <span className="transit-dest">{d.dest}</span>
                <span className={`transit-time ${etaClass(d.eta)}`}>{d.eta} min</span>
                <span className="transit-eta-clock">{d.etaTime}</span>
              </div>
            ))}
          </div>
        ) : <div className="bus-empty">No upcoming trains</div>}
      </div>
    </div>
  )
}

// Self-polling MTA Bus card
// ID format: mtabus:STOP_ID:ROUTE (e.g. mtabus:308209:MTA+NYCT_M1)
function DynamicMtaBusCard({ stopId, displayName, alertSettings, activeAlertSources, inlineAlertDuration }) {
  const fetcher = useCallback(async () => {
    const parts = stopId.split(':')
    const [, stop, route] = parts
    let url = `/api/mtabus/query?stop=${stop}`
    if (route) url += `&route=${encodeURIComponent(route)}`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)
  const departures = data?.departures || []
  const alerts = data?.alerts || []
  const timedOut = data?.timeout === true
  const name = displayName || stopId
  const showAlerts = inlineAlertDuration !== 0 && activeAlertSources?.has('mta_bus') && alertSettings?.mta_bus !== false
  return (
    <div className="card bus-card">
      <div className="card-header">
        <Bus className="card-icon" />
        <span className="card-title">MTA Bus</span>
        <span className="card-title-sep">·</span>
        <span className="card-title-stop">{name}</span>
      </div>
      <div className="card-body" style={{ justifyContent: 'flex-start' }}>
        {showAlerts && alerts.length > 0 && <InlineAlert text={alerts[0]} />}
        {timedOut ? (
          <div className="bus-empty" style={{ color: 'var(--accent-orange, #f97316)' }}>
            Feed timed out — try again shortly
          </div>
        ) : departures.length > 0 ? (
          <div className="transit-list">
            {departures.map((d, i) => (
              <div key={i} className="transit-row">
                <span className={`bus-route njother`} style={{ minWidth: 'clamp(30px, 4vw, 55px)' }}>{d.route}</span>
                <span className="transit-dest">{d.dest}</span>
                <span className={`transit-time ${etaClass(d.eta)}`}>{d.eta} min</span>
                <span className="transit-eta-clock">{d.distance || d.etaTime}</span>
              </div>
            ))}
          </div>
        ) : <div className="bus-empty">No upcoming buses</div>}
      </div>
    </div>
  )
}

// Self-polling NYC Ferry card
// ID format: nycferry:STOP_ID (e.g. nycferry:17)
function DynamicNycFerryCard({ stopId, displayName, inlineAlertDuration }) {
  const fetcher = useCallback(async () => {
    const id = stopId.split(':')[1]
    const res = await fetch(`/api/nycferry/query?stop=${id}`)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)
  const departures = data?.departures || []
  const stationName = displayName || data?.stationName || stopId
  return (
    <div className="card nycferry-card">
      <div className="card-header">
        <Ship className="card-icon" />
        <span className="card-title">NYC Ferry</span>
        <span className="card-title-sep">·</span>
        <span className="card-title-stop">{stationName}</span>
      </div>
      <div className="card-body" style={{ justifyContent: 'flex-start' }}>
        {departures.length > 0 ? (
          <div className="transit-list">
            {departures.map((d, i) => (
              <div key={i} className="transit-row">
                <span className="transit-badge" style={{ background: d.lineColor, fontSize: 'clamp(6px, 0.8vw, 10px)' }}>{d.dest?.split(' ')[0]}</span>
                <span className="transit-dest">{d.dest}</span>
                <span className={`transit-time ${etaClass(d.eta)}`}>{d.eta} min</span>
                <span className="transit-eta-clock">{d.etaTime}</span>
              </div>
            ))}
          </div>
        ) : <div className="bus-empty">No upcoming ferries</div>}
      </div>
    </div>
  )
}

function FerryCard({ data, displayName, alertSettings, activeAlertSources, inlineAlertDuration }) {
  const hasDepartures = data.departures && data.departures.length > 0
  const dest = hasDepartures ? data.departures[0].dest : (displayName || 'No service')
  const showAlert = inlineAlertDuration !== 0 && activeAlertSources?.has('ferry') && alertSettings?.ferry !== false && data.alert

  return (
    <div className="card ferry-card">
      <div className="card-header">
        <Ship className="card-icon" />
        <span className="card-title">NYW Ferry</span>
        <span className="card-title-sep">·</span>
        <span className="card-title-stop">{dest}</span>
      </div>
      <div className="card-body">
        {showAlert && <InlineAlert text={data.alert} />}
        {hasDepartures ? (
          <div className="transit-list">
            {data.departures.map((f, i) => (
              <div key={i} className="transit-row">
                <span className="transit-badge ferry">Ferry</span>
                <span className={`transit-time ${etaClass(f.eta)}`}>{f.eta} min</span>
                <span className="transit-eta-clock">{f.etaTime || etaTime(f.eta)}</span>
                {f.source === 'schedule' && <span className="bus-sched-indicator">~</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="bus-empty">No upcoming ferries</div>
        )}
      </div>
    </div>
  )
}

function PathCard({ data, displayName, alertSettings, activeAlertSources, inlineAlertDuration }) {
  const hasDepartures = data.departures && data.departures.length > 0
  const showAlert = inlineAlertDuration !== 0 && (activeAlertSources?.has('path_hob33') && alertSettings?.path_hob33 !== false ||
                     activeAlertSources?.has('path_jsq33') && alertSettings?.path_jsq33 !== false) && data.alert
  // Group departures by destination for display
  const dests = [...new Set((data.departures || []).map(d => d.dest))]

  return (
    <div className="card path-card">
      <div className="card-header">
        <TrainFront className="card-icon" />
        <span className="card-title">PATH</span>
        {displayName && (
          <>
            <span className="card-title-sep">·</span>
            <span className="card-title-stop">{displayName}</span>
          </>
        )}
      </div>
      <div className="card-body">
        {showAlert && <InlineAlert text={data.alert} />}
        {hasDepartures ? (
          <div className="transit-list">
            {data.departures.map((p, i) => (
              <div key={i} className="transit-row">
                <span className="transit-badge path">{p.dest.split('→')[0].trim()}</span>
                <span className="transit-dest">{p.dest.split('→')[1]?.trim() || ''}</span>
                <span className={`transit-time ${etaClass(p.eta)}`}>{p.eta} min</span>
                <span className="transit-eta-clock">{p.etaTime || etaTime(p.eta)}</span>
                {p.source === 'schedule' && <span className="bus-sched-indicator">~</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="bus-empty">No upcoming trains</div>
        )}
      </div>
    </div>
  )
}

function NewsTicker({ items, speed = 60 }) {
  const doubled = [...items, ...items]
  const scrollRef = useRef(null)
  const [duration, setDuration] = useState(60)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const width = el.scrollWidth / 2
    setDuration(Math.max(15, width / speed))
  }, [items, speed])

  return (
    <div className="news-ticker">
      <div className="news-label">
        <Newspaper className="news-label-icon" />
        ALERTS
      </div>
      <div className="news-scroll-container">
        <div className="news-scroll" ref={scrollRef} style={{ animationDuration: `${duration}s` }}>
          {doubled.map((item, i) => (
            <div key={i} className="news-item">
              <span className={`news-source ${item.cls}`}>{item.source}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// NJT bus route badge color classes
const ROUTE_CLASSES = {
  '126': 'nj126', '119': 'nj119', '128': 'nj128',
  '165': 'nj165', '166': 'nj166', '89': 'nj89',
  '22': 'nj22', '23': 'nj23',
}

// MTA subway line brand colors
const MTA_COLORS = {
  '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
  '4': '#00933C', '5': '#00933C', '6': '#00933C', '6X': '#00933C',
  '7': '#B933AD', '7X': '#B933AD',
  'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
  'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'FX': '#FF6319', 'M': '#FF6319',
  'G': '#6CBE45',
  'J': '#996633', 'Z': '#996633',
  'L': '#A7A9AC',
  'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
  'S': '#808183', 'GS': '#808183', 'FS': '#808183', 'H': '#808183',
  'SI': '#1D2D5C',
}

function SubwayBadge({ line, size = 18 }) {
  const bg = MTA_COLORS[line] || '#808183'
  const textColor = ['N', 'Q', 'R', 'W'].includes(line) ? '#000' : '#fff'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%', backgroundColor: bg,
      color: textColor, fontSize: size * 0.55, fontWeight: 700, lineHeight: 1,
      flexShrink: 0,
    }}>{line}</span>
  )
}

function MtaGlobeIcon({ size = 20 }) {
  const s = size
  return (
    <svg width={s} height={s * 1.6} viewBox="0 0 24 38" style={{ flexShrink: 0 }}>
      {/* Light beam — trapezoid fanning out from globe bottom, dark mode only via CSS */}
      <defs>
        <linearGradient id="mtaBeamGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE566" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#FFE566" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="3,10 21,10 24,22 0,22" fill="url(#mtaBeamGrad)" className="mta-globe-beam"/>
      {/* Globe green top half */}
      <circle cx="12" cy="10" r="9" fill="#00933C" />
      <clipPath id="globeBottom">
        <rect x="0" y="10" width="24" height="10" />
      </clipPath>
      {/* Globe white/warm bottom half */}
      <circle cx="12" cy="10" r="9" fill="#fff" clipPath="url(#globeBottom)" className="mta-globe-white"/>
      <line x1="3" y1="10" x2="21" y2="10" stroke="#333" strokeWidth="0.5" />
      {/* Collar */}
      <rect x="9" y="19" width="6" height="2" rx="0.5" fill="#2a2a2a" />
      {/* Pole */}
      <rect x="10" y="21" width="4" height="12" rx="1" fill="#00933C" />
      <rect x="10.8" y="21" width="1.2" height="12" rx="0.5" fill="#00a844" opacity="0.5" />
      {/* Base */}
      <path d="M7 33 L17 33 L18.5 37 L5.5 37 Z" fill="#00933C" />
      <path d="M7.5 33 L12 33 L12 37 L6 37 Z" fill="#00a844" opacity="0.3" />
    </svg>
  )
}
// Hoboken Lackawanna Terminal clocktower — used for HBLR
// Copper-green tower, four-faced clock, hipped roof, red brick base. Clock face glows in dark mode.
function LightRailIcon({ className, size = 20 }) {
  const h = size * 1.6
  return (
    <svg width={size} height={h} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      {/* Red brick terminal base */}
      <rect x="2" y="27" width="20" height="11" fill="#8B3A2A"/>
      <line x1="2" y1="30.5" x2="22" y2="30.5" stroke="#6B2A1A" strokeWidth="0.4"/>
      <line x1="2" y1="34" x2="22" y2="34" stroke="#6B2A1A" strokeWidth="0.4"/>
      <line x1="7" y1="27" x2="7" y2="30.5" stroke="#6B2A1A" strokeWidth="0.4"/>
      <line x1="12" y1="30.5" x2="12" y2="34" stroke="#6B2A1A" strokeWidth="0.4"/>
      <line x1="17" y1="27" x2="17" y2="30.5" stroke="#6B2A1A" strokeWidth="0.4"/>
      {/* Arched windows */}
      <path d="M4.5 28.5 Q5.5 27.5 6.5 28.5 L6.5 30.5 L4.5 30.5 Z" fill="#5A1A0A" opacity="0.6"/>
      <path d="M9 28.5 Q10 27.5 11 28.5 L11 30.5 L9 30.5 Z" fill="#5A1A0A" opacity="0.6"/>
      <path d="M13.5 28.5 Q14.5 27.5 15.5 28.5 L15.5 30.5 L13.5 30.5 Z" fill="#5A1A0A" opacity="0.6"/>
      {/* Tower shaft — copper green */}
      <rect x="8.5" y="13" width="7" height="14" fill="#4A7C6F"/>
      <rect x="9" y="13.5" width="2.5" height="13" fill="#5A9080" opacity="0.35"/>
      {/* Belfry */}
      <rect x="7.5" y="9.5" width="9" height="4" rx="0.5" fill="#3D6B5E"/>
      <path d="M9 9.5 Q10.5 7.8 12 9.5" fill="#2A4A40"/>
      <path d="M12 9.5 Q13.5 7.8 15 9.5" fill="#2A4A40"/>
      {/* Hipped copper roof */}
      <path d="M6.5 9.5 L12 3.5 L17.5 9.5 Z" fill="#5A9080"/>
      <path d="M6.5 9.5 L12 3.5 L9.5 9.5 Z" fill="#4A7C6F" opacity="0.45"/>
      {/* Finial */}
      <line x1="12" y1="3.5" x2="12" y2="1.2" stroke="#4A7C6F" strokeWidth="1.2"/>
      <circle cx="12" cy="1.2" r="0.9" fill="#5A9080"/>
      {/* Clock face — glows in dark mode via CSS .hblr-clock-face */}
      <circle cx="12" cy="17" r="3" fill="#E8F4F0" className="hblr-clock-face"/>
      <circle cx="12" cy="17" r="3" fill="none" stroke="#3D6B5E" strokeWidth="0.5"/>
      <line x1="12" y1="17" x2="12" y2="14.5" stroke="#2A4A40" strokeWidth="0.7" strokeLinecap="round"/>
      <line x1="12" y1="17" x2="14" y2="17.8" stroke="#2A4A40" strokeWidth="0.5" strokeLinecap="round"/>
      <circle cx="12" cy="17" r="0.4" fill="#4A7C6F"/>
    </svg>
  )
}
// LIRR M7/M9 commuter train — solid fill, blue nose, yellow stripe, headlight in dark mode
function HeavyRailIcon({ className, size = 20 }) {
  const h = size * 1.6
  return (
    <svg width={size} height={h} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      {/* Car body — silver */}
      <rect x="1.5" y="10" width="21" height="13" rx="1.5" fill="#C8CDD4"/>
      <rect x="2" y="10.5" width="7" height="12" fill="#D8DDE4" opacity="0.5"/>
      {/* Blue nose */}
      <rect x="1.5" y="10" width="5.5" height="13" rx="1.5" fill="#003DA5"/>
      <rect x="5" y="10" width="2" height="13" fill="#003DA5"/>
      {/* Yellow safety stripe */}
      <rect x="6.8" y="10" width="1.5" height="13" fill="#F7C300"/>
      {/* Cab window */}
      <rect x="2" y="11.5" width="4" height="4" rx="0.5" fill="#1A1A2E" opacity="0.85"/>
      {/* Passenger windows */}
      <rect x="9.5" y="11.5" width="3" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <rect x="13.5" y="11.5" width="3" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <rect x="17.5" y="11.5" width="2.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      {/* Door line */}
      <line x1="9" y1="10" x2="9" y2="23" stroke="#A0A8B0" strokeWidth="0.5"/>
      {/* Underframe */}
      <rect x="1.5" y="23" width="21" height="2" fill="#6B7280"/>
      {/* Bogies */}
      <rect x="2.5" y="25" width="5.5" height="2" rx="0.5" fill="#4B5563"/>
      <rect x="16" y="25" width="5.5" height="2" rx="0.5" fill="#4B5563"/>
      {/* Wheels */}
      <circle cx="4" cy="28.5" r="2" fill="#374151"/>
      <circle cx="4" cy="28.5" r="0.8" fill="#6B7280"/>
      <circle cx="7" cy="28.5" r="2" fill="#374151"/>
      <circle cx="7" cy="28.5" r="0.8" fill="#6B7280"/>
      <circle cx="17" cy="28.5" r="2" fill="#374151"/>
      <circle cx="17" cy="28.5" r="0.8" fill="#6B7280"/>
      <circle cx="20" cy="28.5" r="2" fill="#374151"/>
      <circle cx="20" cy="28.5" r="0.8" fill="#6B7280"/>
      {/* Rail */}
      <rect x="0.5" y="30.5" width="23" height="1.2" rx="0.5" fill="#9CA3AF"/>
      {/* Headlight — visible in dark mode only via CSS .lirr-headlight */}
      <circle cx="3" cy="20" r="1.2" fill="#FFFDE0" className="lirr-headlight"/>
      <circle cx="3" cy="20" r="0.6" fill="#FFFFFF" className="lirr-headlight"/>
    </svg>
  )
}
// Grand Central Terminal information booth clock — four-faced opal clock on brass stand with pedestal
// Clock face glows gold in dark mode via CSS .mnr-clock-face
function GrandCentralClock({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      {/* Flat base plate */}
      <rect x="6.5" y="21.5" width="11" height="1.8" rx="0.6" fill="#B8860B"/>
      {/* Stem */}
      <rect x="10.5" y="18" width="3" height="3.5" rx="0.3" fill="#C5A55A"/>
      {/* Flared capital */}
      <path d="M9 18 L15 18 L13.8 19.2 L10.2 19.2 Z" fill="#D4AF37"/>
      {/* Outer brass housing */}
      <circle cx="12" cy="11" r="6.5" fill="#B8860B"/>
      {/* Opal clock face — glows in dark mode via CSS */}
      <circle cx="12" cy="11" r="5.5" fill="#F5F0E8" className="mnr-clock-face"/>
      {/* Bezel ring */}
      <circle cx="12" cy="11" r="6" fill="none" stroke="#D4AF37" strokeWidth="0.6"/>
      {/* Main hour markers */}
      <line x1="12" y1="5.8" x2="12" y2="7" stroke="#5C4A1E" strokeWidth="0.8"/>
      <line x1="17.2" y1="11" x2="16" y2="11" stroke="#5C4A1E" strokeWidth="0.8"/>
      <line x1="12" y1="16.2" x2="12" y2="15" stroke="#5C4A1E" strokeWidth="0.8"/>
      <line x1="6.8" y1="11" x2="8" y2="11" stroke="#5C4A1E" strokeWidth="0.8"/>
      {/* Minor markers */}
      {[30,60,120,150,210,240,300,330].map(deg => (
        <line key={deg} x1="12" y1="5.8" x2="12" y2="6.4" stroke="#8B7340" strokeWidth="0.4" transform={`rotate(${deg} 12 11)`}/>
      ))}
      {/* Hour hand ~10 (300°) */}
      <line x1="12" y1="11" x2="12" y2="8" stroke="#3B2F0E" strokeWidth="1" strokeLinecap="round" transform="rotate(300 12 11)"/>
      {/* Minute hand ~2 (60°) */}
      <line x1="12" y1="11" x2="12" y2="7.2" stroke="#3B2F0E" strokeWidth="0.7" strokeLinecap="round" transform="rotate(60 12 11)"/>
      {/* Center brass pin */}
      <circle cx="12" cy="11" r="0.6" fill="#D4AF37"/>
    </svg>
  )
}

const AVAILABLE_CITIES = [
  { id: 'hoboken', name: 'Hoboken' },
  { id: 'jersey-city', name: 'Jersey City' },
  { id: 'nyc', name: 'New York City' },
  { id: 'home', name: 'Home' },
  { id: 'work', name: 'Work' },
]

// Transit modes for the "New transit card" dialog
const TRANSIT_MODES = [
  { id: 'bus', name: 'NJ Transit Bus', icon: Bus, enabled: true },
  { id: 'njtrain', name: 'NJ Transit Rail', icon: TrainFront, enabled: true },
  { id: 'path', name: 'PATH Train', icon: TrainFront, enabled: true },
  { id: 'ferry', name: 'NYW Ferry', icon: Ship, enabled: true },
  { id: 'nycferry', name: 'NYC Ferry', icon: Ship, enabled: true },
  { id: 'hblr', name: 'Hudson-Bergen Light Rail', icon: LightRailIcon, enabled: true },
  { id: 'subway', name: 'MTA Subway', icon: MtaGlobeIcon, enabled: true },
  { id: 'lirr', name: 'LIRR', icon: HeavyRailIcon, enabled: true },
  { id: 'mnr', name: 'Metro-North', icon: GrandCentralClock, enabled: true },
  { id: 'mta-bus', name: 'MTA Bus', icon: Bus, enabled: true },
]

// Lines and stops grouped by mode
const LINES_BY_MODE = {
  bus: [
    { id: '126', name: '126' },
    { id: '119', name: '119' },
  ],
  njtrain: [], // NJT Rail uses search-based picker
  ferry: [], // ferry uses search-based picker, not static stops
  path: [], // PATH uses search-based picker, not static stops
  hblr: [], // HBLR uses bus GTFS-RT search-based picker
  lirr: [], // LIRR uses search-based picker
  mnr: [], // Metro-North uses search-based picker
  'mta-bus': [], // MTA Bus uses search-based picker
  nycferry: [], // NYC Ferry uses search-based picker
  hblr: [],
  subway: [], // subway uses search-based picker, not static stops
  lirr: [
    { id: 'LIRR', name: 'LIRR (all lines)', stops: [
      { id: 'mta:LIRR:8', name: 'Penn Station' },
      { id: 'mta:LIRR:12', name: 'Jamaica' },
      { id: 'mta:LIRR:15', name: 'Atlantic Terminal' },
    ]},
  ],
  mnr: [
    { id: 'MNR', name: 'Metro-North (all lines)', stops: [
      { id: 'mta:MNR:1', name: 'Grand Central' },
    ]},
  ],
  'mta-bus': [],
}

// Flat lookup for display in stop lists
const ALL_STOPS = []
for (const [type, lines] of Object.entries(LINES_BY_MODE)) {
  for (const line of lines) {
    for (const stop of (line.stops || [])) {
      ALL_STOPS.push({ ...stop, type, line: line.name })
    }
  }
}

const ALERT_SOURCE_NAMES = {
  lincoln_tunnel: 'Lincoln Tunnel',
  holland_tunnel: 'Holland Tunnel',
  bus_126: 'Bus 126',
  bus_119: 'Bus 119',
  bus_89: 'Bus 89',
  bus_22: 'Bus 22',
  bus_23: 'Bus 23',
  bus_128: 'Bus 128',
  bus_165: 'Bus 165',
  bus_166: 'Bus 166',
  ferry: 'NYW Ferry',
  path_hob33: 'PATH HOB–33rd',
  path_jsq33: 'PATH JSQ–33rd',
  mta_subway: 'MTA Subway',
  njt_rail: 'NJ Transit Rail',
  hblr: 'HBLR Light Rail',
  lirr: 'LIRR',
  mnr: 'Metro-North',
  mta_bus: 'MTA Bus',
  nycferry: 'NYC Ferry',
}

const AVAILABLE_TUNNELS = [
  { id: 'lincoln', name: 'Lincoln Tunnel' },
  { id: 'holland', name: 'Holland Tunnel' },
  { id: 'gwb_upper', name: 'GWB Upper Level' },
  { id: 'gwb_lower', name: 'GWB Lower Level' },
  { id: 'goethals', name: 'Goethals Bridge' },
  { id: 'bayonne', name: 'Bayonne Bridge' },
  { id: 'outerbridge', name: 'Outerbridge Crossing' },
]

// Global cache for dynamic stop names (persists across renders)
const dynamicStopNames = {
  // Preconfigured outbound bus stops
  'clinton': 'Clinton / 11th (126)',
  'willow': 'Willow / 15th (126/119)',
  'washington': 'Washington / 11th (126/22/89)',
  // Preconfigured inbound PABT bus stops
  'pabt_willow': 'PABT · 126 Willow / Hamilton Pk',
  'pabt_washington': 'PABT · 126 Washington',
  'pabt_119': 'PABT · 119',
  // Preconfigured ferry
  'ferry_hob14': 'Hoboken 14th → Midtown',
  'ferry_w39': 'Midtown/W39th → Hoboken 14th',
  // Preconfigured PATH
  'path_hob33': 'Hoboken → 33rd St',
  'path_33hob': '33rd St → Hoboken',
  'path_33newport': '33rd St → Newport',
  'path_hobwtc': 'Hoboken → WTC',
  'path_wtchob': 'WTC → Hoboken',
  // Default HBLR stops (names from GTFS; will be overwritten by persistDynamicStopName on first add)
  'hblr:15534': 'Hoboken Terminal',
  'hblr:15537': '9th St',
}

// Restore any persisted dynamic stop names from localStorage (e.g. HBLR, dynamic bus, etc.)
// This ensures the settings panel shows friendly names after a page reload.
const STOP_NAMES_KEY = 'hoboken-commuter-stop-names'
try {
  const saved = localStorage.getItem(STOP_NAMES_KEY)
  if (saved) Object.assign(dynamicStopNames, JSON.parse(saved))
} catch {}

function persistDynamicStopName(id, name) {
  dynamicStopNames[id] = name
  try {
    const saved = localStorage.getItem(STOP_NAMES_KEY)
    const existing = saved ? JSON.parse(saved) : {}
    existing[id] = name
    localStorage.setItem(STOP_NAMES_KEY, JSON.stringify(existing))
  } catch {}
}

function NewTransitCardDialog({ open, onClose, onAdd, excludeIds }) {
  const [selectedMode, setSelectedMode] = useState(null)
  const [selectedLine, setSelectedLine] = useState(null)
  // Subway station search
  const [subwaySearch, setSubwaySearch] = useState('')
  const [subwayResults, setSubwayResults] = useState([])
  const [selectedStation, setSelectedStation] = useState(null)
  const [stationLines, setStationLines] = useState([])
  const [selectedSubwayLines, setSelectedSubwayLines] = useState(new Set())
  const [selectedDirection, setSelectedDirection] = useState('S')
  // Bus stop search → line selection (MTA-style)
  const [busSearch, setBusSearch] = useState('')
  const [busSearchResults, setBusSearchResults] = useState([])
  const [selectedBusStop, setSelectedBusStop] = useState(null)
  const [busStopRoutes, setBusStopRoutes] = useState([])
  const [selectedBusRoutes, setSelectedBusRoutes] = useState(new Set())
  // Ferry terminal search → route/destination selection
  const [ferrySearch, setFerrySearch] = useState('')
  const [ferrySearchResults, setFerrySearchResults] = useState([])
  const [selectedFerryTerminal, setSelectedFerryTerminal] = useState(null)
  const [ferryRoutes, setFerryRoutes] = useState([])
  // PATH station search → line/direction selection
  const [pathSearch, setPathSearch] = useState('')
  const [pathSearchResults, setPathSearchResults] = useState([])
  const [selectedPathStation, setSelectedPathStation] = useState(null)
  const [pathRoutes, setPathRoutes] = useState([])
  // NJT Rail station search → line selection
  const [railSearch, setRailSearch] = useState('')
  const [railSearchResults, setRailSearchResults] = useState([])
  const [selectedRailStation, setSelectedRailStation] = useState(null)
  const [railLines, setRailLines] = useState([])
  const [selectedRailLines, setSelectedRailLines] = useState(new Set())
  // HBLR stop search
  const [hblrSearch, setHblrSearch] = useState('')
  const [hblrSearchResults, setHblrSearchResults] = useState([])
  // LIRR station search
  const [lirrSearch, setLirrSearch] = useState('')
  const [lirrSearchResults, setLirrSearchResults] = useState([])
  // MNR station search
  const [mnrSearch, setMnrSearch] = useState('')
  const [mnrSearchResults, setMnrSearchResults] = useState([])
  // MTA Bus route → stop search
  const [mtaBusSearch, setMtaBusSearch] = useState('')
  const [mtaBusRoutes, setMtaBusRoutes] = useState([])
  const [selectedMtaBusRoute, setSelectedMtaBusRoute] = useState(null)
  const [mtaBusStops, setMtaBusStops] = useState([])
  // NYC Ferry stop search
  const [nycFerrySearch, setNycFerrySearch] = useState('')
  const [nycFerryResults, setNycFerryResults] = useState([])

  if (!open) return null

  function reset() {
    setSelectedMode(null); setSelectedLine(null)
    setSubwaySearch(''); setSubwayResults([]); setSelectedStation(null)
    setStationLines([]); setSelectedSubwayLines(new Set()); setSelectedDirection('S')
    setBusSearch(''); setBusSearchResults([])
    setSelectedBusStop(null); setBusStopRoutes([]); setSelectedBusRoutes(new Set())
    setFerrySearch(''); setFerrySearchResults([])
    setSelectedFerryTerminal(null); setFerryRoutes([])
    setPathSearch(''); setPathSearchResults([])
    setSelectedPathStation(null); setPathRoutes([])
    setRailSearch(''); setRailSearchResults([])
    setSelectedRailStation(null); setRailLines([]); setSelectedRailLines(new Set())
    setHblrSearch(''); setHblrSearchResults([])
    setLirrSearch(''); setLirrSearchResults([])
    setMnrSearch(''); setMnrSearchResults([])
    setMtaBusSearch(''); setMtaBusRoutes([]); setSelectedMtaBusRoute(null); setMtaBusStops([])
    setNycFerrySearch(''); setNycFerryResults([])
  }
  function handleClose() { reset(); onClose() }

  const lines = selectedMode ? (LINES_BY_MODE[selectedMode] || []) : []

  function selectMode(id) {
    setSelectedMode(id)
    setSelectedLine(null)
    setSelectedBusStop(null)
    setBusSearch(''); setBusSearchResults([])
    setSelectedFerryTerminal(null); setFerrySearch(''); setFerrySearchResults([]); setFerryRoutes([])
    setSelectedPathStation(null); setPathSearch(''); setPathSearchResults([]); setPathRoutes([])
    setSelectedRailStation(null); setRailSearch(''); setRailSearchResults([]); setRailLines([]); setSelectedRailLines(new Set())
    setHblrSearch(''); setHblrSearchResults([])
    const modeLines = LINES_BY_MODE[id] || []
    if (modeLines.length === 1 && !['bus', 'ferry', 'path', 'njtrain', 'hblr', 'lirr', 'mnr', 'mta-bus', 'nycferry'].includes(id)) setSelectedLine(modeLines[0])
  }

  // Bus: search stops by name
  async function searchBusStops(q) {
    setBusSearch(q)
    if (q.length < 2) { setBusSearchResults([]); return }
    try {
      const res = await fetch(`/api/bus/stop-search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setBusSearchResults(data.stops || [])
    } catch { setBusSearchResults([]) }
  }

  // Bus: after picking a stop, load all routes at that stop
  async function selectBusStop(stopId, stopName) {
    setSelectedBusStop({ id: stopId, name: stopName })
    try {
      const res = await fetch(`/api/bus/stop-routes?id=${stopId}`)
      const data = await res.json()
      const routes = data.routes || []
      setBusStopRoutes(routes)
      // Pre-select all routes
      setSelectedBusRoutes(new Set(routes))
    } catch { setBusStopRoutes([]); setSelectedBusRoutes(new Set()) }
  }

  function toggleBusRoute(route) {
    setSelectedBusRoutes(prev => {
      const next = new Set(prev)
      if (next.has(route)) next.delete(route); else next.add(route)
      return next
    })
  }

  function confirmBus() {
    if (!selectedBusStop || selectedBusRoutes.size === 0) return
    const sortedRoutes = [...selectedBusRoutes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const routes = sortedRoutes.join(',')
    const stopId = `bus:${selectedBusStop.id}:${routes}`
    const isPabt = selectedBusStop.name.toUpperCase().includes('PORT AUTHORITY')
    // Format line suffix: all → (all), 1-2 → (126/119), 3+ → (126+)
    const totalRoutes = busStopRoutes.length
    let lineSuffix
    if (sortedRoutes.length === totalRoutes && totalRoutes > 1) {
      lineSuffix = 'all'
    } else if (sortedRoutes.length <= 2) {
      lineSuffix = sortedRoutes.join('/')
    } else {
      lineSuffix = `${sortedRoutes[0]}+`
    }
    // For PABT, use short title like hardcoded cards: "PABT · 125"
    let cardName
    if (isPabt) {
      cardName = `PABT · ${lineSuffix}`
    } else {
      const shortName = shortenStopName(selectedBusStop.name)
      cardName = `${shortName} (${lineSuffix})`
    }
    persistDynamicStopName(stopId, cardName)
    onAdd(stopId)
    handleClose()
  }

  function selectStop(stopId) {
    if (selectedLine && selectedLine.stops) {
      const cs = selectedLine.stops.find(s => s.id === stopId)
      if (cs) persistDynamicStopName(stopId, cs.name)
    }
    onAdd(stopId)
    handleClose()
  }

  // Ferry terminal search
  async function searchFerryTerminals(q) {
    setFerrySearch(q)
    if (q.length < 2) { setFerrySearchResults([]); return }
    try {
      const res = await fetch(`/api/ferry/terminals?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setFerrySearchResults(data.terminals || [])
    } catch { setFerrySearchResults([]) }
  }

  async function selectFerryTerminal(tag, name) {
    setSelectedFerryTerminal({ tag, name })
    try {
      const res = await fetch(`/api/ferry/terminal-routes?tag=${tag}`)
      const data = await res.json()
      setFerryRoutes(data.routes || [])
    } catch { setFerryRoutes([]) }
  }

  function selectFerryRoute(routeNo, destName) {
    const tag = selectedFerryTerminal.tag
    const termName = selectedFerryTerminal.name
    const stopId = `ferry:${tag}:${routeNo}:${destName || ''}`
    persistDynamicStopName(stopId, `${termName} → ${destName || routeNo}`)
    onAdd(stopId)
    handleClose()
  }

  // PATH station search
  async function searchPathStations(q) {
    setPathSearch(q)
    if (q.length < 2) { setPathSearchResults([]); return }
    try {
      const res = await fetch(`/api/path/stations?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setPathSearchResults(data.stations || [])
    } catch { setPathSearchResults([]) }
  }

  async function selectPathStation(station) {
    setSelectedPathStation(station)
    try {
      const res = await fetch(`/api/path/station-routes?id=${station.id}`)
      const data = await res.json()
      setPathRoutes(data.options || [])
    } catch { setPathRoutes([]) }
  }

  function selectPathRoute(option) {
    const routes = option.routeIds.join(',')
    const stopId = `path:${routes}:${option.dirId}:${selectedPathStation.id}`
    const routeLabel = option.routeNames.join('/')
    persistDynamicStopName(stopId, `${selectedPathStation.name} · ${routeLabel} ${option.label}`)
    onAdd(stopId)
    handleClose()
  }

  // NJT Rail station search
  async function searchRailStations(q) {
    setRailSearch(q)
    if (q.length < 2) { setRailSearchResults([]); return }
    try {
      const res = await fetch(`/api/rail/stations?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setRailSearchResults(data.stations || [])
    } catch { setRailSearchResults([]) }
  }

  async function selectRailStation(station) {
    setSelectedRailStation(station)
    try {
      const res = await fetch(`/api/rail/station-lines?code=${station.code}`)
      const data = await res.json()
      setRailLines(data.lines || [])
      setSelectedRailLines(new Set((data.lines || []).map(l => l.code)))
    } catch { setRailLines([]); setSelectedRailLines(new Set()) }
  }

  function toggleRailLine(code) {
    setSelectedRailLines(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code); else next.add(code)
      return next
    })
  }

  function confirmRail() {
    if (!selectedRailStation || selectedRailLines.size === 0) return
    const lines = [...selectedRailLines].sort().join(',')
    const stopId = `rail:${selectedRailStation.code}:${lines}`
    const lineLabel = selectedRailLines.size === railLines.length && railLines.length > 1
      ? 'all lines' : [...selectedRailLines].map(c => railLines.find(l => l.code === c)?.abbr || c).join('/')
    persistDynamicStopName(stopId, `${selectedRailStation.name} (${lineLabel})`)
    onAdd(stopId)
    handleClose()
  }

  // HBLR stop search
  async function searchHblrStops(q) {
    setHblrSearch(q)
    if (q.length < 2) { setHblrSearchResults([]); return }
    try {
      const res = await fetch(`/api/bus/stop-search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      // Filter to only stops that serve HBLR route
      const hblrStops = []
      for (const stop of (data.stops || [])) {
        const routeRes = await fetch(`/api/bus/stop-routes?id=${stop.id}`)
        const routeData = await routeRes.json()
        if ((routeData.routes || []).includes('HBLR')) {
          hblrStops.push(stop)
        }
      }
      setHblrSearchResults(hblrStops)
    } catch { setHblrSearchResults([]) }
  }

  function selectHblrStop(stopId, stopName) {
    const cardId = `hblr:${stopId}`
    persistDynamicStopName(cardId, shortenStopName(stopName))
    onAdd(cardId)
    handleClose()
  }

  // LIRR station search
  async function searchLirrStations(q) {
    setLirrSearch(q)
    if (q.length < 2) { setLirrSearchResults([]); return }
    try {
      const res = await fetch(`/api/lirr/stations?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setLirrSearchResults(data.stations || [])
    } catch { setLirrSearchResults([]) }
  }

  function selectLirrStation(station) {
    const cardId = `lirr:${station.id}`
    persistDynamicStopName(cardId, station.name)
    onAdd(cardId)
    handleClose()
  }

  // MNR station search
  async function searchMnrStations(q) {
    setMnrSearch(q)
    if (q.length < 2) { setMnrSearchResults([]); return }
    try {
      const res = await fetch(`/api/mnr/stations?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setMnrSearchResults(data.stations || [])
    } catch { setMnrSearchResults([]) }
  }

  function selectMnrStation(station) {
    const cardId = `mnr:${station.id}`
    persistDynamicStopName(cardId, station.name)
    onAdd(cardId)
    handleClose()
  }

  // MTA Bus route search → stop selection
  async function searchMtaBusRoutes(q) {
    setMtaBusSearch(q)
    if (q.length < 1) { setMtaBusRoutes([]); return }
    try {
      const res = await fetch(`/api/mtabus/routes?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setMtaBusRoutes(data.routes || [])
    } catch { setMtaBusRoutes([]) }
  }

  async function selectMtaBusRoute(route) {
    setSelectedMtaBusRoute(route)
    try {
      const res = await fetch(`/api/mtabus/route-stops?route=${encodeURIComponent(route.id)}`)
      const data = await res.json()
      const allStops = (data.directions || []).flatMap(d => d.stops)
      // Deduplicate by name
      const seen = new Map()
      for (const s of allStops) { if (!seen.has(s.name)) seen.set(s.name, s) }
      setMtaBusStops([...seen.values()])
    } catch { setMtaBusStops([]) }
  }

  function selectMtaBusStop(stop) {
    const cardId = `mtabus:${stop.id}:${selectedMtaBusRoute.id}`
    persistDynamicStopName(cardId, `${stop.name} (${selectedMtaBusRoute.name})`)
    onAdd(cardId)
    handleClose()
  }

  // NYC Ferry stop search
  async function searchNycFerryStops(q) {
    setNycFerrySearch(q)
    if (q.length < 2) { setNycFerryResults([]); return }
    try {
      const res = await fetch(`/api/nycferry/stops?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setNycFerryResults(data.stops || [])
    } catch { setNycFerryResults([]) }
  }

  function selectNycFerryStop(stop) {
    const cardId = `nycferry:${stop.id}`
    persistDynamicStopName(cardId, stop.name)
    onAdd(cardId)
    handleClose()
  }

  // Subway station search
  async function searchSubwayStations(q) {
    setSubwaySearch(q)
    if (q.length < 2) { setSubwayResults([]); return }
    try {
      const res = await fetch(`/api/mta/stations?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSubwayResults(data.stations || [])
    } catch { setSubwayResults([]) }
  }

  async function selectSubwayStation(station) {
    setSelectedStation(station)
    setStationLines([])
    setSelectedSubwayLines(new Set())
    // Load which lines serve this station — retry with backoff if cache is still building
    const fetchLines = async (attempt = 0) => {
      try {
        const res = await fetch(`/api/mta/station-lines?ids=${station.ids.join(',')}`)
        const data = await res.json()
        if (data.lines && data.lines.length > 0) {
          setStationLines(data.lines)
          setSelectedSubwayLines(new Set(data.lines))
        } else if (data.building && attempt < 10) {
          // Cache still building — retry with increasing delay (3s, 5s, 8s, ...)
          const delay = Math.min(3000 + attempt * 2000, 10000)
          setTimeout(() => fetchLines(attempt + 1), delay)
        } else if (!data.building && data.lines) {
          // Cache ready but this station has no lines (shouldn't happen, but handle gracefully)
          setStationLines(data.lines)
          setSelectedSubwayLines(new Set(data.lines))
        }
      } catch {
        if (attempt < 3) setTimeout(() => fetchLines(attempt + 1), 3000)
        else setStationLines([])
      }
    }
    fetchLines()
  }

  function toggleSubwayLine(line) {
    setSelectedSubwayLines(prev => {
      const next = new Set(prev)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })
  }

  function confirmSubway() {
    if (!selectedStation || selectedSubwayLines.size === 0) return
    const ids = selectedStation.ids.join(',')
    const lines = [...selectedSubwayLines].sort().join(',')
    const stopId = `mta:${ids}:${selectedDirection}:${lines}`
    const dirLabel = selectedDirection === 'N' ? 'Uptown' : selectedDirection === 'S' ? 'Downtown' : 'All'
    const lineLabels = [...selectedSubwayLines].sort().join('/')
    persistDynamicStopName(stopId, `${selectedStation.name} (${lineLabels} ${dirLabel})`)
    onAdd(stopId)
    handleClose()
  }

  // Determine current step
  const step = !selectedMode ? 0
    : selectedMode === 'subway' ? (selectedStation ? 'subway-dir' : 'subway-search')
    : selectedMode === 'bus' ? (selectedBusStop ? 'bus-lines' : 'bus-search')
    : selectedMode === 'ferry' ? (selectedFerryTerminal ? 'ferry-routes' : 'ferry-search')
    : selectedMode === 'path' ? (selectedPathStation ? 'path-lines' : 'path-search')
    : selectedMode === 'njtrain' ? (selectedRailStation ? 'rail-lines' : 'rail-search')
    : selectedMode === 'hblr' ? 'hblr-search'
    : selectedMode === 'lirr' ? 'lirr-search'
    : selectedMode === 'mnr' ? 'mnr-search'
    : selectedMode === 'mta-bus' ? (selectedMtaBusRoute ? 'mtabus-stop' : 'mtabus-route')
    : selectedMode === 'nycferry' ? 'nycferry-search'
    : !selectedLine ? 1 : 2

  return (
    <div className="settings-overlay" style={{ zIndex: 300 }} onClick={handleClose}>
      <div className="new-card-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">
            {step === 0 && 'New Transit Card'}
            {step === 'bus-search' && 'NJ Transit Bus — Search Stop'}
            {step === 'bus-lines' && `${shortenStopName(selectedBusStop?.name)} — Select Lines`}
            {step === 'ferry-search' && 'NYW Ferry — Search Terminal'}
            {step === 'ferry-routes' && `${selectedFerryTerminal?.name} — Select Destination`}
            {step === 'path-search' && 'PATH Train — Search Station'}
            {step === 'path-lines' && `${selectedPathStation?.name} — Select Line & Direction`}
            {step === 'rail-search' && 'NJ Transit Rail — Search Station'}
            {step === 'rail-lines' && `${selectedRailStation?.name} — Select Lines`}
            {step === 'hblr-search' && 'HBLR Light Rail — Search Stop'}
            {step === 'lirr-search' && 'LIRR — Search Station'}
            {step === 'mnr-search' && 'Metro-North — Search Station'}
            {step === 'mtabus-route' && 'MTA Bus — Search Route'}
            {step === 'mtabus-stop' && `${selectedMtaBusRoute?.name} — Select Stop`}
            {step === 'nycferry-search' && 'NYC Ferry — Search Stop'}
            {step === 1 && (TRANSIT_MODES.find(m => m.id === selectedMode)?.name + ' — Select Line')}
            {step === 'subway-search' && 'MTA Subway — Search Station'}
            {step === 'subway-dir' && `${selectedStation?.name} — Select Direction`}
            {step === 2 && (selectedLine?.name + ' — Select Stop')}
          </h2>
          <button className="settings-close" onClick={handleClose}><X className="settings-close-icon" /></button>
        </div>
        <div className="new-card-body">
          {step !== 0 && (
            <button className="new-card-back" onClick={() => {
              if (step === 'bus-lines') { setSelectedBusStop(null); setBusStopRoutes([]); setSelectedBusRoutes(new Set()) }
              else if (step === 'bus-search') { reset() }
              else if (step === 'ferry-routes') { setSelectedFerryTerminal(null); setFerryRoutes([]) }
              else if (step === 'ferry-search') { reset() }
              else if (step === 'path-lines') { setSelectedPathStation(null); setPathRoutes([]) }
              else if (step === 'path-search') { reset() }
              else if (step === 'rail-lines') { setSelectedRailStation(null); setRailLines([]); setSelectedRailLines(new Set()) }
              else if (step === 'rail-search') { reset() }
              else if (step === 'hblr-search') { reset() }
              else if (step === 'lirr-search') { reset() }
              else if (step === 'mnr-search') { reset() }
              else if (step === 'mtabus-stop') { setSelectedMtaBusRoute(null); setMtaBusStops([]) }
              else if (step === 'mtabus-route') { reset() }
              else if (step === 'nycferry-search') { reset() }
              else if (step === 'subway-dir') { setSelectedStation(null); setStationLines([]); setSelectedSubwayLines(new Set()) }
              else if (step === 'subway-search') { reset() }
              else if (step === 2 && lines.length === 1) { reset() }
              else if (step === 2) { setSelectedLine(null) }
              else { reset() }
            }}>{'← Back'}</button>
          )}

          {/* Step 0: Mode selection */}
          {step === 0 && (
            <div className="new-card-modes">
              {TRANSIT_MODES.map((mode) => {
                const Icon = mode.icon
                return (
                  <button key={mode.id} className={'new-card-mode' + (!mode.enabled ? ' disabled' : '')} onClick={() => mode.enabled && selectMode(mode.id)} disabled={!mode.enabled}>
                    <Icon size={18} />
                    <span>{mode.name}</span>
                    {mode.comingSoon && <span className="new-card-soon">Coming Soon</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* Bus: Search for a stop */}
          {step === 'bus-search' && (
            <div className="new-card-search">
              <input className="new-card-search-input" type="text" placeholder="Search for a bus stop (e.g. Washington, Willow, Port Authority)…" value={busSearch} onChange={(e) => searchBusStops(e.target.value)} autoFocus />
              <div className="new-card-lines" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {busSearchResults.map((s) => (
                  <button key={s.id} className="new-card-line-btn" onClick={() => selectBusStop(s.id, s.name)}>
                    <span className="new-card-line-name">{s.name}</span>
                  </button>
                ))}
                {busSearch.length >= 2 && busSearchResults.length === 0 && <div className="settings-stop-empty">No stops found</div>}
                {busSearch.length < 2 && <div className="settings-stop-empty">Type at least 2 characters to search</div>}
              </div>
            </div>
          )}

          {/* Bus: Select lines at stop */}
          {step === 'bus-lines' && selectedBusStop && (
            <div className="subway-dir-picker">
              {busStopRoutes.length > 0 ? (
                <>
                  <div className="subway-lines-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Routes at this stop</span>
                    <button
                      className="new-card-back"
                      style={{ fontSize: '11px', marginBottom: 0 }}
                      onClick={() => {
                        if (selectedBusRoutes.size === busStopRoutes.length) {
                          setSelectedBusRoutes(new Set())
                        } else {
                          setSelectedBusRoutes(new Set(busStopRoutes))
                        }
                      }}
                    >
                      {selectedBusRoutes.size === busStopRoutes.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="subway-dir-options">
                    {busStopRoutes.map((route) => (
                      <label key={route} className={`subway-dir-option ${selectedBusRoutes.has(route) ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                        <input type="checkbox" style={{ display: 'none' }} checked={selectedBusRoutes.has(route)} onChange={() => toggleBusRoute(route)} />
                        <span className={`bus-route ${ROUTE_CLASSES[route] || 'njother'}`} style={{ minWidth: 40, textAlign: 'center' }}>{route}</span>
                        <span>Route {route}</span>
                      </label>
                    ))}
                  </div>
                </>
              ) : <div className="settings-stop-empty">Loading routes…</div>}
              <button className="settings-save-btn" onClick={confirmBus} style={{ marginTop: '12px' }} disabled={selectedBusRoutes.size === 0}>
                Add Card
              </button>
            </div>
          )}

          {/* Ferry: Search terminals */}
          {step === 'ferry-search' && (
            <div className="new-card-search">
              <input className="new-card-search-input" type="text" placeholder="Search for a ferry terminal (e.g. Hoboken, Midtown, Paulus Hook)…" value={ferrySearch} onChange={(e) => searchFerryTerminals(e.target.value)} autoFocus />
              <div className="new-card-lines" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {ferrySearchResults.map((t) => (
                  <button key={t.tag} className="new-card-line-btn" onClick={() => selectFerryTerminal(t.tag, t.name)}>
                    <span className="new-card-line-name">{t.name}</span>
                  </button>
                ))}
                {ferrySearch.length >= 2 && ferrySearchResults.length === 0 && <div className="settings-stop-empty">No terminals found</div>}
                {ferrySearch.length < 2 && <div className="settings-stop-empty">Type at least 2 characters to search</div>}
              </div>
            </div>
          )}

          {/* Ferry: Select route/destination at terminal */}
          {step === 'ferry-routes' && selectedFerryTerminal && (
            <div className="new-card-lines">
              {ferryRoutes.length > 0 ? (
                ferryRoutes.flatMap((route) =>
                  route.destinations.length > 0
                    ? route.destinations.map((dest) => (
                        <button key={`${route.no}:${dest}`} className="new-card-line-btn" onClick={() => selectFerryRoute(route.no, dest)}>
                          <span className="new-card-line-name">→ {dest}</span>
                          <span className="new-card-line-count">{route.name}</span>
                        </button>
                      ))
                    : [<button key={route.no} className="new-card-line-btn" onClick={() => selectFerryRoute(route.no, '')}>
                        <span className="new-card-line-name">{route.name}</span>
                      </button>]
                )
              ) : <div className="settings-stop-empty">No active routes at this terminal</div>}
            </div>
          )}

          {/* PATH: Search stations */}
          {step === 'path-search' && (
            <div className="new-card-search">
              <input className="new-card-search-input" type="text" placeholder="Search for a PATH station (e.g. Hoboken, 33rd, Grove)…" value={pathSearch} onChange={(e) => searchPathStations(e.target.value)} autoFocus />
              <div className="new-card-lines" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {pathSearchResults.map((s) => (
                  <button key={s.id} className="new-card-line-btn" onClick={() => selectPathStation(s)}>
                    <span className="new-card-line-name">{s.name}</span>
                  </button>
                ))}
                {pathSearch.length >= 2 && pathSearchResults.length === 0 && <div className="settings-stop-empty">No stations found</div>}
                {pathSearch.length < 2 && <div className="settings-stop-empty">Type at least 2 characters to search</div>}
              </div>
            </div>
          )}

          {/* PATH: Select direction */}
          {step === 'path-lines' && selectedPathStation && (
            <div className="new-card-lines">
              {pathRoutes.length > 0 ? (
                pathRoutes.map((opt) => (
                  <button key={`${opt.routeIds.join(',')}:${opt.dirId}`} className="new-card-line-btn" onClick={() => selectPathRoute(opt)}>
                    <span className="new-card-line-name">{opt.label}</span>
                    <span className="new-card-line-count">{opt.routeNames.join(' / ')}</span>
                  </button>
                ))
              ) : <div className="settings-stop-empty">No routes at this station</div>}
            </div>
          )}

          {/* NJT Rail: Search stations */}
          {step === 'rail-search' && (
            <div className="new-card-search">
              <input className="new-card-search-input" type="text" placeholder="Search for a station (e.g. Hoboken, Secaucus, Newark)…" value={railSearch} onChange={(e) => searchRailStations(e.target.value)} autoFocus />
              <div className="new-card-lines" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {railSearchResults.map((s) => (
                  <button key={s.code} className="new-card-line-btn" onClick={() => selectRailStation(s)}>
                    <span className="new-card-line-name">{s.name}</span>
                    <span className="new-card-line-count">{s.code}</span>
                  </button>
                ))}
                {railSearch.length >= 2 && railSearchResults.length === 0 && <div className="settings-stop-empty">No stations found</div>}
                {railSearch.length < 2 && <div className="settings-stop-empty">Type at least 2 characters to search</div>}
              </div>
            </div>
          )}

          {/* NJT Rail: Select lines */}
          {step === 'rail-lines' && selectedRailStation && (
            <div className="subway-dir-picker">
              {railLines.length > 0 ? (
                <>
                  <div className="subway-lines-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Lines at this station</span>
                    <button className="new-card-back" style={{ fontSize: '11px', marginBottom: 0 }} onClick={() => {
                      if (selectedRailLines.size === railLines.length) setSelectedRailLines(new Set())
                      else setSelectedRailLines(new Set(railLines.map(l => l.code)))
                    }}>
                      {selectedRailLines.size === railLines.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="subway-dir-options">
                    {railLines.map((line) => (
                      <label key={line.code} className={`subway-dir-option ${selectedRailLines.has(line.code) ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                        <input type="checkbox" style={{ display: 'none' }} checked={selectedRailLines.has(line.code)} onChange={() => toggleRailLine(line.code)} />
                        <span className="transit-badge" style={{ background: line.color, minWidth: 40, fontSize: '10px' }}>{line.abbr}</span>
                        <span>{line.name}</span>
                      </label>
                    ))}
                  </div>
                </>
              ) : <div className="settings-stop-empty">Loading lines…</div>}
              <button className="settings-save-btn" onClick={confirmRail} style={{ marginTop: '12px' }} disabled={selectedRailLines.size === 0}>
                Add Card
              </button>
            </div>
          )}

          {/* HBLR: Search stops */}
          {step === 'hblr-search' && (
            <div className="new-card-search">
              <input className="new-card-search-input" type="text" placeholder="Search for an HBLR stop (e.g. Hoboken, Exchange, Liberty)…" value={hblrSearch} onChange={(e) => searchHblrStops(e.target.value)} autoFocus />
              <div className="new-card-lines" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {hblrSearchResults.map((s) => (
                  <button key={s.id} className="new-card-line-btn" onClick={() => selectHblrStop(s.id, s.name)}>
                    <span className="new-card-line-name">{s.name}</span>
                  </button>
                ))}
                {hblrSearch.length >= 2 && hblrSearchResults.length === 0 && <div className="settings-stop-empty">No HBLR stops found</div>}
                {hblrSearch.length < 2 && <div className="settings-stop-empty">Type at least 2 characters to search</div>}
              </div>
            </div>
          )}

          {/* LIRR: Search stations */}
          {step === 'lirr-search' && (
            <div className="new-card-search">
              <input className="new-card-search-input" type="text" placeholder="Search for a LIRR station…" value={lirrSearch} onChange={(e) => searchLirrStations(e.target.value)} autoFocus />
              <div className="new-card-lines" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {lirrSearchResults.map((s) => (
                  <button key={s.id} className="new-card-line-btn" onClick={() => selectLirrStation(s)}>
                    <span className="new-card-line-name">{s.name}</span>
                  </button>
                ))}
                {lirrSearch.length >= 2 && lirrSearchResults.length === 0 && <div className="settings-stop-empty">No stations found</div>}
                {lirrSearch.length < 2 && <div className="settings-stop-empty">Type at least 2 characters to search</div>}
              </div>
            </div>
          )}

          {/* MNR: Search stations */}
          {step === 'mnr-search' && (
            <div className="new-card-search">
              <input className="new-card-search-input" type="text" placeholder="Search for a Metro-North station…" value={mnrSearch} onChange={(e) => searchMnrStations(e.target.value)} autoFocus />
              <div className="new-card-lines" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {mnrSearchResults.map((s) => (
                  <button key={s.id} className="new-card-line-btn" onClick={() => selectMnrStation(s)}>
                    <span className="new-card-line-name">{s.name}</span>
                  </button>
                ))}
                {mnrSearch.length >= 2 && mnrSearchResults.length === 0 && <div className="settings-stop-empty">No stations found</div>}
                {mnrSearch.length < 2 && <div className="settings-stop-empty">Type at least 2 characters to search</div>}
              </div>
            </div>
          )}

          {/* MTA Bus: Search routes */}
          {step === 'mtabus-route' && (
            <div className="new-card-search">
              <input className="new-card-search-input" type="text" placeholder="Search for a bus route (e.g. M1, B63, Q32)…" value={mtaBusSearch} onChange={(e) => searchMtaBusRoutes(e.target.value)} autoFocus />
              <div className="new-card-lines" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {mtaBusRoutes.map((r) => (
                  <button key={r.id} className="new-card-line-btn" onClick={() => selectMtaBusRoute(r)}>
                    <span className="new-card-line-name">{r.name}</span>
                    <span className="new-card-line-count">{r.desc?.slice(0, 40)}</span>
                  </button>
                ))}
                {mtaBusSearch.length >= 1 && mtaBusRoutes.length === 0 && <div className="settings-stop-empty">No routes found</div>}
                {mtaBusSearch.length < 1 && <div className="settings-stop-empty">Type a route number to search</div>}
              </div>
            </div>
          )}

          {/* MTA Bus: Select stop */}
          {step === 'mtabus-stop' && (
            <div className="new-card-stop-picker">
              {mtaBusStops.length > 0 ? (
                <select className="new-card-stop-select" defaultValue="" onChange={(e) => {
                  if (e.target.value) {
                    const stop = mtaBusStops.find(s => s.id === e.target.value)
                    if (stop) selectMtaBusStop(stop)
                  }
                }}>
                  <option value="" disabled>Select a stop ({mtaBusStops.length} available)…</option>
                  {mtaBusStops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : <div className="settings-stop-empty">Loading stops…</div>}
            </div>
          )}

          {/* NYC Ferry: Search stops */}
          {step === 'nycferry-search' && (
            <div className="new-card-search">
              <input className="new-card-search-input" type="text" placeholder="Search for a NYC Ferry stop (e.g. Wall St, Astoria, Rockaway)…" value={nycFerrySearch} onChange={(e) => searchNycFerryStops(e.target.value)} autoFocus />
              <div className="new-card-lines" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {nycFerryResults.map((s) => (
                  <button key={s.id} className="new-card-line-btn" onClick={() => selectNycFerryStop(s)}>
                    <span className="new-card-line-name">{s.name}</span>
                  </button>
                ))}
                {nycFerrySearch.length >= 2 && nycFerryResults.length === 0 && <div className="settings-stop-empty">No stops found</div>}
                {nycFerrySearch.length < 2 && <div className="settings-stop-empty">Type at least 2 characters to search</div>}
              </div>
            </div>
          )}

          {/* Other modes: Line selection (future) */}
          {step === 1 && (
            <div className="new-card-lines">
              {lines.map((line) => {
                const avail = line.stops.filter(s => !excludeIds.has(s.id)).length
                return (
                  <button key={line.id} className="new-card-line-btn" onClick={() => setSelectedLine(line)}>
                    <span className="new-card-line-name">{line.name}</span>
                    <span className="new-card-line-count">{avail + ' stop' + (avail !== 1 ? 's' : '')}</span>
                  </button>
                )
              })}
            </div>
          )}

          {step === 'subway-search' && (
            <div className="new-card-search">
              <input className="new-card-search-input" type="text" placeholder="Search for a subway station…" value={subwaySearch} onChange={(e) => searchSubwayStations(e.target.value)} autoFocus />
              <div className="new-card-lines" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {subwayResults.map((s) => (
                  <button key={s.id} className="new-card-line-btn" onClick={() => selectSubwayStation(s)}>
                    <span className="new-card-line-name">{s.name}</span>
                  </button>
                ))}
                {subwaySearch.length >= 2 && subwayResults.length === 0 && <div className="settings-stop-empty">No stations found</div>}
                {subwaySearch.length < 2 && <div className="settings-stop-empty">Type at least 2 characters to search</div>}
              </div>
            </div>
          )}

          {step === 'subway-dir' && selectedStation && (
            <div className="subway-dir-picker">
              {stationLines.length > 0 ? (
                <>
                  <div className="subway-lines-label">Lines at this station</div>
                  <div className="subway-lines-row">
                    {stationLines.map((line) => (
                      <button key={line} className={`subway-line-toggle ${selectedSubwayLines.has(line) ? 'active' : ''}`} onClick={() => toggleSubwayLine(line)}>
                        <SubwayBadge line={line} size={28} />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="settings-stop-empty" style={{ fontSize: '12px' }}>Loading lines… (station data building, please wait)</div>
              )}
              <div className="subway-lines-label" style={{ marginTop: '12px' }}>Direction</div>
              <div className="subway-dir-options">
                {[
                  { value: 'S', label: 'Downtown / Brooklyn' },
                  { value: 'N', label: 'Uptown / Bronx / Queens' },
                  { value: 'all', label: 'Both directions' },
                ].map((opt) => (
                  <label key={opt.value} className={`subway-dir-option ${selectedDirection === opt.value ? 'active' : ''}`}>
                    <input type="radio" name="subwayDir" value={opt.value} checked={selectedDirection === opt.value} onChange={() => setSelectedDirection(opt.value)} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              <button className="settings-save-btn" onClick={confirmSubway} style={{ marginTop: '12px' }} disabled={selectedSubwayLines.size === 0}>
                Add Card
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="new-card-stop-picker">
              {selectedLine?.stops?.length > 0 ? (
                <select className="new-card-stop-select" defaultValue="" onChange={(e) => { if (e.target.value) selectStop(e.target.value) }}>
                  <option value="" disabled>Select a stop…</option>
                  {selectedLine.stops.filter(s => !excludeIds.has(s.id)).map((stop) => (<option key={stop.id} value={stop.id}>{stop.name}</option>))}
                </select>
              ) : <div className="settings-stop-empty">All stops already added</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Preset Picker Modal ──
function PresetPickerModal({ open, onSelect }) {
  if (!open) return null
  return (
    <div className="settings-overlay preset-picker-overlay">
      <div className="preset-picker-modal">
        <div className="preset-picker-header">
          <span className="preset-picker-title">Where do you commute from?</span>
          <p className="preset-picker-subtitle">Pick a neighborhood to set up your dashboard. You can customize everything in Settings.</p>
        </div>
        <div className="preset-picker-grid">
          {PRESETS.map(preset => (
            <button
              key={preset.id}
              className="preset-picker-card"
              onClick={() => onSelect(preset)}
            >
              <span className="preset-picker-emoji">{preset.emoji}</span>
              <span className="preset-picker-label">{preset.label}</span>
              <span className="preset-picker-desc">{preset.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsPanel({ open, onClose, outboundCity, inboundCity, outboundStops, inboundStops, alertSettings, activeAlertSources, inlineAlertDuration, tickerSpeed, outboundWeather, inboundWeather, showTunnels, showWeather, selectedTunnels, onSave, onShowPresetPicker }) {
  const [gtfsStatus, setGtfsStatus] = useState(null)
  const [draftOutStops, setDraftOutStops] = useState(outboundStops)
  const [draftInStops, setDraftInStops] = useState(inboundStops)
  const [draftOutCity, setDraftOutCity] = useState(outboundCity)
  const [draftInCity, setDraftInCity] = useState(inboundCity)
  const [draftOutWeather, setDraftOutWeather] = useState(outboundWeather)
  const [draftInWeather, setDraftInWeather] = useState(inboundWeather)
  const [outZipInput, setOutZipInput] = useState('')
  const [inZipInput, setInZipInput] = useState('')
  const [zipLoading, setZipLoading] = useState(null)
  const [draftAlerts, setDraftAlerts] = useState(() =>
    alertSettings || Object.fromEntries([...activeAlertSources].map((id) => [id, true]))
  )
  const [draftInlineDuration, setDraftInlineDuration] = useState(inlineAlertDuration ?? 60)
  const [draftTickerSpeed, setDraftTickerSpeed] = useState(tickerSpeed ?? 60)
  const [draftShowTunnels, setDraftShowTunnels] = useState(showTunnels)
  const [draftShowWeather, setDraftShowWeather] = useState(showWeather)
  const [draftTunnels, setDraftTunnels] = useState([...selectedTunnels])
  const [newCardTarget, setNewCardTarget] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const dragRef = useRef(null) // { id, setter } for active drag

  // Reset drafts when panel opens
  useEffect(() => {
    if (open) {
      setDraftOutStops([...outboundStops])
      setDraftInStops([...inboundStops])
      setDraftOutCity(outboundCity)
      setDraftInCity(inboundCity)
      setDraftOutWeather(outboundWeather)
      setDraftInWeather(inboundWeather)
      setOutZipInput('')
      setInZipInput('')
      setZipLoading(null)
      setDraftAlerts({ ...alertSettings })
      setDraftInlineDuration(inlineAlertDuration ?? 60)
      setDraftTickerSpeed(tickerSpeed ?? 60)
      setDraftShowTunnels(showTunnels)
      setDraftShowWeather(showWeather)
      setDraftTunnels([...selectedTunnels])
      setConfirmReset(false)
      // Fetch GTFS cache status
      fetch('/api/bus/gtfs-status').then(r => r.json()).then(setGtfsStatus).catch(() => {})
    }
  }, [open])

  if (!open) return null

  const allSelected = new Set([...draftOutStops, ...draftInStops])

  function makeRemove(setter) {
    return (id) => setter((prev) => prev.filter((s) => s !== id))
  }

  function handleNewCardAdd(stopId) {
    if (newCardTarget === 'outbound' && draftOutStops.length < 6) {
      setDraftOutStops((prev) => [...prev, stopId])
    } else if (newCardTarget === 'inbound' && draftInStops.length < 6) {
      setDraftInStops((prev) => [...prev, stopId])
    }
  }

  function toggleAlert(id) {
    setDraftAlerts((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleTunnel(id) {
    setDraftTunnels((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  function renderStopList(stops, setter, minCount) {
    function onDragStart(id) {
      dragRef.current = { id, setter }
    }
    function onDragOver(e, overId) {
      e.preventDefault()
      if (!dragRef.current || dragRef.current.setter !== setter) return
      const { id } = dragRef.current
      if (id === overId) return
      setter((prev) => {
        const from = prev.indexOf(id)
        const to = prev.indexOf(overId)
        if (from < 0 || to < 0) return prev
        const next = [...prev]
        next.splice(from, 1)
        next.splice(to, 0, id)
        return next
      })
    }
    function onDragEnd() {
      dragRef.current = null
    }
    return (
      <div className="settings-stop-list">
        {stops.map((id) => {
          const catalogStop = ALL_STOPS.find((s) => s.id === id)
          const stopType = catalogStop?.type || 'bus'
          const stopLine = catalogStop?.line || ''
          const stopName = catalogStop?.name || dynamicStopNames[id] || id
          return (
            <div
              key={id}
              className="settings-stop-item selected"
              draggable
              onDragStart={() => onDragStart(id)}
              onDragOver={(e) => onDragOver(e, id)}
              onDragEnd={onDragEnd}
            >
              <GripVertical className="settings-grip" />
              <span className={`settings-type-badge ${stopType}`}>{stopLine}</span>
              <span className="settings-stop-name">{stopName}</span>
              <div className="settings-stop-actions">
                <button onClick={() => makeRemove(setter)(id)} className="settings-remove-btn" disabled={stops.length <= minCount}>
                  <Minus size={12} />
                </button>
              </div>
            </div>
          )
        })}
        {stops.length === 0 && <div className="settings-stop-empty">None selected</div>}
      </div>
    )
  }

  return (
    <>
      <div className="settings-overlay" onClick={onClose}>
        <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
          <div className="settings-header">
            <h2 className="settings-title">Settings</h2>
            <button className="settings-close" onClick={onClose}>
              <X className="settings-close-icon" />
            </button>
          </div>

          <div className="settings-body">
            {/* Display Settings — at top for quick access */}
            <section className="settings-section">
              <h3 className="settings-section-title">Display</h3>
              <div className="settings-display-grid">
                <div className="settings-display-row">
                  <span className="settings-display-label">Inline alert duration</span>
                  <select className="settings-city-select" value={draftInlineDuration} onChange={(e) => setDraftInlineDuration(Number(e.target.value))}>
                    <option value={0}>Ticker only</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={Infinity}>Always on</option>
                  </select>
                </div>
                <div className="settings-display-row">
                  <span className="settings-display-label">Ticker speed</span>
                  <div className="ticker-speed-slider-wrap">
                    <input
                      type="range"
                      className="ticker-speed-slider"
                      min={0}
                      max={2}
                      step={1}
                      value={draftTickerSpeed === 30 ? 0 : draftTickerSpeed === 100 ? 2 : 1}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setDraftTickerSpeed(v === 0 ? 30 : v === 2 ? 100 : 60)
                      }}
                    />
                    <span className="ticker-speed-label">
                      {draftTickerSpeed === 30 ? 'Slow' : draftTickerSpeed === 100 ? 'Fast' : 'Regular'}
                    </span>
                  </div>
                </div>
                <div className="settings-display-row">
                  <span className="settings-display-label">Show tunnel card</span>
                  <button className={`settings-alert-toggle ${draftShowTunnels ? 'on' : 'off'}`} onClick={() => setDraftShowTunnels(v => !v)} style={{ minWidth: 'auto' }}>
                    {draftShowTunnels ? 'On' : 'Off'}
                  </button>
                </div>
                <div className="settings-display-row">
                  <span className="settings-display-label">Show weather card</span>
                  <button className={`settings-alert-toggle ${draftShowWeather ? 'on' : 'off'}`} onClick={() => setDraftShowWeather(v => !v)} style={{ minWidth: 'auto' }}>
                    {draftShowWeather ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            </section>

            {/* Transit Cards */}
            <section className="settings-section">
              <h3 className="settings-section-title">Transit Cards</h3>
              <div className="settings-columns">
                <div className="settings-col">
                  <div className="settings-col-header">
                    <div className="settings-col-label">Outbound from</div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-blue)' }}>{draftOutCity}</span>
                    <input type="text" className="settings-city-select" style={{ width: '60px' }} placeholder="Zip" value={outZipInput} onChange={(e) => setOutZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))} />
                    <button className="settings-move-btn" disabled={outZipInput.length !== 5 || zipLoading === 'out'} style={{ fontSize: '10px', width: 'auto', padding: '0 6px' }} onClick={async () => {
                      setZipLoading('out')
                      try {
                        const res = await fetch(`/api/weather/resolve-zip?zip=${outZipInput}`)
                        if (res.ok) {
                          const data = await res.json()
                          setDraftOutCity(data.label)
                          setDraftOutWeather({ label: data.label, url: data.url })
                          setOutZipInput('')
                        }
                      } catch {} finally { setZipLoading(null) }
                    }}>{zipLoading === 'out' ? '…' : 'Set'}</button>
                    <span className="settings-section-hint">{draftOutStops.length}/6</span>
                  </div>
                  {renderStopList(draftOutStops, setDraftOutStops, 3)}
                  {draftOutStops.length < 6 && (
                    <button className="new-card-btn" onClick={() => setNewCardTarget('outbound')}>
                      <Plus size={14} /> New transit card
                    </button>
                  )}
                </div>
                <div className="settings-col">
                  <div className="settings-col-header">
                    <div className="settings-col-label">Inbound from</div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-blue)' }}>{draftInCity}</span>
                    <input type="text" className="settings-city-select" style={{ width: '60px' }} placeholder="Zip" value={inZipInput} onChange={(e) => setInZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))} />
                    <button className="settings-move-btn" disabled={inZipInput.length !== 5 || zipLoading === 'in'} style={{ fontSize: '10px', width: 'auto', padding: '0 6px' }} onClick={async () => {
                      setZipLoading('in')
                      try {
                        const res = await fetch(`/api/weather/resolve-zip?zip=${inZipInput}`)
                        if (res.ok) {
                          const data = await res.json()
                          setDraftInCity(data.label)
                          setDraftInWeather({ label: data.label, url: data.url })
                          setInZipInput('')
                        }
                      } catch {} finally { setZipLoading(null) }
                    }}>{zipLoading === 'in' ? '…' : 'Set'}</button>
                    <span className="settings-section-hint">{draftInStops.length}/6</span>
                  </div>
                  {renderStopList(draftInStops, setDraftInStops, 3)}
                  {draftInStops.length < 6 && (
                    <button className="new-card-btn" onClick={() => setNewCardTarget('inbound')}>
                      <Plus size={14} /> New transit card
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Alerts — auto-generated from active transit cards */}
            <section className="settings-section">
              <h3 className="settings-section-title">Alerts</h3>
              <div className="settings-alert-grid">
                {[...activeAlertSources].map((srcId) => (
                  <button
                    key={srcId}
                    className={`settings-alert-toggle ${draftAlerts[srcId] !== false ? 'on' : 'off'}`}
                    onClick={() => toggleAlert(srcId)}
                  >
                    {draftAlerts[srcId] !== false ? <Bell size={12} /> : <BellOff size={12} />}
                    <span>{ALERT_SOURCE_NAMES[srcId] || srcId}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Tunnels */}
            <section className="settings-section">
              <h3 className="settings-section-title">
                Tunnels & Bridges
                <span className="settings-section-hint">{draftTunnels.length}/2 max</span>
              </h3>
              <div className="settings-tunnel-grid">
                {AVAILABLE_TUNNELS.map((t) => {
                  const isSelected = draftTunnels.includes(t.id)
                  const isDisabled = !isSelected && draftTunnels.length >= 2
                  return (
                    <button
                      key={t.id}
                      className={`settings-tunnel-btn ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                      onClick={() => toggleTunnel(t.id)}
                      disabled={isDisabled}
                    >
                      <Car size={14} />
                      <span>{t.name}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>

          <div className="settings-footer">
            {gtfsStatus && (
              <div className={`settings-gtfs-status ${gtfsStatus.stale ? 'stale' : ''}`}>
                <span>NJT Bus data:</span>
                <span>{gtfsStatus.ageDays != null ? `${gtfsStatus.ageDays}d old` : 'unknown'}</span>
                {gtfsStatus.stale && <span className="settings-gtfs-stale">⚠️ stale</span>}
              </div>
            )}
            <button className="settings-save-btn" onClick={() => {
            onSave({
              outboundStops: draftOutStops,
              inboundStops: draftInStops,
              outboundCity: draftOutCity,
              inboundCity: draftInCity,
              alertSettings: draftAlerts,
              inlineAlertDuration: draftInlineDuration,
              tickerSpeed: draftTickerSpeed,
              outboundWeather: draftOutWeather,
              inboundWeather: draftInWeather,
              showTunnels: draftShowTunnels,
              showWeather: draftShowWeather,
              selectedTunnels: draftTunnels,
            })
            onClose()
          }}>
              Save Changes
            </button>
            <div className="settings-reset-row">
              {confirmReset ? (
                <>
                  <span className="settings-reset-confirm-text">Reset to defaults?</span>
                  <button className="settings-reset-confirm-btn" onClick={() => {
                    localStorage.removeItem(STORAGE_KEY)
                    localStorage.removeItem(STOP_NAMES_KEY)
                    onClose()
                    onShowPresetPicker()
                  }}>Yes, reset</button>
                  <button className="settings-reset-cancel-btn" onClick={() => setConfirmReset(false)}>Cancel</button>
                </>
              ) : (
                <button className="settings-reset-btn" onClick={() => setConfirmReset(true)}>
                  Reset to defaults
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <NewTransitCardDialog
        open={!!newCardTarget}
        onClose={() => setNewCardTarget(null)}
        onAdd={handleNewCardAdd}
        excludeIds={allSelected}
      />
    </>
  )
}

// ── App ──

const STORAGE_KEY = 'hoboken-commuter-settings'

// Fallback HBLR stop IDs used in DEFAULT_SETTINGS.
// The app fetches /api/bus/hblr-defaults on load and migrates these to the current GTFS IDs.
const HBLR_DEFAULTS_FALLBACK = { outbound: '15534', inbound: '15537' }

// ── Neighborhood presets ──
// Each preset defines outbound/inbound stop IDs and the display names to cache.
// stopNames entries are written to dynamicStopNames so the settings panel shows
// friendly labels immediately without waiting for an API response.
const PRESETS = [
  {
    id: 'hoboken',
    label: 'Hoboken',
    emoji: '🚂',
    description: 'Bus, PATH, Ferry & HBLR from Hoboken',
    outboundCity: 'Hoboken',
    inboundCity: 'NYC',
    outboundWeather: { label: 'Hoboken', url: '/api/nws/gridpoints/OKX/32,43/forecast/hourly' },
    inboundWeather:  { label: 'NYC',     url: '/api/nws/gridpoints/OKX/34,44/forecast/hourly' },
    outboundStops: ['clinton', 'willow', 'washington', 'path_hob33', 'ferry_hob14', `hblr:${HBLR_DEFAULTS_FALLBACK.outbound}`],
    inboundStops:  ['pabt_willow', 'pabt_washington', 'pabt_119', 'path_33hob', 'ferry_w39', `hblr:${HBLR_DEFAULTS_FALLBACK.inbound}`],
    stopNames: {}, // preconfigured stops already in dynamicStopNames
  },
  {
    id: 'newport',
    label: 'Newport / JC',
    emoji: '🌊',
    description: 'Bus 119, PATH, HBLR & Ferry from Jersey City',
    outboundCity: 'Jersey City',
    inboundCity: 'NYC',
    outboundWeather: { label: 'Jersey City', url: '/api/nws/gridpoints/OKX/33,43/forecast/hourly' },
    inboundWeather:  { label: 'NYC',         url: '/api/nws/gridpoints/OKX/34,44/forecast/hourly' },
    outboundStops: [
      'bus:15888:119',          // JFK Blvd & Bayview Ave — Bus 119
      'path:861,1024:1:newport', // Newport PATH → 33rd St
      'path:861,1024:1:grove_street', // Grove St PATH → 33rd St
      'hblr:15497',             // Newport Light Rail Station
      'ferry:17:23:Brookfield Place', // Paulus Hook → Brookfield Place
    ],
    inboundStops: [
      'bus:15888:119',
      'path:861,1024:0:newport',
      'path:861,1024:0:grove_street',
      'hblr:15497',
      'ferry:17:23:Brookfield Place',
    ],
    stopNames: {
      'bus:15888:119':                   'JFK Blvd / Bayview (119)',
      'path:861,1024:1:newport':         'Newport · JSQ-33 To 33rd St',
      'path:861,1024:0:newport':         'Newport · JSQ-33 To Journal Sq',
      'path:861,1024:1:grove_street':    'Grove St · JSQ-33 To 33rd St',
      'path:861,1024:0:grove_street':    'Grove St · JSQ-33 To Hoboken',
      'hblr:15497':                      'Newport',
      'ferry:17:23:Brookfield Place':    'Paulus Hook → Brookfield Pl',
    },
  },
  {
    id: 'midtown',
    label: 'Midtown Manhattan',
    emoji: '🗽',
    description: 'Times Sq, Grand Central, Penn Station & more',
    outboundCity: 'NYC',
    inboundCity: 'Hoboken',
    outboundWeather: { label: 'NYC',     url: '/api/nws/gridpoints/OKX/34,44/forecast/hourly' },
    inboundWeather:  { label: 'Hoboken', url: '/api/nws/gridpoints/OKX/32,43/forecast/hourly' },
    outboundStops: [
      'mta:127,725,902,R16:S:1,2,3,7,7X,GS,N,Q,R,W', // Times Sq-42 St
      'mta:631,723,901:S:4,5,6,6X,7,7X,GS',           // Grand Central-42 St
      'mta:120,A28:S:1,2,3,A,C,E,N,Q,R,W',            // 34 St-Penn Station
      'mta:D17,R17:S:B,D,F,FX,M,N,Q,R,W',             // 34 St-Herald Sq
      'mta:D15:S:B,D,F,FX,M',                          // 47-50 Sts-Rockefeller Ctr
      'nycferry:17',                                    // NYC Ferry E 34th St
    ],
    inboundStops: [
      'mta:127,725,902,R16:N:1,2,3,7,7X,GS,N,Q,R,W',
      'mta:631,723,901:N:4,5,6,6X,7,7X,GS',
      'mta:120,A28:N:1,2,3,A,C,E,N,Q,R,W',
      'mta:D17,R17:N:B,D,F,FX,M,N,Q,R,W',
      'mta:D15:N:B,D,F,FX,M',
      'nycferry:17',
    ],
    stopNames: {
      'mta:127,725,902,R16:S:1,2,3,7,7X,GS,N,Q,R,W': 'Times Sq-42 St (Downtown)',
      'mta:631,723,901:S:4,5,6,6X,7,7X,GS':           'Grand Central-42 St (Downtown)',
      'mta:120,A28:S:1,2,3,A,C,E,N,Q,R,W':            '34 St-Penn Station (Downtown)',
      'mta:D17,R17:S:B,D,F,FX,M,N,Q,R,W':             '34 St-Herald Sq (Downtown)',
      'mta:D15:S:B,D,F,FX,M':                          '47-50 Sts-Rockefeller Ctr (Downtown)',
      'mta:127,725,902,R16:N:1,2,3,7,7X,GS,N,Q,R,W': 'Times Sq-42 St (Uptown)',
      'mta:631,723,901:N:4,5,6,6X,7,7X,GS':           'Grand Central-42 St (Uptown)',
      'mta:120,A28:N:1,2,3,A,C,E,N,Q,R,W':            '34 St-Penn Station (Uptown)',
      'mta:D17,R17:N:B,D,F,FX,M,N,Q,R,W':             '34 St-Herald Sq (Uptown)',
      'mta:D15:N:B,D,F,FX,M':                          '47-50 Sts-Rockefeller Ctr (Uptown)',
      'nycferry:17':                                    'East 34th St Ferry',
    },
  },
  {
    id: 'downtown',
    label: 'Downtown Manhattan',
    emoji: '🏙️',
    description: 'Fulton St, Wall St, Chambers St & more',
    outboundCity: 'NYC',
    inboundCity: 'Hoboken',
    outboundWeather: { label: 'NYC',     url: '/api/nws/gridpoints/OKX/34,44/forecast/hourly' },
    inboundWeather:  { label: 'Hoboken', url: '/api/nws/gridpoints/OKX/32,43/forecast/hourly' },
    outboundStops: [
      'mta:229,418,A38,G36,M22:S:2,3,4,5,A,C,G,J,Z', // Fulton St
      'mta:230,419:S:2,3,4,5',                         // Wall St
      'mta:137,A36,M21:S:1,2,3,A,C,J,Z',              // Chambers St
      'mta:640:S:4,5,6,6X',                            // Brooklyn Bridge-City Hall
      'mta:420:S:4,5',                                  // Bowling Green
      'nycferry:87',                                    // NYC Ferry Wall St/Pier 11
    ],
    inboundStops: [
      'mta:229,418,A38,G36,M22:N:2,3,4,5,A,C,G,J,Z',
      'mta:230,419:N:2,3,4,5',
      'mta:137,A36,M21:N:1,2,3,A,C,J,Z',
      'mta:640:N:4,5,6,6X',
      'mta:420:N:4,5',
      'nycferry:87',
    ],
    stopNames: {
      'mta:229,418,A38,G36,M22:S:2,3,4,5,A,C,G,J,Z': 'Fulton St (Downtown)',
      'mta:230,419:S:2,3,4,5':                         'Wall St (Downtown)',
      'mta:137,A36,M21:S:1,2,3,A,C,J,Z':              'Chambers St (Downtown)',
      'mta:640:S:4,5,6,6X':                            'Brooklyn Bridge-City Hall (Downtown)',
      'mta:420:S:4,5':                                  'Bowling Green (Downtown)',
      'mta:229,418,A38,G36,M22:N:2,3,4,5,A,C,G,J,Z': 'Fulton St (Uptown)',
      'mta:230,419:N:2,3,4,5':                         'Wall St (Uptown)',
      'mta:137,A36,M21:N:1,2,3,A,C,J,Z':              'Chambers St (Uptown)',
      'mta:640:N:4,5,6,6X':                            'Brooklyn Bridge-City Hall (Uptown)',
      'mta:420:N:4,5':                                  'Bowling Green (Uptown)',
      'nycferry:87':                                    'Wall St/Pier 11 Ferry',
    },
  },
  {
    id: 'brooklyn',
    label: 'Brooklyn',
    emoji: '🌉',
    description: 'Atlantic Av, Jay St, Borough Hall & more',
    outboundCity: 'Brooklyn',
    inboundCity: 'Manhattan',
    outboundWeather: { label: 'Brooklyn', url: '/api/nws/gridpoints/OKX/35,43/forecast/hourly' },
    inboundWeather:  { label: 'Manhattan', url: '/api/nws/gridpoints/OKX/34,44/forecast/hourly' },
    outboundStops: [
      'mta:235,D24,R31:S:2,3,4,5,B,D,N,Q,R,W', // Atlantic Av-Barclays Ctr
      'mta:A41,R29:S:A,C,F,FX,N,R,W',           // Jay St-MetroTech
      'mta:232,423:S:2,3,4,5',                   // Borough Hall
      'mta:L16,R30:S:B,D,N,Q,R,W',              // DeKalb Av
      'mta:A42:S:A,C,G',                         // Hoyt-Schermerhorn Sts
      'mta:236,F20:S:2,3,4,F,G',                // Bergen St
    ],
    inboundStops: [
      'mta:235,D24,R31:N:2,3,4,5,B,D,N,Q,R,W',
      'mta:A41,R29:N:A,C,F,FX,N,R,W',
      'mta:232,423:N:2,3,4,5',
      'mta:L16,R30:N:B,D,N,Q,R,W',
      'mta:A42:N:A,C,G',
      'mta:236,F20:N:2,3,4,F,G',
    ],
    stopNames: {
      'mta:235,D24,R31:S:2,3,4,5,B,D,N,Q,R,W': 'Atlantic Av-Barclays Ctr (Downtown)',
      'mta:A41,R29:S:A,C,F,FX,N,R,W':           'Jay St-MetroTech (Downtown)',
      'mta:232,423:S:2,3,4,5':                   'Borough Hall (Downtown)',
      'mta:L16,R30:S:B,D,N,Q,R,W':              'DeKalb Av (Downtown)',
      'mta:A42:S:A,C,G':                         'Hoyt-Schermerhorn Sts (Downtown)',
      'mta:236,F20:S:2,3,4,F,G':                'Bergen St (Downtown)',
      'mta:235,D24,R31:N:2,3,4,5,B,D,N,Q,R,W': 'Atlantic Av-Barclays Ctr (Uptown)',
      'mta:A41,R29:N:A,C,F,FX,N,R,W':           'Jay St-MetroTech (Uptown)',
      'mta:232,423:N:2,3,4,5':                   'Borough Hall (Uptown)',
      'mta:L16,R30:N:B,D,N,Q,R,W':              'DeKalb Av (Uptown)',
      'mta:A42:N:A,C,G':                         'Hoyt-Schermerhorn Sts (Uptown)',
      'mta:236,F20:N:2,3,4,F,G':                'Bergen St (Uptown)',
    },
  },
  {
    id: 'queens',
    label: 'Queens',
    emoji: '✈️',
    description: 'Jackson Hts, Flushing, Jamaica & more',
    outboundCity: 'Queens',
    inboundCity: 'Manhattan',
    outboundWeather: { label: 'Queens',    url: '/api/nws/gridpoints/OKX/36,44/forecast/hourly' },
    inboundWeather:  { label: 'Manhattan', url: '/api/nws/gridpoints/OKX/34,44/forecast/hourly' },
    outboundStops: [
      'mta:G14:S:E,F,FX,M,R',    // Jackson Hts-Roosevelt Av
      'mta:701:S:7,7X',           // Flushing-Main St
      'mta:F01:S:F,FX',           // Jamaica-179 St
      'mta:G08:S:E,F,FX,M,R',    // Forest Hills-71 Av
      'mta:G11,J15:S:E,F,J,M,R,Z', // Woodhaven Blvd
      'mta:G05:S:E,J,Z',          // Jamaica Center-Parsons/Archer
    ],
    inboundStops: [
      'mta:G14:N:E,F,FX,M,R',
      'mta:701:N:7,7X',
      'mta:F01:N:F,FX',
      'mta:G08:N:E,F,FX,M,R',
      'mta:G11,J15:N:E,F,J,M,R,Z',
      'mta:G05:N:E,J,Z',
    ],
    stopNames: {
      'mta:G14:S:E,F,FX,M,R':      'Jackson Hts-Roosevelt Av (Downtown)',
      'mta:701:S:7,7X':             'Flushing-Main St (Downtown)',
      'mta:F01:S:F,FX':             'Jamaica-179 St (Downtown)',
      'mta:G08:S:E,F,FX,M,R':      'Forest Hills-71 Av (Downtown)',
      'mta:G11,J15:S:E,F,J,M,R,Z': 'Woodhaven Blvd (Downtown)',
      'mta:G05:S:E,J,Z':            'Jamaica Center (Downtown)',
      'mta:G14:N:E,F,FX,M,R':      'Jackson Hts-Roosevelt Av (Uptown/Queens)',
      'mta:701:N:7,7X':             'Flushing-Main St (Uptown/Queens)',
      'mta:F01:N:F,FX':             'Jamaica-179 St (Uptown/Queens)',
      'mta:G08:N:E,F,FX,M,R':      'Forest Hills-71 Av (Uptown/Queens)',
      'mta:G11,J15:N:E,F,J,M,R,Z': 'Woodhaven Blvd (Uptown/Queens)',
      'mta:G05:N:E,J,Z':            'Jamaica Center (Uptown/Queens)',
    },
  },
]

// Apply a preset: write stop names to cache and save settings
function applyPreset(preset, hblrDefaults) {
  // Resolve HBLR fallback IDs to current GTFS IDs if we have them
  const resolveHblr = (stops) => stops.map(id => {
    if (id === `hblr:${HBLR_DEFAULTS_FALLBACK.outbound}` && hblrDefaults?.outbound) return `hblr:${hblrDefaults.outbound}`
    if (id === `hblr:${HBLR_DEFAULTS_FALLBACK.inbound}`  && hblrDefaults?.inbound)  return `hblr:${hblrDefaults.inbound}`
    return id
  })
  const outStops = resolveHblr(preset.outboundStops)
  const inStops  = resolveHblr(preset.inboundStops)

  // Cache all stop names so settings panel shows friendly labels
  for (const [id, name] of Object.entries(preset.stopNames)) {
    persistDynamicStopName(id, name)
  }
  // Also cache HBLR names if resolved
  if (hblrDefaults?.outbound && hblrDefaults?.outboundName) {
    persistDynamicStopName(`hblr:${hblrDefaults.outbound}`, shortenStopName(hblrDefaults.outboundName))
  }
  if (hblrDefaults?.inbound && hblrDefaults?.inboundName) {
    persistDynamicStopName(`hblr:${hblrDefaults.inbound}`, shortenStopName(hblrDefaults.inboundName))
  }

  const settings = {
    ...DEFAULT_SETTINGS,
    outboundCity:    preset.outboundCity,
    inboundCity:     preset.inboundCity,
    outboundWeather: preset.outboundWeather,
    inboundWeather:  preset.inboundWeather,
    outboundStops:   outStops,
    inboundStops:    inStops,
  }
  saveSettings(settings)
  return settings
}

const DEFAULT_SETTINGS = {
  outboundCity: 'Hoboken',
  inboundCity: 'NYC',
  outboundStops: ['clinton', 'willow', 'washington', 'path_hob33', 'ferry_hob14', `hblr:${HBLR_DEFAULTS_FALLBACK.outbound}`],
  inboundStops: ['pabt_willow', 'pabt_washington', 'pabt_119', 'path_33hob', 'ferry_w39', `hblr:${HBLR_DEFAULTS_FALLBACK.inbound}`],
  outboundWeather: { label: 'Hoboken', url: '/api/nws/gridpoints/OKX/32,43/forecast/hourly' },
  inboundWeather: { label: 'NYC', url: '/api/nws/gridpoints/OKX/34,44/forecast/hourly' },
  alertSettings: {},
  inlineAlertDuration: 60,
  tickerSpeed: 60,
  showTunnels: true,
  showWeather: true,
  selectedTunnels: ['lincoln', 'holland'],
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    // Fire GA4 event with card configuration
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'settings_saved', {
        outbound_cards: (settings.outboundStops || []).join(','),
        inbound_cards: (settings.inboundStops || []).join(','),
        outbound_city: settings.outboundCity,
        inbound_city: settings.inboundCity,
        card_count: (settings.outboundStops?.length || 0) + (settings.inboundStops?.length || 0),
      })
    }
  } catch {}
}

export default function App() {
  const [theme, setTheme] = useState(isDaytime() ? 'light' : 'dark')
  const [autoTheme, setAutoTheme] = useState(true)
  const [weatherLocation, setWeatherLocation] = useState('hoboken')
  const [outboundWeather, setOutboundWeather] = useState(() => loadSettings().outboundWeather)
  const [inboundWeather, setInboundWeather] = useState(() => loadSettings().inboundWeather)
  const [direction, setDirection] = useState('outbound')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [outboundCity, setOutboundCity] = useState(() => loadSettings().outboundCity)
  const [inboundCity, setInboundCity] = useState(() => loadSettings().inboundCity)
  const [outboundStops, setOutboundStops] = useState(() => loadSettings().outboundStops)
  const [inboundStops, setInboundStops] = useState(() => loadSettings().inboundStops)
  const [alertSettings, setAlertSettings] = useState(() => loadSettings().alertSettings)
  const [inlineAlertDuration, setInlineAlertDuration] = useState(() => loadSettings().inlineAlertDuration)
  const [tickerSpeed, setTickerSpeed] = useState(() => loadSettings().tickerSpeed)
  const [showTunnels, setShowTunnels] = useState(() => loadSettings().showTunnels)
  const [showWeather, setShowWeather] = useState(() => loadSettings().showWeather)
  const [selectedTunnels, setSelectedTunnels] = useState(() => loadSettings().selectedTunnels)
  const [refreshKey, setRefreshKey] = useState(0)

  // Show preset picker on first load (no saved settings) or after reset
  const [presetPickerOpen, setPresetPickerOpen] = useState(() => !localStorage.getItem(STORAGE_KEY))
  // Cache HBLR defaults from server so applyPreset can resolve them
  const [hblrDefaults, setHblrDefaults] = useState(null)

  // On first load, fetch HBLR default stop IDs from the server (resolved from current GTFS data).
  // This keeps the default dashboard in sync with GTFS updates without any code changes.
  useEffect(() => {
    fetch('/api/bus/hblr-defaults')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        setHblrDefaults(data)
        const { outbound: obId, inbound: ibId, outboundName, inboundName } = data

        // Update stop name cache with GTFS-resolved names
        if (outboundName) persistDynamicStopName(`hblr:${obId}`, shortenStopName(outboundName))
        if (inboundName)  persistDynamicStopName(`hblr:${ibId}`,  shortenStopName(inboundName))

        // If the user has the old default HBLR IDs, migrate them to the current GTFS IDs.
        // We only do this for stops that look like the defaults (hblr:XXXXX pattern) —
        // user-added custom HBLR stops are left alone.
        const oldObId = HBLR_DEFAULTS_FALLBACK.outbound
        const oldIbId = HBLR_DEFAULTS_FALLBACK.inbound

        setOutboundStops(prev => {
          const updated = prev.map(id => id === `hblr:${oldObId}` ? `hblr:${obId}` : id)
          if (updated.some((id, i) => id !== prev[i])) {
            const s = loadSettings()
            saveSettings({ ...s, outboundStops: updated })
            return updated
          }
          return prev
        })
        setInboundStops(prev => {
          const updated = prev.map(id => id === `hblr:${oldIbId}` ? `hblr:${ibId}` : id)
          if (updated.some((id, i) => id !== prev[i])) {
            const s = loadSettings()
            saveSettings({ ...s, inboundStops: updated })
            return updated
          }
          return prev
        })
      })
      .catch(() => {}) // non-fatal — fallback IDs remain in use
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePresetSelect(preset) {
    const settings = applyPreset(preset, hblrDefaults)
    setOutboundCity(settings.outboundCity)
    setInboundCity(settings.inboundCity)
    setOutboundWeather(settings.outboundWeather)
    setInboundWeather(settings.inboundWeather)
    setOutboundStops(settings.outboundStops)
    setInboundStops(settings.inboundStops)
    setAlertSettings(settings.alertSettings)
    setPresetPickerOpen(false)
  }

  const dirLabel = direction === 'outbound' ? `${outboundCity} → ${inboundCity}` : `${inboundCity} → ${outboundCity}`

  // Live data — all direction-aware
  const tunnelFetcher = useCallback(() => fetchTunnels(direction, selectedTunnels), [direction, selectedTunnels])
  const { data: tunnelData, error: tunnelError } = usePolling(tunnelFetcher, 120_000, refreshKey)
  const tunnels = tunnelData || TUNNEL_FALLBACK

  // Weather auto-matches direction: outbound shows outbound city weather, inbound shows inbound city weather
  const activeWeatherLocation = direction === 'outbound' ? outboundWeather : inboundWeather
  const weatherFetcher = useCallback(() => fetchWeather(activeWeatherLocation), [activeWeatherLocation])
  const { data: weatherData, error: weatherError } = usePolling(weatherFetcher, 600_000, refreshKey)
  const weather = weatherData || WEATHER_FALLBACK

  const busFetcher = useCallback(() => fetchBusArrivals(direction), [direction])
  const { data: busData, error: busError } = usePolling(busFetcher, 30_000, refreshKey)
  const defaultBusFallback = direction === 'inbound' ? BUS_FALLBACK_INBOUND : BUS_FALLBACK
  const busStops = busData || defaultBusFallback
  const busStopOrder = busStops._stopOrder || defaultBusFallback._stopOrder

  const ferryFetcher = useCallback(() => fetchFerry(direction), [direction])
  const { data: ferryData, error: ferryError } = usePolling(ferryFetcher, 30_000, refreshKey)
  const ferry = ferryData || FERRY_FALLBACK

  const pathFetcher = useCallback(() => fetchPath(direction), [direction])
  const { data: pathData, error: pathError } = usePolling(pathFetcher, 15_000, refreshKey)
  const path = pathData || PATH_FALLBACK

  // Collect all MTA lines from dashboard cards for alert polling
  const allMtaLines = [...outboundStops, ...inboundStops]
    .filter(id => id.startsWith('mta:'))
    .flatMap(id => { const lines = id.split(':')[3]; return lines ? lines.split(',') : [] })
  const mtaLinesParam = [...new Set(allMtaLines)].sort().join(',')

  const mtaAlertFetcher = useCallback(async () => {
    if (!mtaLinesParam) return []
    const res = await fetch(`/api/mta/alerts?lines=${mtaLinesParam}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.alerts || []
  }, [mtaLinesParam])
  const { data: mtaAlertData } = usePolling(mtaAlertFetcher, 120_000, refreshKey)
  const mtaAlerts = mtaAlertData || []

  // Collect NJT Rail station codes for alert polling
  const allRailStations = [...outboundStops, ...inboundStops]
    .filter(id => id.startsWith('rail:'))
    .map(id => id.split(':')[1])
  const firstRailStation = allRailStations[0] || ''

  const railAlertFetcher = useCallback(async () => {
    if (!firstRailStation) return []
    const res = await fetch(`/api/rail/query?station=${firstRailStation}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.alerts || []).map(text => ({ text }))
  }, [firstRailStation])
  const { data: railAlertData } = usePolling(railAlertFetcher, 120_000, refreshKey)
  const railAlerts = railAlertData || []

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!autoTheme) return
    const id = setInterval(() => {
      setTheme(isDaytime() ? 'light' : 'dark')
    }, 60_000)
    return () => clearInterval(id)
  }, [autoTheme])

  function handleThemeToggle() {
    setAutoTheme(false)
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  function handleDirectionToggle() {
    setDirection((d) => (d === 'outbound' ? 'inbound' : 'outbound'))
  }

  // Derive which alert sources are relevant based on all dashboard cards (both directions)
  const activeAlertSources = deriveActiveAlertSources([...outboundStops, ...inboundStops])

  const tickerItems = buildTickerItems(tunnels, ferry, path, busStops, mtaAlerts, railAlerts, alertSettings, activeAlertSources)

  // Pull-to-refresh
  const pullRef = useRef({ startY: 0, pulling: false })
  const [pullProgress, setPullProgress] = useState(0) // 0–1
  const PULL_THRESHOLD = 80 // px to trigger refresh

  function onTouchStart(e) {
    if (window.scrollY === 0) {
      pullRef.current = { startY: e.touches[0].clientY, pulling: true }
    }
  }
  function onTouchMove(e) {
    if (!pullRef.current.pulling) return
    const dy = e.touches[0].clientY - pullRef.current.startY
    if (dy > 0) setPullProgress(Math.min(dy / PULL_THRESHOLD, 1))
  }
  function onTouchEnd() {
    if (pullRef.current.pulling && pullProgress >= 1) {
      setRefreshKey(k => k + 1)
      if (window.gtag) window.gtag('event', 'pull_to_refresh')
    }
    pullRef.current.pulling = false
    setPullProgress(0)
  }

  return (
    <>
    <div
      className={`dashboard${presetPickerOpen || settingsOpen ? ' dashboard-blurred' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullProgress > 0 && (
        <div className="pull-indicator" style={{ opacity: pullProgress, transform: `scaleX(${pullProgress})` }} />
      )}
      {/* Connectivity alert */}
      <ConnectivityBanner errors={[tunnelError, weatherError, busError, ferryError, pathError]} />

      {/* Header */}
      <div className="header">
        <div className="header-left">
          <div className="status-dot" />
          <div>
            <button className="direction-toggle" onClick={handleDirectionToggle} title="Switch direction">
              <span className="header-title">{dirLabel}</span>
              <ArrowLeftRight className="direction-toggle-icon" />
            </button>
            <div className="header-subtitle">Commuter Dashboard</div>
          </div>
        </div>
        <div className="header-right">
          <CurrentTime />
          <ThemeToggle theme={theme} onToggle={handleThemeToggle} />
          <button className="settings-btn" onClick={() => setSettingsOpen(true)} title="Settings">
            <Settings className="settings-btn-icon" />
          </button>
        </div>
      </div>

      {/* Row 1: Tunnels + Weather (conditionally shown) */}
      {(showTunnels || showWeather) && (
        <div className="top-row" style={{ gridTemplateColumns: showTunnels && showWeather ? '1fr 1fr' : '1fr' }}>
          {showTunnels && <TunnelCard data={tunnels} alertSettings={alertSettings} activeAlertSources={activeAlertSources} inlineAlertDuration={inlineAlertDuration} />}
          {showWeather && <WeatherCard weatherData={weather} location={activeWeatherLocation.label || activeWeatherLocation} />}
        </div>
      )}

      {/* Row 2: News ticker */}
      <NewsTicker items={tickerItems} speed={tickerSpeed} />

      {/* Transit cards — rendered in settings order */}
      {(direction === 'outbound' ? outboundStops : inboundStops).map((stopId) => {
        // Preconfigured ferry (legacy IDs)
        if (stopId === 'ferry_hob14' || stopId === 'ferry_w39') {
          return <FerryCard key={stopId} data={ferry} displayName={dynamicStopNames[stopId]} alertSettings={alertSettings} activeAlertSources={activeAlertSources} inlineAlertDuration={inlineAlertDuration} />
        }
        // Dynamic ferry (ferry:STOP:ROUTE:DEST)
        if (stopId.startsWith('ferry:')) {
          const catalogStop = ALL_STOPS.find(s => s.id === stopId)
          return <DynamicFerryCard key={stopId} stopId={stopId} displayName={catalogStop?.name || dynamicStopNames[stopId]} alertSettings={alertSettings} activeAlertSources={activeAlertSources} inlineAlertDuration={inlineAlertDuration} />
        }
        // Preconfigured PATH (legacy IDs)
        if (stopId === 'path_hob33' || stopId === 'path_33hob' || stopId === 'path_33newport' || stopId === 'path_hobwtc' || stopId === 'path_wtchob') {
          return <PathCard key={stopId} data={path} displayName={dynamicStopNames[stopId]} alertSettings={alertSettings} activeAlertSources={activeAlertSources} inlineAlertDuration={inlineAlertDuration} />
        }
        // Dynamic PATH (path:ROUTE:DIR:STOP)
        if (stopId.startsWith('path:')) {
          return <DynamicPathCard key={stopId} stopId={stopId} displayName={dynamicStopNames[stopId]} alertSettings={alertSettings} activeAlertSources={activeAlertSources} inlineAlertDuration={inlineAlertDuration} />
        }
        // MTA (mta:ROUTE:STOP)
        if (stopId.startsWith('mta:')) {
          const catalogStop = ALL_STOPS.find(s => s.id === stopId)
          return <DynamicMtaCard key={stopId} stopId={stopId} displayName={catalogStop?.name || dynamicStopNames[stopId]} alertSettings={alertSettings} activeAlertSources={activeAlertSources} inlineAlertDuration={inlineAlertDuration} />
        }
        // New-format dynamic bus card (bus:STOP_ID:ROUTES)
        if (stopId.startsWith('bus:')) {
          return <DynamicBusCard key={stopId} stopId={stopId} displayName={dynamicStopNames[stopId]} />
        }
        // NJT Rail (rail:STATION:LINES)
        if (stopId.startsWith('rail:')) {
          return <DynamicRailCard key={stopId} stopId={stopId} displayName={dynamicStopNames[stopId]} alertSettings={alertSettings} activeAlertSources={activeAlertSources} inlineAlertDuration={inlineAlertDuration} />
        }
        // HBLR (hblr:STOP_ID)
        if (stopId.startsWith('hblr:')) {
          return <DynamicHblrCard key={stopId} stopId={stopId} displayName={dynamicStopNames[stopId]} alertSettings={alertSettings} activeAlertSources={activeAlertSources} inlineAlertDuration={inlineAlertDuration} />
        }
        // LIRR (lirr:STOP_ID)
        if (stopId.startsWith('lirr:')) {
          return <DynamicLirrCard key={stopId} stopId={stopId} displayName={dynamicStopNames[stopId]} inlineAlertDuration={inlineAlertDuration} />
        }
        // Metro-North (mnr:STOP_ID)
        if (stopId.startsWith('mnr:')) {
          return <DynamicMnrCard key={stopId} stopId={stopId} displayName={dynamicStopNames[stopId]} inlineAlertDuration={inlineAlertDuration} />
        }
        // MTA Bus (mtabus:STOP_ID:ROUTE)
        if (stopId.startsWith('mtabus:')) {
          return <DynamicMtaBusCard key={stopId} stopId={stopId} displayName={dynamicStopNames[stopId]} alertSettings={alertSettings} activeAlertSources={activeAlertSources} inlineAlertDuration={inlineAlertDuration} />
        }
        // NYC Ferry (nycferry:STOP_ID)
        if (stopId.startsWith('nycferry:')) {
          return <DynamicNycFerryCard key={stopId} stopId={stopId} displayName={dynamicStopNames[stopId]} inlineAlertDuration={inlineAlertDuration} />
        }
        // Preconfigured bus stop
        const busStop = busStops[stopId]
        if (busStop) {
          return <BusStopCard key={stopId} stop={busStop} />
        }
        // Dynamic bus stop
        const catalogStop = ALL_STOPS.find(s => s.id === stopId)
        return <DynamicBusCard key={stopId} stopId={stopId} displayName={catalogStop?.name || dynamicStopNames[stopId]} />
      })}

      {/* Footer */}
      <footer className="dashboard-footer">
        <span>We ❤️ public transit</span>
        <span className="footer-sep">·</span>
        <span>Like this dashboard? <a href="https://venmo.com/u/IanStroz" target="_blank" rel="noopener noreferrer">Buy me a coffee ☕</a></span>
      </footer>

    </div>

    <SettingsPanel
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      outboundCity={outboundCity}
      inboundCity={inboundCity}
      outboundStops={outboundStops}
      inboundStops={inboundStops}
      alertSettings={alertSettings}
      activeAlertSources={activeAlertSources}
      inlineAlertDuration={inlineAlertDuration}
      tickerSpeed={tickerSpeed}
      outboundWeather={outboundWeather}
      inboundWeather={inboundWeather}
      showTunnels={showTunnels}
      showWeather={showWeather}
      selectedTunnels={selectedTunnels}
      onShowPresetPicker={() => setPresetPickerOpen(true)}
      onSave={({ outboundStops: os, inboundStops: is, outboundCity: oc, inboundCity: ic, alertSettings: as, inlineAlertDuration: iad, tickerSpeed: ts, outboundWeather: ow, inboundWeather: iw, showTunnels: st, showWeather: sw, selectedTunnels: stun }) => {
        setOutboundStops(os)
        setInboundStops(is)
        if (oc) setOutboundCity(oc)
        if (ic) setInboundCity(ic)
        if (as) setAlertSettings(as)
        if (iad !== undefined) setInlineAlertDuration(iad)
        if (ts !== undefined) setTickerSpeed(ts)
        if (ow) setOutboundWeather(ow)
        if (iw) setInboundWeather(iw)
        if (st !== undefined) setShowTunnels(st)
        if (sw !== undefined) setShowWeather(sw)
        if (stun) setSelectedTunnels(stun)
        saveSettings({
          outboundStops: os,
          inboundStops: is,
          outboundCity: oc,
          inboundCity: ic,
          alertSettings: as,
          inlineAlertDuration: iad,
          tickerSpeed: ts,
          outboundWeather: ow,
          inboundWeather: iw,
          showTunnels: st,
          showWeather: sw,
          selectedTunnels: stun,
        })
      }}
    />

    <PresetPickerModal
      open={presetPickerOpen}
      onSelect={handlePresetSelect}
    />
    </>
  )
}
