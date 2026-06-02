/**
 * Mobile alerts aggregator — polls transit APIs and collects active alerts.
 * Returns a flat array of alert objects for the Alerts page.
 */

import { fetchTunnels } from '../../services/tunnels'

// MTA subway line colors
const MTA_COLORS = {
  '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
  '4': '#00933C', '5': '#00933C', '6': '#00933C', '6X': '#00933C',
  '7': '#B933AD', '7X': '#B933AD',
  'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
  'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'M': '#FF6319',
  'G': '#6CBE45', 'J': '#996633', 'Z': '#996633', 'L': '#A7A9AC',
  'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
  'S': '#808183', 'SI': '#1D2D5C',
}
function getMtaColor(line) { return MTA_COLORS[line] || '#808183' }

/**
 * Format a timestamp (ms epoch) as a relative time string.
 * Returns e.g. "2 min ago", "1h ago", "3h ago"
 */
function formatRelativeTime(epochMs) {
  if (!epochMs) return ''
  const diffMin = Math.round((Date.now() - epochMs) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const hours = Math.floor(diffMin / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * Fetch all active alerts relevant to the user's configured stops.
 * @param {string[]} stops - array of stop IDs the user has configured
 * @returns {Promise<Array<{id: string, source: string, text: string, timestamp: string, startedAt: number|null, badges?: Array}>>}
 */
export async function fetchAlerts(stops) {
  const alerts = []

  try {
    // Tunnel alerts
    const tunnelData = await fetchTunnels()
    if (tunnelData?.tunnels) {
      for (const t of tunnelData.tunnels) {
        const allAlerts = t.allAlerts || t.alertsWithAge || []
        for (const a of allAlerts) {
          const text = typeof a === 'string' ? a : a.text
          if (text) {
            const ageMs = a.ageMinutes != null ? a.ageMinutes * 60000 : null
            alerts.push({
              id: `tunnel-${t.name}-${text.slice(0, 30)}`,
              source: 'PANYNJ',
              text,
              startedAt: ageMs != null ? Date.now() - ageMs : null,
              timestamp: a.ageMinutes != null ? `${a.ageMinutes} min ago` : '',
              badges: [{ label: `🚗 ${t.name} Tunnel`, color: 'transparent', textColor: 'inherit' }],
            })
          }
        }
      }
    }
  } catch {
    // Tunnel fetch failed — skip
  }

  // Bus alerts (from GTFS-RT)
  const hasBus = stops.some(s => s.startsWith('bus:') || /^\d/.test(s) || ['clinton', 'willow', 'washington', 'pabt_willow', 'pabt_washington', 'pabt_119'].includes(s))
  if (hasBus) {
    try {
      const res = await fetch('/api/bus/alerts')
      if (res.ok) {
        const data = await res.json()
        if (data.alerts) {
          for (const a of data.alerts) {
            alerts.push({
              id: `bus-${a.routes?.join(',')}-${a.text?.slice(0, 30)}`,
              source: 'NJT',
              text: `Rt ${a.routes?.join(',')}: ${a.text}`,
              routes: a.routes || [],
              startedAt: a.startedAt || null,
              timestamp: a.startedAt ? formatRelativeTime(a.startedAt) : '',
              badges: a.routes?.map(r => ({ label: r, color: '#1e40af' })),
            })
          }
        }
      }
    } catch { /* skip */ }
  }

  // PATH alerts
  const hasPath = stops.some(s => s.startsWith('path:'))
  if (hasPath) {
    try {
      const res = await fetch('/api/path/alerts')
      if (res.ok) {
        const data = await res.json()
        if (data.alert) {
          alerts.push({
            id: `path-${data.alert.slice(0, 30)}`,
            source: 'PATH',
            text: data.alert,
            startedAt: data.startedAt || null,
            timestamp: data.startedAt ? formatRelativeTime(data.startedAt) : '',
            badges: [{ label: 'PATH', color: '#0369a1' }],
          })
        }
      }
    } catch { /* skip */ }
  }

  // MTA Subway alerts
  const hasMta = stops.some(s => s.startsWith('mta:'))
  if (hasMta) {
    try {
      const res = await fetch('/api/mta/alerts')
      if (res.ok) {
        const data = await res.json()
        if (data.alerts) {
          for (const a of data.alerts.slice(0, 5)) {
            const lines = a.routes || a.lines || []
            alerts.push({
              id: `mta-${lines.join(',')}-${a.text?.slice(0, 20)}`,
              source: 'MTA',
              text: a.text,
              startedAt: a.startedAt || null,
              timestamp: a.startedAt ? formatRelativeTime(a.startedAt) : '',
              badges: lines.map(l => ({ label: l, color: getMtaColor(l), textColor: ['N','Q','R','W'].includes(l) ? '#000' : '#fff' })),
            })
          }
        }
      }
    } catch { /* skip */ }
  }

  // Ferry alerts
  const hasFerry = stops.some(s => s.startsWith('ferry:'))
  if (hasFerry) {
    try {
      const res = await fetch('/api/ferry/alerts')
      if (res.ok) {
        const data = await res.json()
        if (data.alert) {
          alerts.push({
            id: `ferry-${data.alert.slice(0, 30)}`,
            source: 'Ferry',
            text: data.alert,
            startedAt: null,
            timestamp: '',
          })
        }
      }
    } catch { /* skip */ }
  }

  return alerts
}
