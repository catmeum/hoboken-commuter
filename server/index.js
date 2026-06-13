/**
 * Backend proxy for transit data.
 *
 * All endpoints accept ?dir=outbound (default, Hoboken→NYC) or ?dir=inbound (NYC→Hoboken)
 */

// imports for the server start

import express from 'express'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import AdmZip from 'adm-zip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const app = express()
app.set('trust proxy', 1)

// CORS — restrict to known origin in production, open in dev
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN
app.use((req, res, next) => {
  if (!ALLOWED_ORIGIN) {
    // No origin configured — allow all
    res.set('Access-Control-Allow-Origin', '*')
  } else {
    const requestOrigin = req.get('Origin')
    if (requestOrigin && requestOrigin === ALLOWED_ORIGIN) {
      res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
    }
    // If origin doesn't match, omit the header entirely
  }
  res.set('Access-Control-Allow-Methods', 'GET')
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  next()
})

// ══════════════════════════════════════════════════════════
// Rate limiting
// Protects upstream APIs from abuse and prevents excessive bills.
// ══════════════════════════════════════════════════════════

// Global: 300 requests per minute per IP — covers normal dashboard polling
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
})
app.use(globalLimiter)

// Strict: 30 req/min — endpoints that hit paid/rate-limited upstream APIs
// NJT Rail (40K/day limit), MTA Bus SIRI (API key), weather zip (external calls)
const strictLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded for this endpoint.' },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
})

// Input validation helpers
function safeString(val, maxLen = 100) {
  return String(val || '').slice(0, maxLen).replace(/[^\w\s,.:/-]/g, '')
}
function safeZip(val) {
  return String(val || '').replace(/\D/g, '').slice(0, 5)
}


const NJT_USERNAME = process.env.VITE_NJT_USERNAME
const NJT_PASSWORD = process.env.VITE_NJT_PASSWORD
const NJT_API = 'https://pcsdata.njtransit.com/api/GTFSG2'

// ══════════════════════════════════════════════════════════
// Direction-based config
// ══════════════════════════════════════════════════════════

// ── Stop name patterns for GTFS-based resolution ──
// Instead of hardcoding GTFS stop IDs (which change with each NJT GTFS update),
// we define name patterns. After GTFS loads, resolveConfiguredStops() finds the
// matching stop IDs from the current GTFS data automatically.
//
// stopNamePatterns: array of substrings that must ALL appear in the stop name (case-insensitive)
// filterRoutes: only accept stops that serve these routes (prevents false matches)
// fallbackIds: used only if name resolution fails (last resort, logged as warning)
const DIRECTIONS = {
  outbound: {
    label: 'Hoboken → NYC',
    busStops: {
      clinton: {
        name: 'Clinton St & 11th',
        stopNamePatterns: ['CLINTON', '11TH'],
        filterRoutes: ['126'],
        fallbackIds: ['7917'],
        stopIds: ['7917'], // resolved at startup; fallback until GTFS loads
        serviceNote: 'Weekdays only · AM 5:40–9:45 · PM 4:09–8:29',
      },
      washington: {
        name: 'Washington St & 11th',
        stopNamePatterns: ['WASHINGTON', '11TH'],
        filterRoutes: ['126'],
        fallbackIds: ['7931'],
        stopIds: ['7931'],
        serviceNote: null,
      },
      willow: {
        name: 'Willow Ave & 15th',
        stopNamePatterns: ['WILLOW', '15TH'],
        filterRoutes: ['126'],
        fallbackIds: ['7940', '16135'],
        stopIds: ['7940', '16135'],
        serviceNote: null,
      },
    },
    busStopOrder: ['clinton', 'willow', 'washington'],
    tunnel: { facilityId: 5, travelDirection: 'ToNY', label: 'Hoboken → NYC' },
    path: [
      { routeId: '862', directionId: 1, dest: 'HOB → 33rd St' },
      { routeId: '1024', directionId: 1, dest: 'JSQ via HOB → 33rd St' },
    ],
    ferry: { stopTag: '9', routeNo: '18', destMatch: 'Midtown', dest: 'Hoboken 14th → W 39th' },
  },
  inbound: {
    label: 'NYC → Hoboken',
    busStops: {
      pabt_willow: {
        name: 'PABT · 126 Willow / Hamilton Pk',
        gate: { day: '214', late: '323', overnight: '79' },
        // PABT has a fixed master stop ID (16977) plus platform-specific IDs.
        // Platform IDs can change; resolve by finding PABT stops that serve route 126
        // with Willow/Hamilton Park headsigns.
        stopNamePatterns: ['PORT AUTHORITY'],
        filterRoutes: ['126'],
        filterHeadsigns: ['WILLOW', 'HAMILTON PK VIA WILLOW'],
        fallbackIds: ['16977', '16809'],
        stopIds: ['16977', '16809'],
        serviceNote: 'Peak hours only · check NJT for schedule',
      },
      pabt_washington: {
        name: 'PABT · 126 Washington',
        gate: { day: '213', late: '323', overnight: '79' },
        stopNamePatterns: ['PORT AUTHORITY'],
        filterRoutes: ['126'],
        filterHeadsigns: ['PATH', 'HAMILTON PK VIA HOBOKEN'],
        excludeHeadsigns: ['WILLOW'],
        fallbackIds: ['16977', '16808'],
        stopIds: ['16977', '16808'],
        serviceNote: 'Peak hours only · check NJT for schedule',
      },
      pabt_119: {
        name: 'PABT · 119',
        gate: { day: '210', late: '322', overnight: '80' },
        stopNamePatterns: ['PORT AUTHORITY'],
        filterRoutes: ['119'],
        fallbackIds: ['16977', '16803', '16856'],
        stopIds: ['16977', '16803', '16856'],
        serviceNote: null,
      },
    },
    busStopOrder: ['pabt_willow', 'pabt_washington', 'pabt_119'],
    tunnel: { facilityId: 5, travelDirection: 'ToNJ', label: 'NYC → Hoboken' },
    path: [
      { routeId: '862', directionId: 0, dest: '33rd → Hoboken' },
      { routeId: '861', directionId: 0, dest: '33rd → Newport' },
      { routeId: '1024', directionId: 0, dest: '33rd → Hoboken (JSQ)' },
    ],
    ferry: { stopTag: '14', routeNo: '18', destMatch: 'Hoboken', dest: 'W 39th → Hoboken 14th' },
  },
}

// HBLR default stops — resolved by name from GTFS at startup.
// These drive the /api/bus/hblr-defaults endpoint used by the frontend DEFAULT_SETTINGS.
const HBLR_DEFAULTS = {
  outbound: { namePatterns: ['HOBOKEN', 'TERMINAL'], fallbackId: '15534' },
  inbound:  { namePatterns: ['9TH'],                 fallbackId: '15537' },
}
// Resolved IDs (populated after GTFS loads)
let hblrDefaultIds = {
  outbound: HBLR_DEFAULTS.outbound.fallbackId,
  inbound:  HBLR_DEFAULTS.inbound.fallbackId,
}

function getDir(req) {
  return req.query.dir === 'inbound' ? 'inbound' : 'outbound'
}

// ══════════════════════════════════════════════════════════
// NJT Auth
// ══════════════════════════════════════════════════════════

let cachedToken = null
let tokenExpiry = 0

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const form = new FormData()
  form.append('username', NJT_USERNAME)
  form.append('password', NJT_PASSWORD)
  const res = await fetch(`${NJT_API}/authenticateUser`, { method: 'POST', body: form })
  const data = await res.json()
  if (data.Authenticated !== 'True') throw new Error('NJT auth failed')
  cachedToken = data.UserToken
  tokenExpiry = Date.now() + 20 * 60 * 60 * 1000
  console.log('[NJT] Authenticated, token cached')
  return cachedToken
}

// ══════════════════════════════════════════════════════════
// Static GTFS
// ══════════════════════════════════════════════════════════

let tripRouteMap = {}
let tripHeadsignMap = {}
let tripDirectionMap = {}  // trip_id → direction_id ('0' or '1')
let scheduleByStop = {}
let stopNamesMap = {}
let stopCoordsMap = {} // stop_id → { lat, lon }
let gtfsLoaded = false
const GTFS_CACHE = path.join(__dirname, '..', '.cache')
const GTFS_ZIP = path.join(GTFS_CACHE, 'gtfs.zip')

// Collect ALL stop IDs — load schedule for everything
function getAllStopIds() {
  return null // null = load all stops
}

async function loadGTFS() {
  if (gtfsLoaded) return

  const needsDownload = !fs.existsSync(GTFS_ZIP) ||
    (Date.now() - fs.statSync(GTFS_ZIP).mtimeMs > 3 * 24 * 60 * 60 * 1000) // refresh every 3 days (NJT license: download within 3 business days)

  if (needsDownload) {
    console.log('[GTFS] Downloading static data...')
    const token = await getToken()
    const form = new FormData()
    form.append('token', token)
    const res = await fetch(`${NJT_API}/getGTFS`, { method: 'POST', body: form })
    const buf = Buffer.from(await res.arrayBuffer())
    fs.mkdirSync(GTFS_CACHE, { recursive: true })
    fs.writeFileSync(GTFS_ZIP, buf)
    console.log('[GTFS] Downloaded', (buf.length / 1e6).toFixed(1), 'MB')
  }

  const zip = new AdmZip(GTFS_ZIP)

  const routesMap = {}
  const routesCsv = zip.readAsText('routes.txt').trim().split('\n')
  const routesHeader = routesCsv[0].split(',')
  const rIdIdx = routesHeader.indexOf('route_id')
  const rNameIdx = routesHeader.indexOf('route_short_name')
  for (let i = 1; i < routesCsv.length; i++) {
    const cols = routesCsv[i].split(',')
    routesMap[cols[rIdIdx]] = cols[rNameIdx]
  }

  const tripsCsv = zip.readAsText('trips.txt').trim().split('\n')
  const tripsHeader = tripsCsv[0].split(',')
  const tIdIdx = tripsHeader.indexOf('trip_id')
  const tRIdx = tripsHeader.indexOf('route_id')
  const tHsIdx = tripsHeader.indexOf('trip_headsign')
  const tDirIdx = tripsHeader.indexOf('direction_id')
  for (let i = 1; i < tripsCsv.length; i++) {
    const cols = tripsCsv[i].split(',')
    tripRouteMap[cols[tIdIdx]] = routesMap[cols[tRIdx]] || cols[tRIdx]
    if (tHsIdx >= 0) tripHeadsignMap[cols[tIdIdx]] = cols[tHsIdx] || ''
    if (tDirIdx >= 0) tripDirectionMap[cols[tIdIdx]] = cols[tDirIdx] || '0'
  }
  console.log('[GTFS] Loaded', Object.keys(tripRouteMap).length, 'trips')

  // Parse stops.txt for name lookup
  const stopsCsv = zip.readAsText('stops.txt').trim().split('\n')
  const stopsHeader = stopsCsv[0].split(',')
  const sIdIdx = stopsHeader.indexOf('stop_id')
  const sNameIdx = stopsHeader.indexOf('stop_name')
  const sLatIdx = stopsHeader.indexOf('stop_lat')
  const sLonIdx = stopsHeader.indexOf('stop_lon')
  for (let i = 1; i < stopsCsv.length; i++) {
    const cols = stopsCsv[i].split(',')
    stopNamesMap[cols[sIdIdx]] = cols[sNameIdx]
    if (sLatIdx >= 0 && sLonIdx >= 0) {
      const lat = parseFloat(cols[sLatIdx])
      const lon = parseFloat(cols[sLonIdx])
      if (!isNaN(lat) && !isNaN(lon)) {
        stopCoordsMap[cols[sIdIdx]] = { lat, lon }
      }
    }
  }
  console.log('[GTFS] Loaded', Object.keys(stopNamesMap).length, 'stop names,', Object.keys(stopCoordsMap).length, 'with coordinates')

  getAllStopIds() // ensure stop IDs are initialized
  const stCsv = zip.readAsText('stop_times.txt').trim().split('\n')
  const stHeader = stCsv[0].split(',')
  const stTripIdx = stHeader.indexOf('trip_id')
  const stStopIdx = stHeader.indexOf('stop_id')
  const stDepIdx = stHeader.indexOf('departure_time')

  scheduleByStop = {}
  for (let i = 1; i < stCsv.length; i++) {
    const cols = stCsv[i].split(',')
    const stopId = cols[stStopIdx]
    const tripId = cols[stTripIdx]
    const route = tripRouteMap[tripId]
    if (!route) continue
    const depTime = cols[stDepIdx]
    if (!scheduleByStop[stopId]) scheduleByStop[stopId] = []
    scheduleByStop[stopId].push({ route, departureTime: depTime, tripId })
  }

  for (const sid of Object.keys(scheduleByStop)) {
    scheduleByStop[sid].sort((a, b) => a.departureTime.localeCompare(b.departureTime))
  }

  gtfsLoaded = true
  console.log('[GTFS] Schedule loaded for', Object.keys(scheduleByStop).length, 'stops')

  // ── Resolve configured stop IDs from GTFS by name pattern ──
  // This replaces hardcoded IDs with whatever the current GTFS data says,
  // so a GTFS re-download is all that's needed when NJT renumbers stops.
  console.log('[GTFS] Resolving configured stop IDs by name...')

  // Helper: find all stop IDs whose name matches ALL patterns and serve at least one of the given routes
  function findStopIdsByName(namePatterns, requiredRoutes) {
    const pats = namePatterns.map(p => p.toUpperCase())
    const results = []
    for (const [stopId, name] of Object.entries(stopNamesMap)) {
      const upper = (name || '').toUpperCase()
      if (!pats.every(p => upper.includes(p))) continue
      if (!scheduleByStop[stopId]) continue
      if (requiredRoutes) {
        const routes = new Set(scheduleByStop[stopId].map(e => e.route))
        if (!requiredRoutes.some(r => routes.has(r))) continue
      }
      results.push(stopId)
    }
    return results
  }

  // Resolve bus stop IDs for all configured directions
  for (const [dirKey, dir] of Object.entries(DIRECTIONS)) {
    for (const [stopKey, stop] of Object.entries(dir.busStops)) {
      if (!stop.stopNamePatterns) continue
      const resolved = findStopIdsByName(stop.stopNamePatterns, stop.filterRoutes || null)
      if (resolved.length > 0) {
        stop.stopIds = resolved
        console.log(`[GTFS] Resolved ${dirKey}/${stopKey} → [${resolved.join(', ')}] (${resolved.map(id => stopNamesMap[id]).join(' | ')})`)
      } else {
        stop.stopIds = stop.fallbackIds
        console.warn(`[GTFS] ⚠️  Could not resolve ${dirKey}/${stopKey} by name — using fallback IDs [${stop.fallbackIds.join(', ')}]`)
      }
    }
  }

  // Resolve HBLR default stop IDs
  for (const [dirKey, cfg] of Object.entries(HBLR_DEFAULTS)) {
    const resolved = findStopIdsByName(cfg.namePatterns, ['HBLR'])
    if (resolved.length > 0) {
      hblrDefaultIds[dirKey] = resolved[0]
      console.log(`[GTFS] Resolved HBLR default ${dirKey} → ${resolved[0]} (${stopNamesMap[resolved[0]]})`)
    } else {
      hblrDefaultIds[dirKey] = cfg.fallbackId
      console.warn(`[GTFS] ⚠️  Could not resolve HBLR default ${dirKey} — using fallback ID ${cfg.fallbackId}`)
    }
  }

  // Rebuild PABT_STOP_IDS from current GTFS — any stop whose name contains "PORT AUTHORITY"
  // This keeps isPabtStop() accurate after NJT renumbers platform IDs.
  for (const [stopId, name] of Object.entries(stopNamesMap)) {
    if ((name || '').toUpperCase().includes('PORT AUTHORITY') && scheduleByStop[stopId]) {
      PABT_STOP_IDS.add(stopId)
    }
  }
  console.log(`[GTFS] PABT stop IDs: ${[...PABT_STOP_IDS].sort((a, b) => a - b).join(', ')}`)

  // Validate: log routes served by each resolved stop so mismatches are obvious
  console.log('[GTFS] Validating resolved stop IDs...')
  for (const [dirKey, dir] of Object.entries(DIRECTIONS)) {
    for (const [stopKey, stop] of Object.entries(dir.busStops)) {
      for (const id of stop.stopIds) {
        const entries = scheduleByStop[id] || []
        const routes = [...new Set(entries.map(e => e.route))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        const name = stopNamesMap[id] || '(unknown)'
        if (routes.length === 0) {
          console.warn(`[GTFS] ⚠️  Stop ${id} (${dirKey}/${stopKey}) — "${name}" — NO routes found!`)
        } else {
          const expected = stop.filterRoutes
          const mismatch = expected && !expected.some(r => routes.includes(r))
          const flag = mismatch ? ' ⚠️  EXPECTED ROUTES NOT FOUND' : ''
          console.log(`[GTFS] Stop ${id} (${dirKey}/${stopKey}) — "${name}" — routes: ${routes.join(', ')}${flag}`)
        }
      }
    }
  }
}

// ══════════════════════════════════════════════════════════
// GTFS-RT caches
// ══════════════════════════════════════════════════════════

let rtCache = null, rtCacheTime = 0
let vpCache = null, vpCacheTime = 0
const RT_CACHE_TTL = 30_000

async function fetchTripUpdates() {
  if (rtCache && Date.now() - rtCacheTime < RT_CACHE_TTL) return rtCache
  try {
    const token = await getToken()
    const form = new FormData()
    form.append('token', token)
    const res = await fetch(`${NJT_API}/getTripUpdates`, { method: 'POST', body: form })
    const buf = Buffer.from(await res.arrayBuffer())
    rtCache = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf)
    rtCacheTime = Date.now()
    console.log('[RT] Fetched', rtCache.entity.length, 'trip updates')
    return rtCache
  } catch (err) {
    console.error('[RT] Failed to fetch/decode trip updates:', err.message)
    // Return stale cache if available, otherwise empty feed
    if (rtCache) return rtCache
    return { entity: [] }
  }
}

const OCC_MAP = { 0: 'empty', 1: 'empty', 2: 'some', 3: 'full', 4: 'full', 5: 'full', 6: 'full' }

async function fetchVehiclePositions() {
  if (vpCache && Date.now() - vpCacheTime < RT_CACHE_TTL) return vpCache
  try {
    const token = await getToken()
    const form = new FormData()
    form.append('token', token)
    const res = await fetch(`${NJT_API}/getVehiclePositions`, { method: 'POST', body: form })
    const buf = Buffer.from(await res.arrayBuffer())
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf)
    const occMap = {}
    const routeMap = {}
    for (const entity of feed.entity) {
      const vp = entity.vehicle
      if (vp?.trip?.tripId) {
        occMap[vp.trip.tripId] = OCC_MAP[vp.occupancyStatus] ?? 'unknown'
        if (vp.trip.routeId) routeMap[vp.trip.tripId] = vp.trip.routeId
      }
    }
    vpCache = { occMap, routeMap }
    vpCacheTime = Date.now()
    console.log('[VP] Fetched', Object.keys(occMap).length, 'vehicle positions,', Object.keys(routeMap).length, 'route mappings')
    return vpCache
  } catch (err) {
    console.error('[VP] Failed to fetch/decode vehicle positions:', err.message)
    // Return stale cache if available, otherwise empty maps
    if (vpCache) return vpCache
    return { occMap: {}, routeMap: {} }
  }
}

// ══════════════════════════════════════════════════════════
// Bus helpers
// ══════════════════════════════════════════════════════════

// All transit schedules (NJT GTFS, ferry scheduledMin, gate hours) are in Eastern Time.
// The server may run in UTC (e.g. Lightsail). Always use Eastern time for display and comparisons.
const EASTERN_TZ = 'America/New_York'

function nowEastern() {
  // Returns { h, m, s, totalMinutes } in Eastern Time
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TZ,
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(new Date())
  const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0')
  const h = get('hour') % 24  // Intl can return 24 for midnight
  const m = get('minute')
  const s = get('second')
  return { h, m, s, totalMinutes: h * 60 + m }
}

function dateToEastern(date) {
  // Returns { h, m } for a Date object converted to Eastern Time
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TZ,
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(date)
  const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0')
  return { h: get('hour') % 24, m: get('minute') }
}

function formatTime(h, m) {
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatTimeFromDate(date) {
  const { h, m } = dateToEastern(date)
  return formatTime(h, m)
}

// Headsign → friendly variant label
function parseVariant(headsign) {
  const hs = (headsign || '').toUpperCase()
  if (hs.includes('WILLOW')) return 'via Willow'
  if (hs.includes('HOBOKEN') && !hs.includes('WILLOW')) return 'via Washington'
  if (hs.includes('PATH')) return 'via Washington'
  if (hs.includes('119')) return '119'
  return null
}

// Extract a keyword from a headsign for filtering (e.g. "126 HOBOKEN VIA WILLOW AVE" → "WILLOW")
function extractHeadsignKeyword(headsign) {
  const hs = (headsign || '').toUpperCase()
  if (hs.includes('WILLOW')) return 'WILLOW'
  if (hs.includes('WASHINGTON')) return 'WASHINGTON'
  if (hs.includes('HAMILTON PK VIA HOBOKEN')) return 'HOBOKEN'
  if (hs.includes('HAMILTON PK')) return 'HAMILTON'
  // For non-variant headsigns, use the destination portion (after route number)
  const match = hs.match(/^\d+\s+(.+)/)
  return match ? match[1].split(' ')[0] : hs.split(' ')[0]
}

function getScheduleFallback(stopIds, limit = 6, filterRoutes = null, filterHeadsigns = null, excludeHeadsigns = null) {
  const { h: nowH, m: nowM, s: nowS, totalMinutes: nowTotalMin } = nowEastern()
  const nowTime = `${String(nowH).padStart(2,'0')}:${String(nowM).padStart(2,'0')}:${String(nowS).padStart(2,'0')}`
  const upcoming = []
  for (const sid of stopIds) {
    for (const entry of (scheduleByStop[sid] || [])) {
      if (entry.departureTime > nowTime) {
        if (filterRoutes && !filterRoutes.includes(entry.route)) continue
        const headsign = tripHeadsignMap[entry.tripId] || ''
        const hsUpper = headsign.toUpperCase()
        if (filterHeadsigns && !filterHeadsigns.some(f => hsUpper.includes(f.toUpperCase()))) continue
        if (excludeHeadsigns && excludeHeadsigns.some(f => hsUpper.includes(f.toUpperCase()))) continue
        const [eh, em] = entry.departureTime.split(':').map(Number)
        const etaMin = (eh * 60 + em) - nowTotalMin
        if (etaMin > 0 && etaMin < 180) {
          upcoming.push({
            route: entry.route,
            eta: etaMin,
            etaTime: formatTime(eh, em),
            source: 'schedule',
            tripId: entry.tripId,
            variant: parseVariant(headsign),
            headsign,
          })
        }
      }
    }
  }
  upcoming.sort((a, b) => a.eta - b.eta)
  const seen = new Set(), deduped = []
  for (const u of upcoming) {
    const key = `${u.route}-${u.etaTime}`
    if (!seen.has(key)) { seen.add(key); deduped.push(u) }
  }
  return deduped.slice(0, limit)
}

// Derive a short, friendly destination/headsign from the terminal stop name of a trip.
// The RT feed's stopTimeUpdate sequence ends at the trip's final stop — that's
// the true destination. Static GTFS trip→headsign mapping is unreliable for NJT G2
// because RT trip_ids don't align with static trip_ids, so we use the live stop sequence.
// Keep outputs short (≈ ≤16 chars) so they fit the card layout.
function headsignFromTerminal(terminalStopName) {
  if (!terminalStopName) return ''
  const upper = terminalStopName.toUpperCase()
  // Map well-known terminals to short, rider-friendly destinations
  if (upper.includes('PORT AUTHORITY') || upper.includes('NEW YORK')) return 'New York'
  if (upper.includes('HOBOKEN')) return 'Hoboken'
  if (upper.includes('PATH')) return 'PATH'
  if (upper.includes('JOURNAL SQ')) return 'Journal Sq'
  if (upper.includes('JERSEY CITY')) return 'Jersey City'
  if (upper.includes('BERGENLINE')) return 'Bergenline'
  if (upper.includes('GEORGE WASHINGTON') || upper.includes('GW BRIDGE')) return 'GWB Station'
  if (upper.includes('NEWARK')) return 'Newark'
  // Otherwise, shorten the raw terminal name: take the part before " AT "
  // (e.g. "BERGENLINE AVE AT JFK BLVD" → "Bergenline Ave") and cap length.
  let short = terminalStopName.split(/ AT /i)[0].trim()
  if (short.length > 16) short = short.slice(0, 15).trim() + '…'
  // Title-case it
  return short.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

async function getRealtimeBuses(stopIds, limit = 6, filterRoutes = null, filterHeadsigns = null, excludeHeadsigns = null) {
  const [feed, vpData] = await Promise.all([fetchTripUpdates(), fetchVehiclePositions()])
  const { occMap, routeMap: vpRouteMap } = vpData
  const now = Date.now() / 1000
  const stopSet = new Set(stopIds)
  const results = []
  for (const entity of feed.entity) {
    const tu = entity.tripUpdate
    if (!tu) continue
    const stus = tu.stopTimeUpdate
    if (!stus || stus.length === 0) continue
    // Derive destination from the LAST stop in the trip's live sequence
    const terminalStop = stus[stus.length - 1]
    const terminalName = stopNamesMap[terminalStop.stopId] || ''
    const headsign = headsignFromTerminal(terminalName)
    const hsUpper = headsign.toUpperCase()
    for (const stu of stus) {
      if (!stopSet.has(stu.stopId)) continue
      const t = (stu.arrival?.time?.low || stu.arrival?.time || 0) || (stu.departure?.time?.low || stu.departure?.time || 0)
      if (t && t > now) {
        const tripId = tu.trip?.tripId || ''
        // Route: VP feed is the only reliable source (RT trip descriptor has no routeId,
        // and static GTFS trip→route mapping doesn't align with RT trip_ids).
        const route = vpRouteMap[tripId] || tripRouteMap[tripId] || '?'
        if (filterRoutes && !filterRoutes.includes(route)) continue
        // Headsign filtering uses the live-derived destination
        if (filterHeadsigns && headsign && !filterHeadsigns.some(f => hsUpper.includes(f.toUpperCase()))) continue
        if (excludeHeadsigns && headsign && excludeHeadsigns.some(f => hsUpper.includes(f.toUpperCase()))) continue
        const d = new Date(t * 1000)
        results.push({
          route,
          eta: Math.round((t - now) / 60),
          etaTime: formatTimeFromDate(d),
          source: 'realtime', tripId,
          capacity: occMap[tripId] || 'unknown',
          headsign,
          variant: parseVariant(headsign),
          _liveHeadsign: true,
        })
      }
    }
  }
  results.sort((a, b) => a.eta - b.eta)
  return results.slice(0, limit)
}

// ══════════════════════════════════════════════════════════
// Bus Alerts
// ══════════════════════════════════════════════════════════

let busAlertCache = null, busAlertCacheTime = 0
const BUS_ALERT_CACHE_TTL = 120_000
const OUR_BUS_ROUTES = new Set(['126', '119', '89', '22', '23', '128', '165', '166'])

async function fetchBusAlerts() {
  if (busAlertCache && Date.now() - busAlertCacheTime < BUS_ALERT_CACHE_TTL) return busAlertCache
  try {
    const token = await getToken()
    const form = new FormData()
    form.append('token', token)
    const res = await fetch(`${NJT_API}/getAlerts`, { method: 'POST', body: form })
    const buf = Buffer.from(await res.arrayBuffer())
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf)
    const alerts = []
    for (const entity of feed.entity) {
      const alert = entity.alert
      if (!alert) continue
      const routesAffected = new Set()
      for (const ie of alert.informedEntity) {
        if (ie.routeId && OUR_BUS_ROUTES.has(ie.routeId)) routesAffected.add(ie.routeId)
      }
      if (routesAffected.size > 0) {
        const text = (alert.descriptionText?.translation?.[0]?.text || alert.headerText?.translation?.[0]?.text || '').slice(0, 200)
        // Extract active_period start timestamp (Unix seconds)
        const startEpoch = alert.activePeriod?.[0]?.start
        const startedAt = startEpoch ? Number(startEpoch) * 1000 : null
        if (text) alerts.push({ routes: [...routesAffected], text, startedAt })
      }
    }
    busAlertCache = alerts
    busAlertCacheTime = Date.now()
    console.log('[Alerts] NJT bus alerts for our routes:', alerts.length)
  } catch (err) {
    console.error('[Alerts] NJT bus alerts error:', err.message)
    busAlertCache = busAlertCache || []
  }
  return busAlertCache
}

function getCurrentGate(gateConfig) {
  if (!gateConfig) return null
  const { h } = nowEastern()
  if (h >= 6 && h < 22) return gateConfig.day       // 6 AM – 10 PM
  if (h >= 22 || h < 1) return gateConfig.late       // 10 PM – 1 AM
  return gateConfig.overnight                         // 1 AM – 6 AM
}

// PABT gate assignments by route (from portauthoritygate.com, June 2024)
// Format: { day: gate 6AM-10PM, late: gate 10PM-1AM, overnight: gate 1AM-6AM }
const PABT_GATES_BY_ROUTE = {
  // Hoboken / Jersey City routes
  '126': { day: '213', late: '323', overnight: '79' },
  '128': { day: '215', late: '323', overnight: '79' },
  '125': { day: '212', late: '323', overnight: '79' },
  '119': { day: '210', late: '322', overnight: '80' },
  '89':  { day: '211', late: '322', overnight: '80' },
  '22':  { day: '208', late: '321', overnight: '78' },
  '23':  { day: '209', late: '321', overnight: '78' },
  // Bergen County routes
  '154': { day: '223', late: '325', overnight: '82' },
  '156': { day: '224', late: '325', overnight: '82' },
  '158': { day: '224', late: '325', overnight: '82' },
  '159': { day: '224', late: '325', overnight: '82' },
  '160': { day: '224', late: '325', overnight: '82' },
  '161': { day: '225', late: '325', overnight: '82' },
  '163': { day: '225', late: '325', overnight: '82' },
  '164': { day: '225', late: '325', overnight: '82' },
  '165': { day: '225', late: '325', overnight: '82' },
  '166': { day: '226', late: '325', overnight: '82' },
  '167': { day: '226', late: '325', overnight: '82' },
  '168': { day: '226', late: '325', overnight: '82' },
  '171': { day: '227', late: '326', overnight: '83' },
  '175': { day: '227', late: '326', overnight: '83' },
  '177': { day: '227', late: '326', overnight: '83' },
  '178': { day: '227', late: '326', overnight: '83' },
  // Passaic / Morris routes
  '181': { day: '228', late: '326', overnight: '83' },
  '182': { day: '228', late: '326', overnight: '83' },
  '186': { day: '228', late: '326', overnight: '83' },
  '190': { day: '229', late: '326', overnight: '83' },
  '191': { day: '229', late: '326', overnight: '83' },
  '192': { day: '229', late: '326', overnight: '83' },
  '193': { day: '229', late: '326', overnight: '83' },
  '194': { day: '230', late: '326', overnight: '83' },
  '195': { day: '230', late: '326', overnight: '83' },
  '197': { day: '230', late: '326', overnight: '83' },
  // Essex / Union routes
  '320': { day: '320', late: '320', overnight: '320' },
  '321': { day: '321', late: '321', overnight: '321' },
  '324': { day: '324', late: '324', overnight: '324' },
  // South Jersey / Turnpike routes
  '137': { day: '218', late: '324', overnight: '81' },
  '138': { day: '218', late: '324', overnight: '81' },
  '139': { day: '219', late: '324', overnight: '81' },
  '143': { day: '220', late: '324', overnight: '81' },
  '144': { day: '220', late: '324', overnight: '81' },
  '145': { day: '221', late: '324', overnight: '81' },
  '148': { day: '221', late: '324', overnight: '81' },
  '151': { day: '222', late: '325', overnight: '82' },
  '153': { day: '222', late: '325', overnight: '82' },
  // Meadowlands / Secaucus
  '351': { day: '216', late: '323', overnight: '79' },
  '352': { day: '216', late: '323', overnight: '79' },
  '354': { day: '216', late: '323', overnight: '79' },
  '355': { day: '217', late: '323', overnight: '79' },
  '356': { day: '217', late: '323', overnight: '79' },
}

// Known PABT GTFS stop IDs (Port Authority Bus Terminal has multiple platform IDs).
// Seeded with historically known IDs as a fallback; rebuilt from GTFS after loadGTFS() runs.
const PABT_STOP_IDS = new Set(['16977', '16012', '16049', '16808', '16809', '16803', '16856'])

function isPabtStop(stopIds) {
  if (typeof stopIds === 'string') return PABT_STOP_IDS.has(stopIds)
  return stopIds.some(id => PABT_STOP_IDS.has(id))
}

function getPabtGateForRoutes(routes) {
  // Return gate info for the first matching route
  for (const r of routes) {
    if (PABT_GATES_BY_ROUTE[r]) return PABT_GATES_BY_ROUTE[r]
  }
  return null
}

// ══════════════════════════════════════════════════════════
// Bus endpoint
// ══════════════════════════════════════════════════════════

// HBLR default stop IDs — resolved from GTFS by name, used by frontend DEFAULT_SETTINGS
// Returns the current GTFS stop IDs for the default outbound/inbound HBLR stops.
// Frontend calls this on first load so defaults are always in sync with current GTFS data.
app.get('/api/bus/hblr-defaults', async (req, res) => {
  try {
    await loadGTFS()
    res.json({
      outbound: hblrDefaultIds.outbound,
      inbound: hblrDefaultIds.inbound,
      outboundName: stopNamesMap[hblrDefaultIds.outbound] || 'Hoboken Terminal',
      inboundName: stopNamesMap[hblrDefaultIds.inbound] || '9th St',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Route list — returns all bus route numbers
let routeListCache = null
app.get('/api/bus/routes', async (req, res) => {
  try {
    await loadGTFS()
    if (!routeListCache) {
      const routeSet = new Set(Object.values(tripRouteMap))
      routeListCache = [...routeSet].filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    }
    res.json({ routes: routeListCache })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Stops for a route — returns all stops served by a given route number (deduplicated by name)
app.get('/api/bus/routes/:route/stops', async (req, res) => {
  try {
    await loadGTFS()
    const targetRoute = req.params.route
    // Find all stop IDs that have this route in their schedule
    const stopIds = new Set()
    for (const [stopId, entries] of Object.entries(scheduleByStop)) {
      if (entries.some(e => e.route === targetRoute)) {
        stopIds.add(stopId)
      }
    }
    // Deduplicate by stop name — keep the first ID for each unique name
    const seenNames = new Map()
    const allStops = [...stopIds].map(id => ({
      id,
      name: stopNamesMap[id] || id,
    })).sort((a, b) => a.name.localeCompare(b.name))

    for (const stop of allStops) {
      if (!seenNames.has(stop.name)) {
        seenNames.set(stop.name, stop)
      }
    }
    const stops = [...seenNames.values()]

    res.json({ route: targetRoute, stops })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Routes at a stop — returns all route numbers that serve a given GTFS stop ID
app.get('/api/bus/stop-routes', async (req, res) => {
  try {
    await loadGTFS()
    const stopIds = (req.query.id || '').split(',').filter(Boolean)
    if (stopIds.length === 0) return res.json({ routes: [], stopName: 'Unknown' })
    // Union of routes across all provided stop IDs
    const routeSet = new Set()
    for (const sid of stopIds) {
      const entries = scheduleByStop[sid] || []
      entries.forEach(e => routeSet.add(e.route))
    }
    const routes = [...routeSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const stopName = stopNamesMap[stopIds[0]] || stopIds[0]
    res.json({ routes, stopName })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Search bus stops by name — returns matching stops across all routes (deduplicated)
// For multi-platform stops (like PABT), consolidates all platform IDs into a single result.
app.get('/api/bus/stop-search', async (req, res) => {
  try {
    await loadGTFS()
    const q = safeString(req.query.q, 50).toLowerCase()
    if (q.length < 2) return res.json({ stops: [] })

    // Optional route filter (e.g. ?routes=HBLR)
    const routeFilter = req.query.routes ? req.query.routes.split(',').filter(Boolean) : null

    const byName = new Map()
    for (const [stopId, name] of Object.entries(stopNamesMap)) {
      if (!name.toLowerCase().includes(q)) continue
      // Only include stops that have schedule data (i.e., are actually served)
      if (!scheduleByStop[stopId]) continue
      // If route filter specified, only include stops that serve those routes
      if (routeFilter) {
        const stopRoutes = new Set((scheduleByStop[stopId] || []).map(e => e.route))
        if (!routeFilter.some(r => stopRoutes.has(r))) continue
      }
      if (!byName.has(name)) byName.set(name, { ids: [], name })
      byName.get(name).ids.push(stopId)
    }
    const stops = [...byName.values()]
      .map(s => ({ id: s.ids.join(','), name: s.name, ids: s.ids }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30)
    res.json({ stops })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Bus stop directions — for stops with multiple physical IDs (different directions at same intersection)
// Returns which direction each stop ID serves, based on direction_id from GTFS trips
app.get('/api/bus/stop-directions', async (req, res) => {
  try {
    await loadGTFS()
    const stopIds = (req.query.ids || '').split(',').filter(Boolean)
    const routes = (req.query.routes || '').split(',').filter(Boolean)
    if (stopIds.length <= 1 || routes.length === 0) return res.json({ directions: [], needsPicker: false })

    // For each stop ID, determine its primary direction by looking at headsigns
    const directionsByStop = {}
    for (const sid of stopIds) {
      const entries = scheduleByStop[sid] || []
      const headsigns = new Set()
      for (const e of entries) {
        if (routes.length > 0 && !routes.includes(e.route)) continue
        const hs = tripHeadsignMap[e.tripId] || ''
        if (hs) headsigns.add(hs)
        // Use direction_id to determine inbound/outbound
        const dir = tripDirectionMap[e.tripId]
        if (!directionsByStop[sid]) directionsByStop[sid] = { dirs: new Set(), headsigns: new Set() }
        if (dir) directionsByStop[sid].dirs.add(dir)
        if (hs) directionsByStop[sid].headsigns.add(hs)
      }
    }

    // Build direction options — group stop IDs by their direction_id
    const dir0Stops = []
    const dir1Stops = []
    for (const [sid, info] of Object.entries(directionsByStop)) {
      if (info.dirs.has('0') && !info.dirs.has('1')) dir0Stops.push(sid)
      else if (info.dirs.has('1') && !info.dirs.has('0')) dir1Stops.push(sid)
      else { dir0Stops.push(sid); dir1Stops.push(sid) } // serves both — include in both
    }

    // Determine labels from headsigns
    const getLabel = (stops) => {
      for (const sid of stops) {
        const info = directionsByStop[sid]
        if (info?.headsigns.size > 0) {
          const hs = [...info.headsigns][0].replace(/^\d+[A-Z]?\s+/, '')
          if (hs.toUpperCase().includes('NEW YORK')) return 'To NYC'
          return `To ${hs.split(' ')[0]}`
        }
      }
      return 'Unknown'
    }

    const directions = []
    if (dir0Stops.length > 0) directions.push({ label: getLabel(dir0Stops), stopIds: dir0Stops.join(','), dirId: '0' })
    if (dir1Stops.length > 0 && dir1Stops.join(',') !== dir0Stops.join(',')) {
      directions.push({ label: getLabel(dir1Stops), stopIds: dir1Stops.join(','), dirId: '1' })
    }

    // Only show picker if there are genuinely different directions
    const needsPicker = directions.length > 1
    if (needsPicker) directions.push({ label: 'Both directions', stopIds: stopIds.join(','), dirId: 'all' })

    res.json({ directions, needsPicker })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Headsign variants at a stop — returns distinct headsigns for given routes at given stop IDs
// Used by the mobile picker to let users choose between e.g. "126 via Willow" vs "126 via Washington"
app.get('/api/bus/stop-headsigns', async (req, res) => {
  try {
    await loadGTFS()
    const stopIds = (req.query.ids || '').split(',').filter(Boolean)
    const routes = (req.query.routes || '').split(',').filter(Boolean)
    if (stopIds.length === 0 || routes.length === 0) return res.json({ variants: [] })

    // Collect unique headsigns from schedule data for these stops + routes
    const headsignSet = new Map() // headsign → { routes, keyword }
    for (const sid of stopIds) {
      const entries = scheduleByStop[sid] || []
      for (const e of entries) {
        if (!routes.includes(e.route)) continue
        const hs = tripHeadsignMap[e.tripId] || ''
        if (!hs) continue
        const variant = parseVariant(hs)
        const key = `${e.route}:${variant || hs}`
        if (!headsignSet.has(key)) {
          headsignSet.set(key, { route: e.route, headsign: hs, variant: variant || hs, keyword: extractHeadsignKeyword(hs) })
        }
      }
    }

    const variants = [...headsignSet.values()]
    // Check if this is PABT — include gate info per variant and filter out inbound arrivals
    const isPabt = isPabtStop(stopIds)
    if (isPabt) {
      // At PABT, headsigns ending in "NEW YORK" are inbound arrivals — filter them out
      const filtered = variants.filter(v => {
        const dest = (v.headsign || '').toUpperCase()
        const destPart = dest.replace(/^\d+[A-Z]?\s+/, '')
        return !destPart.startsWith('NEW YORK')
      })
      variants.length = 0
      variants.push(...filtered)

      // Special case: route 126 has known variants with different gates and stop IDs
      // The static GTFS doesn't distinguish them well, so inject the known config
      const has126 = routes.includes('126')
      if (has126) {
        // Remove any auto-detected 126 variants and replace with known ones
        const non126 = variants.filter(v => v.route !== '126')
        variants.length = 0
        variants.push(...non126)
        variants.push({
          route: '126', headsign: '126 HOBOKEN VIA WILLOW AVE', variant: 'via Willow',
          keyword: 'WILLOW,HAMILTON PK VIA WILLOW', gate: '214',
          gateSchedule: { day: '214', late: '323', overnight: '79' },
          stopIds: [...PABT_STOP_IDS].join(','), // all PABT platforms — headsign filter narrows
        })
        variants.push({
          route: '126', headsign: '126 HOBOKEN VIA WASHINGTON', variant: 'via Washington',
          keyword: 'PATH,HAMILTON PK VIA HOBOKEN,HOBOKEN-PATH', gate: '213',
          gateSchedule: { day: '213', late: '323', overnight: '79' },
          stopIds: [...PABT_STOP_IDS].join(','), // all PABT platforms — headsign filter narrows
        })
      }

      // For non-126 routes, add gate info normally
      for (const v of variants) {
        if (v.gate) continue // already set (126 special case)
        const gateData = getPabtGateForRoutes([v.route])
        if (gateData) {
          v.gate = getCurrentGate(gateData)
          v.gateSchedule = gateData
        }
      }
    }

    res.json({ variants, isPabt })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Dynamic stop query — accepts comma-separated GTFS stop IDs and optional route filter
app.get('/api/bus/stops', async (req, res) => {
  try {
    await loadGTFS()
    let stopIds = (req.query.ids || '').split(',').filter(Boolean)
    if (stopIds.length === 0) return res.json({ buses: [], stop: 'Unknown' })

    // PABT resilience: if any provided stop ID is a known PABT platform,
    // replace with ALL current PABT stop IDs. This ensures the query works
    // even if NJT renumbers platform IDs in a GTFS update.
    if (stopIds.some(id => PABT_STOP_IDS.has(id))) {
      stopIds = [...PABT_STOP_IDS]
    }

    // Optional route filter (e.g. ?routes=126,22)
    const routeFilter = req.query.routes ? req.query.routes.split(',').filter(Boolean) : null
    // Optional headsign filter (e.g. ?headsigns=WILLOW,HAMILTON+PK or semicolons for multi-variant: WILLOW;PATH)
    // Supports both comma (keywords within variant) and semicolons (between variant groups)
    const headsignFilter = req.query.headsigns ? req.query.headsigns.split(/[,;]/).filter(Boolean).map(h => h.toUpperCase()) : null

    let buses = await getRealtimeBuses(stopIds, 6, routeFilter, headsignFilter)
    if (buses.length === 0) buses = getScheduleFallback(stopIds, 6, routeFilter, headsignFilter)

    // Add variant and headsign info if missing.
    // Realtime buses already have a live-derived headsign (from the trip's terminal stop);
    // don't override it with the unreliable static GTFS trip→headsign mapping.
    buses = buses.map(b => {
      if (!b._liveHeadsign) {
        if (!b.variant && b.tripId) b.variant = parseVariant(tripHeadsignMap[b.tripId])
        if (!b.headsign && b.tripId) b.headsign = tripHeadsignMap[b.tripId] || ''
      }
      return b
    })

    // Apply headsign filter if provided
    if (headsignFilter) {
      buses = buses.filter(b => {
        const hs = (b.headsign || '').toUpperCase()
        return headsignFilter.some(kw => hs.includes(kw))
      })
    }

    // PABT direction filter: at PABT, only show departures (direction_id=0 = outbound from NYC)
    // This filters out buses that are arriving at PABT (inbound to NYC)
    const isPabt = isPabtStop(stopIds)
    if (isPabt && !headsignFilter) {
      // Only apply auto-filter when no explicit headsign filter is set
      // (headsign filter already handles the 126 Willow/Washington case)
      buses = buses.filter(b => {
        if (!b.tripId) return true
        const dir = tripDirectionMap[b.tripId]
        // direction_id=0 is typically outbound from PABT (departures to NJ)
        // Keep buses with direction 0, or unknown direction
        return dir === '0' || dir === undefined
      })
    }

    // Get stop name from first ID
    const stopName = stopNamesMap[stopIds[0]] || 'Unknown Stop'

    // Check if this is a PABT stop and include gate info
    let gate = null, gateSchedule = null
    if (isPabt && routeFilter && routeFilter.length === 1) {
      // Special case: route 126 gate depends on headsign filter
      if (routeFilter[0] === '126' && headsignFilter) {
        const hasWillow = headsignFilter.some(h => h.includes('WILLOW'))
        if (hasWillow) {
          gate = '214'
          gateSchedule = { day: '214', late: '323', overnight: '79' }
        } else {
          gate = '213'
          gateSchedule = { day: '213', late: '323', overnight: '79' }
        }
      } else {
        const pabtGateData = getPabtGateForRoutes(routeFilter)
        if (pabtGateData) {
          gate = getCurrentGate(pabtGateData)
          gateSchedule = pabtGateData
        }
      }
    }

    // Service time notice for limited-service routes (hardcoded for now)
    // TODO: derive dynamically from GTFS stop_times operating windows
    let serviceNote = null
    if (routeFilter && routeFilter.includes('126')) {
      const stopName126 = (stopNamesMap[stopIds[0]] || '').toUpperCase()
      if (stopName126.includes('CLINTON')) {
        serviceNote = 'Weekdays only · AM 5:40–9:45 · PM 4:09–8:29'
      }
      if (isPabt && headsignFilter && headsignFilter.some(h => h.includes('WILLOW'))) {
        serviceNote = 'Weekdays only · AM/PM peak hours'
      }
    }

    res.json({ stop: stopName, buses, gate, gateSchedule, isPabt, serviceNote, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[API]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/bus', async (req, res) => {
  try {
    await loadGTFS()
    const dir = getDir(req)
    const config = DIRECTIONS[dir]
    const result = {}

    for (const [key, group] of Object.entries(config.busStops)) {
      let buses = await getRealtimeBuses(group.stopIds, 6, group.filterRoutes || null, group.filterHeadsigns || null, group.excludeHeadsigns || null)
      if (buses.length === 0) buses = getScheduleFallback(group.stopIds, 6, group.filterRoutes || null, group.filterHeadsigns || null, group.excludeHeadsigns || null)
      // Add variant info from headsign
      buses = buses.map(b => {
        if (!b.variant && b.tripId) {
          b.variant = parseVariant(tripHeadsignMap[b.tripId])
        }
        return b
      })
      result[key] = {
        stop: group.name,
        gate: getCurrentGate(group.gate),
        gateSchedule: group.gate || null,
        buses,
        serviceNote: group.serviceNote,
      }
    }

    const alerts = await fetchBusAlerts()
    res.json({ stops: result, stopOrder: config.busStopOrder, alerts, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[API]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Bus alerts endpoint — returns just the alerts for mobile consumption
app.get('/api/bus/alerts', async (req, res) => {
  try {
    const alerts = await fetchBusAlerts()
    res.json({ alerts, timestamp: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// PATH
// ══════════════════════════════════════════════════════════

const PATH_GTFSRT_URL = 'https://path.transitdata.nyc/gtfsrt'
const PATH_ALERTS_URL = 'https://www.panynj.gov/bin/portauthority/alerts?agency=PATH'

let pathCache = null, pathCacheTime = 0
let pathAlertCache = null, pathAlertCacheTime = 0
const PATH_CACHE_TTL = 15_000
const PATH_ALERT_CACHE_TTL = 120_000

async function fetchPathFeed() {
  if (pathCache && Date.now() - pathCacheTime < PATH_CACHE_TTL) return pathCache
  const resp = await fetch(PATH_GTFSRT_URL)
  const buf = Buffer.from(await resp.arrayBuffer())
  pathCache = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf)
  pathCacheTime = Date.now()
  return pathCache
}

async function fetchPathAlerts() {
  if (pathAlertCache && Date.now() - pathAlertCacheTime < PATH_ALERT_CACHE_TTL) return pathAlertCache
  const res = await fetch(PATH_ALERTS_URL, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'MyStopNow/1.0', 'Referer': 'https://www.panynj.gov/path/en/alerts.html' },
  })
  const data = await res.json()
  const disruptions = data.filter(a => {
    const tmpl = (a.TemplateName || '').toLowerCase()
    const msg = (a.SentMessage || '').toLowerCase()
    if (tmpl.includes('elevator') || tmpl.includes('escalator')) return false
    return msg.includes('33') || msg.includes('hoboken') || msg.includes('hob-')
      || tmpl.includes('33') || tmpl.includes('hoboken')
  })
  // Extract timestamp from PATH alert if available (SendDate field)
  let alertStartedAt = null
  if (disruptions.length > 0 && disruptions[0].SendDate) {
    alertStartedAt = new Date(disruptions[0].SendDate).getTime() || null
  }
  pathAlertCache = disruptions.length > 0 ? { text: disruptions[0].SentMessage, startedAt: alertStartedAt } : null
  pathAlertCacheTime = Date.now()
  return pathAlertCache
}

// PATH alerts endpoint — returns just the alert text + timestamp for mobile
app.get('/api/path/alerts', async (req, res) => {
  try {
    const pathAlert = await fetchPathAlerts()
    res.json({ alert: pathAlert?.text || null, startedAt: pathAlert?.startedAt || null })
  } catch {
    res.json({ alert: null })
  }
})

app.get('/api/path/gtfsrt', async (req, res) => {
  try {
    const dir = getDir(req)
    const config = DIRECTIONS[dir]
    const feed = await fetchPathFeed()
    const now = Date.now() / 1000

    const departures = []
    for (const pathLine of config.path) {
      for (const entity of feed.entity) {
        const tu = entity.tripUpdate
        if (!tu) continue
        if (tu.trip?.routeId !== pathLine.routeId) continue
        if (tu.trip?.directionId !== pathLine.directionId) continue
        // Feed only reports next stop per train — take the earliest time from any stop
        let earliest = null
        for (const stu of tu.stopTimeUpdate) {
          const t = (stu.departure?.time?.low || stu.departure?.time || 0) || (stu.arrival?.time?.low || stu.arrival?.time || 0)
          if (t && t > now && (earliest === null || t < earliest)) earliest = t
        }
        if (earliest !== null) {
          const d = new Date(earliest * 1000)
          departures.push({
            dest: pathLine.dest,
            eta: Math.round((earliest - now) / 60),
            etaTime: formatTimeFromDate(d),
            source: 'realtime',
          })
        }
      }
    }

    departures.sort((a, b) => a.eta - b.eta)
    const pathAlert = await fetchPathAlerts()
    res.json({ departures: departures.slice(0, 4), alert: pathAlert?.text || null, alertStartedAt: pathAlert?.startedAt || null, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[PATH]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Dynamic PATH query — accepts route, direction, stop as query params
const PATH_STATION_NAMES = {
  '26722': 'Newark', '26723': 'Harrison', '26724': 'Journal Square',
  '26725': 'Grove St', '26726': 'Exchange Place', '26727': 'Christopher St',
  '26728': 'Newport', '26729': 'Hoboken', '26730': 'World Trade Center',
  '26731': '9th St', '26732': '14th St', '26733': '23rd St', '26734': '33rd St',
}
const PATH_ROUTE_NAMES = { '859': 'NWK-WTC', '860': 'HOB-WTC', '861': 'JSQ-33', '862': 'HOB-33', '1024': 'JSQ-33' }

// Which routes serve each PATH station (weekday daytime service)
// NWK-WTC (859): Newark → Harrison → Journal Sq → Grove St → Exchange Pl → WTC
// HOB-WTC (860): Hoboken → Newport → Exchange Pl → WTC
// JSQ-33  (861): Journal Sq → Grove St → Exchange Pl → Newport → Christopher → 9th → 14th → 23rd → 33rd
// HOB-33  (862): Hoboken → Christopher → 9th → 14th → 23rd → 33rd
// Weeknights/holidays: HOB-33 and HOB-WTC merge into JSQ-33 via Hoboken
// JSQ-33 weekend (1024): same as 861 but runs via Hoboken — replaces 861 on weekends/holidays
const PATH_STATION_ROUTES = {
  '26722': ['859'],                      // Newark — NWK-WTC
  '26723': ['859'],                      // Harrison — NWK-WTC
  '26724': ['859', '861', '1024'],       // Journal Square — NWK-WTC, JSQ-33
  '26725': ['859', '861', '1024'],       // Grove St — NWK-WTC, JSQ-33
  '26726': ['859', '860', '861', '1024'],// Exchange Place — NWK-WTC, HOB-WTC, JSQ-33
  '26727': ['861', '862', '1024'],       // Christopher St — JSQ-33, HOB-33
  '26728': ['860', '861', '1024'],       // Newport — HOB-WTC, JSQ-33
  '26729': ['860', '862', '1024'],       // Hoboken — HOB-WTC, HOB-33, JSQ-33 wknd
  '26730': ['859', '860'],               // World Trade Center — NWK-WTC, HOB-WTC
  '26731': ['861', '862', '1024'],       // 9th St — JSQ-33, HOB-33
  '26732': ['861', '862', '1024'],       // 14th St — JSQ-33, HOB-33
  '26733': ['861', '862', '1024'],       // 23rd St — JSQ-33, HOB-33
  '26734': ['861', '862', '1024'],       // 33rd St — JSQ-33, HOB-33
}

// PATH direction labels by route
const PATH_DIR_LABELS = {
  '859': { '1': 'To WTC', '0': 'To Newark' },
  '860': { '1': 'To WTC', '0': 'To Hoboken' },
  '861': { '1': 'To 33rd St', '0': 'To Journal Sq' },
  '862': { '1': 'To 33rd St', '0': 'To Hoboken' },
  '1024': { '1': 'To 33rd St', '0': 'To Hoboken' }, // weekend JSQ-33 via Hoboken
}

// Terminal stations where only one direction makes sense
const PATH_TERMINAL_DIRS = {
  '26722': { '859': '1' },                           // Newark → only To WTC
  '26729': { '860': '1', '862': '1', '1024': '1' },  // Hoboken → only outbound
  '26730': { '859': '0', '860': '0' },               // WTC → only outbound
  '26734': { '861': '0', '862': '0', '1024': '0' },  // 33rd St → only outbound
}

// PATH stations list endpoint
app.get('/api/path/stations', (req, res) => {
  const q = (req.query.q || '').toLowerCase()
  // Build unique station list (26733 and 26734 are both "33rd St" — deduplicate)
  const seen = new Map()
  for (const [id, name] of Object.entries(PATH_STATION_NAMES)) {
    if (q && !name.toLowerCase().includes(q)) continue
    if (!seen.has(name)) seen.set(name, { id, name, ids: [id] })
    else seen.get(name).ids.push(id)
  }
  const stations = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  res.json({ stations })
})

// Routes at a PATH station — returns deduplicated direction options
app.get('/api/path/station-routes', (req, res) => {
  const id = req.query.id
  if (!id) return res.json({ options: [], stationName: 'Unknown' })
  const stationName = PATH_STATION_NAMES[id] || id
  const routeIds = PATH_STATION_ROUTES[id] || []
  const terminalDirs = PATH_TERMINAL_DIRS[id]

  // Collect all direction options, deduplicating by direction label
  // e.g. "To 33rd St" from JSQ-33 and HOB-33 become one option
  const dirOptions = new Map() // label → { dirId, routeIds[], routeNames[] }
  for (const rid of routeIds) {
    const allDirs = PATH_DIR_LABELS[rid] || { '0': 'Direction 0', '1': 'Direction 1' }
    for (const [dirId, label] of Object.entries(allDirs)) {
      // Skip invalid directions at terminal stations
      if (terminalDirs && terminalDirs[rid] && terminalDirs[rid] !== dirId) continue
      if (!dirOptions.has(label)) {
        dirOptions.set(label, { dirId, label, routeIds: [rid], routeNames: [PATH_ROUTE_NAMES[rid] || rid] })
      } else {
        const opt = dirOptions.get(label)
        if (!opt.routeIds.includes(rid)) {
          opt.routeIds.push(rid)
          opt.routeNames.push(PATH_ROUTE_NAMES[rid] || rid)
        }
      }
    }
  }
  const options = [...dirOptions.values()]
  res.json({ options, stationName })
})

app.get('/api/path/query', async (req, res) => {
  try {
    const { route, direction, stop } = req.query
    if (!route || !stop) return res.json({ departures: [], alert: null })

    const feed = await fetchPathFeed()
    const now = Date.now() / 1000
    const dirId = parseInt(direction) || 0
    const stopName = PATH_STATION_NAMES[stop] || stop
    // Support comma-separated route IDs (e.g. "861,862")
    const routeSet = new Set(route.split(',').filter(Boolean))

    const departures = []
    for (const entity of feed.entity) {
      const tu = entity.tripUpdate
      if (!tu) continue
      if (!routeSet.has(tu.trip?.routeId)) continue
      if (tu.trip?.directionId !== dirId) continue
      // Feed only reports next stop — take earliest time from any stop in the update
      let earliest = null
      for (const stu of tu.stopTimeUpdate) {
        const t = (stu.departure?.time?.low || stu.departure?.time || 0) || (stu.arrival?.time?.low || stu.arrival?.time || 0)
        if (t && t > now && (earliest === null || t < earliest)) earliest = t
      }
      if (earliest !== null) {
        const d = new Date(earliest * 1000)
        const thisRoute = PATH_ROUTE_NAMES[tu.trip.routeId] || tu.trip.routeId
        departures.push({
          dest: `${stopName} (${thisRoute})`,
          eta: Math.round((earliest - now) / 60),
          etaTime: formatTimeFromDate(d),
          source: 'realtime',
        })
      }
    }

    departures.sort((a, b) => a.eta - b.eta)
    const pathAlert = await fetchPathAlerts()
    res.json({ departures: departures.slice(0, 6), alert: pathAlert?.text || null, alertStartedAt: pathAlert?.startedAt || null, stationName: stopName, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[PATH]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// Ferry
// ══════════════════════════════════════════════════════════

const FERRY_API_KEY = 'EFD912BD775313FED5D8791D11365'
const FERRY_BASE_URL = 'https://api-eta.connexionz.net/api/cnxlegacy/stet/nywaterway.connexionz.net'

// All known NY Waterway ferry terminals with Connexionz stop tags
const FERRY_TERMINALS = [
  { tag: '4',  name: 'Brookfield Place' },
  { tag: '5',  name: 'Edgewater Ferry Landing' },
  { tag: '8',  name: 'Haverstraw' },
  { tag: '9',  name: 'Hoboken 14th Street' },
  { tag: '10', name: 'Hoboken / NJ Transit Terminal' },
  { tag: '11', name: 'Port Imperial / Weehawken' },
  { tag: '12', name: 'Liberty Harbor / Marin Blvd.' },
  { tag: '13', name: 'Lincoln Harbor' },
  { tag: '14', name: 'Midtown / W. 39th St.' },
  { tag: '16', name: 'Ossining' },
  { tag: '17', name: 'Paulus Hook / Jersey City' },
  { tag: '18', name: 'Pier 11 / Wall St.' },
  { tag: '20', name: 'Port Liberté' },
  { tag: '30', name: 'South Amboy' },
]

let ferryCaches = {} // keyed by stopTag
const FERRY_CACHE_TTL = 30_000

async function fetchFerryData(stopTag) {
  const cached = ferryCaches[stopTag]
  if (cached && Date.now() - cached.time < FERRY_CACHE_TTL) return cached.data

  const resp = await fetch(`${FERRY_BASE_URL}/${stopTag}`, {
    headers: {
      'accept': '*/*', 'apikey': FERRY_API_KEY,
      'content-type': 'application/json;charset=utf-8',
      'origin': 'https://etacloud.connexionz.net',
      'referer': 'https://etacloud.connexionz.net/',
      'user-agent': 'MyStopNow/1.0',
    },
  })
  const data = await resp.json()
  ferryCaches[stopTag] = { data, time: Date.now() }
  return data
}

app.get('/api/ferry', async (req, res) => {
  try {
    const dir = getDir(req)
    const config = DIRECTIONS[dir].ferry
    const data = await fetchFerryData(config.stopTag)

    const departures = []
    const platform = data.platforms?.[0]
    if (platform) {
      for (const route of platform.routes || []) {
        if (route.no !== config.routeNo) continue
        for (const dest of route.destinations || []) {
          if (!dest.name?.toLowerCase().includes(config.destMatch.toLowerCase())) continue
          for (const trip of dest.trips || []) {
            let etaMin, source, etaTimeStr
            if (trip.eta != null) {
              etaMin = trip.eta
              source = 'realtime'
              const d = new Date(Date.now() + trip.eta * 60_000)
              etaTimeStr = formatTimeFromDate(d)
            } else if (trip.scheduledMin != null) {
              const { totalMinutes: nowMin } = nowEastern()
              etaMin = trip.scheduledMin - nowMin
              if (etaMin <= 0) continue
              source = 'schedule'
              etaTimeStr = formatTime(Math.floor(trip.scheduledMin / 60), trip.scheduledMin % 60)
            } else continue

            if (etaMin > 0) {
              departures.push({ dest: config.dest, eta: etaMin, etaTime: etaTimeStr, source })
            }
          }
        }
      }
    }

    departures.sort((a, b) => a.eta - b.eta)
    const alerts = platform?.alerts || []
    const alertText = alerts.length > 0 ? alerts.map(a => a.text || a).join('; ') : null
    res.json({ departures: departures.slice(0, 4), alert: alertText, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[Ferry]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Dynamic ferry query — accepts stopTag and optional routeNo/destMatch
app.get('/api/ferry/query', async (req, res) => {
  try {
    const { stop, route, dest, routes } = req.query
    if (!stop) return res.json({ departures: [], alert: null })

    const data = await fetchFerryData(stop)
    const departures = []
    const platform = data.platforms?.[0]
    const platformName = platform?.name || 'Unknown'

    // Parse multi-route filter: routes=18:Midtown,12:Brookfield
    let routeFilters = null
    if (routes) {
      routeFilters = routes.split(',').map(pair => {
        const colonIdx = pair.indexOf(':')
        if (colonIdx < 1) return null
        return { no: pair.slice(0, colonIdx), dest: pair.slice(colonIdx + 1) }
      }).filter(Boolean).slice(0, 10)
    }

    if (platform) {
      for (const r of platform.routes || []) {
        // Apply route filtering
        if (routeFilters) {
          // Multi-route mode: check if this route matches any filter
          const matchingFilters = routeFilters.filter(f => f.no === r.no)
          if (matchingFilters.length === 0) continue
          for (const d of r.destinations || []) {
            const destMatches = matchingFilters.some(f => !f.dest || d.name?.toLowerCase().includes(f.dest.toLowerCase()))
            if (!destMatches) continue
            for (const trip of d.trips || []) {
              let etaMin, source, etaTimeStr
              if (trip.eta != null) {
                etaMin = trip.eta
                source = 'realtime'
                const dt = new Date(Date.now() + trip.eta * 60_000)
                etaTimeStr = formatTimeFromDate(dt)
              } else if (trip.scheduledMin != null) {
                const { totalMinutes: nowMin } = nowEastern()
                etaMin = trip.scheduledMin - nowMin
                if (etaMin <= 0) continue
                source = 'schedule'
                etaTimeStr = formatTime(Math.floor(trip.scheduledMin / 60), trip.scheduledMin % 60)
              } else continue
              if (etaMin > 0) {
                departures.push({ dest: `${platformName} → ${d.name}`, eta: etaMin, etaTime: etaTimeStr, source })
              }
            }
          }
        } else {
          // Legacy single-route mode or unfiltered
          if (route && r.no !== route) continue
          for (const d of r.destinations || []) {
            if (dest && !d.name?.toLowerCase().includes(dest.toLowerCase())) continue
            for (const trip of d.trips || []) {
              let etaMin, source, etaTimeStr
              if (trip.eta != null) {
                etaMin = trip.eta
                source = 'realtime'
                const dt = new Date(Date.now() + trip.eta * 60_000)
                etaTimeStr = formatTimeFromDate(dt)
              } else if (trip.scheduledMin != null) {
                const { totalMinutes: nowMin } = nowEastern()
                etaMin = trip.scheduledMin - nowMin
                if (etaMin <= 0) continue
                source = 'schedule'
                etaTimeStr = formatTime(Math.floor(trip.scheduledMin / 60), trip.scheduledMin % 60)
              } else continue
              if (etaMin > 0) {
                departures.push({ dest: `${platformName} → ${d.name}`, eta: etaMin, etaTime: etaTimeStr, source })
              }
            }
          }
        }
      }
    }

    departures.sort((a, b) => a.eta - b.eta)
    const alerts = platform?.alerts || []
    const alertText = alerts.length > 0 ? alerts.map(a => a.text || a).join('; ') : null
    res.json({ departures: departures.slice(0, 6), alert: alertText, platformName, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[Ferry]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Ferry alerts endpoint — returns alert text (no structured timestamp available from Connexionz)
app.get('/api/ferry/alerts', async (req, res) => {
  try {
    const data = await fetchFerryData('hoboken_14')
    const platform = data?.platforms?.[0]
    const alerts = platform?.alerts || []
    const alertText = alerts.length > 0 ? alerts.map(a => a.text || a).join('; ') : null
    res.json({ alert: alertText })
  } catch {
    res.json({ alert: null })
  }
})

// Ferry terminals list — returns all known terminals for the picker
app.get('/api/ferry/terminals', (req, res) => {
  const q = (req.query.q || '').toLowerCase()
  const filtered = q
    ? FERRY_TERMINALS.filter(t => t.name.toLowerCase().includes(q))
    : FERRY_TERMINALS
  res.json({ terminals: filtered })
})

// Routes at a ferry terminal — fetches live data to get current routes
app.get('/api/ferry/terminal-routes', async (req, res) => {
  try {
    const tag = req.query.tag
    if (!tag) return res.json({ routes: [], terminalName: 'Unknown' })
    const data = await fetchFerryData(tag)
    const platform = data.platforms?.[0]
    const terminalName = platform?.name || FERRY_TERMINALS.find(t => t.tag === tag)?.name || 'Unknown'
    const routes = (platform?.routes || []).map(r => ({
      no: r.no,
      name: r.name,
      destinations: (r.destinations || []).map(d => d.name),
    }))
    res.json({ routes, terminalName })
  } catch (err) {
    console.error('[Ferry] Terminal routes error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// MTA (Subway, LIRR, Metro-North)
// ══════════════════════════════════════════════════════════

const MTA_BASE = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds'
const MTA_FEEDS = {
  '1':  'nyct%2Fgtfs',     '2':  'nyct%2Fgtfs',     '3':  'nyct%2Fgtfs',
  '4':  'nyct%2Fgtfs',     '5':  'nyct%2Fgtfs',     '6':  'nyct%2Fgtfs',
  '6X': 'nyct%2Fgtfs',     '7':  'nyct%2Fgtfs',     '7X': 'nyct%2Fgtfs',
  'GS': 'nyct%2Fgtfs',
  'A':  'nyct%2Fgtfs-ace', 'C':  'nyct%2Fgtfs-ace', 'E':  'nyct%2Fgtfs-ace',
  'B':  'nyct%2Fgtfs-bdfm','D':  'nyct%2Fgtfs-bdfm','F':  'nyct%2Fgtfs-bdfm','M':  'nyct%2Fgtfs-bdfm',
  'G':  'nyct%2Fgtfs-g',
  'J':  'nyct%2Fgtfs-jz',  'Z':  'nyct%2Fgtfs-jz',
  'N':  'nyct%2Fgtfs-nqrw','Q':  'nyct%2Fgtfs-nqrw','R':  'nyct%2Fgtfs-nqrw','W':  'nyct%2Fgtfs-nqrw',
  'L':  'nyct%2Fgtfs-l',
  'SI': 'nyct%2Fgtfs-si',
  'LIRR': 'lirr%2Fgtfs-lirr',
  'MNR':  'mnr%2Fgtfs-mnr',
}

let mtaFeedCaches = {} // keyed by feed URL suffix
const MTA_CACHE_TTL = 30_000

async function fetchMtaFeed(feedSuffix) {
  const cached = mtaFeedCaches[feedSuffix]
  if (cached && Date.now() - cached.time < MTA_CACHE_TTL) return cached.data
  const resp = await fetch(`${MTA_BASE}/${feedSuffix}`)
  const buf = Buffer.from(await resp.arrayBuffer())
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf)
  mtaFeedCaches[feedSuffix] = { data: feed, time: Date.now() }
  return feed
}

// MTA subway alerts
const MTA_ALERTS_FEED = 'camsys%2Fsubway-alerts'
let mtaAlertCache = null, mtaAlertCacheTime = 0
const MTA_ALERT_CACHE_TTL = 120_000 // 2 minutes

async function fetchMtaAlerts() {
  if (mtaAlertCache && Date.now() - mtaAlertCacheTime < MTA_ALERT_CACHE_TTL) return mtaAlertCache
  try {
    const resp = await fetch(`${MTA_BASE}/${MTA_ALERTS_FEED}`)
    const buf = Buffer.from(await resp.arrayBuffer())
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf)
    const alerts = []
    for (const entity of feed.entity) {
      const a = entity.alert
      if (!a) continue
      const routes = new Set()
      for (const ie of (a.informedEntity || [])) {
        if (ie.routeId) routes.add(ie.routeId)
      }
      if (routes.size === 0) continue
      const text = a.headerText?.translation?.[0]?.text || a.descriptionText?.translation?.[0]?.text || ''
      if (!text) continue
      // Extract active_period start timestamp (Unix seconds)
      const startEpoch = a.activePeriod?.[0]?.start
      const startedAt = startEpoch ? Number(startEpoch) * 1000 : null
      alerts.push({ routes: [...routes], text: text.slice(0, 200), startedAt })
    }
    mtaAlertCache = alerts
    mtaAlertCacheTime = Date.now()
    console.log('[MTA] Fetched', alerts.length, 'subway alerts')
    return alerts
  } catch (err) {
    console.error('[MTA] Alerts error:', err.message)
    return mtaAlertCache || []
  }
}

function getMtaAlertsForLines(allAlerts, lines) {
  if (!lines || lines.length === 0) return []
  const lineSet = new Set(lines)
  return allAlerts.filter(a => a.routes.some(r => lineSet.has(r)))
}

// MTA subway station list (loaded from GTFS static)
let mtaStationsCache = null
let mtaStationsCoordsCache = null // id → { lat, lon }
let lirrStationsCache = null
let mnrStationsCache = null

async function loadMtaStations() {
  if (mtaStationsCache) return mtaStationsCache
  try {
    // Reuse the cached subway zip (shared with build_station_routes.mjs) so
    // station IDs always match the routes cache. Refresh if older than 7 days.
    const SUBWAY_ZIP = path.join(GTFS_CACHE, 'gtfs_subway.zip')
    const ZIP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
    const needsDownload = !fs.existsSync(SUBWAY_ZIP) ||
      (Date.now() - fs.statSync(SUBWAY_ZIP).mtimeMs > ZIP_MAX_AGE_MS)

    let buf
    if (needsDownload) {
      console.log('[MTA] Downloading subway GTFS...')
      const resp = await fetch('https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      buf = Buffer.from(await resp.arrayBuffer())
      fs.mkdirSync(GTFS_CACHE, { recursive: true })
      fs.writeFileSync(SUBWAY_ZIP, buf)
    } else {
      buf = fs.readFileSync(SUBWAY_ZIP)
    }

    const zip = new AdmZip(buf)
    const lines = zip.readAsText('stops.txt').trim().split('\n')
    const header = lines[0].split(',')
    const idIdx = header.indexOf('stop_id')
    const nameIdx = header.indexOf('stop_name')
    const typeIdx = header.indexOf('location_type')
    const latIdx = header.indexOf('stop_lat')
    const lonIdx = header.indexOf('stop_lon')

    const stations = []
    const coords = {}
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      if (cols[typeIdx] === '1') {
        stations.push({ id: cols[idIdx], name: cols[nameIdx] })
        const lat = parseFloat(cols[latIdx])
        const lon = parseFloat(cols[lonIdx])
        if (!isNaN(lat) && !isNaN(lon)) {
          coords[cols[idIdx]] = { lat, lon }
        }
      }
    }
    stations.sort((a, b) => a.name.localeCompare(b.name))
    mtaStationsCache = stations
    mtaStationsCoordsCache = coords
    console.log('[MTA] Loaded', stations.length, 'subway stations with', Object.keys(coords).length, 'coordinates')
    return stations
  } catch (err) {
    console.error('[MTA] Failed to load stations:', err.message)
    return []
  }
}

// Parse GTFS stops.txt with quoted fields
function parseGtfsCsv(text) {
  const lines = text.trim().split('\n')
  const header = lines[0].replace(/"/g, '').split(',')
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].replace(/"/g, '').split(',')
    const row = {}
    header.forEach((h, idx) => row[h.trim()] = (vals[idx] || '').trim())
    rows.push(row)
  }
  return rows
}

async function loadLirrStations() {
  if (lirrStationsCache) return lirrStationsCache
  try {
    const resp = await fetch('https://rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip')
    const buf = Buffer.from(await resp.arrayBuffer())
    const zip = new AdmZip(buf)
    const stops = parseGtfsCsv(zip.readAsText('stops.txt'))
    const routes = parseGtfsCsv(zip.readAsText('routes.txt'))
    const routeMap = {}
    for (const r of routes) {
      routeMap[r.route_id] = { id: r.route_id, name: r.route_long_name, color: '#' + (r.route_color || '006EC7') }
    }
    // Build station-to-routes mapping from trips.txt + stop_times.txt
    const trips = parseGtfsCsv(zip.readAsText('trips.txt'))
    const tripRoutes = {}
    for (const t of trips) tripRoutes[t.trip_id] = t.route_id
    const stopTimes = parseGtfsCsv(zip.readAsText('stop_times.txt'))
    const stationRoutes = {} // stop_id → Set of route_ids
    for (const st of stopTimes) {
      const route = tripRoutes[st.trip_id]
      if (!route) continue
      if (!stationRoutes[st.stop_id]) stationRoutes[st.stop_id] = new Set()
      stationRoutes[st.stop_id].add(route)
    }
    lirrStationsCache = {
      stops: stops.map(s => ({ id: s.stop_id, name: s.stop_name })).sort((a, b) => a.name.localeCompare(b.name)),
      routes: routeMap,
      stationRoutes, // stop_id → Set of route_ids
    }
    console.log('[LIRR] Loaded', lirrStationsCache.stops.length, 'stations,', Object.keys(routeMap).length, 'routes')
    return lirrStationsCache
  } catch (err) {
    console.error('[LIRR] Failed to load:', err.message)
    return { stops: [], routes: {}, stationRoutes: {} }
  }
}

async function loadMnrStations() {
  if (mnrStationsCache) return mnrStationsCache
  try {
    const resp = await fetch('https://rrgtfsfeeds.s3.amazonaws.com/gtfsmnr.zip')
    const buf = Buffer.from(await resp.arrayBuffer())
    const zip = new AdmZip(buf)
    const stops = parseGtfsCsv(zip.readAsText('stops.txt'))
    const routes = parseGtfsCsv(zip.readAsText('routes.txt'))
    const routeMap = {}
    for (const r of routes) {
      routeMap[r.route_id] = { id: r.route_id, name: r.route_long_name, color: '#' + (r.route_color || '009B3A') }
    }
    // Build station-to-routes mapping from trips.txt + stop_times.txt
    const trips = parseGtfsCsv(zip.readAsText('trips.txt'))
    const tripRoutes = {}
    for (const t of trips) tripRoutes[t.trip_id] = t.route_id
    const stopTimes = parseGtfsCsv(zip.readAsText('stop_times.txt'))
    const stationRoutes = {}
    for (const st of stopTimes) {
      const route = tripRoutes[st.trip_id]
      if (!route) continue
      if (!stationRoutes[st.stop_id]) stationRoutes[st.stop_id] = new Set()
      stationRoutes[st.stop_id].add(route)
    }
    // Filter out non-public stops (yards, etc.)
    const publicStops = stops.filter(s => s.stop_url && s.stop_url.includes('mta.info'))
    mnrStationsCache = {
      stops: publicStops.map(s => ({ id: s.stop_id, name: s.stop_name })).sort((a, b) => a.name.localeCompare(b.name)),
      routes: routeMap,
      stationRoutes,
    }
    console.log('[MNR] Loaded', mnrStationsCache.stops.length, 'stations,', Object.keys(routeMap).length, 'routes')
    return mnrStationsCache
  } catch (err) {
    console.error('[MNR] Failed to load:', err.message)
    return { stops: [], routes: {}, stationRoutes: {} }
  }
}

app.get('/api/mta/stations', async (req, res) => {
  const stations = await loadMtaStations()
  const q = (req.query.q || '').toLowerCase()
  const filtered = q ? stations.filter(s => s.name.toLowerCase().includes(q)) : stations

  // Group stations by name, then split groups where stations are physically far apart
  // (same name but different locations = different stations, e.g. "72 St" on UES vs UWS)
  const routesMap = loadStationRoutes()
  const byName = {}
  for (const s of filtered) {
    if (!byName[s.name]) byName[s.name] = []
    byName[s.name].push(s)
  }

  const results = []
  for (const [name, group] of Object.entries(byName)) {
    if (group.length === 1) {
      // Single station — no disambiguation needed
      const s = group[0]
      const lines = (routesMap[s.id] || []).sort()
      results.push({ name, ids: [s.id], lines, linesLabel: '' })
    } else {
      // Multiple stations with same name — cluster by proximity
      // Stations within 0.15 miles are the same complex; farther apart are different stations
      const clusters = []
      const used = new Set()
      for (const s of group) {
        if (used.has(s.id)) continue
        used.add(s.id)
        const cluster = { ids: [s.id], lines: new Set(routesMap[s.id] || []) }
        const sCoords = mtaStationsCoordsCache?.[s.id]
        for (const other of group) {
          if (used.has(other.id)) continue
          const oCoords = mtaStationsCoordsCache?.[other.id]
          if (sCoords && oCoords) {
            const dist = haversineDistance(sCoords.lat, sCoords.lon, oCoords.lat, oCoords.lon)
            if (dist <= 0.15) {
              used.add(other.id)
              cluster.ids.push(other.id)
              ;(routesMap[other.id] || []).forEach(r => cluster.lines.add(r))
            }
          } else {
            // No coords — assume same complex (legacy behavior)
            used.add(other.id)
            cluster.ids.push(other.id)
            ;(routesMap[other.id] || []).forEach(r => cluster.lines.add(r))
          }
        }
        clusters.push(cluster)
      }

      if (clusters.length === 1) {
        // All stations are one complex — consolidate, no disambiguation
        const lines = [...clusters[0].lines].sort()
        results.push({ name, ids: clusters[0].ids, lines, linesLabel: '' })
      } else {
        // Multiple distinct stations — show lines for disambiguation
        for (const cluster of clusters) {
          const lines = [...cluster.lines].sort()
          results.push({ name, ids: cluster.ids, lines, linesLabel: lines.join(', ') })
        }
      }
    }
  }

  res.json({ stations: results.slice(0, 30) })
})

// Get lines serving a station — uses static GTFS mapping
let stationRoutesMap = null
let stationRoutesBuilding = false

function loadStationRoutes() {
  // Don't cache empty results — retry on every call until the file is ready
  if (stationRoutesMap && Object.keys(stationRoutesMap).length > 0) return stationRoutesMap
  try {
    const data = fs.readFileSync(path.join(__dirname, '..', '.cache', 'mta_station_routes.json'), 'utf8')
    const parsed = JSON.parse(data)
    if (Object.keys(parsed).length > 0) {
      stationRoutesMap = parsed
      stationRoutesBuilding = false
      console.log('[MTA] Loaded station routes for', Object.keys(stationRoutesMap).length, 'stations')
    } else {
      stationRoutesMap = {}
    }
  } catch {
    stationRoutesMap = {}
  }
  return stationRoutesMap
}

app.get('/api/mta/station-lines', async (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean)
  if (ids.length === 0) return res.json({ lines: [], building: false })

  const map = loadStationRoutes()
  // If the cache file hasn't been built yet, signal the frontend
  if (Object.keys(map).length === 0) {
    return res.json({ lines: [], building: stationRoutesBuilding })
  }
  const lines = new Set()
  for (const id of ids) {
    const routes = map[id]
    if (routes) routes.forEach(r => lines.add(r))
  }
  res.json({ lines: [...lines].sort(), building: false })
})

// Query MTA departures — accepts stop (base ID), direction (N/S/all), and optional lines filter
app.get('/api/mta/query', async (req, res) => {
  try {
    const { stop, lines: linesParam } = req.query
    if (!stop) return res.json({ departures: [], stationName: stop })

    // Parse stop param — can be comma-separated (e.g. "D17S,R17S" or "D17,R17")
    const stopParts = stop.split(',')
    const stopIds = new Set()
    for (const sp of stopParts) {
      const base = sp.replace(/[NS]$/, '')
      const dir = sp.match(/[NS]$/)?.[0]
      if (dir) {
        stopIds.add(sp)
      } else {
        stopIds.add(base + 'N')
        stopIds.add(base + 'S')
      }
    }

    // Filter by selected lines
    const selectedLines = linesParam ? new Set(linesParam.split(',')) : null

    const now = Date.now() / 1000
    const departures = []
    const checkedFeeds = new Set()

    for (const [, feedSuffix] of Object.entries(MTA_FEEDS)) {
      if (checkedFeeds.has(feedSuffix)) continue
      checkedFeeds.add(feedSuffix)
      try {
        const feed = await fetchMtaFeed(feedSuffix)
        for (const entity of feed.entity) {
          const tu = entity.tripUpdate
          if (!tu) continue
          const route = tu.trip?.routeId
          if (!route) continue
          if (selectedLines && !selectedLines.has(route)) continue
          for (const stu of tu.stopTimeUpdate) {
            if (!stopIds.has(stu.stopId)) continue
            const t = (stu.arrival?.time?.low || stu.arrival?.time || 0) || (stu.departure?.time?.low || stu.departure?.time || 0)
            if (t && t > now) {
              const d = new Date(t * 1000)
              const dir = stu.stopId.endsWith('N') ? 'Uptown' : stu.stopId.endsWith('S') ? 'Downtown' : ''
              departures.push({ dest: `${route} ${dir}`.trim(), route, eta: Math.round((t - now) / 60), etaTime: formatTimeFromDate(d), source: 'realtime' })
            }
          }
        }
      } catch { /* skip failed feeds */ }
    }

    departures.sort((a, b) => a.eta - b.eta)

    // Fetch alerts for the selected lines
    const allAlerts = await fetchMtaAlerts()
    const selectedLinesArr = selectedLines ? [...selectedLines] : []
    const lineAlerts = getMtaAlertsForLines(allAlerts, selectedLinesArr)
    const alertTexts = lineAlerts.map(a => {
      const linePrefix = a.routes.filter(r => !selectedLines || selectedLines.has(r)).join('/')
      return `[${linePrefix}] ${a.text}`
    })

    res.json({
      departures: departures.slice(0, 10),
      alerts: alertTexts.slice(0, 5),
      stationName: stop,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[MTA]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// NJT Rail (TrainData JSON API at raildata.njtransit.com)
// ══════════════════════════════════════════════════════════

const NJT_RAIL_API = 'https://raildata.njtransit.com/api/TrainData'
let railToken = null, railTokenExpiry = 0

async function getRailToken() {
  if (railToken && Date.now() < railTokenExpiry) return railToken
  const form = new FormData()
  form.append('username', NJT_USERNAME)
  form.append('password', NJT_PASSWORD)
  const res = await fetch(`${NJT_RAIL_API}/getToken`, { method: 'POST', body: form })
  const data = await res.json()
  if (data.Authenticated !== 'True') throw new Error('NJT Rail auth failed')
  railToken = data.UserToken
  railTokenExpiry = Date.now() + 20 * 60 * 60 * 1000 // 20h to be safe (24h actual)
  console.log('[NJT Rail] Authenticated, token cached')
  return railToken
}

// Station list cache
let railStationsCache = null

async function loadRailStations() {
  if (railStationsCache) return railStationsCache
  try {
    const token = await getRailToken()
    const form = new FormData()
    form.append('token', token)
    const res = await fetch(`${NJT_RAIL_API}/getStationList`, { method: 'POST', body: form })
    const data = await res.json()
    if (Array.isArray(data)) {
      railStationsCache = data.map(s => ({
        code: s.STATION_2CHAR,
        name: s.STATIONNAME,
        shortName: s.STATION_14CHAR,
        accessible: s.WHEELCHAIR_ACCESSIBLE === 'True',
      }))
      console.log('[NJT Rail] Loaded', railStationsCache.length, 'stations')
    }
    return railStationsCache || []
  } catch (err) {
    console.error('[NJT Rail] Station list error:', err.message)
    return railStationsCache || []
  }
}

// NJT Rail line codes and colors (from API appendix)
const NJT_RAIL_LINES = {
  'AC': { name: 'Atlantic City Line', abbr: 'ACRL', color: '#2E55A5' },
  'BC': { name: 'Bergen County Line', abbr: 'BERG', color: '#98A8BF' },
  'GS': { name: 'Gladstone Branch', abbr: 'M&E', color: '#A1D5AE' },
  'MC': { name: 'Montclair-Boonton Line', abbr: 'MOBO', color: '#C36366' },
  'ME': { name: 'Morris & Essex Line', abbr: 'M&E', color: '#00953B' },
  'ML': { name: 'Main Line', abbr: 'MAIN', color: '#F2B826' },
  'NC': { name: 'North Jersey Coast Line', abbr: 'NJCL', color: '#009CDB' },
  'NE': { name: 'Northeast Corridor Line', abbr: 'NEC', color: '#F7505E' },
  'PV': { name: 'Pascack Valley Line', abbr: 'PASC', color: '#A34F8B' },
  'PR': { name: 'Princeton Branch', abbr: 'PRIN', color: '#FF6319' },
  'RV': { name: 'Raritan Valley Line', abbr: 'RARV', color: '#FF993E' },
}

// Station search
app.get('/api/rail/stations', async (req, res) => {
  try {
    const stations = await loadRailStations()
    const q = (req.query.q || '').toLowerCase()
    const filtered = q ? stations.filter(s => s.name.toLowerCase().includes(q)) : stations
    res.json({ stations: filtered.slice(0, 30) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Lines at a station — queries next departures to find which lines serve it
let railStationLinesCache = {} // code → { lines, time }
const RAIL_STATION_LINES_TTL = 3600_000 // 1 hour

app.get('/api/rail/station-lines', async (req, res) => {
  try {
    const code = req.query.code
    if (!code) return res.json({ lines: [] })

    // Check cache
    const cached = railStationLinesCache[code]
    if (cached && Date.now() - cached.time < RAIL_STATION_LINES_TTL) {
      return res.json({ lines: cached.lines })
    }

    const token = await getRailToken()
    const form = new FormData()
    form.append('token', token)
    form.append('station', code)
    form.append('line', '')
    const resp = await fetch(`${NJT_RAIL_API}/getTrainSchedule19Rec`, { method: 'POST', body: form })
    const data = await resp.json()
    const items = data?.ITEMS || []
    const lineSet = new Map()
    for (const item of items) {
      if (item.LINECODE && NJT_RAIL_LINES[item.LINECODE]) {
        lineSet.set(item.LINECODE, {
          code: item.LINECODE,
          ...NJT_RAIL_LINES[item.LINECODE],
        })
      }
    }
    const lines = [...lineSet.values()].sort((a, b) => a.name.localeCompare(b.name))
    railStationLinesCache[code] = { lines, time: Date.now() }
    res.json({ lines })
  } catch (err) {
    console.error('[NJT Rail] Station lines error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Departures query — returns next departures filtered by line
app.get('/api/rail/query', strictLimiter, async (req, res) => {
  try {
    const { station, lines: linesParam } = req.query
    if (!station) return res.json({ departures: [], alerts: [], stationName: '' })

    const token = await getRailToken()
    const form = new FormData()
    form.append('token', token)
    form.append('station', station)
    form.append('line', '')
    const resp = await fetch(`${NJT_RAIL_API}/getTrainSchedule19Rec`, { method: 'POST', body: form })
    const data = await resp.json()

    const selectedLines = linesParam ? new Set(linesParam.split(',')) : null
    const items = (data?.ITEMS || []).filter(item => {
      if (item.TRAIN_ID?.startsWith('X')) return false // non-revenue
      if (selectedLines && !selectedLines.has(item.LINECODE)) return false
      return true
    })

    const now = new Date()
    const departures = items
      .map(item => {
        const secLate = parseInt(item.SEC_LATE) || 0
        const status = item.STATUS || ''
        // Parse ETA from STATUS field (e.g. "in 5 Min")
        const etaMatch = status.match(/in (\d+) Min/i)
        let eta = etaMatch ? parseInt(etaMatch[1]) : null
        const schedDate = new Date(item.SCHED_DEP_DATE)
        if (eta === null) {
          // Compute from scheduled time + delay
          eta = Math.round((schedDate.getTime() + secLate * 1000 - now.getTime()) / 60000)
        }
        const etaTime = formatTimeFromDate(schedDate)

        return {
          dest: item.DESTINATION,
          line: item.LINECODE,
          lineName: NJT_RAIL_LINES[item.LINECODE]?.abbr || item.LINEABBREVIATION || item.LINE,
          lineColor: NJT_RAIL_LINES[item.LINECODE]?.color || '#666',
          trainId: item.TRAIN_ID,
          track: item.TRACK,
          eta,
          etaTime,
          status,
          secLate,
          source: secLate > 0 || status.includes('Min') ? 'realtime' : 'schedule',
        }
      })
      .filter(d => d.eta >= -1) // drop trains that departed more than 1 min ago
      .map(d => ({ ...d, eta: Math.max(0, d.eta) })) // clamp to 0 for display
      .slice(0, 10)

    // Extract alerts from station messages
    const alerts = (data?.STATIONMSGS || [])
      .filter(m => m.MSG_TYPE === 'banner' && m.MSG_TEXT)
      .map(m => m.MSG_TEXT.slice(0, 200))
      .slice(0, 5)

    const stationName = data?.STATIONNAME || station
    res.json({ departures, alerts, stationName, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[NJT Rail] Query error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// NYC Ferry (GTFS-RT via Connexionz)
// ══════════════════════════════════════════════════════════

let nycFerryStopsCache = null
let nycFerryRoutesCache = null
let nycFerryTripMapCache = null // tripId → { routeId, headsign }
let nycFerryScheduleCache = null // stopId → [{ routeId, departureTime, tripId }]

async function loadNycFerryData() {
  if (nycFerryStopsCache) return { stops: nycFerryStopsCache, routes: nycFerryRoutesCache, tripMap: nycFerryTripMapCache, schedule: nycFerryScheduleCache }
  try {
    const resp = await fetch('http://nycferry.connexionz.net/rtt/public/utility/gtfs.aspx')
    const buf = Buffer.from(await resp.arrayBuffer())
    const zip = new AdmZip(buf)
    const stopLines = zip.readAsText('stops.txt').trim().split('\n')
    const routeLines = zip.readAsText('routes.txt').trim().split('\n')
    const tripLines = zip.readAsText('trips.txt').trim().split('\n')

    // Parse stops
    const stopHeader = stopLines[0].replace(/"/g, '').replace(/\r/g, '').split(',')
    const sIdIdx = stopHeader.indexOf('stop_id')
    const sNameIdx = stopHeader.indexOf('stop_name')
    const sLatIdx = stopHeader.indexOf('stop_lat')
    const sLonIdx = stopHeader.indexOf('stop_lon')
    const stops = []
    for (let i = 1; i < stopLines.length; i++) {
      const cols = stopLines[i].replace(/"/g, '').replace(/\r/g, '').split(',')
      const lat = parseFloat(cols[sLatIdx])
      const lon = parseFloat(cols[sLonIdx])
      stops.push({ id: cols[sIdIdx], name: cols[sNameIdx], lat: isNaN(lat) ? null : lat, lon: isNaN(lon) ? null : lon })
    }
    stops.sort((a, b) => a.name.localeCompare(b.name))
    nycFerryStopsCache = stops

    // Parse routes
    const routeHeader = routeLines[0].replace(/"/g, '').split(',')
    const rIdIdx = routeHeader.indexOf('route_id')
    const rNameIdx = routeHeader.indexOf('route_long_name')
    const rColorIdx = routeHeader.indexOf('route_color')
    const routes = {}
    for (let i = 1; i < routeLines.length; i++) {
      const cols = routeLines[i].replace(/"/g, '').split(',')
      routes[cols[rIdIdx]] = { id: cols[rIdIdx], name: cols[rNameIdx], color: '#' + (cols[rColorIdx] || '00839C') }
    }
    nycFerryRoutesCache = routes

    // Parse trips — build tripId → { routeId, headsign, serviceId } map
    // The realtime feed has empty routeId, so we resolve via tripId
    const tripHeader = tripLines[0].replace(/"/g, '').split(',')
    const tIdIdx = tripHeader.indexOf('trip_id')
    const tRIdIdx = tripHeader.indexOf('route_id')
    const tHsIdx = tripHeader.indexOf('trip_headsign')
    const tSvcIdx = tripHeader.indexOf('service_id')
    const tripMap = {}
    for (let i = 1; i < tripLines.length; i++) {
      const cols = tripLines[i].replace(/"/g, '').split(',')
      tripMap[cols[tIdIdx]] = { routeId: cols[tRIdIdx], headsign: cols[tHsIdx] || '', serviceId: cols[tSvcIdx] || '' }
    }
    nycFerryTripMapCache = tripMap

    // Parse stop_times.txt — build schedule for static fallback
    const stLines = zip.readAsText('stop_times.txt').trim().split('\n')
    const stHeader = stLines[0].replace(/"/g, '').split(',')
    const stTripIdx = stHeader.indexOf('trip_id')
    const stStopIdx = stHeader.indexOf('stop_id')
    const stDepIdx = stHeader.indexOf('departure_time')
    const schedule = {}
    for (let i = 1; i < stLines.length; i++) {
      const cols = stLines[i].replace(/"/g, '').split(',')
      const stopId = cols[stStopIdx]
      const tripId = cols[stTripIdx]
      const depTime = cols[stDepIdx]
      if (!stopId || !tripId || !depTime) continue
      if (!schedule[stopId]) schedule[stopId] = []
      const tripInfo = tripMap[tripId] || {}
      schedule[stopId].push({ routeId: tripInfo.routeId || '', departureTime: depTime, tripId, serviceId: tripInfo.serviceId || '' })
    }
    for (const sid of Object.keys(schedule)) {
      schedule[sid].sort((a, b) => a.departureTime.localeCompare(b.departureTime))
    }
    nycFerryScheduleCache = schedule

    console.log('[NYC Ferry] Loaded', stops.length, 'stops,', Object.keys(routes).length, 'routes,', Object.keys(tripMap).length, 'trips,', Object.keys(schedule).length, 'scheduled stops')
    return { stops, routes, tripMap, schedule }
  } catch (err) {
    console.error('[NYC Ferry] Failed to load:', err.message)
    return { stops: [], routes: {}, tripMap: {}, schedule: {} }
  }
}

let nycFerryFeedCache = null, nycFerryFeedTime = 0
const NYC_FERRY_CACHE_TTL = 30_000

async function fetchNycFerryFeed() {
  if (nycFerryFeedCache && Date.now() - nycFerryFeedTime < NYC_FERRY_CACHE_TTL) return nycFerryFeedCache
  const resp = await fetch('https://nycferry.connexionz.net/rtt/public/utility/gtfsrealtime.aspx/tripupdate')
  const buf = Buffer.from(await resp.arrayBuffer())
  nycFerryFeedCache = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf)
  nycFerryFeedTime = Date.now()
  return nycFerryFeedCache
}

app.get('/api/nycferry/stops', async (req, res) => {
  try {
    const data = await loadNycFerryData()
    const q = (req.query.q || '').toLowerCase()
    const filtered = q ? data.stops.filter(s => s.name.toLowerCase().includes(q)) : data.stops
    res.json({ stops: filtered.slice(0, 30), routes: data.routes })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/nycferry/query', async (req, res) => {
  try {
    const { stop } = req.query
    if (!stop) return res.json({ departures: [], stationName: '' })
    const data = await loadNycFerryData()
    const stationName = data.stops.find(s => s.id === stop)?.name || stop

    // Try realtime GTFS-RT feed first
    let departures = []
    try {
      const feed = await fetchNycFerryFeed()
      const now = Date.now() / 1000
      for (const entity of feed.entity) {
        const tu = entity.tripUpdate
        if (!tu) continue
        for (const stu of tu.stopTimeUpdate) {
          if (stu.stopId !== stop) continue
          const t = (stu.departure?.time?.low || stu.departure?.time || 0) || (stu.arrival?.time?.low || stu.arrival?.time || 0)
          if (t && t > now) {
            const d = new Date(t * 1000)
            const tripId = tu.trip?.tripId
            const tripInfo = data.tripMap?.[tripId] || {}
            const routeId = tu.trip?.routeId || tripInfo.routeId || ''
            const routeInfo = data.routes[routeId]
            const headsign = tripInfo.headsign || ''
            departures.push({
              dest: routeInfo ? `${routeInfo.name}${headsign ? ' → ' + headsign : ''}` : (headsign || routeId || '?'),
              route: routeId,
              lineColor: routeInfo?.color || '#00839C',
              eta: Math.round((t - now) / 60),
              etaTime: formatTimeFromDate(d),
              source: 'realtime',
            })
          }
        }
      }
    } catch (rtErr) {
      console.warn('[NYC Ferry] RT feed failed, falling back to static schedule:', rtErr.message)
    }

    // Supplement RT departures with static GTFS schedule for times not covered by RT
    // This ensures schedule departures show up when RT only tracks a subset of trips
    if (data.schedule && data.schedule[stop]) {
      const { h: nowH, m: nowM, s: nowS, totalMinutes: nowTotalMin } = nowEastern()
      const nowTime = `${String(nowH).padStart(2,'0')}:${String(nowM).padStart(2,'0')}:${String(nowS).padStart(2,'0')}`

      // Determine today's service_id from calendar.txt (1=weekday, 2=weekend for NYC Ferry)
      const today = new Date(new Date().toLocaleString('en-US', { timeZone: EASTERN_TZ }))
      const dow = today.getDay() // 0=Sun, 6=Sat
      const todayServiceId = (dow === 0 || dow === 6) ? '2' : '1'

      // Build a set of approximate ETAs already covered by RT (±3 min window)
      const rtEtas = new Set(departures.map(d => d.eta))

      for (const entry of data.schedule[stop]) {
        if (entry.departureTime <= nowTime) continue
        // Filter by service day
        const tripInfo = data.tripMap?.[entry.tripId] || {}
        // tripInfo doesn't have serviceId, but we stored it during parsing — check trip service
        if (entry.serviceId && entry.serviceId !== todayServiceId) continue
        const [eh, em] = entry.departureTime.split(':').map(Number)
        const etaMin = (eh * 60 + em) - nowTotalMin
        if (etaMin <= 0 || etaMin >= 180) continue
        // Skip if RT already has a departure within ±3 min of this scheduled time
        const nearRT = [...rtEtas].some(rt => Math.abs(rt - etaMin) <= 3)
        if (nearRT) continue
        const routeInfo = data.routes[entry.routeId]
        const headsign = tripInfo.headsign || ''
        departures.push({
          dest: routeInfo ? `${routeInfo.name}${headsign ? ' → ' + headsign : ''}` : (headsign || entry.routeId || '?'),
          route: entry.routeId,
          lineColor: routeInfo?.color || '#00839C',
          eta: etaMin,
          etaTime: formatTime(eh, em),
          source: 'schedule',
        })
      }
    }

    departures.sort((a, b) => a.eta - b.eta)
    res.json({ departures: departures.slice(0, 10), stationName, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[NYC Ferry]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// Weather — zip code to NWS grid resolution
// ══════════════════════════════════════════════════════════

const weatherGridCache = {} // zip → { label, url, time }
const WEATHER_GRID_TTL = 86400_000 // 24 hours

app.get('/api/weather/resolve-zip', strictLimiter, async (req, res) => {
  try {
    const zip = safeZip(req.query.zip)
    if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Invalid zip code' })

    // Check cache
    if (weatherGridCache[zip] && Date.now() - weatherGridCache[zip].time < WEATHER_GRID_TTL) {
      return res.json(weatherGridCache[zip])
    }

    // Geocode zip to lat/lon using Zippopotam.us (free, no key)
    const geoRes = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      headers: { 'User-Agent': 'MyStopNow/1.0' },
    })
    if (!geoRes.ok) {
      return res.status(404).json({ error: 'Zip code not found' })
    }
    const geoData = await geoRes.json()
    const place = geoData?.places?.[0]
    if (!place) {
      return res.status(404).json({ error: 'Zip code not found' })
    }

    const lat = parseFloat(place.latitude).toFixed(4)
    const lon = parseFloat(place.longitude).toFixed(4)
    const city = place['place name'] || zip

    // Get NWS grid point
    const nwsRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
      headers: { 'User-Agent': 'MyStopNow/1.0 (transit-dashboard)' },
    })
    if (!nwsRes.ok) {
      return res.status(502).json({ error: 'NWS points API failed' })
    }
    const nwsData = await nwsRes.json()
    const gridId = nwsData.properties?.gridId
    const gridX = nwsData.properties?.gridX
    const gridY = nwsData.properties?.gridY
    if (!gridId || gridX == null || gridY == null) {
      return res.status(502).json({ error: 'Could not resolve NWS grid' })
    }

    const result = {
      label: city,
      zip,
      url: `/api/nws/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`,
      lat, lon,
    }
    weatherGridCache[zip] = { ...result, time: Date.now() }
    console.log(`[Weather] Resolved zip ${zip} → ${city} (${gridId} ${gridX},${gridY})`)
    res.json(result)
  } catch (err) {
    console.error('[Weather] Zip resolve error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// Start
// ══════════════════════════════════════════════════════════

// MTA alerts endpoint — returns alerts filtered by lines
app.get('/api/mta/alerts', async (req, res) => {
  try {
    const lines = req.query.lines ? req.query.lines.split(',').filter(Boolean) : []
    const allAlerts = await fetchMtaAlerts()
    const filtered = lines.length > 0 ? getMtaAlertsForLines(allAlerts, lines) : allAlerts
    res.json({ alerts: filtered.slice(0, 10), timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[MTA] Alerts endpoint error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// LIRR station search
app.get('/api/lirr/stations', async (req, res) => {
  try {
    const data = await loadLirrStations()
    const q = (req.query.q || '').toLowerCase()
    const filtered = q ? data.stops.filter(s => s.name.toLowerCase().includes(q)) : data.stops
    res.json({ stations: filtered.slice(0, 30), routes: data.routes })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// LIRR departures — queries the LIRR GTFS-RT feed
app.get('/api/lirr/query', async (req, res) => {
  try {
    const { stop, routes: routesParam } = req.query
    if (!stop) return res.json({ departures: [], stationName: '' })
    const data = await loadLirrStations()
    const stationName = data.stops.find(s => s.id === stop)?.name || stop
    const selectedRoutes = routesParam ? new Set(routesParam.split(',')) : null
    const feed = await fetchMtaFeed('lirr%2Fgtfs-lirr')
    const now = Date.now() / 1000
    const departures = []
    for (const entity of feed.entity) {
      const tu = entity.tripUpdate
      if (!tu) continue
      const route = tu.trip?.routeId
      if (selectedRoutes && !selectedRoutes.has(route)) continue
      for (const stu of tu.stopTimeUpdate) {
        if (stu.stopId !== stop) continue
        const t = (stu.arrival?.time?.low || stu.arrival?.time || 0) || (stu.departure?.time?.low || stu.departure?.time || 0)
        if (t && t > now) {
          const d = new Date(t * 1000)
          const routeInfo = data.routes[route]
          departures.push({
            dest: routeInfo?.name || `Route ${route}`,
            route,
            lineColor: routeInfo?.color || '#006EC7',
            eta: Math.round((t - now) / 60),
            etaTime: formatTimeFromDate(d),
            source: 'realtime',
          })
        }
      }
    }
    departures.sort((a, b) => a.eta - b.eta)
    res.json({ departures: departures.slice(0, 10), stationName, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[LIRR]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Metro-North station search
app.get('/api/mnr/stations', async (req, res) => {
  try {
    const data = await loadMnrStations()
    const q = (req.query.q || '').toLowerCase()
    const filtered = q ? data.stops.filter(s => s.name.toLowerCase().includes(q)) : data.stops
    res.json({ stations: filtered.slice(0, 30), routes: data.routes })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// LIRR station-routes — returns which branches serve a specific station (from static GTFS)
app.get('/api/lirr/station-routes', async (req, res) => {
  try {
    const { stop } = req.query
    if (!stop) return res.json({ routes: [] })
    const data = await loadLirrStations()
    const routeIds = data.stationRoutes[stop] || new Set()
    const routes = [...routeIds].map(id => ({
      id,
      name: data.routes[id]?.name || `Route ${id}`,
      color: data.routes[id]?.color || '#006EC7',
    })).sort((a, b) => a.name.localeCompare(b.name))
    res.json({ routes })
  } catch (err) {
    console.error('[LIRR station-routes]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// MNR station-routes — returns which lines serve a specific station (from static GTFS)
app.get('/api/mnr/station-routes', async (req, res) => {
  try {
    const { stop } = req.query
    if (!stop) return res.json({ routes: [] })
    const data = await loadMnrStations()
    const routeIds = data.stationRoutes[stop] || new Set()
    const routes = [...routeIds].map(id => ({
      id,
      name: data.routes[id]?.name || `Route ${id}`,
      color: data.routes[id]?.color || '#0039A6',
    })).sort((a, b) => a.name.localeCompare(b.name))
    res.json({ routes })
  } catch (err) {
    console.error('[MNR station-routes]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Metro-North departures
app.get('/api/mnr/query', async (req, res) => {
  try {
    const { stop, routes: routesParam } = req.query
    if (!stop) return res.json({ departures: [], stationName: '' })
    const data = await loadMnrStations()
    const stationName = data.stops.find(s => s.id === stop)?.name || stop
    const selectedRoutes = routesParam ? new Set(routesParam.split(',')) : null
    const feed = await fetchMtaFeed('mnr%2Fgtfs-mnr')
    const now = Date.now() / 1000
    const departures = []
    for (const entity of feed.entity) {
      const tu = entity.tripUpdate
      if (!tu) continue
      const route = tu.trip?.routeId
      if (selectedRoutes && !selectedRoutes.has(route)) continue
      for (const stu of tu.stopTimeUpdate) {
        if (stu.stopId !== stop) continue
        const t = (stu.arrival?.time?.low || stu.arrival?.time || 0) || (stu.departure?.time?.low || stu.departure?.time || 0)
        if (t && t > now) {
          const d = new Date(t * 1000)
          const routeInfo = data.routes[route]
          departures.push({
            dest: routeInfo?.name || `Route ${route}`,
            route,
            lineColor: routeInfo?.color || '#009B3A',
            eta: Math.round((t - now) / 60),
            etaTime: formatTimeFromDate(d),
            source: 'realtime',
          })
        }
      }
    }
    departures.sort((a, b) => a.eta - b.eta)
    res.json({ departures: departures.slice(0, 10), stationName, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[MNR]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// MTA Bus (Bus Time SIRI API)
// ══════════════════════════════════════════════════════════

const MTA_BUS_KEY = process.env.MTA_BUS_API_KEY
const MTA_BUS_BASE = 'https://bustime.mta.info/api'

// MTA Bus route search
app.get('/api/mtabus/routes', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase()
    // Fetch routes for both agencies
    const results = []
    for (const agency of ['MTA%20NYCT', 'MTABC']) {
      const resp = await fetch(`${MTA_BUS_BASE}/where/routes-for-agency/${agency}.json?key=${MTA_BUS_KEY}`)
      if (!resp.ok) continue
      const data = await resp.json()
      for (const r of (data.data?.list || [])) {
        const name = r.shortName || r.id.split('_')[1] || r.id
        const desc = r.longName || ''
        if (q && !name.toLowerCase().includes(q) && !desc.toLowerCase().includes(q)) continue
        results.push({ id: r.id, name, desc })
      }
    }
    results.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    res.json({ routes: results.slice(0, 30) })
  } catch (err) {
    console.error('[MTA Bus] Routes error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// MTA Bus stops for a route
app.get('/api/mtabus/route-stops', async (req, res) => {
  try {
    const routeId = req.query.route
    if (!routeId) return res.json({ stops: [] })
    const resp = await fetch(`${MTA_BUS_BASE}/where/stops-for-route/${encodeURIComponent(routeId)}.json?key=${MTA_BUS_KEY}&includePolylines=false&version=2`)
    if (!resp.ok) return res.json({ stops: [] })
    const data = await resp.json()
    const stopGroups = data.data?.entry?.stopGroupings?.[0]?.stopGroups || []
    const allStops = data.data?.references?.stops || []
    const stopMap = {}
    for (const s of allStops) stopMap[s.id] = s.name
    // Return stops grouped by direction
    const directions = stopGroups.map(g => ({
      direction: g.name?.name || g.id,
      stops: (g.stopIds || []).map(id => ({ id, name: stopMap[id] || id })),
    }))
    res.json({ directions })
  } catch (err) {
    console.error('[MTA Bus] Route stops error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// MTA Bus stop monitoring — real-time arrivals at a stop
app.get('/api/mtabus/query', strictLimiter, async (req, res) => {
  try {
    const { stop, route } = req.query
    if (!stop) return res.json({ departures: [] })
    let url = `${MTA_BUS_BASE}/siri/stop-monitoring.json?key=${MTA_BUS_KEY}&MonitoringRef=${stop}`
    if (route) url += `&LineRef=${encodeURIComponent(route)}`
    // 8-second timeout — SIRI API can hang, especially on weekends
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return res.json({ departures: [], alerts: [] })
    const data = await resp.json()
    const visits = data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || []
    const departures = visits.slice(0, 10).map(v => {
      const j = v.MonitoredVehicleJourney
      const call = j.MonitoredCall || {}
      const eta = call.ExpectedArrivalTime ? Math.max(0, Math.round((new Date(call.ExpectedArrivalTime) - Date.now()) / 60000)) : null
      const dist = call.Extensions?.Distances?.PresentableDistance || ''
      return {
        route: j.PublishedLineName || '?',
        dest: j.DestinationName || '?',
        eta: eta ?? 99,
        distance: dist,
        etaTime: call.ExpectedArrivalTime ? formatTimeFromDate(new Date(call.ExpectedArrivalTime)) : '',
        source: 'realtime',
      }
    })
    const situations = data.Siri?.ServiceDelivery?.SituationExchangeDelivery?.[0]?.Situations?.PtSituationElement || []
    const alerts = situations.slice(0, 3).map(s => s.Description?.value || s.Summary?.value || '').filter(Boolean)
    res.json({ departures, alerts, timestamp: new Date().toISOString() })
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError'
    if (isTimeout) console.warn('[MTA Bus] SIRI request timed out for stop', req.query.stop)
    else console.error('[MTA Bus]', err.message)
    // Return empty gracefully — card will show "No upcoming buses" instead of error
    res.json({ departures: [], alerts: [], timeout: isTimeout, timestamp: new Date().toISOString() })
  }
})

// ══════════════════════════════════════════════════════════
// Nearby Stops — geo-lookup across all transit types
// ══════════════════════════════════════════════════════════

// Hardcoded PATH station coordinates
const PATH_STATION_COORDS = {
  '26722': { lat: 40.7355, lon: -74.1641, name: 'Newark' },
  '26723': { lat: 40.7393, lon: -74.1557, name: 'Harrison' },
  '26724': { lat: 40.7328, lon: -74.0629, name: 'Journal Square' },
  '26725': { lat: 40.7191, lon: -74.0431, name: 'Grove St' },
  '26726': { lat: 40.7167, lon: -74.0347, name: 'Exchange Place' },
  '26727': { lat: 40.7328, lon: -74.0070, name: 'Christopher St' },
  '26728': { lat: 40.7270, lon: -74.0340, name: 'Newport' },
  '26729': { lat: 40.7355, lon: -74.0298, name: 'Hoboken' },
  '26730': { lat: 40.7115, lon: -74.0134, name: 'World Trade Center' },
  '26731': { lat: 40.7342, lon: -74.0005, name: '9th St' },
  '26732': { lat: 40.7375, lon: -73.9967, name: '14th St' },
  '26733': { lat: 40.7428, lon: -73.9930, name: '23rd St' },
  '26734': { lat: 40.7490, lon: -73.9882, name: '33rd St' },
}

// NJT Rail station coordinates with 2-char codes and lines
// Codes verified against NJT Rail API getStationList endpoint.
// Lines: AC=Atlantic City, BC=Bergen County, GS=Gladstone, MC=Montclair-Boonton,
//        ME=Morris & Essex, ML=Main, NC=North Jersey Coast, NE=Northeast Corridor,
//        PV=Pascack Valley, PR=Princeton, RV=Raritan Valley
const NJT_RAIL_STATIONS = [
  // Morris & Essex / Gladstone Branch
  { code: 'HB', name: 'Hoboken', lat: 40.7355, lon: -74.0298, lines: ['ME', 'MC', 'BC', 'ML', 'PV'] },
  { code: 'SE', name: 'Secaucus Upper Lvl', lat: 40.7614, lon: -74.0756, lines: ['ME', 'MC', 'ML', 'NE', 'NC'] },
  { code: 'TS', name: 'Secaucus Lower Lvl', lat: 40.7614, lon: -74.0756, lines: ['BC', 'PV'] },
  { code: 'NY', name: 'New York Penn Station', lat: 40.7505, lon: -73.9935, lines: ['NE', 'NC', 'ME', 'MC', 'RV', 'ML', 'BC', 'PV', 'GS', 'AC'] },
  { code: 'MW', name: 'Maplewood', lat: 40.7313, lon: -74.2730, lines: ['ME', 'GS'] },
  { code: 'SO', name: 'South Orange', lat: 40.7480, lon: -74.2620, lines: ['ME', 'GS'] },
  { code: 'OG', name: 'Orange', lat: 40.7710, lon: -74.2330, lines: ['ME'] },
  { code: 'MB', name: 'Millburn', lat: 40.7260, lon: -74.3040, lines: ['ME', 'GS'] },
  { code: 'SH', name: 'Short Hills', lat: 40.7250, lon: -74.3250, lines: ['ME', 'GS'] },
  { code: 'ST', name: 'Summit', lat: 40.7162, lon: -74.3580, lines: ['ME', 'GS'] },
  { code: 'CM', name: 'Chatham', lat: 40.7410, lon: -74.3830, lines: ['ME', 'GS'] },
  { code: 'MA', name: 'Madison', lat: 40.7590, lon: -74.4160, lines: ['ME', 'GS'] },
  { code: 'CN', name: 'Convent Station', lat: 40.7780, lon: -74.4410, lines: ['ME', 'GS'] },
  { code: 'MR', name: 'Morristown', lat: 40.7970, lon: -74.4770, lines: ['ME', 'GS'] },
  { code: 'MH', name: 'Murray Hill', lat: 40.6948, lon: -74.4029, lines: ['GS'] },
  { code: 'NV', name: 'New Providence', lat: 40.6990, lon: -74.3820, lines: ['GS'] },
  { code: 'BY', name: 'Berkeley Heights', lat: 40.6820, lon: -74.4310, lines: ['GS'] },
  { code: 'GL', name: 'Gladstone', lat: 40.7230, lon: -74.6650, lines: ['GS'] },
  { code: 'DO', name: 'Dover', lat: 40.8830, lon: -74.5620, lines: ['ME'] },
  { code: 'MX', name: 'Morris Plains', lat: 40.8290, lon: -74.4810, lines: ['ME'] },
  { code: 'DV', name: 'Denville', lat: 40.8680, lon: -74.4780, lines: ['ME'] },
  { code: 'BU', name: 'Brick Church', lat: 40.7630, lon: -74.2520, lines: ['ME', 'GS'] },
  { code: 'EO', name: 'East Orange', lat: 40.7670, lon: -74.2150, lines: ['ME'] },
  // Northeast Corridor
  { code: 'NP', name: 'Newark Penn Station', lat: 40.7345, lon: -74.1645, lines: ['NE', 'NC', 'RV'] },
  { code: 'NA', name: 'Newark Airport', lat: 40.7040, lon: -74.1910, lines: ['NE', 'NC'] },
  { code: 'EZ', name: 'Elizabeth', lat: 40.6680, lon: -74.2150, lines: ['NE', 'NC'] },
  { code: 'LI', name: 'Linden', lat: 40.6320, lon: -74.2490, lines: ['NE', 'NC'] },
  { code: 'RH', name: 'Rahway', lat: 40.6080, lon: -74.2770, lines: ['NE', 'NC'] },
  { code: 'MP', name: 'Metropark', lat: 40.5680, lon: -74.3300, lines: ['NE', 'NC'] },
  { code: 'MU', name: 'Metuchen', lat: 40.5430, lon: -74.3630, lines: ['NE'] },
  { code: 'NB', name: 'New Brunswick', lat: 40.4960, lon: -74.4440, lines: ['NE'] },
  { code: 'PJ', name: 'Princeton Junction', lat: 40.3170, lon: -74.6220, lines: ['NE'] },
  { code: 'PR', name: 'Princeton', lat: 40.3440, lon: -74.6590, lines: ['NE'] },
  { code: 'ED', name: 'Edison', lat: 40.5180, lon: -74.4120, lines: ['NE'] },
  { code: 'NZ', name: 'North Elizabeth', lat: 40.6810, lon: -74.2200, lines: ['NE', 'NC'] },
  // North Jersey Coast
  { code: 'AM', name: 'Aberdeen-Matawan', lat: 40.4180, lon: -74.2320, lines: ['NC'] },
  { code: 'HZ', name: 'Hazlet', lat: 40.4160, lon: -74.1900, lines: ['NC'] },
  { code: 'MI', name: 'Middletown NJ', lat: 40.3900, lon: -74.1160, lines: ['NC'] },
  { code: 'RB', name: 'Red Bank', lat: 40.3480, lon: -74.0740, lines: ['NC'] },
  { code: 'LB', name: 'Long Branch', lat: 40.2960, lon: -73.9880, lines: ['NC'] },
  { code: 'AP', name: 'Asbury Park', lat: 40.2130, lon: -74.0120, lines: ['NC'] },
  { code: 'LS', name: 'Little Silver', lat: 40.3340, lon: -74.0410, lines: ['NC'] },
  { code: 'PP', name: 'Point Pleasant Beach', lat: 40.0920, lon: -74.0480, lines: ['NC'] },
  { code: 'CH', name: 'South Amboy', lat: 40.4840, lon: -74.2780, lines: ['NC'] },
  // Raritan Valley
  { code: 'PF', name: 'Plainfield', lat: 40.6190, lon: -74.4210, lines: ['RV'] },
  { code: 'WF', name: 'Westfield', lat: 40.6520, lon: -74.3470, lines: ['RV'] },
  { code: 'XC', name: 'Cranford', lat: 40.6580, lon: -74.3030, lines: ['RV'] },
  { code: 'GW', name: 'Garwood', lat: 40.6520, lon: -74.3240, lines: ['RV'] },
  { code: 'SM', name: 'Somerville', lat: 40.5740, lon: -74.6140, lines: ['RV'] },
  { code: 'BW', name: 'Bridgewater', lat: 40.5930, lon: -74.5530, lines: ['RV'] },
  { code: 'BK', name: 'Bound Brook', lat: 40.5680, lon: -74.5380, lines: ['RV'] },
  { code: 'DN', name: 'Dunellen', lat: 40.5930, lon: -74.4720, lines: ['RV'] },
  { code: 'FW', name: 'Fanwood', lat: 40.6420, lon: -74.3830, lines: ['RV'] },
  { code: 'NE', name: 'Netherwood', lat: 40.6310, lon: -74.4000, lines: ['RV'] },
  { code: 'RL', name: 'Roselle Park', lat: 40.6640, lon: -74.2640, lines: ['RV'] },
  // Main / Bergen / Pascack Valley
  { code: 'RF', name: 'Rutherford', lat: 40.8280, lon: -74.1010, lines: ['BC'] },
  { code: 'PV', name: 'Park Ridge', lat: 41.0370, lon: -74.0420, lines: ['ML'] },
  { code: 'RW', name: 'Ridgewood', lat: 40.9790, lon: -74.1160, lines: ['ML', 'BC'] },
  { code: 'RS', name: 'Glen Rock Main Line', lat: 40.9590, lon: -74.1310, lines: ['ML'] },
  { code: 'GK', name: 'Glen Rock Boro Hall', lat: 40.9560, lon: -74.1240, lines: ['BC'] },
  { code: 'HD', name: 'Hillsdale', lat: 41.0060, lon: -74.0430, lines: ['PV'] },
  { code: 'WL', name: 'Woodcliff Lake', lat: 41.0230, lon: -74.0560, lines: ['PV'] },
  { code: 'WK', name: 'Waldwick', lat: 41.0110, lon: -74.1190, lines: ['ML', 'BC'] },
  { code: 'MZ', name: 'Mahwah', lat: 41.0890, lon: -74.1440, lines: ['ML'] },
  { code: 'SF', name: 'Suffern', lat: 41.1150, lon: -74.1490, lines: ['ML'] },
  // Montclair-Boonton
  { code: 'UV', name: 'Montclair State U', lat: 40.8630, lon: -74.1990, lines: ['MC'] },
  { code: 'HS', name: 'Montclair Heights', lat: 40.8470, lon: -74.2020, lines: ['MC'] },
  { code: 'BM', name: 'Bloomfield', lat: 40.7920, lon: -74.2000, lines: ['MC'] },
  { code: 'GG', name: 'Glen Ridge', lat: 40.8040, lon: -74.2040, lines: ['MC'] },
  { code: 'WT', name: 'Watsessing Avenue', lat: 40.7870, lon: -74.1930, lines: ['MC'] },
  { code: 'BN', name: 'Boonton', lat: 40.9030, lon: -74.4070, lines: ['MC'] },
  { code: 'LP', name: 'Lincoln Park', lat: 40.9240, lon: -74.3020, lines: ['MC'] },
  { code: 'MV', name: 'Mountain View', lat: 40.9080, lon: -74.2600, lines: ['MC'] },
  // Atlantic City
  { code: 'AC', name: 'Atlantic City Rail Terminal', lat: 39.3640, lon: -74.4420, lines: ['AC'] },
  { code: 'LW', name: 'Lindenwold', lat: 39.8240, lon: -74.9960, lines: ['AC'] },
  { code: 'CY', name: 'Cherry Hill', lat: 39.9340, lon: -75.0230, lines: ['AC'] },
]

// Hardcoded ferry terminal coordinates
const FERRY_TERMINAL_COORDS = {
  '4':  { lat: 40.7133, lon: -74.0154, name: 'Brookfield Place' },
  '5':  { lat: 40.8270, lon: -73.9750, name: 'Edgewater Ferry Landing' },
  '9':  { lat: 40.7520, lon: -74.0270, name: 'Hoboken 14th Street' },
  '10': { lat: 40.7360, lon: -74.0290, name: 'Hoboken / NJ Transit Terminal' },
  '11': { lat: 40.7730, lon: -74.0130, name: 'Port Imperial / Weehawken' },
  '12': { lat: 40.7130, lon: -74.0380, name: 'Liberty Harbor / Marin Blvd.' },
  '13': { lat: 40.7620, lon: -74.0180, name: 'Lincoln Harbor' },
  '14': { lat: 40.7610, lon: -73.9990, name: 'Midtown / W. 39th St.' },
  '17': { lat: 40.7140, lon: -74.0340, name: 'Paulus Hook / Jersey City' },
  '18': { lat: 40.7010, lon: -74.0090, name: 'Pier 11 / Wall St.' },
  '20': { lat: 40.6930, lon: -74.0550, name: 'Port Liberté' },
}

// Haversine distance in miles
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

app.get('/api/nearby-stops', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat)
    const lon = parseFloat(req.query.lon)
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'Invalid lat/lon' })

    const maxDistance = parseFloat(req.query.maxDistance) || 3 // miles
    const maxResults = parseInt(req.query.max) || 10

    const candidates = [] // { type, id, name, distance, stopKey, routes }

    // 1. NJT Bus stops (from GTFS)
    if (gtfsLoaded) {
      for (const [stopId, coords] of Object.entries(stopCoordsMap)) {
        const dist = haversineDistance(lat, lon, coords.lat, coords.lon)
        if (dist > maxDistance) continue
        const name = stopNamesMap[stopId] || stopId
        // Skip large terminals unless very close — they serve too many routes and aren't useful as "nearby" stops
        const schedule = scheduleByStop[stopId]
        const routes = schedule ? [...new Set(schedule.map(s => s.route))].sort() : []

        // Identify Light Rail stations
        const isLightRail = name.toUpperCase().includes('LIGHT RAIL STATION')
        if (isLightRail) {
          const stationName = name.replace(/\s*LIGHT RAIL STATION\s*/i, '').trim()
          candidates.push({ type: 'hblr', id: stopId, name: stationName || name, distance: dist, stopKey: `hblr:${stopId}`, routes: routes.slice(0, 5) })
          continue
        }

        if (!schedule || schedule.length === 0) continue
        if (routes.length > 20 && dist > 0.5) continue // large terminal far away, skip
        // Check if it's HBLR by route name
        const isHblr = routes.some(r => r === 'HBLR' || r.toLowerCase().includes('hblr'))
        const type = isHblr ? 'hblr' : 'bus'
        const stopKey = isHblr ? `hblr:${stopId}` : `bus:${stopId}:${routes.slice(0, 3).join(',')}`
        candidates.push({ type, id: stopId, name, distance: dist, stopKey, routes: routes.slice(0, 5) })
      }
    }

    // 2. MTA Subway stations
    await loadMtaStations()
    if (mtaStationsCoordsCache) {
      const routesMap = loadStationRoutes()
      const mtaCandidates = []
      for (const [stationId, coords] of Object.entries(mtaStationsCoordsCache)) {
        const dist = haversineDistance(lat, lon, coords.lat, coords.lon)
        if (dist > maxDistance) continue
        const station = mtaStationsCache?.find(s => s.id === stationId)
        const name = station?.name || stationId
        const routes = routesMap[stationId] || []
        if (routes.length === 0) continue
        mtaCandidates.push({ id: stationId, name, lat: coords.lat, lon: coords.lon, distance: dist, routes })
      }
      // Consolidate nearby MTA stations into complexes (within 0.15 miles)
      mtaCandidates.sort((a, b) => a.distance - b.distance)
      const merged = []
      const used = new Set()
      for (const station of mtaCandidates) {
        if (used.has(station.id)) continue
        used.add(station.id)
        const complex = { ids: [station.id], name: station.name, distance: station.distance, routes: new Set(station.routes) }
        // Find other stations within 0.15 miles of this one to merge
        for (const other of mtaCandidates) {
          if (used.has(other.id)) continue
          const interDist = haversineDistance(station.lat, station.lon, other.lat, other.lon)
          if (interDist <= 0.15) {
            used.add(other.id)
            complex.ids.push(other.id)
            other.routes.forEach(r => complex.routes.add(r))
            // Use the shorter/more recognizable name
            if (other.name.length < complex.name.length) complex.name = other.name
          }
        }
        const allRoutes = [...complex.routes].sort()
        const idsStr = complex.ids.join(',')
        const linesStr = allRoutes.join(',')
        const stopKeyS = `mta:${idsStr}:S:${linesStr}`
        const stopKeyN = `mta:${idsStr}:N:${linesStr}`
        merged.push({ type: 'mta', id: idsStr, name: complex.name, distance: complex.distance, stopKey: stopKeyS, stopKeyN, routes: allRoutes })
      }
      candidates.push(...merged)
    }

    // 3. PATH stations
    for (const [stationId, info] of Object.entries(PATH_STATION_COORDS)) {
      const dist = haversineDistance(lat, lon, info.lat, info.lon)
      if (dist > maxDistance) continue
      const routes = PATH_STATION_ROUTES[stationId] || []
      const routeStr = routes.join(',')
      // PATH stop key format: path:ROUTES:DIR:STATION_ID
      const stopKeyOut = `path:${routeStr}:1:${stationId}`
      const stopKeyIn = `path:${routeStr}:0:${stationId}`
      candidates.push({ type: 'path', id: stationId, name: info.name, distance: dist, stopKey: stopKeyOut, stopKeyIn, routes })
    }

    // 4. Ferry terminals
    for (const [tag, info] of Object.entries(FERRY_TERMINAL_COORDS)) {
      const dist = haversineDistance(lat, lon, info.lat, info.lon)
      if (dist > maxDistance) continue
      candidates.push({ type: 'ferry', id: tag, name: info.name, distance: dist, stopKey: `ferry:${tag}`, routes: [] })
    }

    // 5. NJT Rail stations
    for (const station of NJT_RAIL_STATIONS) {
      const dist = haversineDistance(lat, lon, station.lat, station.lon)
      if (dist > maxDistance) continue
      const linesStr = station.lines.join(',')
      const stopKey = `rail:${station.code}:${linesStr}`
      candidates.push({ type: 'rail', id: station.code, name: station.name, distance: dist, stopKey, routes: station.lines })
    }

    // 6. NYC Ferry stops (from GTFS)
    try {
      const nycFerryData = await loadNycFerryData()
      if (nycFerryData.stops && nycFerryData.stops.length > 0) {
        for (const stop of nycFerryData.stops) {
          if (!stop.lat || !stop.lon) continue
          const dist = haversineDistance(lat, lon, stop.lat, stop.lon)
          if (dist > maxDistance) continue
          candidates.push({ type: 'nycferry', id: stop.id, name: stop.name, distance: dist, stopKey: `nycferry:${stop.id}`, routes: [] })
        }
      }
    } catch {
      // NYC Ferry GTFS may not be loaded yet — skip silently
    }

    // Sort by distance and pick closest, with mode diversity and location-aware priority
    candidates.sort((a, b) => a.distance - b.distance)

    // Determine location context for prioritization
    // NJ waterfront (Hoboken, JC, Weehawken): PATH, Ferry, Bus, HBLR dominate
    // Manhattan: Subway dominates
    // Outer boroughs (Brooklyn, Queens, Bronx): Subway + MTA Bus + NYC Ferry
    // NJ suburban: NJT Rail + Bus
    const isNJWaterfront = lon < -74.01 && lon > -74.08 && lat > 40.70 && lat < 40.78
    const isManhattan = lon > -74.02 && lon < -73.93 && lat > 40.70 && lat < 40.88
    const isOuterBorough = lon > -74.04 && lon < -73.70 && lat > 40.55 && lat < 40.92 && !isManhattan
    // If none of the above, treat as NJ suburban (rail + bus area)

    // Priority tiers by location (higher priority modes get filled first)
    // Also define which modes are EXCLUDED per zone (cross-state filtering)
    let modePriority
    let excludedModes = new Set()
    if (isNJWaterfront) {
      modePriority = ['path', 'ferry', 'hblr', 'bus', 'rail']
      excludedModes = new Set(['mta', 'mtabus', 'nycferry'])
    } else if (isManhattan) {
      modePriority = ['mta', 'rail', 'mtabus', 'nycferry']
      excludedModes = new Set(['path', 'hblr', 'bus', 'ferry'])
    } else if (isOuterBorough) {
      modePriority = ['mta', 'mtabus', 'nycferry', 'rail']
      excludedModes = new Set(['bus', 'ferry', 'path', 'hblr'])
    } else {
      // NJ suburban
      modePriority = ['rail', 'bus', 'path']
      excludedModes = new Set(['hblr', 'mta', 'mtabus', 'ferry', 'nycferry'])
    }

    // Filter out excluded modes before selection
    const filteredCandidates = candidates.filter(c => !excludedModes.has(c.type))

    const MAX_PER_TYPE = 2
    const selected = []
    const typeCounts = {}

    // Pass 1: Pick the closest stop from each available mode (in priority order)
    for (const mode of modePriority) {
      if (selected.length >= maxResults) break
      const closest = filteredCandidates.find(c => c.type === mode && !selected.includes(c))
      if (closest) {
        selected.push(closest)
        typeCounts[mode] = (typeCounts[mode] || 0) + 1
      }
    }

    // Pass 2: Fill remaining slots with closest candidates, respecting 2-per-type cap
    for (const c of filteredCandidates) {
      if (selected.length >= maxResults) break
      if (selected.includes(c)) continue
      const count = typeCounts[c.type] || 0
      if (count >= MAX_PER_TYPE) continue
      selected.push(c)
      typeCounts[c.type] = count + 1
    }

    // Pass 3: If still not full, allow a 3rd of any type (closest remaining)
    if (selected.length < maxResults) {
      for (const c of filteredCandidates) {
        if (selected.length >= maxResults) break
        if (selected.includes(c)) continue
        selected.push(c)
      }
    }

    // Re-sort final selection by distance for display
    selected.sort((a, b) => a.distance - b.distance)

    // Build response with stop keys and display names
    const stops = selected.map(s => ({
      type: s.type,
      id: s.id,
      name: s.name,
      distance: Math.round(s.distance * 100) / 100,
      stopKey: s.stopKey,
      stopKeyReverse: s.stopKeyN || s.stopKeyIn || s.stopKey,
      routes: s.routes,
    }))

    res.json({ stops, lat, lon, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[Nearby] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GTFS cache status endpoint — must be before production catch-all
app.get('/api/bus/gtfs-status', (req, res) => {
  const exists = fs.existsSync(GTFS_ZIP)
  const ageDays = exists ? (Date.now() - fs.statSync(GTFS_ZIP).mtimeMs) / 86400_000 : null
  const sizeMB = exists ? (fs.statSync(GTFS_ZIP).size / 1e6).toFixed(1) : null
  res.json({
    cached: exists,
    loaded: gtfsLoaded,
    ageDays: ageDays ? parseFloat(ageDays.toFixed(1)) : null,
    sizeMB: sizeMB ? parseFloat(sizeMB) : null,
    stale: ageDays ? ageDays > 7 : false,
    lastModified: exists ? new Date(fs.statSync(GTFS_ZIP).mtimeMs).toISOString() : null,
  })
})

// System status endpoint — easter egg diagnostics panel
const SERVER_START_TIME = Date.now()
app.get('/api/system-status', (req, res) => {
  const uptimeMs = Date.now() - SERVER_START_TIME
  const uptimeH = (uptimeMs / 3600_000).toFixed(1)

  // NJT Bus GTFS
  const busGtfsExists = fs.existsSync(GTFS_ZIP)
  const busGtfsAge = busGtfsExists ? parseFloat(((Date.now() - fs.statSync(GTFS_ZIP).mtimeMs) / 86400_000).toFixed(1)) : null

  // MTA Subway GTFS
  const subwayZip = path.join(GTFS_CACHE, 'gtfs_subway.zip')
  const subwayExists = fs.existsSync(subwayZip)
  const subwayAge = subwayExists ? parseFloat(((Date.now() - fs.statSync(subwayZip).mtimeMs) / 86400_000).toFixed(1)) : null

  // MTA Station routes cache
  const routesFile = path.join(__dirname, '..', '.cache', 'mta_station_routes.json')
  const routesExists = fs.existsSync(routesFile)
  const routesStations = stationRoutesMap ? Object.keys(stationRoutesMap).length : 0

  // NJT tokens
  const busTokenOk = cachedToken && Date.now() < tokenExpiry
  const busTokenAge = busTokenOk ? parseFloat(((tokenExpiry - Date.now()) / 3600_000).toFixed(1)) : null
  const railTokenOk = railToken && Date.now() < railTokenExpiry
  const railTokenAge = railTokenOk ? parseFloat(((railTokenExpiry - Date.now()) / 3600_000).toFixed(1)) : null

  res.json({
    app: 'My Stop Now',
    uptime: `${uptimeH}h`,
    busGtfs: { ageDays: busGtfsAge, loaded: gtfsLoaded, stale: busGtfsAge > 7 },
    subwayGtfs: { ageDays: subwayAge, stale: subwayAge > 7 },
    stationRoutes: { loaded: routesExists, stations: routesStations },
    njtBusToken: { valid: !!busTokenOk, expiresInH: busTokenAge },
    njtRailToken: { valid: !!railTokenOk, expiresInH: railTokenAge },
  })
})

// ══════════════════════════════════════════════════════════
// User-Agent routing — redirect mobile devices to /mobile
// Only active in production; dev uses Vite's dev server.
// ══════════════════════════════════════════════════════════

const MOBILE_UA_PATTERNS = /iPhone|Android|iPad|iPod|webOS|BlackBerry|Windows Phone|Opera Mini/i

function userAgentRouter(req, res, next) {
  // Only activate in production
  if (process.env.NODE_ENV !== 'production') return next()

  // Only redirect root path
  if (req.path !== '/') return next()

  // Allow desktop override
  if (req.query.desktop === '1') return next()

  // Check for mobile UA
  const ua = req.get('User-Agent') || ''
  if (MOBILE_UA_PATTERNS.test(ua)) {
    return res.redirect(302, '/mobile')
  }

  next()
}

app.use(userAgentRouter)

// ══════════════════════════════════════════════════════════
// Production mode — serve built frontend + proxy external APIs
// In dev, Vite handles these. In prod (NODE_ENV=production),
// Express serves dist/ and proxies PANYNJ + NWS directly.
// ══════════════════════════════════════════════════════════

if (process.env.NODE_ENV === 'production') {
  // Proxy /api/panynj → https://www.panynj.gov/bin/portauthority/*
  app.get('/api/panynj/*path', async (req, res) => {
    try {
      const panynj = req.path.replace('/api/panynj', '/bin/portauthority')
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
      const url = `https://www.panynj.gov${panynj}${qs}`
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const data = await r.json()
      res.json(data)
    } catch (err) {
      console.error('[PANYNJ proxy]', err.message)
      res.status(502).json({ error: 'PANYNJ unavailable' })
    }
  })

  // Proxy /api/nws/* → https://api.weather.gov/*
  app.get('/api/nws/*path', async (req, res) => {
    try {
      const nwsPath = req.path.replace('/api/nws', '')
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
      const url = `https://api.weather.gov${nwsPath}${qs}`
      const r = await fetch(url, {
        headers: { 'User-Agent': 'MyStopNow/1.0 (transit-dashboard)' },
        signal: AbortSignal.timeout(10000),
      })
      const data = await r.json()
      res.json(data)
    } catch (err) {
      console.error('[NWS proxy]', err.message)
      res.status(502).json({ error: 'NWS unavailable' })
    }
  })

  // Serve mobile assets from /mobile path
  const distRoot = path.join(__dirname, '..')
  app.use('/mobile', express.static(path.join(distRoot, 'dist', 'mobile'), { index: false }))

  // Serve dashboard assets from root
  app.use(express.static(path.join(distRoot, 'dist', 'dashboard'), { index: false }))

  // Mobile SPA catch-all (bare /mobile and /mobile/*)
  app.get('/mobile', (req, res) => {
    res.sendFile(path.join(distRoot, 'dist', 'mobile', 'mobile.html'))
  })
  app.get('/mobile/*path', (req, res) => {
    res.sendFile(path.join(distRoot, 'dist', 'mobile', 'mobile.html'))
  })

  // Desktop SPA catch-all
  app.get('*path', (req, res) => {
    res.sendFile(path.join(distRoot, 'dist', 'dashboard', 'index.html'))
  })

  console.log('[Server] Production mode — serving dist/dashboard and dist/mobile')
}

const PORT = process.env.BUS_API_PORT || 3001
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
  
  // Load GTFS and MTA caches in background — don't block startup
  setImmediate(() => {
    loadGTFS().catch(err => console.error('[GTFS] Init error:', err.message))
    
    const stationRoutesFile = path.join(__dirname, '..', '.cache', 'mta_station_routes.json')
    if (!fs.existsSync(stationRoutesFile)) {
      console.log('[MTA] Station routes cache missing — building...')
      stationRoutesBuilding = true
      import('./build_station_routes.mjs')
        .then(() => { stationRoutesBuilding = false })
        .catch(err => { stationRoutesBuilding = false; console.error('[MTA] Build error:', err.message) })
    }
    
    if (fs.existsSync(GTFS_ZIP)) {
      const ageDays = (Date.now() - fs.statSync(GTFS_ZIP).mtimeMs) / 86400_000
      const sizeMB = (fs.statSync(GTFS_ZIP).size / 1e6).toFixed(1)
      console.log(`[GTFS] Cache: ${sizeMB}MB, age: ${ageDays.toFixed(1)} days${ageDays > 3 ? ' ⚠️  consider refreshing (NJT license: 3 business days)' : ''}`)
    }
  })
})


