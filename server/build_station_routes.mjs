/**
 * Builds .cache/mta_station_routes.json
 * Maps each MTA subway station stop_id → array of route_ids that serve it
 * Uses the MTA GTFS static data from rrgtfsfeeds.s3.amazonaws.com
 */
import AdmZip from 'adm-zip'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '.cache')
const OUT_FILE = path.join(CACHE_DIR, 'mta_station_routes.json')

console.log('[build] Downloading MTA subway GTFS...')
const resp = await fetch('https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip')
if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
const buf = Buffer.from(await resp.arrayBuffer())
fs.mkdirSync(CACHE_DIR, { recursive: true })

const tmpZip = path.join(CACHE_DIR, 'gtfs_subway_tmp.zip')
fs.writeFileSync(tmpZip, buf)
const zip = new AdmZip(tmpZip)

// Parse stops.txt — we want parent stations (location_type=1)
const stopsText = zip.readAsText('stops.txt').trim().split('\n')
const stopsHeader = stopsText[0].split(',')
const sIdIdx = stopsHeader.indexOf('stop_id')
const sParentIdx = stopsHeader.indexOf('parent_station')
const sTypeIdx = stopsHeader.indexOf('location_type')

// Build child→parent map
const childToParent = {}
const parentIds = new Set()
for (let i = 1; i < stopsText.length; i++) {
  const cols = stopsText[i].split(',')
  const id = cols[sIdIdx]
  const parent = cols[sParentIdx]
  const type = cols[sTypeIdx]
  if (type === '1') parentIds.add(id)
  if (parent) childToParent[id] = parent
}

// Parse stop_times.txt to get stop→trip mapping
// This is large — use trips.txt + routes.txt instead for efficiency
const tripsText = zip.readAsText('trips.txt').trim().split('\n')
const tripsHeader = tripsText[0].split(',')
const tIdIdx = tripsHeader.indexOf('trip_id')
const tRIdIdx = tripsHeader.indexOf('route_id')
const tripToRoute = {}
for (let i = 1; i < tripsText.length; i++) {
  const cols = tripsText[i].split(',')
  tripToRoute[cols[tIdIdx]] = cols[tRIdIdx]
}
console.log('[build] Loaded', Object.keys(tripToRoute).length, 'trips')

// Parse stop_times.txt — map stop_id → Set of route_ids
console.log('[build] Parsing stop_times.txt (this may take a moment)...')
const stopTimesText = zip.readAsText('stop_times.txt').trim().split('\n')
const stHeader = stopTimesText[0].split(',')
const stTripIdx = stHeader.indexOf('trip_id')
const stStopIdx = stHeader.indexOf('stop_id')

const stopRoutes = {} // stop_id → Set<route_id>
for (let i = 1; i < stopTimesText.length; i++) {
  const cols = stopTimesText[i].split(',')
  const stopId = cols[stStopIdx]
  const tripId = cols[stTripIdx]
  const routeId = tripToRoute[tripId]
  if (!routeId) continue
  // Resolve to parent station
  const parent = childToParent[stopId] || stopId
  if (!stopRoutes[parent]) stopRoutes[parent] = new Set()
  stopRoutes[parent].add(routeId)
}

// Convert Sets to sorted arrays
const result = {}
for (const [stopId, routes] of Object.entries(stopRoutes)) {
  result[stopId] = [...routes].sort()
}

fs.writeFileSync(OUT_FILE, JSON.stringify(result))
fs.unlinkSync(tmpZip)
console.log('[build] Written', Object.keys(result).length, 'stations to', OUT_FILE)
