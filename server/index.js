/**
 * Backend proxy for transit data.
 *
 * All endpoints accept ?dir=outbound (default, Hoboken→NYC) or ?dir=inbound (NYC→Hoboken)
 */

// imports for the server start

import express from 'express'
import cors from 'cors'
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
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET'],
}))

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

const DIRECTIONS = {
  outbound: {
    label: 'Hoboken → NYC',
    busStops: {
      clinton: { name: 'Clinton St & 11th', stopIds: ['7917'], serviceNote: 'Weekdays only · AM 5:40–9:45 · PM 4:09–8:29' },
      washington: { name: 'Washington St & 11th', stopIds: ['7931'], serviceNote: null },
      willow: { name: 'Willow Ave & 15th', stopIds: ['7940', '16135'], serviceNote: null },
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
        stopIds: ['16977', '16809'],
        serviceNote: 'Peak hours only · check NJT for schedule',
        filterRoutes: ['126'],
        filterHeadsigns: ['WILLOW', 'HAMILTON PK VIA WILLOW'],
      },
      pabt_washington: {
        name: 'PABT · 126 Washington',
        gate: { day: '213', late: '323', overnight: '79' },
        stopIds: ['16977', '16808'],
        serviceNote: 'Peak hours only · check NJT for schedule',
        filterRoutes: ['126'],
        filterHeadsigns: ['PATH', 'HAMILTON PK VIA HOBOKEN'],
        excludeHeadsigns: ['WILLOW'],
      },
      pabt_119: {
        name: 'PABT · 119',
        gate: { day: '210', late: '322', overnight: '80' },
        stopIds: ['16977', '16803', '16856'],
        serviceNote: null,
        filterRoutes: ['119'],
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
let scheduleByStop = {}
let stopNamesMap = {}
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
    (Date.now() - fs.statSync(GTFS_ZIP).mtimeMs > 7 * 24 * 60 * 60 * 1000) // refresh every 7 days

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
  for (let i = 1; i < tripsCsv.length; i++) {
    const cols = tripsCsv[i].split(',')
    tripRouteMap[cols[tIdIdx]] = routesMap[cols[tRIdx]] || cols[tRIdx]
    if (tHsIdx >= 0) tripHeadsignMap[cols[tIdIdx]] = cols[tHsIdx] || ''
  }
  console.log('[GTFS] Loaded', Object.keys(tripRouteMap).length, 'trips')

  // Parse stops.txt for name lookup
  const stopsCsv = zip.readAsText('stops.txt').trim().split('\n')
  const stopsHeader = stopsCsv[0].split(',')
  const sIdIdx = stopsHeader.indexOf('stop_id')
  const sNameIdx = stopsHeader.indexOf('stop_name')
  for (let i = 1; i < stopsCsv.length; i++) {
    const cols = stopsCsv[i].split(',')
    stopNamesMap[cols[sIdIdx]] = cols[sNameIdx]
  }
  console.log('[GTFS] Loaded', Object.keys(stopNamesMap).length, 'stop names')

  const allStopIds = getAllStopIds() // null = all stops
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
}

// ══════════════════════════════════════════════════════════
// GTFS-RT caches
// ══════════════════════════════════════════════════════════

let rtCache = null, rtCacheTime = 0
let vpCache = null, vpCacheTime = 0
const RT_CACHE_TTL = 30_000

async function fetchTripUpdates() {
  if (rtCache && Date.now() - rtCacheTime < RT_CACHE_TTL) return rtCache
  const token = await getToken()
  const form = new FormData()
  form.append('token', token)
  const res = await fetch(`${NJT_API}/getTripUpdates`, { method: 'POST', body: form })
  const buf = Buffer.from(await res.arrayBuffer())
  rtCache = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))
  rtCacheTime = Date.now()
  console.log('[RT] Fetched', rtCache.entity.length, 'trip updates')
  return rtCache
}

const OCC_MAP = { 0: 'empty', 1: 'empty', 2: 'some', 3: 'full', 4: 'full', 5: 'full', 6: 'full' }

async function fetchVehiclePositions() {
  if (vpCache && Date.now() - vpCacheTime < RT_CACHE_TTL) return vpCache
  const token = await getToken()
  const form = new FormData()
  form.append('token', token)
  const res = await fetch(`${NJT_API}/getVehiclePositions`, { method: 'POST', body: form })
  const buf = Buffer.from(await res.arrayBuffer())
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))
  const occMap = {}
  for (const entity of feed.entity) {
    const vp = entity.vehicle
    if (vp?.trip?.tripId) occMap[vp.trip.tripId] = OCC_MAP[vp.occupancyStatus] ?? 'unknown'
  }
  vpCache = occMap
  vpCacheTime = Date.now()
  console.log('[VP] Fetched', Object.keys(occMap).length, 'vehicle positions')
  return occMap
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

async function getRealtimeBuses(stopIds, limit = 6, filterRoutes = null, filterHeadsigns = null, excludeHeadsigns = null) {
  const [feed, occMap] = await Promise.all([fetchTripUpdates(), fetchVehiclePositions()])
  const now = Date.now() / 1000
  const stopSet = new Set(stopIds)
  const results = []
  for (const entity of feed.entity) {
    const tu = entity.tripUpdate
    if (!tu) continue
    for (const stu of tu.stopTimeUpdate) {
      if (!stopSet.has(stu.stopId)) continue
      const t = (stu.arrival?.time?.low || stu.arrival?.time || 0) || (stu.departure?.time?.low || stu.departure?.time || 0)
      if (t && t > now) {
        const tripId = tu.trip?.tripId || ''
        const route = tripRouteMap[tripId] || '?'
        if (filterRoutes && !filterRoutes.includes(route)) continue
        const headsign = tripHeadsignMap[tripId] || ''
        const hsUpper = headsign.toUpperCase()
        if (filterHeadsigns && !filterHeadsigns.some(f => hsUpper.includes(f.toUpperCase()))) continue
        if (excludeHeadsigns && excludeHeadsigns.some(f => hsUpper.includes(f.toUpperCase()))) continue
        const d = new Date(t * 1000)
        results.push({
          route,
          eta: Math.round((t - now) / 60),
          etaTime: formatTimeFromDate(d),
          source: 'realtime', tripId,
          capacity: occMap[tripId] || 'unknown',
          headsign,
          variant: parseVariant(headsign),
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
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))
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
        if (text) alerts.push({ routes: [...routesAffected], text })
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
  '320': { day: '320', late: '320', overnight: '320' },
  '351': { day: '216', late: '323', overnight: '79' },
  '352': { day: '216', late: '323', overnight: '79' },
  '354': { day: '216', late: '323', overnight: '79' },
  '355': { day: '217', late: '323', overnight: '79' },
  '356': { day: '217', late: '323', overnight: '79' },
}

// Known PABT GTFS stop IDs (Port Authority Bus Terminal has multiple platform IDs)
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
    const stopId = req.query.id
    if (!stopId) return res.json({ routes: [], stopName: 'Unknown' })
    const entries = scheduleByStop[stopId] || []
    const routeSet = new Set(entries.map(e => e.route))
    const routes = [...routeSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const stopName = stopNamesMap[stopId] || stopId
    res.json({ routes, stopName })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Search bus stops by name — returns matching stops across all routes (deduplicated)
app.get('/api/bus/stop-search', async (req, res) => {
  try {
    await loadGTFS()
    const q = safeString(req.query.q, 50).toLowerCase()
    if (q.length < 2) return res.json({ stops: [] })

    const seenNames = new Map()
    for (const [stopId, name] of Object.entries(stopNamesMap)) {
      if (!name.toLowerCase().includes(q)) continue
      if (seenNames.has(name)) continue
      // Only include stops that have schedule data (i.e., are actually served)
      if (!scheduleByStop[stopId]) continue
      seenNames.set(name, { id: stopId, name })
    }
    const stops = [...seenNames.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30)
    res.json({ stops })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Dynamic stop query — accepts comma-separated GTFS stop IDs and optional route filter
app.get('/api/bus/stops', async (req, res) => {
  try {
    await loadGTFS()
    const stopIds = (req.query.ids || '').split(',').filter(Boolean)
    if (stopIds.length === 0) return res.json({ buses: [], stop: 'Unknown' })

    // Optional route filter (e.g. ?routes=126,22)
    const routeFilter = req.query.routes ? req.query.routes.split(',').filter(Boolean) : null

    let buses = await getRealtimeBuses(stopIds, 6, routeFilter)
    if (buses.length === 0) buses = getScheduleFallback(stopIds, 6, routeFilter)

    // Add variant and headsign info if missing
    buses = buses.map(b => {
      if (!b.variant && b.tripId) b.variant = parseVariant(tripHeadsignMap[b.tripId])
      if (!b.headsign && b.tripId) b.headsign = tripHeadsignMap[b.tripId] || ''
      return b
    })

    // Get stop name from first ID
    const stopName = stopNamesMap[stopIds[0]] || 'Unknown Stop'

    // Check if this is a PABT stop and include gate info (only for single-route selections)
    const isPabt = isPabtStop(stopIds)
    let gate = null, gateSchedule = null
    if (isPabt && routeFilter && routeFilter.length === 1) {
      const pabtGateData = getPabtGateForRoutes(routeFilter)
      if (pabtGateData) {
        gate = getCurrentGate(pabtGateData)
        gateSchedule = pabtGateData
      }
    }

    res.json({ stop: stopName, buses, gate, gateSchedule, isPabt, timestamp: new Date().toISOString() })
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
  pathCache = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))
  pathCacheTime = Date.now()
  return pathCache
}

async function fetchPathAlerts() {
  if (pathAlertCache && Date.now() - pathAlertCacheTime < PATH_ALERT_CACHE_TTL) return pathAlertCache
  const res = await fetch(PATH_ALERTS_URL, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'HobokenCommuter/1.0', 'Referer': 'https://www.panynj.gov/path/en/alerts.html' },
  })
  const data = await res.json()
  const disruptions = data.filter(a => {
    const tmpl = (a.TemplateName || '').toLowerCase()
    const msg = (a.SentMessage || '').toLowerCase()
    if (tmpl.includes('elevator') || tmpl.includes('escalator')) return false
    return msg.includes('33') || msg.includes('hoboken') || msg.includes('hob-')
      || tmpl.includes('33') || tmpl.includes('hoboken')
  })
  pathAlertCache = disruptions.length > 0 ? disruptions[0].SentMessage : null
  pathAlertCacheTime = Date.now()
  return pathAlertCache
}

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
    const alert = await fetchPathAlerts()
    res.json({ departures: departures.slice(0, 4), alert, timestamp: new Date().toISOString() })
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
    const routeLabel = [...routeSet].map(r => PATH_ROUTE_NAMES[r] || r).join('/')

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
    const alert = await fetchPathAlerts()
    res.json({ departures: departures.slice(0, 6), alert, stationName: stopName, timestamp: new Date().toISOString() })
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
      'user-agent': 'HobokenCommuter/1.0',
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
    const { stop, route, dest } = req.query
    if (!stop) return res.json({ departures: [], alert: null })

    const data = await fetchFerryData(stop)
    const departures = []
    const platform = data.platforms?.[0]
    const platformName = platform?.name || 'Unknown'

    if (platform) {
      for (const r of platform.routes || []) {
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

    departures.sort((a, b) => a.eta - b.eta)
    const alerts = platform?.alerts || []
    const alertText = alerts.length > 0 ? alerts.map(a => a.text || a).join('; ') : null
    res.json({ departures: departures.slice(0, 6), alert: alertText, platformName, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[Ferry]', err.message)
    res.status(500).json({ error: err.message })
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
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))
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
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))
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
      alerts.push({ routes: [...routes], text: text.slice(0, 200) })
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
let lirrStationsCache = null
let mnrStationsCache = null

async function loadMtaStations() {
  if (mtaStationsCache) return mtaStationsCache
  try {
    const resp = await fetch('https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip')
    const buf = Buffer.from(await resp.arrayBuffer())
    const zip = new AdmZip(buf)
    const lines = zip.readAsText('stops.txt').trim().split('\n')
    const header = lines[0].split(',')
    const idIdx = header.indexOf('stop_id')
    const nameIdx = header.indexOf('stop_name')
    const typeIdx = header.indexOf('location_type')

    const stations = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      if (cols[typeIdx] === '1') {
        stations.push({ id: cols[idIdx], name: cols[nameIdx] })
      }
    }
    stations.sort((a, b) => a.name.localeCompare(b.name))
    mtaStationsCache = stations
    console.log('[MTA] Loaded', stations.length, 'subway stations')
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
    lirrStationsCache = { stops: stops.map(s => ({ id: s.stop_id, name: s.stop_name })).sort((a, b) => a.name.localeCompare(b.name)), routes: routeMap }
    console.log('[LIRR] Loaded', lirrStationsCache.stops.length, 'stations,', Object.keys(routeMap).length, 'routes')
    return lirrStationsCache
  } catch (err) {
    console.error('[LIRR] Failed to load:', err.message)
    return { stops: [], routes: {} }
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
    // Filter out non-public stops (yards, etc.)
    const publicStops = stops.filter(s => s.stop_url && s.stop_url.includes('mta.info'))
    mnrStationsCache = { stops: publicStops.map(s => ({ id: s.stop_id, name: s.stop_name })).sort((a, b) => a.name.localeCompare(b.name)), routes: routeMap }
    console.log('[MNR] Loaded', mnrStationsCache.stops.length, 'stations,', Object.keys(routeMap).length, 'routes')
    return mnrStationsCache
  } catch (err) {
    console.error('[MNR] Failed to load:', err.message)
    return { stops: [], routes: {} }
  }
}

app.get('/api/mta/stations', async (req, res) => {
  const stations = await loadMtaStations()
  const q = (req.query.q || '').toLowerCase()
  const filtered = q ? stations.filter(s => s.name.toLowerCase().includes(q)) : stations

  // Consolidate stations with the same name — merge their stop IDs
  const byName = {}
  for (const s of filtered) {
    if (!byName[s.name]) byName[s.name] = { name: s.name, ids: [] }
    byName[s.name].ids.push(s.id)
  }

  const consolidated = Object.values(byName).slice(0, 30)
  res.json({ stations: consolidated })
})

// Get lines serving a station — uses static GTFS mapping
let stationRoutesMap = null

function loadStationRoutes() {
  if (stationRoutesMap) return stationRoutesMap
  try {
    const data = fs.readFileSync(path.join(__dirname, '..', '.cache', 'mta_station_routes.json'), 'utf8')
    stationRoutesMap = JSON.parse(data)
    console.log('[MTA] Loaded station routes for', Object.keys(stationRoutesMap).length, 'stations')
  } catch {
    stationRoutesMap = {}
  }
  return stationRoutesMap
}

app.get('/api/mta/station-lines', async (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean)
  if (ids.length === 0) return res.json({ lines: [] })

  const map = loadStationRoutes()
  const lines = new Set()
  for (const id of ids) {
    const routes = map[id]
    if (routes) routes.forEach(r => lines.add(r))
  }
  res.json({ lines: [...lines].sort() })
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
      } catch (e) { /* skip failed feeds */ }
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
    const departures = items.slice(0, 10).map(item => {
      const secLate = parseInt(item.SEC_LATE) || 0
      const status = item.STATUS || ''
      // Parse ETA from STATUS field (e.g. "in 5 Min")
      const etaMatch = status.match(/in (\d+) Min/i)
      let eta = etaMatch ? parseInt(etaMatch[1]) : null
      if (eta === null) {
        // Try to compute from scheduled time
        const schedDate = new Date(item.SCHED_DEP_DATE)
        eta = Math.max(0, Math.round((schedDate.getTime() + secLate * 1000 - now.getTime()) / 60000))
      }
      const schedDate = new Date(item.SCHED_DEP_DATE)
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

async function loadNycFerryData() {
  if (nycFerryStopsCache) return { stops: nycFerryStopsCache, routes: nycFerryRoutesCache, tripMap: nycFerryTripMapCache }
  try {
    const resp = await fetch('http://nycferry.connexionz.net/rtt/public/utility/gtfs.aspx')
    const buf = Buffer.from(await resp.arrayBuffer())
    const zip = new AdmZip(buf)
    const stopLines = zip.readAsText('stops.txt').trim().split('\n')
    const routeLines = zip.readAsText('routes.txt').trim().split('\n')
    const tripLines = zip.readAsText('trips.txt').trim().split('\n')

    // Parse stops
    const stopHeader = stopLines[0].replace(/"/g, '').split(',')
    const sIdIdx = stopHeader.indexOf('stop_id')
    const sNameIdx = stopHeader.indexOf('stop_name')
    const stops = []
    for (let i = 1; i < stopLines.length; i++) {
      const cols = stopLines[i].replace(/"/g, '').split(',')
      stops.push({ id: cols[sIdIdx], name: cols[sNameIdx] })
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

    // Parse trips — build tripId → { routeId, headsign } map
    // The realtime feed has empty routeId, so we resolve via tripId
    const tripHeader = tripLines[0].replace(/"/g, '').split(',')
    const tIdIdx = tripHeader.indexOf('trip_id')
    const tRIdIdx = tripHeader.indexOf('route_id')
    const tHsIdx = tripHeader.indexOf('trip_headsign')
    const tripMap = {}
    for (let i = 1; i < tripLines.length; i++) {
      const cols = tripLines[i].replace(/"/g, '').split(',')
      tripMap[cols[tIdIdx]] = { routeId: cols[tRIdIdx], headsign: cols[tHsIdx] || '' }
    }
    nycFerryTripMapCache = tripMap

    console.log('[NYC Ferry] Loaded', stops.length, 'stops,', Object.keys(routes).length, 'routes,', Object.keys(tripMap).length, 'trips')
    return { stops, routes, tripMap }
  } catch (err) {
    console.error('[NYC Ferry] Failed to load:', err.message)
    return { stops: [], routes: {}, tripMap: {} }
  }
}

let nycFerryFeedCache = null, nycFerryFeedTime = 0
const NYC_FERRY_CACHE_TTL = 30_000

async function fetchNycFerryFeed() {
  if (nycFerryFeedCache && Date.now() - nycFerryFeedTime < NYC_FERRY_CACHE_TTL) return nycFerryFeedCache
  const resp = await fetch('https://nycferry.connexionz.net/rtt/public/utility/gtfsrealtime.aspx/tripupdate')
  const buf = Buffer.from(await resp.arrayBuffer())
  nycFerryFeedCache = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))
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
    const feed = await fetchNycFerryFeed()
    const now = Date.now() / 1000
    const departures = []
    for (const entity of feed.entity) {
      const tu = entity.tripUpdate
      if (!tu) continue
      for (const stu of tu.stopTimeUpdate) {
        if (stu.stopId !== stop) continue
        const t = (stu.departure?.time?.low || stu.departure?.time || 0) || (stu.arrival?.time?.low || stu.arrival?.time || 0)
        if (t && t > now) {
          const d = new Date(t * 1000)
          // routeId is often empty in the feed — resolve via tripId from static GTFS
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
      headers: { 'User-Agent': 'HobokenCommuter/1.0' },
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
      headers: { 'User-Agent': 'HobokenCommuter/1.0 (commuter-dashboard)' },
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
    const { stop } = req.query
    if (!stop) return res.json({ departures: [], stationName: '' })
    const data = await loadLirrStations()
    const stationName = data.stops.find(s => s.id === stop)?.name || stop
    const feed = await fetchMtaFeed('lirr%2Fgtfs-lirr')
    const now = Date.now() / 1000
    const departures = []
    for (const entity of feed.entity) {
      const tu = entity.tripUpdate
      if (!tu) continue
      for (const stu of tu.stopTimeUpdate) {
        if (stu.stopId !== stop) continue
        const t = (stu.arrival?.time?.low || stu.arrival?.time || 0) || (stu.departure?.time?.low || stu.departure?.time || 0)
        if (t && t > now) {
          const d = new Date(t * 1000)
          const route = tu.trip?.routeId
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

// Metro-North departures
app.get('/api/mnr/query', async (req, res) => {
  try {
    const { stop } = req.query
    if (!stop) return res.json({ departures: [], stationName: '' })
    const data = await loadMnrStations()
    const stationName = data.stops.find(s => s.id === stop)?.name || stop
    const feed = await fetchMtaFeed('mnr%2Fgtfs-mnr')
    const now = Date.now() / 1000
    const departures = []
    for (const entity of feed.entity) {
      const tu = entity.tripUpdate
      if (!tu) continue
      for (const stu of tu.stopTimeUpdate) {
        if (stu.stopId !== stop) continue
        const t = (stu.arrival?.time?.low || stu.arrival?.time || 0) || (stu.departure?.time?.low || stu.departure?.time || 0)
        if (t && t > now) {
          const d = new Date(t * 1000)
          const route = tu.trip?.routeId
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

// ══════════════════════════════════════════════════════════
// Production mode — serve built frontend + proxy external APIs
// In dev, Vite handles these. In prod (NODE_ENV=production),
// Express serves dist/ and proxies PANYNJ + NWS directly.
// ══════════════════════════════════════════════════════════

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist')

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
        headers: { 'User-Agent': 'HobokenCommuter/1.0 (commuter-dashboard)' },
        signal: AbortSignal.timeout(10000),
      })
      const data = await r.json()
      res.json(data)
    } catch (err) {
      console.error('[NWS proxy]', err.message)
      res.status(502).json({ error: 'NWS unavailable' })
    }
  })

  // Serve React SPA — all non-API routes return index.html
  app.use(express.static(distPath))
  app.get('*path', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })

  console.log('[Server] Production mode — serving', distPath)
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
      import('./build_station_routes.mjs').catch(err => console.error('[MTA] Build error:', err.message))
    }
    
    if (fs.existsSync(GTFS_ZIP)) {
      const ageDays = (Date.now() - fs.statSync(GTFS_ZIP).mtimeMs) / 86400_000
      const sizeMB = (fs.statSync(GTFS_ZIP).size / 1e6).toFixed(1)
      console.log(`[GTFS] Cache: ${sizeMB}MB, age: ${ageDays.toFixed(1)} days${ageDays > 7 ? ' ⚠️  consider refreshing' : ''}`)
    }
  })
})


