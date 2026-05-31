import { useState, useEffect, useCallback } from 'react'
import { SubwayBadge, MtaGlobeIcon, NjtBusIcon, NjtRailIcon, PathIcon, LightRailIcon, HeavyRailIcon } from '../../components/icons'

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

function shortenStopName(name) {
  if (!name) return name
  let s = name
    .replace(/\bST\b(?!\w)/gi, '')
    .replace(/\bAVE?\b/gi, '')
    .replace(/\bBLVD\b/gi, '')
    .replace(/\bPL\b/gi, '')
    .replace(/\bRD\b/gi, '')
    .replace(/\bDR\b/gi, '')
    .replace(/\bAT\b/gi, '/')
    .replace(/\bAND\b/gi, '/')
    .replace(/&/g, '/')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  s = s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  s = s.replace(/(\d+)(St|Nd|Rd|Th)\b/gi, (_, n, suf) => n + suf.toLowerCase())
  return s
}

// ── Polling hook ──
function usePolling(fetchFn, intervalMs) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const poll = useCallback(async () => {
    try {
      const result = await fetchFn()
      setData(result)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [fetchFn])

  useEffect(() => {
    setData(null) // eslint-disable-line react-hooks/set-state-in-effect
    poll()
    const id = setInterval(poll, intervalMs)
    return () => clearInterval(id)
  }, [poll, intervalMs])

  return { data, error, refetch: poll }
}

// ── Generic transit card shell ──
function CardShell({ icon, station, badges, alert, children }) {
  return (
    <div className="ms-card">
      <div className="ms-card-head">
        <span className="ms-icon">{icon}</span>
        {badges}
        <span className="ms-station">{station}</span>
        {alert && <span className="ms-alert">⚠️</span>}
      </div>
      {children}
    </div>
  )
}

function DepartureRow({ dest, eta, etaClock, badgeColor, source }) {
  return (
    <div className="ms-row">
      {badgeColor && <span className="ms-dot" style={{ background: badgeColor }} />}
      <span className="ms-dest">{dest}</span>
      <span className={`ms-eta ${etaClass(eta)}`}>{eta} min</span>
      <span className="ms-clock">{etaClock || etaTime(eta)}</span>
      {source && (
        <span className={`ms-src ${source === 'schedule' ? 'ms-sched' : ''}`}>
          {source === 'realtime' ? 'LIVE' : 'SCHED'}
        </span>
      )}
    </div>
  )
}

// ── MTA Subway Card ──
export function MtaSubwayCard({ stopId, displayName }) {
  const fetcher = useCallback(async () => {
    const parts = stopId.split(':')
    if (parts.length < 3) return null
    const [, stationIds, dir, lines] = parts
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
  const lines = stopId.split(':')[3]?.split(',') || []

  return (
    <CardShell
      icon={<MtaGlobeIcon size={16} />}
      station={stationName}
      alert={alerts.length > 0}
      badges={
        <>
          {lines.slice(0, 4).map(l => (
            <SubwayBadge key={l} line={l} size={22} />
          ))}
        </>
      }
    >
      {departures.length > 0 ? (
        departures.slice(0, 4).map((d, i) => (
          <DepartureRow key={i} dest={d.dest} eta={d.eta} etaClock={d.etaTime} />
        ))
      ) : (
        <div className="ms-empty">No upcoming trains</div>
      )}
    </CardShell>
  )
}

// ── NJT Bus Card ──
export function BusCard({ stopId, displayName }) {
  const fetcher = useCallback(async () => {
    // Formats: bus:STOP_ID:ROUTES or legacy preconfigured IDs
    if (stopId.startsWith('bus:')) {
      const parts = stopId.split(':')
      const gtfsStop = parts[1]
      const routes = parts[2] || ''
      let url = `/api/bus/stops?ids=${gtfsStop}`
      if (routes) url += `&routes=${routes}`
      const res = await fetch(url)
      if (!res.ok) return null
      return await res.json()
    }
    // Legacy preconfigured stops
    const res = await fetch(`/api/bus/stops?ids=${stopId}`)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)

  const buses = data?.buses || []
  const name = displayName || shortenStopName(data?.name || data?.stop) || stopId
  const routes = [...new Set(buses.map(b => b.route))].slice(0, 3)

  return (
    <CardShell
      icon={<NjtBusIcon size={16} />}
      station={name}
      badges={
        <>
          {routes.map(r => (
            <span key={r} className="ms-badge ms-badge-bus" style={{ background: '#1e40af' }}>{r}</span>
          ))}
        </>
      }
    >
      {buses.length > 0 ? (
        buses.slice(0, 4).map((b, i) => (
          <DepartureRow
            key={i}
            dest={`${b.route} · ${b.headsign || b.variant || '—'}`}
            eta={b.eta}
            etaClock={b.etaTime || etaTime(b.eta)}
            badgeColor="#1e40af"
            source={b.source}
          />
        ))
      ) : (
        <div className="ms-empty">No upcoming buses</div>
      )}
    </CardShell>
  )
}

// ── PATH Card ──
export function PathCard({ stopId, displayName }) {
  const fetcher = useCallback(async () => {
    const parts = stopId.split(':')
    if (parts.length < 4) return null
    const [, route, direction, stop] = parts
    const res = await fetch(`/api/path/query?route=${route}&direction=${direction}&stop=${stop}`)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 15_000)

  const departures = data?.departures || []
  const name = displayName || data?.stationName || stopId

  return (
    <CardShell
      icon={<PathIcon size={16} />}
      station={name}
      alert={!!data?.alert}
      badges={<span className="ms-badge ms-badge-rail" style={{ background: '#0369a1' }}>PATH</span>}
    >
      {departures.length > 0 ? (
        departures.slice(0, 4).map((d, i) => (
          <DepartureRow key={i} dest={d.dest} eta={d.eta} etaClock={d.etaTime} />
        ))
      ) : (
        <div className="ms-empty">No upcoming trains</div>
      )}
    </CardShell>
  )
}

// ── Ferry Card ──
export function FerryCard({ stopId, displayName }) {
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

  const departures = data?.departures || []
  const name = displayName || data?.terminalName || stopId

  return (
    <CardShell
      icon="⛴️"
      station={name}
      alert={!!data?.alert}
      badges={null}
    >
      {departures.length > 0 ? (
        departures.slice(0, 4).map((d, i) => (
          <DepartureRow key={i} dest={`→ ${d.dest}`} eta={d.eta} etaClock={d.etaTime} />
        ))
      ) : (
        <div className="ms-empty">No upcoming ferries</div>
      )}
    </CardShell>
  )
}

// ── NJT Rail Card ──
export function RailCard({ stopId, displayName }) {
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
  const { data } = usePolling(fetcher, 60_000)

  const departures = data?.departures || []
  const name = displayName || data?.stationName || stopId
  const lineNames = [...new Set(departures.map(d => d.lineName))].slice(0, 2)

  return (
    <CardShell
      icon={<NjtRailIcon size={16} />}
      station={name}
      badges={
        <>
          {lineNames.map(l => (
            <span key={l} className="ms-badge ms-badge-rail" style={{ background: '#00953B' }}>{l}</span>
          ))}
        </>
      }
    >
      {departures.length > 0 ? (
        departures.slice(0, 4).map((d, i) => (
          <DepartureRow
            key={i}
            dest={`${d.lineName} → ${d.dest}`}
            eta={d.eta}
            etaClock={d.etaTime}
            badgeColor={d.lineColor}
          />
        ))
      ) : (
        <div className="ms-empty">No upcoming trains</div>
      )}
    </CardShell>
  )
}

// ── HBLR Card ──
export function HblrCard({ stopId, displayName }) {
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

  return (
    <CardShell
      icon={<LightRailIcon size={16} />}
      station={name}
      badges={<span className="ms-badge ms-badge-rail" style={{ background: '#6B3FA0' }}>HBLR</span>}
    >
      {buses.length > 0 ? (
        buses.slice(0, 4).map((b, i) => (
          <DepartureRow
            key={i}
            dest={b.headsign || b.variant || '—'}
            eta={b.eta}
            etaClock={b.etaTime || etaTime(b.eta)}
            source={b.source}
          />
        ))
      ) : (
        <div className="ms-empty">No upcoming trains</div>
      )}
    </CardShell>
  )
}

// ── Card router — picks the right card component based on stop ID prefix ──
export default function TransitCard({ stopId, displayName }) {
  if (stopId.startsWith('mta:')) return <MtaSubwayCard stopId={stopId} displayName={displayName} />
  if (stopId.startsWith('bus:') || /^\d/.test(stopId)) return <BusCard stopId={stopId} displayName={displayName} />
  if (stopId.startsWith('path:')) return <PathCard stopId={stopId} displayName={displayName} />
  if (stopId.startsWith('ferry:')) return <FerryCard stopId={stopId} displayName={displayName} />
  if (stopId.startsWith('rail:')) return <RailCard stopId={stopId} displayName={displayName} />
  if (stopId.startsWith('hblr:')) return <HblrCard stopId={stopId} displayName={displayName} />
  // Fallback for legacy preconfigured stops (clinton, willow, washington, etc.)
  return <BusCard stopId={stopId} displayName={displayName} />
}
