/**
 * Tunnel Crossing Times & Alerts — PANYNJ API
 *
 * Lincoln Tunnel: facilityId 5
 * Holland Tunnel: facilityId 4
 */

const CROSSING_TIMES_URL = '/api/panynj/crossingtimesapi.json'
const ALERTS_URL = '/api/panynj/crossingtimesalertapi.json'

const TUNNELS = {
  lincoln:     { facilityId: 5, name: 'Lincoln', alertKeyword: 'lincoln' },
  holland:     { facilityId: 4, name: 'Holland', alertKeyword: 'holland' },
  gwb_upper:   { facilityId: 2, name: 'GWB Upper', alertKeyword: 'george washington' },
  gwb_lower:   { facilityId: 2, name: 'GWB Lower', alertKeyword: 'george washington' },
  goethals:    { facilityId: 3, name: 'Goethals', alertKeyword: 'goethals' },
  bayonne:     { facilityId: 1, name: 'Bayonne', alertKeyword: 'bayonne' },
  outerbridge: { facilityId: 6, name: 'Outerbridge', alertKeyword: 'outerbridge' },
}

const SEVERITY_MAP = {
  '#2FB357': 'light', '#61B505': 'light',
  '#FFDD15': 'moderate', '#D2C204': 'moderate',
  '#FFAE00': 'heavy', '#C27901': 'heavy',
  '#FF0000': 'severe', '#CC0000': 'severe',
}

function classifySeverity(hexColor) {
  if (!hexColor) return 'moderate'
  return SEVERITY_MAP[hexColor.toUpperCase()] || 'moderate'
}

function todayDateParam() {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

function parseTunnelEntry(entry) {
  if (!entry) {
    return { crossingMinutes: null, speed: null, severity: 'moderate', trafficText: 'No data', closed: false, timestamp: null }
  }
  return {
    crossingMinutes: entry.routeTravelTime,
    speed: entry.routeSpeed,
    severity: classifySeverity(entry.overviewUIBackgroundColor),
    trafficText: entry.closed ? 'CLOSED' : entry.infomationalText,
    closed: entry.isCrossingClosed,
    timestamp: entry.timeStamp,
  }
}

/**
 * Fetch crossing times and alerts for selected tunnels/bridges.
 * @param {'outbound' | 'inbound'} direction
 * @param {string[]} selected — tunnel IDs to fetch (e.g. ['lincoln', 'holland'])
 */
export async function fetchTunnels(direction = 'outbound', selected = ['lincoln', 'holland']) {
  const travelDir = direction === 'inbound' ? 'ToNJ' : 'ToNY'
  const dirLabel = direction === 'inbound' ? 'NY → NJ' : 'NJ → NY'

  const [crossingRes, alertsRes] = await Promise.all([
    fetch(CROSSING_TIMES_URL),
    fetch(`${ALERTS_URL}?start_date=${todayDateParam()}`),
  ])

  if (!crossingRes.ok) throw new Error(`Crossing times API returned ${crossingRes.status}`)
  if (!alertsRes.ok) throw new Error(`Alerts API returned ${alertsRes.status}`)

  const crossingData = await crossingRes.json()
  const alertsData = await alertsRes.json()

  const activeTunnels = selected.map(id => TUNNELS[id]).filter(Boolean)

  const tunnels = activeTunnels.map((tunnel) => {
    const entry = crossingData.find(
      (d) => d.facilityId === tunnel.facilityId && d.travelDirection === travelDir
    )
    const crossing = parseTunnelEntry(entry)

    const alerts = alertsData
      .filter((a) => {
        const msg = (a.SentMessage || '').toLowerCase()
        const tmpl = (a.TemplateName || '').toLowerCase()
        return msg.includes(tunnel.alertKeyword) || tmpl.includes(tunnel.alertKeyword)
      })
      .map((a) => ({
        text: a.SentMessage,
        time: a.SentTime, // HH:MM:SS
        date: a.SentDate, // MM/DD/YYYY
      }))

    // Return alerts with timestamps — UI filters based on inline duration setting
    // Only keep the most recent alert per tunnel — superseded status updates are noise
    const now = new Date()
    const alertsWithAge = alerts.map((a) => {
      try {
        const [mm, dd, yyyy] = (a.date || '').split('/')
        const [hh, mi, ss] = (a.time || '').split(':')
        const alertDate = new Date(yyyy, mm - 1, dd, hh, mi, ss)
        return { text: a.text, ageMinutes: Math.round((now - alertDate) / 60000) }
      } catch { return { text: a.text, ageMinutes: 9999 } }
    })
    // Sort by age ascending (most recent first)
    alertsWithAge.sort((a, b) => a.ageMinutes - b.ageMinutes)

    return {
      name: tunnel.name,
      ...crossing,
      severity: crossing.closed ? 'severe' : crossing.severity,
      alertsWithAge: alertsWithAge.slice(0, 1), // only the most recent
      allAlerts: alertsWithAge.length > 0 ? [alertsWithAge[0].text] : [], // only the most recent for ticker
    }
  })

  return { direction: dirLabel, tunnels }
}
