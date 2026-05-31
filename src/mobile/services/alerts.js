/**
 * Mobile alerts aggregator — polls transit APIs and collects active alerts.
 * Returns a flat array of alert objects for the Alerts page.
 */

import { fetchTunnels } from '../../services/tunnels'

/**
 * Fetch all active alerts relevant to the user's configured stops.
 * @param {string[]} stops - array of stop IDs the user has configured
 * @returns {Promise<Array<{id: string, source: string, text: string, timestamp: string, badges?: Array}>>}
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
            alerts.push({
              id: `tunnel-${t.name}-${text.slice(0, 30)}`,
              source: 'PANYNJ',
              text,
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
              timestamp: '',
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
            timestamp: '',
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
            alerts.push({
              id: `mta-${a.text?.slice(0, 30)}`,
              source: 'MTA',
              text: a.text,
              timestamp: '',
              badges: a.lines?.map(l => ({ label: l, color: a.lineColor || '#00933C' })),
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
            timestamp: '',
          })
        }
      }
    } catch { /* skip */ }
  }

  return alerts
}
