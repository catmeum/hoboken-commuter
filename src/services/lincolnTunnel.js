/**
 * Lincoln Tunnel — PANYNJ Crossing Times & Alerts
 *
 * Crossing times: https://www.panynj.gov/bin/portauthority/crossingtimesapi.json
 * Alerts:         https://www.panynj.gov/bin/portauthority/crossingtimesalertapi.json?start_date=MM/DD/YYYY
 *
 * We want facilityId 5, travelDirection "ToNY" for Hoboken → NYC crossing time.
 * Alerts are filtered by "Lincoln" in SentMessage or TemplateName.
 */

const CROSSING_TIMES_URL = '/api/panynj/crossingtimesapi.json'
const ALERTS_URL = '/api/panynj/crossingtimesalertapi.json'

const FACILITY_ID = 5 // Lincoln Tunnel

// Map PANYNJ background color hex to our severity levels
const SEVERITY_MAP = {
  '#2FB357': 'light',
  '#61B505': 'light',
  '#FFDD15': 'moderate',
  '#D2C204': 'moderate',
  '#FFAE00': 'heavy',
  '#C27901': 'heavy',
  '#FF0000': 'severe',
  '#CC0000': 'severe',
}

function classifySeverity(hexColor) {
  if (!hexColor) return 'moderate'
  const upper = hexColor.toUpperCase()
  return SEVERITY_MAP[upper] || 'moderate'
}

function todayDateParam() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

/**
 * Fetch real-time Lincoln Tunnel crossing data.
 * @param {'outbound' | 'inbound'} direction
 */
export async function fetchCrossingTime(direction = 'outbound') {
  const travelDir = direction === 'inbound' ? 'ToNJ' : 'ToNY'
  const res = await fetch(CROSSING_TIMES_URL)
  if (!res.ok) throw new Error(`Crossing times API returned ${res.status}`)

  const data = await res.json()
  const entry = data.find(
    (d) => d.facilityId === FACILITY_ID && d.travelDirection === travelDir
  )

  if (!entry) {
    return {
      crossingMinutes: null,
      speed: null,
      historicalMinutes: null,
      severity: 'moderate',
      trafficText: 'No data',
      closed: false,
      timestamp: null,
    }
  }

  return {
    crossingMinutes: entry.routeTravelTime,
    speed: entry.routeSpeed,
    historicalMinutes: entry.routeTravelTimeHist,
    severity: classifySeverity(entry.overviewUIBackgroundColor),
    trafficText: entry.infomationalText,
    closed: entry.isCrossingClosed,
    timestamp: entry.timeStamp,
  }
}

/**
 * Fetch today's Lincoln Tunnel alerts.
 * Returns: string[] of alert messages, most recent first.
 */
export async function fetchAlerts() {
  const url = `${ALERTS_URL}?start_date=${todayDateParam()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Alerts API returned ${res.status}`)

  const data = await res.json()

  // Filter to Lincoln Tunnel alerts only
  const lincolnAlerts = data.filter((a) => {
    const msg = (a.SentMessage || '').toLowerCase()
    const tmpl = (a.TemplateName || '').toLowerCase()
    return msg.includes('lincoln') || tmpl.includes('lincoln')
  })

  // Return just the message text, most recent first (API already returns newest first)
  return lincolnAlerts.map((a) => a.SentMessage)
}

/**
 * Fetch both crossing time and alerts in parallel.
 * @param {'outbound' | 'inbound'} direction
 */
export async function fetchLincolnTunnel(direction = 'outbound') {
  const [crossing, alerts] = await Promise.all([
    fetchCrossingTime(direction),
    fetchAlerts(),
  ])

  const label = direction === 'inbound' ? 'NYC → Hoboken' : 'Hoboken → NYC'

  return {
    crossingMinutes: crossing.crossingMinutes,
    speed: crossing.speed,
    severity: crossing.closed ? 'severe' : crossing.severity,
    direction: label,
    trafficText: crossing.closed ? 'TUNNEL CLOSED' : crossing.trafficText,
    timestamp: crossing.timestamp,
    alerts,
  }
}
