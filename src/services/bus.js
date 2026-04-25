/**
 * Bus Arrivals — NJ Transit GTFS-RT via backend proxy
 * Supports preconfigured stops (?dir=) and dynamic stops (?ids=&routes=)
 */

const BUS_API_URL = '/api/bus'

const ROUTE_CLASSES = {
  '126': 'nj126', '119': 'nj119', '128': 'nj128',
  '165': 'nj165', '166': 'nj166', '89': 'nj89',
  '22': 'nj22', '23': 'nj23',
}

function routeClass(route) {
  return ROUTE_CLASSES[route] || 'njother'
}

function mapBuses(buses) {
  return buses.map((b) => ({
    route: b.route,
    cls: routeClass(b.route),
    eta: b.eta,
    etaTime: b.etaTime,
    source: b.source,
    capacity: b.capacity || 'unknown',
  }))
}

/** Fetch preconfigured bus stops for a direction */
export async function fetchBusArrivals(direction = 'outbound') {
  const res = await fetch(`${BUS_API_URL}?dir=${direction}`)
  if (!res.ok) throw new Error(`Bus API returned ${res.status}`)

  const data = await res.json()
  const result = { _alerts: data.alerts || [], _stopOrder: data.stopOrder || [] }

  for (const [key, group] of Object.entries(data.stops)) {
    result[key] = {
      name: group.stop,
      gate: group.gate || null,
      gateSchedule: group.gateSchedule || null,
      serviceNote: group.serviceNote || null,
      buses: mapBuses(group.buses),
    }
  }

  return result
}

/**
 * Fetch bus data for a dynamic stop.
 * Supports new format: bus:STOP_ID:ROUTE1,ROUTE2 (with route filter)
 * Legacy format: STOP_ID or STOP_ID:ROUTE (single route, no route filter on server)
 * @param {string} stopId
 * @returns {{ name, buses, serviceNote, gate, gateSchedule, isPabt }}
 */
export async function fetchDynamicStop(stopId) {
  let gtfsId, routeFilter

  if (stopId.startsWith('bus:')) {
    // New format: bus:STOP_ID:ROUTE1,ROUTE2
    const parts = stopId.split(':')
    gtfsId = parts[1]
    routeFilter = parts[2] || null
  } else {
    // Legacy format: STOP_ID or STOP_ID:ROUTE
    gtfsId = stopId.split(':')[0]
    routeFilter = null
  }

  let url = `${BUS_API_URL}/stops?ids=${gtfsId}`
  if (routeFilter) url += `&routes=${routeFilter}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Dynamic stop API returned ${res.status}`)

  const data = await res.json()
  return {
    name: data.stop,
    buses: mapBuses(data.buses || []),
    serviceNote: null,
    gate: data.gate || null,
    gateSchedule: data.gateSchedule || null,
    isPabt: data.isPabt || false,
  }
}
