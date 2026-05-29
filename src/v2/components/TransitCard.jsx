import { useState, useEffect, useCallback } from 'react'

function usePolling(fetcher, interval) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let active = true
    async function poll() {
      try {
        const result = await fetcher()
        if (active && result) setData(result)
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, interval)
    return () => { active = false; clearInterval(id) }
  }, [fetcher, interval])
  return data
}

function getModeIcon(stopKey) {
  if (stopKey.startsWith('mta:')) return '🚇'
  if (stopKey.startsWith('bus:')) return '🚌'
  if (stopKey.startsWith('rail:')) return '🚂'
  if (stopKey.startsWith('path:')) return '🚂'
  if (stopKey.startsWith('ferry:')) return '⛴️'
  if (stopKey.startsWith('hblr:')) return '🚈'
  if (stopKey.startsWith('nycferry:')) return '⛴️'
  if (stopKey.startsWith('lirr:')) return '🚂'
  if (stopKey.startsWith('mnr:')) return '🚂'
  if (stopKey.startsWith('mtabus:')) return '🚌'
  return '🚏'
}

function formatEta(min) {
  if (min <= 0) return 'Now'
  return `${min} min`
}

export default function TransitCard({ stopKey, displayName, hasAlert }) {
  const fetcher = useCallback(async () => {
    if (stopKey.startsWith('mta:')) {
      const parts = stopKey.split(':')
      const [, stationIds, dir, lines] = parts
      const stopParam = (dir === 'N' || dir === 'S')
        ? stationIds.split(',').map(id => id + dir).join(',')
        : stationIds
      let url = `/api/mta/query?stop=${stopParam}`
      if (lines) url += `&lines=${lines}`
      const res = await fetch(url)
      return res.ok ? await res.json() : null
    }
    if (stopKey.startsWith('bus:')) {
      const parts = stopKey.split(':')
      const gtfsId = parts[1]
      const routeFilter = parts[2] || null
      let url = `/api/bus/stops?ids=${gtfsId}`
      if (routeFilter) url += `&routes=${routeFilter}`
      const res = await fetch(url)
      if (!res.ok) return null
      const data = await res.json()
      return { departures: (data.buses || []).map(b => ({ dest: `${b.route} · ${data.stop || ''}`, route: b.route, eta: b.eta, etaTime: b.etaTime, source: b.source })), stationName: data.stop }
    }
    if (stopKey.startsWith('rail:')) {
      const parts = stopKey.split(':')
      const [, station, lines] = parts
      let url = `/api/rail/query?station=${station}`
      if (lines) url += `&lines=${lines}`
      const res = await fetch(url)
      return res.ok ? await res.json() : null
    }
    if (stopKey.startsWith('path:')) {
      const parts = stopKey.split(':')
      const [, route, direction, stop] = parts
      const res = await fetch(`/api/path/query?route=${route}&direction=${direction}&stop=${stop}`)
      return res.ok ? await res.json() : null
    }
    if (stopKey.startsWith('ferry:')) {
      const parts = stopKey.split(':')
      const [, stopTag, routeNo, destMatch] = parts
      let url = `/api/ferry/query?stop=${stopTag}`
      if (routeNo) url += `&route=${routeNo}`
      if (destMatch) url += `&dest=${destMatch}`
      const res = await fetch(url)
      return res.ok ? await res.json() : null
    }
    if (stopKey.startsWith('hblr:')) {
      const gtfsStop = stopKey.split(':')[1]
      const res = await fetch(`/api/bus/stops?ids=${gtfsStop}&routes=HBLR`)
      if (!res.ok) return null
      const data = await res.json()
      return { departures: (data.buses || []).map(b => ({ dest: b.route, eta: b.eta, etaTime: b.etaTime, source: b.source })), stationName: data.stop }
    }
    return null
  }, [stopKey])

  const data = usePolling(fetcher, stopKey.startsWith('path:') ? 15000 : 30000)
  const departures = data?.departures || []
  const name = displayName || data?.stationName || stopKey

  return (
    <div className="v2-card">
      <div className="v2-card-head">
        <span className="v2-mode-icon">{getModeIcon(stopKey)}</span>
        <span className="v2-station">{name}</span>
        {hasAlert && <span className="v2-alert-dot">⚠️</span>}
      </div>
      <div className="v2-card-body">
        {departures.length > 0 ? departures.slice(0, 4).map((d, i) => (
          <div key={i} className="v2-row">
            {d.route && <span className="v2-route-dot" style={{ background: getRouteColor(d.route) }}></span>}
            <span className="v2-dest">{d.dest || d.route || '—'}</span>
            <span className="v2-eta">{formatEta(d.eta)}</span>
            <span className="v2-clock">{d.etaTime || ''}</span>
          </div>
        )) : (
          <div className="v2-empty">No upcoming departures</div>
        )}
      </div>
    </div>
  )
}

function getRouteColor(route) {
  // MTA subway colors
  const colors = {
    '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
    '4': '#00933C', '5': '#00933C', '6': '#00933C', '6X': '#00933C',
    '7': '#B933AD', '7X': '#B933AD',
    'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
    'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'FX': '#FF6319', 'M': '#FF6319',
    'G': '#6CBE45',
    'J': '#996633', 'Z': '#996633',
    'L': '#A7A9AC',
    'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
    'GS': '#808183', 'SI': '#0039A6',
  }
  if (colors[route]) return colors[route]
  // NJT bus — hash to a color
  const hash = route.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const hues = ['#1e40af', '#7c3aed', '#0369a1', '#0d9488', '#b45309', '#dc2626']
  return hues[hash % hues.length]
}
