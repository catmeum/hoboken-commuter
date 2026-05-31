import { useState, useEffect, useCallback } from 'react'
import { SubwayBadge, MtaGlobeIcon, NjtBusIcon, NjtRailIcon, PathIcon, LightRailIcon, HeavyRailIcon, GrandCentralClock } from '../../components/icons'

// ── Helpers ──
function etaClass(min) {
  if (min <= 5) return 'soon'
  if (min <= 15) return 'moderate'
  return 'later'
}

// NJT Bus route color palette — consistent colors by route number
const NJT_ROUTE_COLORS = {
  '119': '#0e7c47', '125': '#6b21a8', '126': '#1e40af',
  '22': '#b45309', '64': '#0f766e', '68': '#7c2d12',
  '85': '#4338ca', '87': '#be123c', '89': '#7c3aed',
}
const NJT_COLOR_PALETTE = ['#1e40af', '#7c3aed', '#0e7c47', '#b45309', '#be123c', '#0f766e', '#4338ca', '#6b21a8', '#7c2d12', '#0369a1']

function njtRouteColor(route) {
  if (NJT_ROUTE_COLORS[route]) return NJT_ROUTE_COLORS[route]
  // Consistent hash-based color for unknown routes
  let hash = 0
  for (let i = 0; i < route.length; i++) hash = route.charCodeAt(i) + ((hash << 5) - hash)
  return NJT_COLOR_PALETTE[Math.abs(hash) % NJT_COLOR_PALETTE.length]
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

// ── Expandable badge row — shows max 3, tap to expand all ──
function ExpandableBadges({ children, maxVisible = 3 }) {
  const [expanded, setExpanded] = useState(false)
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : []

  if (items.length <= maxVisible) return <>{items}</>

  const visible = expanded ? items : items.slice(0, maxVisible)
  const remaining = items.length - maxVisible

  return (
    <>
      {visible}
      {!expanded && (
        <span className="ms-badge-more" onClick={(e) => { e.stopPropagation(); setExpanded(true) }}>
          +{remaining}
        </span>
      )}
      {expanded && (
        <span className="ms-badge-more" onClick={(e) => { e.stopPropagation(); setExpanded(false) }}>
          ▾
        </span>
      )}
    </>
  )
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
        <ExpandableBadges maxVisible={2}>
          {lines.map(l => (
            <SubwayBadge key={l} line={l} size={22} />
          ))}
        </ExpandableBadges>
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
  const [showGateInfo, setShowGateInfo] = useState(false)
  const fetcher = useCallback(async () => {
    // Formats: bus:STOP_IDS:ROUTES:HEADSIGN or bus:STOP_IDS:ROUTES or legacy
    if (stopId.startsWith('bus:')) {
      const parts = stopId.split(':')
      const gtfsStop = parts[1]
      const routes = parts[2] || ''
      const headsigns = parts[3] || ''
      let url = `/api/bus/stops?ids=${gtfsStop}`
      if (routes) url += `&routes=${routes}`
      if (headsigns) url += `&headsigns=${encodeURIComponent(headsigns)}`
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
  const gate = data?.gate
  const gateSchedule = data?.gateSchedule

  return (
    <CardShell
      icon={<NjtBusIcon size={16} />}
      station={name}
      badges={
        <>
          {routes.map(r => (
            <span key={r} className="ms-badge ms-badge-bus" style={{ background: njtRouteColor(r) }}>{r}</span>
          ))}
          {gate && (
            <button className="ms-gate-badge" onClick={(e) => { e.stopPropagation(); setShowGateInfo(v => !v) }}>
              Gate {gate}
            </button>
          )}
        </>
      }
    >
      {showGateInfo && gateSchedule && (
        <div className="ms-gate-info">
          <div className="ms-gate-row"><span>6 AM – 10 PM</span><span className="ms-gate-num">Gate {gateSchedule.day}</span></div>
          <div className="ms-gate-row"><span>10 PM – 1 AM</span><span className="ms-gate-num">Gate {gateSchedule.late}</span></div>
          <div className="ms-gate-row"><span>1 AM – 6 AM</span><span className="ms-gate-num">Gate {gateSchedule.overnight}</span></div>
        </div>
      )}
      {buses.length > 0 ? (
        buses.slice(0, 4).map((b, i) => {
          // Clean up headsign: remove route number prefix, shorten common words
          let dest = b.headsign || b.variant || '—'
          dest = dest.replace(/^\d+[A-Z]?\s+/, '') // remove "126 " or "126T " prefix
          dest = dest.replace(/VIA\s+/gi, '→ ').replace(/\s+/g, ' ').trim()
          if (dest.length > 28) dest = dest.slice(0, 26) + '…'
          return (
            <DepartureRow
              key={i}
              dest={`${b.route} · ${dest}`}
              eta={b.eta}
              etaClock={b.etaTime || etaTime(b.eta)}
              badgeColor={njtRouteColor(b.route)}
              source={b.source}
            />
          )
        })
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
        departures.slice(0, 4).map((d, i) => {
          // Shorten: "Hoboken 14th Street → Midtown/W39th" → "Midtown/W39th"
          let dest = d.dest || ''
          if (dest.includes('→')) dest = dest.split('→').pop().trim()
          return <DepartureRow key={i} dest={`→ ${dest}`} eta={d.eta} etaClock={d.etaTime} />
        })
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
  const lineNames = [...new Set(departures.map(d => d.lineName))]
  const lineColors = {}
  departures.forEach(d => { if (d.lineName && d.lineColor) lineColors[d.lineName] = d.lineColor })

  return (
    <CardShell
      icon={<NjtRailIcon size={16} />}
      station={name}
      badges={
        <ExpandableBadges maxVisible={2}>
          {lineNames.map(l => (
            <span key={l} className="ms-badge ms-badge-rail" style={{ background: lineColors[l] || '#00953B', fontSize: 'clamp(7px, 1.8vw, 9px)' }}>{l}</span>
          ))}
        </ExpandableBadges>
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
    const res = await fetch(`/api/bus/stops?ids=${gtfsStop}&routes=HBLR,NLR`)
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

// ── LIRR Card ──
export function LirrCard({ stopId, displayName }) {
  const fetcher = useCallback(async () => {
    const id = stopId.split(':')[1]
    const routes = stopId.split(':')[2] || ''
    let url = `/api/lirr/query?stop=${id}`
    if (routes) url += `&routes=${routes}`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)

  const departures = data?.departures || []
  const name = displayName || data?.stationName || stopId
  const lineNames = [...new Set(departures.map(d => d.dest?.split(' ')[0]).filter(Boolean))]
  const lineColors = {}
  departures.forEach(d => { if (d.dest && d.lineColor) lineColors[d.dest.split(' ')[0]] = d.lineColor })

  return (
    <CardShell
      icon={<HeavyRailIcon size={16} />}
      station={name}
      badges={
        <ExpandableBadges maxVisible={2}>
          {lineNames.map(l => (
            <span key={l} className="ms-badge ms-badge-rail" style={{ background: lineColors[l] || '#0039A6', fontSize: 'clamp(6px, 1.6vw, 8px)' }}>{l}</span>
          ))}
        </ExpandableBadges>
      }
    >
      {departures.length > 0 ? (
        departures.slice(0, 4).map((d, i) => (
          <DepartureRow key={i} dest={d.dest} eta={d.eta} etaClock={d.etaTime} badgeColor={d.lineColor} />
        ))
      ) : (
        <div className="ms-empty">No upcoming trains</div>
      )}
    </CardShell>
  )
}

// ── Metro-North Card ──
export function MnrCard({ stopId, displayName }) {
  const fetcher = useCallback(async () => {
    const id = stopId.split(':')[1]
    const routes = stopId.split(':')[2] || ''
    let url = `/api/mnr/query?stop=${id}`
    if (routes) url += `&routes=${routes}`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)

  const departures = data?.departures || []
  const name = displayName || data?.stationName || stopId
  const lineNames = [...new Set(departures.map(d => d.dest).filter(Boolean))]
  const lineColors = {}
  departures.forEach(d => { if (d.dest && d.lineColor) lineColors[d.dest] = d.lineColor })

  return (
    <CardShell
      icon={<GrandCentralClock size={16} />}
      station={name}
      badges={
        <ExpandableBadges maxVisible={2}>
          {lineNames.map(l => (
            <span key={l} className="ms-badge ms-badge-rail" style={{ background: lineColors[l] || '#0039A6', fontSize: 'clamp(6px, 1.6vw, 8px)' }}>{l.slice(0, 5)}</span>
          ))}
        </ExpandableBadges>
      }
    >
      {departures.length > 0 ? (
        departures.slice(0, 4).map((d, i) => (
          <DepartureRow key={i} dest={d.dest} eta={d.eta} etaClock={d.etaTime} badgeColor={d.lineColor} />
        ))
      ) : (
        <div className="ms-empty">No upcoming trains</div>
      )}
    </CardShell>
  )
}

// ── NYC Ferry Card ──
export function NycFerryCard({ stopId, displayName }) {
  const fetcher = useCallback(async () => {
    const id = stopId.split(':')[1]
    const res = await fetch(`/api/nycferry/query?stop=${id}`)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)

  const departures = data?.departures || []
  const name = displayName || data?.stationName || stopId

  return (
    <CardShell
      icon="⛴️"
      station={name}
      badges={<span className="ms-badge ms-badge-rail" style={{ background: '#1D8BC9' }}>NYC</span>}
    >
      {departures.length > 0 ? (
        departures.slice(0, 4).map((d, i) => {
          let dest = d.dest || ''
          if (dest.includes('→')) dest = dest.split('→').pop().trim()
          return <DepartureRow key={i} dest={`→ ${dest}`} eta={d.eta} etaClock={d.etaTime} />
        })
      ) : (
        <div className="ms-empty">No upcoming ferries</div>
      )}
    </CardShell>
  )
}

// ── MTA Bus Card ──
export function MtaBusCard({ stopId, displayName }) {
  const fetcher = useCallback(async () => {
    const parts = stopId.split(':')
    const [, stop, route] = parts
    let url = `/api/mtabus/query?stop=${stop}`
    if (route) url += `&route=${route}`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)

  const departures = data?.departures || []
  const name = displayName || data?.stopName || stopId

  return (
    <CardShell
      icon={<NjtBusIcon size={16} />}
      station={name}
      badges={<span className="ms-badge ms-badge-bus" style={{ background: '#0039A6' }}>MTA</span>}
    >
      {departures.length > 0 ? (
        departures.slice(0, 4).map((d, i) => (
          <DepartureRow key={i} dest={d.dest || d.route} eta={d.eta} etaClock={d.etaTime} source={d.source} />
        ))
      ) : (
        <div className="ms-empty">No upcoming buses</div>
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
  if (stopId.startsWith('lirr:')) return <LirrCard stopId={stopId} displayName={displayName} />
  if (stopId.startsWith('mnr:')) return <MnrCard stopId={stopId} displayName={displayName} />
  if (stopId.startsWith('nycferry:')) return <NycFerryCard stopId={stopId} displayName={displayName} />
  if (stopId.startsWith('mtabus:')) return <MtaBusCard stopId={stopId} displayName={displayName} />
  // Fallback for legacy preconfigured stops (clinton, willow, washington, etc.)
  return <BusCard stopId={stopId} displayName={displayName} />
}
