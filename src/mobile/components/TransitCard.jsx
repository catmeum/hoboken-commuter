import { useState, useEffect, useCallback, useRef } from 'react'
import { SubwayBadge, MtaGlobeIcon, NjtBusIcon, NjtRailIcon, PathIcon, LightRailIcon, HeavyRailIcon, GrandCentralClock } from '../../components/icons'
import { ferryDestColor } from '../../components/transitColors'
import { AlertTriangle } from 'lucide-react'

// â”€â”€ Helpers â”€â”€
function etaClass(min) {
  if (min <= 5) return 'soon'
  if (min <= 15) return 'moderate'
  return 'later'
}

// NJT Bus route color palette â€” consistent colors by route number
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
    .replace(/\bPORT AUTHORITY BUS TERMINAL\b/gi, 'PABT')
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
  // Preserve PABT as uppercase
  s = s.replace(/\bPabt\b/g, 'PABT')
  return s
}

// â”€â”€ Polling hook â”€â”€
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

// â”€â”€ Expandable badge row â€” shows max 3, tap to expand all â”€â”€
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
          â–¾
        </span>
      )}
    </>
  )
}

// â”€â”€ Generic transit card shell â”€â”€
// alert prop: 'active' = fresh undismissed, 'dismissed' = greyed out, falsy = no icon
function CardShell({ icon, station, badges, alert, onAlertTap, stopId, loading, children }) {
  return (
    <div className="ms-card">
      <div className="ms-card-head">
        <span className="ms-icon">{icon}</span>
        {badges}
        <span className="ms-station">{station}</span>
        {alert === 'active' && <button className="ms-alert ms-alert-active" onClick={() => onAlertTap && onAlertTap(stopId)}><AlertTriangle size={14} /></button>}
        {alert === 'dismissed' && <span className="ms-alert ms-alert-dismissed"><AlertTriangle size={14} /></span>}
      </div>
      {loading ? <SkeletonRows count={3} /> : children}
    </div>
  )
}

function capacityLabel(cap) {
  if (cap === 'empty') return 'Seats'
  if (cap === 'some') return 'Standing'
  if (cap === 'full') return 'Full'
  return null
}

// â”€â”€ Loading skeleton rows for transit cards â”€â”€
function SkeletonRows({ count = 3 }) {
  return (
    <div className="ms-skeleton-rows">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ms-skeleton-row">
          <span className="ms-skeleton-dest" />
          <span className="ms-skeleton-eta" />
        </div>
      ))}
    </div>
  )
}

function DepartureRow({ dest, eta, etaClock, badgeColor, source, capacity }) {
  const [expanded, setExpanded] = useState(false)
  const timerRef = useRef(null)

  const handleTap = useCallback(() => {
    if (expanded) {
      // Second tap collapses immediately
      setExpanded(false)
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    } else {
      setExpanded(true)
      timerRef.current = setTimeout(() => { setExpanded(false); timerRef.current = null }, 10_000)
    }
  }, [expanded])

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const capText = capacityLabel(capacity)

  return (
    <div className={`ms-row${expanded ? ' ms-row-expanded' : ''}`} onClick={handleTap}>
      {badgeColor && <span className="ms-dot" style={{ background: badgeColor }} />}
      <span className="ms-dest">{dest}</span>
      <span className={`ms-eta ${etaClass(eta)}`}>{eta} min</span>
      <span className="ms-clock">{etaClock || etaTime(eta)}</span>
      {capText ? (
        <span className={`ms-src ms-cap-${capacity}`}>{capText}</span>
      ) : source === 'schedule' ? (
        <span className="ms-src ms-sched">SCHED</span>
      ) : null}
    </div>
  )
}

// â”€â”€ MTA Subway Card â”€â”€
export function MtaSubwayCard({ stopId, displayName, hiddenBadges, alertState, onAlertTap }) {
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
  const stationName = displayName || data?.stationName || stopId
  const lines = stopId.split(':')[3]?.split(',') || []
  const visibleLines = hiddenBadges?.includes('__all__') ? [] : lines

  return (
    <CardShell
      loading={!data}
      icon={<MtaGlobeIcon size={16} />}
      station={stationName}
      alert={alertState}
      onAlertTap={onAlertTap}
      stopId={stopId}
      badges={
        <ExpandableBadges maxVisible={2}>
          {visibleLines.map(l => (
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

// â”€â”€ NJT Bus Card â”€â”€
export function BusCard({ stopId, displayName, hiddenBadges, alertState, onAlertTap }) {
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
  const rawName = displayName || shortenStopName(data?.name || data?.stop) || stopId
  const name = rawName.replace(/\bPORT AUTHORITY BUS TERMINAL\b/gi, 'PABT').replace(/\bPort Authority Bus Terminal\b/g, 'PABT')
  const routes = [...new Set(buses.map(b => b.route))].slice(0, 3)
  const visibleRoutes = hiddenBadges?.includes('__all__') ? [] : routes
  const gate = data?.gate
  const gateSchedule = data?.gateSchedule

  return (
    <CardShell
      loading={!data}
      icon={<NjtBusIcon size={16} />}
      station={name}
      alert={alertState}
      onAlertTap={onAlertTap}
      stopId={stopId}
      badges={
        <>
          {visibleRoutes.map(r => (
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
          <div className="ms-gate-row"><span>6 AM â€“ 10 PM</span><span className="ms-gate-num">Gate {gateSchedule.day}</span></div>
          <div className="ms-gate-row"><span>10 PM â€“ 1 AM</span><span className="ms-gate-num">Gate {gateSchedule.late}</span></div>
          <div className="ms-gate-row"><span>1 AM â€“ 6 AM</span><span className="ms-gate-num">Gate {gateSchedule.overnight}</span></div>
        </div>
      )}
      {buses.length > 0 ? (
        buses.slice(0, 4).map((b, i) => {
          // Clean up headsign: remove route number prefix, shorten common words
          let dest = b.headsign || b.variant || 'â€”'
          dest = dest.replace(/^\d+[A-Z]?\s+/, '') // remove "126 " or "126T " prefix
          dest = dest.replace(/VIA\s+/gi, 'â†’ ').replace(/\s+/g, ' ').trim()
          if (dest.length > 28) dest = dest.slice(0, 26) + 'â€¦'
          return (
            <DepartureRow
              key={i}
              dest={`${b.route} Â· ${dest}`}
              eta={b.eta}
              etaClock={b.etaTime || etaTime(b.eta)}
              badgeColor={njtRouteColor(b.route)}
              source={b.source}
              capacity={b.capacity}
            />
          )
        })
      ) : (
        <div className="ms-empty">No upcoming buses</div>
      )}
    </CardShell>
  )
}

// â”€â”€ PATH Card â”€â”€
export function PathCard({ stopId, displayName, hiddenBadges, alertState, onAlertTap }) {
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
      loading={!data}
      icon={<PathIcon size={16} />}
      station={name}
      alert={alertState}
      onAlertTap={onAlertTap}
      stopId={stopId}
      badges={!hiddenBadges?.includes('__all__') ? <span className="ms-badge ms-badge-rail" style={{ background: '#0369a1' }}>PATH</span> : null}
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

// â”€â”€ Ferry Card â”€â”€
export function FerryCard({ stopId, displayName, hiddenBadges, alertState, onAlertTap }) {
  const fetcher = useCallback(async () => {
    const colonIdx = stopId.indexOf(':')
    const afterPrefix = stopId.slice(colonIdx + 1) // e.g. "9:all" or "9:18:Midtown,12:Brookfield"
    const tagEnd = afterPrefix.indexOf(':')
    if (tagEnd < 0) return null
    const stopTag = afterPrefix.slice(0, tagEnd)
    const routePart = afterPrefix.slice(tagEnd + 1) // "all" or "18:Midtown" or "18:Midtown,12:Brookfield"

    let url = `/api/ferry/query?stop=${stopTag}`
    if (routePart === 'all') {
      // No filter â€” fetch all routes
    } else if (routePart.includes(',')) {
      // Multi-route: pass as routes param
      url += `&routes=${encodeURIComponent(routePart)}`
    } else {
      // Single route: legacy format ROUTE_NO:DEST or just ROUTE_NO
      const singleColonIdx = routePart.indexOf(':')
      if (singleColonIdx > 0) {
        url += `&route=${routePart.slice(0, singleColonIdx)}&dest=${encodeURIComponent(routePart.slice(singleColonIdx + 1))}`
      } else {
        url += `&route=${routePart}`
      }
    }
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  }, [stopId])
  const { data } = usePolling(fetcher, 30_000)

  const departures = data?.departures || []
  const name = displayName || data?.platformName || stopId

  // Extract destination names from stop ID for badges
  const destBadges = (() => {
    const colonIdx = stopId.indexOf(':')
    const afterPrefix = stopId.slice(colonIdx + 1)
    const tagEnd = afterPrefix.indexOf(':')
    if (tagEnd < 0) return []
    const routePart = afterPrefix.slice(tagEnd + 1)
    if (routePart === 'all') return ['All routes']
    const pairs = routePart.includes(',') ? routePart.split(',') : [routePart]
    return [...new Set(pairs.map(p => {
      const ci = p.indexOf(':')
      return ci > 0 ? p.slice(ci + 1) : p
    }).filter(Boolean))]
  })()

  const showBadges = !hiddenBadges?.includes('__all__')

  return (
    <CardShell
      loading={!data}
      icon="â›´ï¸"
      station={name}
      alert={alertState}
      onAlertTap={onAlertTap}
      stopId={stopId}
      badges={showBadges && destBadges.length > 0 ? (
        <ExpandableBadges maxVisible={2}>
          {destBadges.map(d => (
            <span key={d} className="ms-badge ms-badge-rail" style={{ background: ferryDestColor(d), fontSize: 'clamp(6px, 1.6vw, 9px)' }}>{d}</span>
          ))}
        </ExpandableBadges>
      ) : null}
    >
      {departures.length > 0 ? (
        departures.slice(0, 4).map((d, i) => {
          // Extract short destination from "Terminal â†’ Dest"
          let dest = d.dest || ''
          if (dest.includes('â†’')) dest = dest.split('â†’').pop().trim()
          return <DepartureRow key={i} dest={dest} eta={d.eta} etaClock={d.etaTime} badgeColor={ferryDestColor(dest)} source={d.source} />
        })
      ) : (
        <div className="ms-empty">No upcoming ferries</div>
      )}
    </CardShell>
  )
}

// â”€â”€ NJT Rail Card â”€â”€
export function RailCard({ stopId, displayName, hiddenBadges, alertState, onAlertTap }) {
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
  const showBadges = !hiddenBadges?.includes('__all__')

  return (
    <CardShell
      loading={!data}
      icon={<NjtRailIcon size={16} />}
      station={name}
      alert={alertState}
      onAlertTap={onAlertTap}
      stopId={stopId}
      badges={showBadges ? (
        <ExpandableBadges maxVisible={2}>
          {lineNames.map(l => (
            <span key={l} className="ms-badge ms-badge-rail" style={{ background: lineColors[l] || '#00953B', fontSize: 'clamp(7px, 1.8vw, 9px)' }}>{l}</span>
          ))}
        </ExpandableBadges>
      ) : null}
    >
      {departures.length > 0 ? (
        departures.slice(0, 4).map((d, i) => (
          <DepartureRow
            key={i}
            dest={`${d.lineName} â†’ ${d.dest}`}
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

// â”€â”€ HBLR Card â”€â”€
export function HblrCard({ stopId, displayName, alertState, onAlertTap }) {
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
      loading={!data}
      icon={<LightRailIcon size={16} />}
      station={name}
      alert={alertState}
      onAlertTap={onAlertTap}
      stopId={stopId}
      badges={<span className="ms-badge ms-badge-rail" style={{ background: '#6B3FA0' }}>HBLR</span>}
    >
      {buses.length > 0 ? (
        buses.slice(0, 4).map((b, i) => (
          <DepartureRow
            key={i}
            dest={b.headsign || b.variant || 'â€”'}
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

// â”€â”€ LIRR Card â”€â”€
export function LirrCard({ stopId, displayName, hiddenBadges, alertState, onAlertTap }) {
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
  const showBadges = !hiddenBadges?.includes('__all__')

  return (
    <CardShell
      loading={!data}
      icon={<HeavyRailIcon size={16} />}
      station={name}
      alert={alertState}
      onAlertTap={onAlertTap}
      stopId={stopId}
      badges={showBadges ? (
        <ExpandableBadges maxVisible={2}>
          {lineNames.map(l => (
            <span key={l} className="ms-badge ms-badge-rail" style={{ background: lineColors[l] || '#0039A6', fontSize: 'clamp(6px, 1.6vw, 8px)' }}>{l}</span>
          ))}
        </ExpandableBadges>
      ) : null}
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

// â”€â”€ Metro-North Card â”€â”€
export function MnrCard({ stopId, displayName, hiddenBadges, alertState, onAlertTap }) {
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
  const showBadges = !hiddenBadges?.includes('__all__')

  return (
    <CardShell
      loading={!data}
      icon={<GrandCentralClock size={16} />}
      station={name}
      alert={alertState}
      onAlertTap={onAlertTap}
      stopId={stopId}
      badges={showBadges ? (
        <ExpandableBadges maxVisible={2}>
          {lineNames.map(l => (
            <span key={l} className="ms-badge ms-badge-rail" style={{ background: lineColors[l] || '#0039A6', fontSize: 'clamp(6px, 1.6vw, 8px)' }}>{l.slice(0, 5)}</span>
          ))}
        </ExpandableBadges>
      ) : null}
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

// â”€â”€ NYC Ferry Card â”€â”€
export function NycFerryCard({ stopId, displayName, alertState, onAlertTap }) {
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
      loading={!data}
      icon="â›´ï¸"
      station={name}
      alert={alertState}
      onAlertTap={onAlertTap}
      stopId={stopId}
      badges={<span className="ms-badge ms-badge-rail" style={{ background: '#1D8BC9' }}>NYC</span>}
    >
      {departures.length > 0 ? (
        departures.slice(0, 4).map((d, i) => {
          let dest = d.dest || ''
          if (dest.includes('â†’')) dest = dest.split('â†’').pop().trim()
          return <DepartureRow key={i} dest={`â†’ ${dest}`} eta={d.eta} etaClock={d.etaTime} />
        })
      ) : (
        <div className="ms-empty">No upcoming ferries</div>
      )}
    </CardShell>
  )
}

// â”€â”€ MTA Bus Card â”€â”€
export function MtaBusCard({ stopId, displayName, alertState, onAlertTap }) {
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
      loading={!data}
      icon={<NjtBusIcon size={16} />}
      station={name}
      alert={alertState}
      onAlertTap={onAlertTap}
      stopId={stopId}
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

// â”€â”€ Helper: extract bus route(s) from a bus stop ID â”€â”€
// Formats: bus:{stopIds}:{routes} or bus:{stopIds}:{routes}:{headsign}
function getBusRoutes(stopId) {
  if (!stopId.startsWith('bus:')) return []
  const parts = stopId.split(':')
  if (parts.length >= 3) return parts[2].split(',')
  return []
}

// â”€â”€ Helper: determine alert state for a card based on its stop ID â”€â”€
function getAlertState(stopId, alerts, dismissedAlerts) {
  if (!alerts && !dismissedAlerts) return null
  // Determine which alert source IDs match this stop
  const sourceMatchers = []
  if (stopId.startsWith('mta:')) sourceMatchers.push('mta')
  else if (stopId.startsWith('bus:') || /^\d/.test(stopId)) sourceMatchers.push('bus')
  else if (stopId.startsWith('path:')) sourceMatchers.push('path')
  else if (stopId.startsWith('ferry:')) sourceMatchers.push('ferry')
  else if (stopId.startsWith('rail:')) sourceMatchers.push('rail', 'njt')
  else if (stopId.startsWith('hblr:')) sourceMatchers.push('hblr')
  else if (stopId.startsWith('lirr:')) sourceMatchers.push('lirr')
  else if (stopId.startsWith('mnr:')) sourceMatchers.push('mnr')
  else if (stopId.startsWith('nycferry:')) sourceMatchers.push('nycferry')
  else if (stopId.startsWith('mtabus:')) sourceMatchers.push('mtabus', 'mta')

  // For bus stops, do route-level matching instead of just source matching
  const busRoutes = getBusRoutes(stopId)

  const matchesSource = (alert) => {
    const sourceMatch = sourceMatchers.some(s => alert.id?.includes(s) || alert.source?.toLowerCase().includes(s))
    if (!sourceMatch) return false
    // For bus alerts, additionally verify route overlap
    if (busRoutes.length > 0 && alert.routes) {
      return alert.routes.some(r => busRoutes.includes(r))
    }
    return true
  }

  // Check if there's an active (undismissed) alert for this source
  const hasActive = (alerts || []).some(matchesSource)
  if (hasActive) return 'active'

  // Check if there's a dismissed alert for this source
  const hasDismissed = (dismissedAlerts || []).some(matchesSource)
  if (hasDismissed) return 'dismissed'

  return null // no alert at all
}

// â”€â”€ Card router â€” picks the right card component based on stop ID prefix â”€â”€
export default function TransitCard({ stopId, displayName, hiddenBadges, alerts, dismissedAlerts, onAlertTap }) {
  const alertState = getAlertState(stopId, alerts, dismissedAlerts)
  if (stopId.startsWith('mta:')) return <MtaSubwayCard stopId={stopId} displayName={displayName} hiddenBadges={hiddenBadges} alertState={alertState} onAlertTap={onAlertTap} />
  if (stopId.startsWith('bus:') || /^\d/.test(stopId)) return <BusCard stopId={stopId} displayName={displayName} hiddenBadges={hiddenBadges} alertState={alertState} onAlertTap={onAlertTap} />
  if (stopId.startsWith('path:')) return <PathCard stopId={stopId} displayName={displayName} hiddenBadges={hiddenBadges} alertState={alertState} onAlertTap={onAlertTap} />
  if (stopId.startsWith('ferry:')) return <FerryCard stopId={stopId} displayName={displayName} hiddenBadges={hiddenBadges} alertState={alertState} onAlertTap={onAlertTap} />
  if (stopId.startsWith('rail:')) return <RailCard stopId={stopId} displayName={displayName} hiddenBadges={hiddenBadges} alertState={alertState} onAlertTap={onAlertTap} />
  if (stopId.startsWith('hblr:')) return <HblrCard stopId={stopId} displayName={displayName} alertState={alertState} onAlertTap={onAlertTap} />
  if (stopId.startsWith('lirr:')) return <LirrCard stopId={stopId} displayName={displayName} hiddenBadges={hiddenBadges} alertState={alertState} onAlertTap={onAlertTap} />
  if (stopId.startsWith('mnr:')) return <MnrCard stopId={stopId} displayName={displayName} hiddenBadges={hiddenBadges} alertState={alertState} onAlertTap={onAlertTap} />
  if (stopId.startsWith('nycferry:')) return <NycFerryCard stopId={stopId} displayName={displayName} alertState={alertState} onAlertTap={onAlertTap} />
  if (stopId.startsWith('mtabus:')) return <MtaBusCard stopId={stopId} displayName={displayName} alertState={alertState} onAlertTap={onAlertTap} />
  return <BusCard stopId={stopId} displayName={displayName} hiddenBadges={hiddenBadges} alertState={alertState} onAlertTap={onAlertTap} />
}
