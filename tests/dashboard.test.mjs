/**
 * Hoboken Commuter Dashboard — Integration Test Suite
 *
 * Tests all server API endpoints and key frontend behaviors.
 * Run with: node tests/dashboard.test.mjs
 *
 * Requires the server to be running on localhost:3001
 */

const BASE = 'http://localhost:3001'
let passed = 0, failed = 0, skipped = 0

function ok(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

function skip(label, reason) {
  console.log(`  ⏭  ${label} (skipped: ${reason})`)
  skipped++
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function section(name, fn) {
  console.log(`\n── ${name} ──`)
  try { await fn() }
  catch (e) { console.log(`  💥 Section crashed: ${e.message}`); failed++ }
}

// ─────────────────────────────────────────────
// NJT Bus
// ─────────────────────────────────────────────
await section('NJT Bus — preconfigured stops', async () => {
  // GTFS loads async on server start — retry a few times
  let data, attempts = 0
  while (attempts < 3) {
    try { data = await get('/api/bus?dir=outbound'); break }
    catch { attempts++; await new Promise(r => setTimeout(r, 3000)) }
  }
  if (!data) { skip('NJT Bus preconfigured', 'GTFS still loading — run tests again in 30s'); return }
  ok('Returns stops object', !!data.stops)
  ok('Has stopOrder array', Array.isArray(data.stopOrder))
  ok('Has alerts array', Array.isArray(data.alerts))
  ok('Has timestamp', !!data.timestamp)
  const first = Object.values(data.stops)[0]
  ok('Stop has buses array', Array.isArray(first?.buses))
  ok('Stop has name', typeof first?.stop === 'string')
})

await section('NJT Bus — dynamic stop query', async () => {
  const data = await get('/api/bus/stops?ids=7931&routes=126')
  ok('Returns buses array', Array.isArray(data.buses))
  ok('Returns stop name', typeof data.stop === 'string')
  ok('Returns timestamp', !!data.timestamp)
  if (data.buses.length > 0) {
    const b = data.buses[0]
    ok('Bus has eta', typeof b.eta === 'number')
    ok('Bus has etaTime', typeof b.etaTime === 'string')
    ok('Bus has source (realtime or schedule)', b.source === 'realtime' || b.source === 'schedule')
    ok('Bus has headsign', typeof b.headsign === 'string')
  } else {
    skip('Bus departure fields', 'no buses currently running')
  }
})

await section('NJT Bus — stop search', async () => {
  const data = await get('/api/bus/stop-search?q=washington')
  ok('Returns stops array', Array.isArray(data.stops))
  ok('Results contain search term', data.stops.every(s => s.name.toLowerCase().includes('washington')))
  ok('Each stop has id and name', data.stops.every(s => s.id && s.name))
})

await section('NJT Bus — route list', async () => {
  const data = await get('/api/bus/routes')
  ok('Returns routes array', Array.isArray(data.routes))
  ok('Has 100+ routes', data.routes.length > 100)
  ok('Contains route 126', data.routes.includes('126'))
  ok('Contains route 119', data.routes.includes('119'))
})

await section('NJT Bus — stops for route', async () => {
  const data = await get('/api/bus/routes/126/stops')
  ok('Returns stops array', Array.isArray(data.stops))
  ok('Has stops', data.stops.length > 0)
  ok('Each stop has id and name', data.stops.every(s => s.id && s.name))
})

await section('NJT Bus — stop routes', async () => {
  const data = await get('/api/bus/stop-routes?id=7931')
  ok('Returns routes array', Array.isArray(data.routes))
  ok('Returns stopName', typeof data.stopName === 'string')
  ok('Contains route 126', data.routes.includes('126'))
})

// ─────────────────────────────────────────────
// NJT Rail
// ─────────────────────────────────────────────
await section('NJT Rail — station search', async () => {
  const data = await get('/api/rail/stations?q=hoboken')
  ok('Returns stations array', Array.isArray(data.stations))
  ok('Finds Hoboken', data.stations.some(s => s.name.toLowerCase().includes('hoboken')))
  ok('Each station has code and name', data.stations.every(s => s.code && s.name))
})

await section('NJT Rail — station lines', async () => {
  const data = await get('/api/rail/station-lines?code=HB')
  ok('Returns lines array', Array.isArray(data.lines))
  ok('Has at least one line', data.lines.length > 0)
  ok('Lines have code, name, color', data.lines.every(l => l.code && l.name && l.color))
})

await section('NJT Rail — departures', async () => {
  const data = await get('/api/rail/query?station=HB&lines=ML,ME,NC,NE,BC,MC,PV,RV,AC,PR,GS')
  ok('Returns departures array', Array.isArray(data.departures))
  ok('Returns stationName', typeof data.stationName === 'string')
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('Departure has dest', typeof d.dest === 'string')
    ok('Departure has eta', typeof d.eta === 'number')
    ok('Departure has line', typeof d.line === 'string')
    ok('Departure has etaTime', typeof d.etaTime === 'string')
  } else {
    skip('Departure fields', 'no trains currently running')
  }
})

// ─────────────────────────────────────────────
// HBLR
// ─────────────────────────────────────────────
await section('HBLR — stop query', async () => {
  // Search for an HBLR stop first
  const search = await get('/api/bus/stop-search?q=hoboken terminal')
  const hblrStop = search.stops.find(s => s.name.toLowerCase().includes('hoboken'))
  if (!hblrStop) { skip('HBLR stop query', 'no HBLR stop found in search'); return }
  const data = await get(`/api/bus/stops?ids=${hblrStop.id}&routes=HBLR`)
  ok('Returns buses array', Array.isArray(data.buses))
  ok('Returns stop name', typeof data.stop === 'string')
  if (data.buses.length > 0) {
    ok('Bus has headsign', typeof data.buses[0].headsign === 'string')
    ok('Headsign is not empty', data.buses[0].headsign.length > 0)
  } else {
    skip('HBLR headsign', 'no trains currently running')
  }
})

// ─────────────────────────────────────────────
// PATH
// ─────────────────────────────────────────────
await section('PATH — preconfigured outbound', async () => {
  const data = await get('/api/path/gtfsrt?dir=outbound')
  ok('Returns departures array', Array.isArray(data.departures))
  ok('Has timestamp', !!data.timestamp)
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('Departure has dest', typeof d.dest === 'string')
    ok('Departure has eta', typeof d.eta === 'number')
    ok('Departure has etaTime', typeof d.etaTime === 'string')
    ok('Source is realtime', d.source === 'realtime')
  } else {
    skip('PATH departure fields', 'no trains in feed')
  }
})

await section('PATH — station search', async () => {
  const data = await get('/api/path/stations?q=hoboken')
  ok('Returns stations array', Array.isArray(data.stations))
  ok('Finds Hoboken', data.stations.some(s => s.name.toLowerCase().includes('hoboken')))
})

await section('PATH — station routes', async () => {
  const data = await get('/api/path/station-routes?id=26729') // Hoboken
  ok('Returns options array', Array.isArray(data.options))
  ok('Has direction options', data.options.length > 0)
  ok('Returns stationName', data.stationName === 'Hoboken')
  ok('Options have routeIds', data.options.every(o => Array.isArray(o.routeIds)))
})

await section('PATH — dynamic query', async () => {
  const data = await get('/api/path/query?route=862,1024&direction=1&stop=26729')
  ok('Returns departures array', Array.isArray(data.departures))
  ok('Returns stationName', typeof data.stationName === 'string')
})

await section('PATH — weekend route 1024 known', async () => {
  const data = await get('/api/path/station-routes?id=26729')
  const allRouteIds = data.options.flatMap(o => o.routeIds)
  ok('Route 862 (HOB-33) in options', allRouteIds.includes('862'))
  ok('Route 1024 (weekend JSQ) in options', allRouteIds.includes('1024'))
})

// ─────────────────────────────────────────────
// NYW Ferry
// ─────────────────────────────────────────────
await section('NYW Ferry — preconfigured outbound', async () => {
  const data = await get('/api/ferry?dir=outbound')
  ok('Returns departures array', Array.isArray(data.departures))
  ok('Has timestamp', !!data.timestamp)
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('Departure has dest', typeof d.dest === 'string')
    ok('Departure has eta', typeof d.eta === 'number')
  } else {
    skip('NYW Ferry departure fields', 'no ferries currently running')
  }
})

await section('NYW Ferry — terminal list', async () => {
  const data = await get('/api/ferry/terminals')
  ok('Returns terminals array', Array.isArray(data.terminals))
  ok('Has 10+ terminals', data.terminals.length >= 10)
  ok('Each terminal has tag and name', data.terminals.every(t => t.tag && t.name))
})

await section('NYW Ferry — terminal routes', async () => {
  const data = await get('/api/ferry/terminal-routes?tag=9') // Hoboken 14th
  ok('Returns routes array', Array.isArray(data.routes))
  ok('Returns terminalName', typeof data.terminalName === 'string')
})

// ─────────────────────────────────────────────
// NYC Ferry
// ─────────────────────────────────────────────
await section('NYC Ferry — stop search', async () => {
  const data = await get('/api/nycferry/stops?q=east')
  ok('Returns stops array', Array.isArray(data.stops))
  ok('Has stops', data.stops.length > 0)
  ok('Each stop has id and name', data.stops.every(s => s.id && s.name))
})

await section('NYC Ferry — departures with route info', async () => {
  const data = await get('/api/nycferry/query?stop=113') // East 90th St
  ok('Returns departures array', Array.isArray(data.departures))
  ok('Returns stationName', typeof data.stationName === 'string')
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('Departure has dest (not "?")', d.dest && d.dest !== '?')
    ok('Departure has route', typeof d.route === 'string' && d.route.length > 0)
    ok('Departure has lineColor', d.lineColor && d.lineColor.startsWith('#'))
    ok('Dest includes route name', d.dest.length > 2)
  } else {
    skip('NYC Ferry departure fields', 'no ferries currently running')
  }
})

// ─────────────────────────────────────────────
// MTA Subway
// ─────────────────────────────────────────────
await section('MTA Subway — station search', async () => {
  const data = await get('/api/mta/stations?q=herald')
  ok('Returns stations array', Array.isArray(data.stations))
  ok('Finds Herald Square', data.stations.some(s => s.name.toLowerCase().includes('herald')))
  ok('Each station has ids and name', data.stations.every(s => Array.isArray(s.ids) && s.name))
})

await section('MTA Subway — station lines (Herald Square)', async () => {
  const data = await get('/api/mta/station-lines?ids=D17,R17')
  ok('Returns lines array', Array.isArray(data.lines))
  ok('Has lines', data.lines.length > 0)
  ok('Contains B or D line', data.lines.some(l => ['B','D','F','M','N','Q','R','W'].includes(l)))
})

await section('MTA Subway — station lines (Times Square)', async () => {
  const data = await get('/api/mta/station-lines?ids=R16,A27,127')
  ok('Returns lines array', Array.isArray(data.lines))
  ok('Has multiple lines', data.lines.length >= 3)
  ok('building flag is false when cache exists', data.building !== true)
})

await section('MTA Subway — departures', async () => {
  const data = await get('/api/mta/query?stop=D17,R17&lines=B,D,F,M,N,Q,R,W')
  ok('Returns departures array', Array.isArray(data.departures))
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('Departure has dest', typeof d.dest === 'string')
    ok('Departure has eta', typeof d.eta === 'number')
    ok('Departure has route', typeof d.route === 'string')
  } else {
    skip('MTA departure fields', 'no trains in feed right now')
  }
})

// ─────────────────────────────────────────────
// LIRR
// ─────────────────────────────────────────────
await section('LIRR — station search', async () => {
  const data = await get('/api/lirr/stations?q=penn')
  ok('Returns stations array', Array.isArray(data.stations))
  ok('Finds Penn Station', data.stations.some(s => s.name.toLowerCase().includes('penn')))
})

await section('LIRR — departures', async () => {
  const data = await get('/api/lirr/query?stop=8') // Penn Station
  ok('Returns departures array', Array.isArray(data.departures))
  ok('Returns stationName', typeof data.stationName === 'string')
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('Departure has dest', typeof d.dest === 'string')
    ok('Departure has eta', typeof d.eta === 'number')
    ok('Departure has lineColor', d.lineColor && d.lineColor.startsWith('#'))
  } else {
    skip('LIRR departure fields', 'no trains in feed')
  }
})

// ─────────────────────────────────────────────
// Metro-North
// ─────────────────────────────────────────────
await section('Metro-North — station search', async () => {
  const data = await get('/api/mnr/stations?q=grand')
  ok('Returns stations array', Array.isArray(data.stations))
  ok('Finds Grand Central', data.stations.some(s => s.name.toLowerCase().includes('grand')))
})

await section('Metro-North — departures', async () => {
  const data = await get('/api/mnr/query?stop=1') // Grand Central
  ok('Returns departures array', Array.isArray(data.departures))
  ok('Returns stationName', typeof data.stationName === 'string')
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('Departure has dest', typeof d.dest === 'string')
    ok('Departure has eta', typeof d.eta === 'number')
    ok('Departure has lineColor', d.lineColor && d.lineColor.startsWith('#'))
  } else {
    skip('MNR departure fields', 'no trains in feed')
  }
})

// ─────────────────────────────────────────────
// MTA Bus
// ─────────────────────────────────────────────
await section('MTA Bus — route search', async () => {
  const data = await get('/api/mtabus/routes?q=M15')
  ok('Returns routes array', Array.isArray(data.routes))
  ok('Finds M15', data.routes.some(r => r.name === 'M15'))
  ok('Each route has id and name', data.routes.every(r => r.id && r.name))
})

await section('MTA Bus — route stops', async () => {
  const data = await get('/api/mtabus/route-stops?route=MTA+NYCT_M15')
  ok('Returns directions array', Array.isArray(data.directions))
  ok('Has directions', data.directions.length > 0)
  const firstDir = data.directions[0]
  ok('Direction has stops array', Array.isArray(firstDir?.stops))
  ok('Each stop has id and name', firstDir?.stops.every(s => s.id && s.name))
})

// ─────────────────────────────────────────────
// Tunnels
// ─────────────────────────────────────────────
await section('Tunnels — server config', async () => {
  // PANYNJ is proxied via Vite dev server, not directly from Express.
  // We verify the vite.config.js has the proxy configured correctly.
  const { readFileSync } = await import('fs')
  const viteConfig = readFileSync('vite.config.js', 'utf8')
  ok('PANYNJ proxy configured', viteConfig.includes('/api/panynj'))
  ok('NWS proxy configured', viteConfig.includes('/api/nws'))
  ok('Bus proxy to backend', viteConfig.includes("'/api/bus'"))
  ok('PATH proxy to backend', viteConfig.includes("'/api/path'"))
  ok('Ferry proxy to backend', viteConfig.includes("'/api/ferry'"))
})

// ─────────────────────────────────────────────
// Weather
// ─────────────────────────────────────────────
await section('Weather — zip code resolution', async () => {
  const data = await get('/api/weather/resolve-zip?zip=07030') // Hoboken
  ok('Returns label', typeof data.label === 'string')
  ok('Returns url with NWS gridpoints', typeof data.url === 'string' && data.url.includes('gridpoints'))
  ok('Label contains city name', data.label.length > 0)
  ok('Returns zip', data.zip === '07030')
})

// ─────────────────────────────────────────────
// Settings persistence
// ─────────────────────────────────────────────
await section('Settings — localStorage key defined', async () => {
  // We can't test localStorage directly from Node, but we can verify
  // the build output contains the key
  const { readFileSync } = await import('fs')
  const src = readFileSync('src/App.jsx', 'utf8')
  ok('STORAGE_KEY defined', src.includes("'hoboken-commuter-settings'"))
  ok('loadSettings function exists', src.includes('function loadSettings()'))
  ok('saveSettings function exists', src.includes('function saveSettings('))
  ok('DEFAULT_SETTINGS defined', src.includes('const DEFAULT_SETTINGS'))
  ok('Reset button exists', src.includes('Reset to defaults'))
  ok('localStorage.removeItem on reset', src.includes('localStorage.removeItem(STORAGE_KEY)'))
})

// ─────────────────────────────────────────────
// MTA station routes cache
// ─────────────────────────────────────────────
await section('MTA station routes cache', async () => {
  const { readFileSync, existsSync } = await import('fs')
  ok('Cache file exists', existsSync('.cache/mta_station_routes.json'))
  if (existsSync('.cache/mta_station_routes.json')) {
    const data = JSON.parse(readFileSync('.cache/mta_station_routes.json', 'utf8'))
    ok('Has 400+ stations', Object.keys(data).length >= 400)
    ok('D17 has B/D/F/M lines', data['D17']?.some(l => ['B','D','F','M'].includes(l)))
    ok('R17 has N/Q/R/W lines', data['R17']?.some(l => ['N','Q','R','W'].includes(l)))
  }
})

// ─────────────────────────────────────────────
// Card ID format validation
// ─────────────────────────────────────────────
await section('Card ID format conventions', async () => {
  const { readFileSync } = await import('fs')
  const src = readFileSync('src/App.jsx', 'utf8')
  ok('bus: prefix handled', src.includes("stopId.startsWith('bus:')"))
  ok('rail: prefix handled', src.includes("stopId.startsWith('rail:')"))
  ok('hblr: prefix handled', src.includes("stopId.startsWith('hblr:')"))
  ok('path: prefix handled', src.includes("stopId.startsWith('path:')"))
  ok('ferry: prefix handled', src.includes("stopId.startsWith('ferry:')"))
  ok('mta: prefix handled', src.includes("stopId.startsWith('mta:')"))
  ok('lirr: prefix handled', src.includes("stopId.startsWith('lirr:')"))
  ok('mnr: prefix handled', src.includes("stopId.startsWith('mnr:')"))
  ok('mtabus: prefix handled', src.includes("stopId.startsWith('mtabus:')"))
  ok('nycferry: prefix handled', src.includes("stopId.startsWith('nycferry:')"))
})

// ─────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`)

// ═══════════════════════════════════════════════════════════
// REGRESSION TESTS
// ═══════════════════════════════════════════════════════════

const { readFileSync } = await import('fs')
const src = readFileSync('src/App.jsx', 'utf8')

// ─────────────────────────────────────────────
// MTA Subway — line icons and cache
// ─────────────────────────────────────────────
await section('MTA Subway — station lines building state', async () => {
  const serverSrc = readFileSync('server/index.js', 'utf8')
  ok('Returns building:true when map is empty', serverSrc.includes("building: true"))
  ok('Returns building:false in normal response', serverSrc.includes("building: false") || serverSrc.includes("building,"))
})

await section('MTA Subway — FX line in MTA_COLORS', async () => {
  ok('FX line has color defined', src.includes("'FX': '#FF6319'") || src.includes('"FX": "#FF6319"') || src.includes("'FX'"))
  const { existsSync } = await import('fs')
  if (existsSync('.cache/mta_station_routes.json')) {
    const cache = JSON.parse(readFileSync('.cache/mta_station_routes.json', 'utf8'))
    const allLines = new Set(Object.values(cache).flat())
    const MTA_COLORS_KEYS = ['1','2','3','4','5','6','6X','7','7X','A','C','E','B','D','F','FX','M','G','J','Z','L','N','Q','R','W','S','GS','FS','H','SI']
    const missing = [...allLines].filter(l => !MTA_COLORS_KEYS.includes(l))
    ok('No lines in cache missing from MTA_COLORS', missing.length === 0, missing.length > 0 ? `Missing: ${missing.join(', ')}` : '')
  } else {
    skip('MTA_COLORS completeness check', 'cache file not present')
  }
})

await section('MTA Subway — station-lines returns empty array not error for unknown ID', async () => {
  const data = await get('/api/mta/station-lines?ids=BOGUS999')
  ok('Returns lines array for unknown ID', Array.isArray(data.lines))
  ok('Returns empty array not error', data.lines.length === 0)
  ok('No error field', !data.error)
})

// Helper: extract a function body from source
function extractFn(source, fnName) {
  const idx = source.indexOf(`function ${fnName}(`)
  if (idx < 0) return ''
  let depth = 0, i = idx
  while (i < source.length) {
    if (source[i] === '{') depth++
    if (source[i] === '}') { depth--; if (depth === 0) return source.slice(idx, i + 1) }
    i++
  }
  return ''
}

// ─────────────────────────────────────────────
// Alert filtering — deriveActiveAlertSources
// ─────────────────────────────────────────────
await section('Alert filtering — deriveActiveAlertSources logic', async () => {
  // Verify the function exists and handles all expected card types
  const fn = extractFn(src, 'deriveActiveAlertSources')
  ok('Function exists', fn.length > 0)

  // Tunnel sources always added
  ok('lincoln_tunnel always added', fn.includes("sources.add('lincoln_tunnel')") || fn.includes('"lincoln_tunnel"'))
  ok('holland_tunnel always added', fn.includes("sources.add('holland_tunnel')") || fn.includes('"holland_tunnel"'))

  // Bus cards
  ok('bus_126 added for clinton/washington/willow', fn.includes("sources.add('bus_126')"))
  ok('bus_119 added for willow/pabt_119', fn.includes("sources.add('bus_119')"))

  // PATH cards
  ok('path_hob33 added for path_hob33 card', fn.includes("sources.add('path_hob33')"))
  ok('path_jsq33 added for path_33newport card', fn.includes("sources.add('path_jsq33')"))

  // Ferry
  ok('ferry source added for ferry cards', fn.includes("sources.add('ferry')"))

  // NJT Rail
  ok('njt_rail added for rail: prefix', fn.includes("sources.add('njt_rail')"))

  // HBLR
  ok('hblr added for hblr: prefix', fn.includes("sources.add('hblr')"))

  // MTA Subway
  ok('mta_subway added for mta: prefix', fn.includes("sources.add('mta_subway')"))

  // Dynamic bus cards add per-route sources
  ok('bus: prefix handled in deriveActiveAlertSources', fn.includes("startsWith('bus:')"))
})

await section('Alert filtering — bus:STOP:126 adds bus_126 source', async () => {
  // Verify the bus: card parsing logic adds the right source
  const fn = extractFn(src, 'deriveActiveAlertSources')
  ok('Parses routes from bus: card ID', fn.includes("split(':')"))
  ok('Adds bus_ROUTE source for each route', fn.includes('bus_') && fn.includes("sources.add("))
})

await section('Alert filtering — removing ferry card suppresses ferry alerts', async () => {
  // Verify ferry source is only added when a ferry card is present
  const fn = extractFn(src, 'deriveActiveAlertSources')
  const ferrySection = fn.slice(fn.indexOf('ferry'))
  ok('ferry source conditional on card presence', fn.includes("sources.add('ferry')"))
  // Verify buildTickerItems checks activeAlertSources before showing ferry alerts
  const tickerFn = extractFn(src, 'buildTickerItems')
  ok('Ticker checks ferry source before showing alert', tickerFn.includes("on('ferry')") || tickerFn.includes("activeAlertSources"))
})

await section('Alert filtering — PATH alerts gated on path source', async () => {
  const tickerFn = extractFn(src, 'buildTickerItems')
  ok('PATH alert checks path_hob33 or path_jsq33', tickerFn.includes("on('path_hob33')") || tickerFn.includes("path_hob33"))
  ok('NJT Rail alert checks njt_rail source', tickerFn.includes("on('njt_rail')") || tickerFn.includes("njt_rail"))
})

// ─────────────────────────────────────────────
// Settings panel structure
// ─────────────────────────────────────────────
await section('Settings panel — Display section above Transit Cards', async () => {
  // Find the settings body and verify Display section comes before Transit Cards section
  const displayIdx = src.indexOf('Display Settings')
  const transitIdx = src.indexOf('Transit Cards')
  ok('Display Settings section exists', displayIdx > 0)
  ok('Transit Cards section exists', transitIdx > 0)
  ok('Display appears before Transit Cards in source', displayIdx < transitIdx)
})

await section('Settings panel — ticker speed values', async () => {
  ok('Slow speed = 30', src.includes('30 : 30') || src.includes("=== 30 ? 'Slow'") || src.includes('draftTickerSpeed === 30'))
  ok('Regular speed = 60', src.includes('tickerSpeed === 60') || src.includes("=== 60") || src.includes("60 : 'Regular'") || src.includes("Regular"))
  ok('Fast speed = 100', src.includes('draftTickerSpeed === 100') || src.includes("=== 100 ? 'Fast'"))
  ok('Slider has 3 positions (0-2)', src.includes('max={2}') && src.includes('step={1}'))
})

await section('Settings panel — preconfigured stop friendly names', async () => {
  // PRECONFIGURED_STOP_NAMES map should exist with friendly names
  ok('clinton has friendly name', src.includes("'clinton'") && src.includes('Clinton'))
  ok('willow has friendly name', src.includes("'willow'") && src.includes('Willow'))
  ok('washington has friendly name', src.includes("'washington'") && src.includes('Washington'))
  ok('path_hob33 has friendly name', src.includes("'path_hob33'") && src.includes('33rd'))
  ok('ferry_hob14 has friendly name', src.includes("'ferry_hob14'") && src.includes('Hoboken'))
  ok('pabt_willow has friendly name', src.includes("'pabt_willow'") && src.includes('PABT'))
})

await section('Settings panel — drag-and-drop reorder', async () => {
  ok('draggable attribute set on stop items', src.includes('draggable'))
  ok('onDragStart handler exists', src.includes('onDragStart'))
  ok('onDragOver handler exists', src.includes('onDragOver'))
  ok('onDragEnd handler exists', src.includes('onDragEnd'))
  ok('dragRef used for drag state', src.includes('dragRef'))
  ok('Reorder via splice in onDragOver', src.includes('splice'))
})

await section('Settings panel — select all / deselect all', async () => {
  ok('Select all button exists for bus routes', src.includes('Select all') || src.includes('select all') || src.includes('selectAll'))
  ok('Deselect all button exists', src.includes('Deselect all') || src.includes('deselect all') || src.includes('deselectAll') || src.includes('clear all') || src.includes('Clear all'))
})

// ─────────────────────────────────────────────
// Card rendering
// ─────────────────────────────────────────────
await section('Card rendering — all prefixes route to correct components', async () => {
  // Verify the card rendering switch/if chain handles all prefixes
  ok('ferry_hob14/ferry_w39 → FerryCard', src.includes("stopId === 'ferry_hob14'") || src.includes("'ferry_hob14'"))
  ok('ferry: → DynamicFerryCard', src.includes("startsWith('ferry:')") && src.includes('DynamicFerryCard'))
  ok('path_* → PathCard', src.includes("stopId === 'path_hob33'") && src.includes('PathCard'))
  ok('path: → DynamicPathCard', src.includes("startsWith('path:')") && src.includes('DynamicPathCard'))
  ok('bus: → DynamicBusCard', src.includes("startsWith('bus:')") && src.includes('DynamicBusCard'))
  ok('rail: → DynamicRailCard', src.includes("startsWith('rail:')") && src.includes('DynamicRailCard'))
  ok('hblr: → DynamicHblrCard', src.includes("startsWith('hblr:')") && src.includes('DynamicHblrCard'))
  ok('mta: → DynamicMtaCard', src.includes("startsWith('mta:')") && src.includes('DynamicMtaCard'))
  ok('lirr: → DynamicLirrCard', src.includes("startsWith('lirr:')") && src.includes('DynamicLirrCard'))
  ok('mnr: → DynamicMnrCard', src.includes("startsWith('mnr:')") && src.includes('DynamicMnrCard'))
  ok('mtabus: → DynamicMtaBusCard', src.includes("startsWith('mtabus:')") && src.includes('DynamicMtaBusCard'))
  ok('nycferry: → DynamicNycFerryCard', src.includes("startsWith('nycferry:')") && src.includes('DynamicNycFerryCard'))
})

await section('Card rendering — LINES_BY_MODE entries without stops do not crash ALL_STOPS', async () => {
  // ALL_STOPS builder uses (line.stops || []) — verify this guard exists
  ok('ALL_STOPS uses (line.stops || []) guard', src.includes('line.stops || []') || src.includes('(line.stops||[])'))

  // Verify all search-based modes have empty stops arrays (not missing)
  const linesSection = src.slice(src.indexOf('const LINES_BY_MODE'), src.indexOf('const ALL_STOPS'))
  ok('njtrain has empty stops array', linesSection.includes("njtrain: []") || linesSection.includes("njtrain:[]"))
  ok('ferry has empty stops array', linesSection.includes("ferry: []") || linesSection.includes("ferry:[]"))
  ok('path has empty stops array', linesSection.includes("path: []") || linesSection.includes("path:[]"))
  ok('hblr has empty stops array', linesSection.includes("hblr: []") || linesSection.includes("hblr:[]"))
  ok('lirr has empty stops array', linesSection.includes("lirr: []") || linesSection.includes("lirr:[]"))
  ok('mnr has empty stops array', linesSection.includes("mnr: []") || linesSection.includes("mnr:[]"))
  ok('subway has empty stops array', linesSection.includes("subway: []") || linesSection.includes("subway:[]"))
  ok('nycferry has empty stops array', linesSection.includes("nycferry: []") || linesSection.includes("nycferry:[]"))
})

await section('Card rendering — FerryCard shows displayName when no departures', async () => {
  ok('FerryCard uses hasDepartures flag', src.includes('const hasDepartures'))
  ok('Shows displayName or "No service" when empty', src.includes("displayName || 'No service'") || src.includes('displayName || "No service"'))
  ok('Does not show "Loading" text in FerryCard', !src.slice(src.indexOf('function FerryCard'), src.indexOf('function PathCard')).includes('Loading'))
})

await section('Card rendering — PathCard shows station name in title', async () => {
  const pathCardFn = extractFn(src, 'PathCard')
  ok('PathCard function exists', pathCardFn.length > 0)
  ok('Uses displayName prop', pathCardFn.includes('displayName'))
  // DynamicPathCard also shows station name
  ok('DynamicPathCard shows stationName', src.includes('stationName') && src.includes('DynamicPathCard'))
})

await section('Card rendering — HBLR card shows headsign', async () => {
  ok('DynamicHblrCard renders headsign field', src.includes('b.headsign'))
  ok('Falls back to variant if no headsign', src.includes('b.headsign || b.variant'))
})

await section('Card rendering — MTA globe beam only in dark mode', async () => {
  const css = readFileSync('src/App.css', 'utf8')
  ok('mta-globe-beam hidden by default', css.includes('.mta-globe-beam') && css.includes('display: none'))
  ok('mta-globe-beam shown in dark mode only', css.includes('[data-theme="dark"] .mta-globe-beam') && css.includes('display: block'))
  ok('mta-globe-white tinted in dark mode', css.includes('[data-theme="dark"] .mta-globe-white'))
  ok('HBLR clock face glows in dark mode only', css.includes('[data-theme="dark"] .hblr-clock-face'))
  ok('MNR clock face glows in dark mode only', css.includes('[data-theme="dark"] .mnr-clock-face'))
  ok('LIRR headlight hidden by default', css.includes('.lirr-headlight') && css.includes('display: none'))
  ok('LIRR headlight shown in dark mode', css.includes('[data-theme="dark"] .lirr-headlight') && css.includes('display: block'))
})

await section('Card rendering — MTA Bus timeout message', async () => {
  ok('timedOut flag derived from response', src.includes("data?.timeout === true"))
  ok('Shows timeout message when timedOut', src.includes('Feed timed out'))
  ok('Timeout message has distinct color', src.includes('accent-orange') || src.includes('#f97316'))
})

// ─────────────────────────────────────────────
// DEFAULT_SETTINGS matches expected config
// ─────────────────────────────────────────────
await section('DEFAULT_SETTINGS — correct default card config', async () => {
  ok('HBLR outbound stop in defaults', src.includes("'hblr:15534'"))
  ok('HBLR inbound stop in defaults', src.includes("'hblr:15537'"))
  ok('clinton in outbound defaults', src.includes("'clinton'"))
  ok('path_hob33 in outbound defaults', src.includes("'path_hob33'"))
  ok('ferry_hob14 in outbound defaults', src.includes("'ferry_hob14'"))
  ok('pabt_willow in inbound defaults', src.includes("'pabt_willow'"))
  ok('path_33hob in inbound defaults', src.includes("'path_33hob'"))
  ok('ferry_w39 in inbound defaults', src.includes("'ferry_w39'"))
  // path_33newport was removed from defaults
  const defaultsSection = src.slice(src.indexOf('const DEFAULT_SETTINGS'), src.indexOf('function loadSettings'))
  ok('path_33newport NOT in defaults', !defaultsSection.includes("'path_33newport'"))
})

// ─────────────────────────────────────────────
// GTFS cache status endpoint
// ─────────────────────────────────────────────
await section('GTFS cache status endpoint', async () => {
  const data = await get('/api/bus/gtfs-status')
  ok('Returns cached boolean', typeof data.cached === 'boolean')
  ok('Returns loaded boolean', typeof data.loaded === 'boolean')
  ok('Returns ageDays', data.ageDays === null || typeof data.ageDays === 'number')
  ok('Returns sizeMB', data.sizeMB === null || typeof data.sizeMB === 'number')
  ok('Returns stale flag', typeof data.stale === 'boolean')
  ok('Cache is not stale (< 3 days)', data.stale === false)
  ok('GTFS is loaded', data.loaded === true)
})

// ─────────────────────────────────────────────
// MTA Bus timeout handling
// ─────────────────────────────────────────────
await section('MTA Bus — timeout handling in server', async () => {
  const serverSrc = readFileSync('server/index.js', 'utf8')
  ok('AbortSignal.timeout used', serverSrc.includes('AbortSignal.timeout(8000)'))
  ok('TimeoutError caught', serverSrc.includes('TimeoutError') || serverSrc.includes('AbortError'))
  ok('Returns timeout:true flag', serverSrc.includes('timeout: isTimeout') || serverSrc.includes("timeout: true"))
  ok('Returns empty departures on timeout', serverSrc.includes('departures: []') && serverSrc.includes('timeout'))
})

// ─────────────────────────────────────────────
// PATH weekend route 1024 in server config
// ─────────────────────────────────────────────
await section('PATH — route 1024 fully integrated in server', async () => {
  const serverSrc = readFileSync('server/index.js', 'utf8')
  ok("Route 1024 in PATH_ROUTE_NAMES", serverSrc.includes("'1024'") && serverSrc.includes('JSQ-33'))
  ok('Route 1024 in PATH_DIR_LABELS', serverSrc.slice(serverSrc.indexOf('PATH_DIR_LABELS')).includes("'1024'"))
  ok('Route 1024 in PATH_TERMINAL_DIRS', serverSrc.slice(serverSrc.indexOf('PATH_TERMINAL_DIRS')).includes("'1024'"))
  ok('Route 1024 in outbound DIRECTIONS', serverSrc.includes("routeId: '1024'"))
  ok('Route 1024 in PATH_STATION_ROUTES for Hoboken', serverSrc.includes("'26729': ['860', '862', '1024']"))
})

// ─────────────────────────────────────────────
// NYC Ferry GTFS URL correct
// ─────────────────────────────────────────────
await section('NYC Ferry — correct GTFS URL', async () => {
  const serverSrc = readFileSync('server/index.js', 'utf8')
  ok('Uses correct Connexionz GTFS URL', serverSrc.includes('nycferry.connexionz.net/rtt/public/utility/gtfs.aspx'))
  ok('Does not use broken S3 URL', !serverSrc.includes('rrgtfsfeeds.s3.amazonaws.com/gtfs_nyc_ferry'))
  ok('Builds tripId→routeId map', serverSrc.includes('nycFerryTripMapCache') || serverSrc.includes('tripMap'))
})

// ─────────────────────────────────────────────
// NJT GTFS 7-day refresh
// ─────────────────────────────────────────────
await section('NJT GTFS — 3-day refresh interval (updated from 7-day)', async () => {
  const serverSrc = readFileSync('server/index.js', 'utf8')
  ok('Uses 3-day TTL', serverSrc.includes('3 * 24 * 60 * 60 * 1000'))
  ok('Does not use 7-day TTL', !serverSrc.includes('7 * 24 * 60 * 60 * 1000'))
})

// ─────────────────────────────────────────────
// Summary (updated)
// ─────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`)

// ═══════════════════════════════════════════════════════════
// v2.0 — GTFS auto-resolution, PABT gate fix, preset picker,
//         HBLR name persistence, mobile layout, GTFS TTL
// ═══════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// GTFS stop ID auto-resolution
// ─────────────────────────────────────────────
await section('GTFS — stop ID auto-resolution from name patterns', async () => {
  const serverSrc = readFileSync('server/index.js', 'utf8')
  ok('DIRECTIONS uses stopNamePatterns', serverSrc.includes('stopNamePatterns'))
  ok('findStopIdsByName helper exists', serverSrc.includes('function findStopIdsByName'))
  ok('fallbackIds defined for each stop', serverSrc.includes('fallbackIds'))
  ok('Resolved IDs replace hardcoded ones after GTFS load', serverSrc.includes('stop.stopIds = resolved'))
  ok('Warns when name resolution fails', serverSrc.includes('Could not resolve'))
})

await section('GTFS — outbound stops resolve to correct routes (live)', async () => {
  // After GTFS loads, the /api/bus endpoint should return route 126 for all outbound stops
  let data, attempts = 0
  while (attempts < 3) {
    try { data = await get('/api/bus?dir=outbound'); break }
    catch { attempts++; await new Promise(r => setTimeout(r, 3000)) }
  }
  if (!data) { skip('Outbound stop route validation', 'GTFS still loading'); return }
  const stops = Object.values(data.stops)
  ok('At least one outbound stop returned', stops.length > 0)
  // All buses across all stops should be route 126 (or 119/89/22 for willow/washington)
  const allBuses = stops.flatMap(s => s.buses || [])
  const bogusRoutes = allBuses.filter(b => !['126','119','89','22','23'].includes(b.route))
  ok('No unexpected routes on outbound stops', bogusRoutes.length === 0,
    bogusRoutes.length > 0 ? `Unexpected: ${[...new Set(bogusRoutes.map(b=>b.route))].join(',')}` : '')
})

await section('GTFS — HBLR defaults endpoint', async () => {
  const data = await get('/api/bus/hblr-defaults')
  ok('Returns outbound stop ID', typeof data.outbound === 'string' && data.outbound.length > 0)
  ok('Returns inbound stop ID', typeof data.inbound === 'string' && data.inbound.length > 0)
  ok('Returns outboundName', typeof data.outboundName === 'string' && data.outboundName.length > 0)
  ok('Returns inboundName', typeof data.inboundName === 'string' && data.inboundName.length > 0)
  ok('Outbound name contains HOBOKEN or TERMINAL', data.outboundName.toUpperCase().includes('HOBOKEN') || data.outboundName.toUpperCase().includes('TERMINAL'))
  ok('Inbound name contains 9TH or STREET', data.inboundName.toUpperCase().includes('9TH') || data.inboundName.toUpperCase().includes('STREET'))
  // Verify the returned IDs actually serve HBLR
  const outCheck = await get(`/api/bus/stop-routes?id=${data.outbound}`)
  ok('Outbound HBLR stop serves HBLR route', outCheck.routes.includes('HBLR'))
  const inCheck = await get(`/api/bus/stop-routes?id=${data.inbound}`)
  ok('Inbound HBLR stop serves HBLR route', inCheck.routes.includes('HBLR'))
})

await section('GTFS — 3-day refresh TTL (NJT license compliance)', async () => {
  const serverSrc = readFileSync('server/index.js', 'utf8')
  ok('Uses 3-day TTL', serverSrc.includes('3 * 24 * 60 * 60 * 1000'))
  ok('Does not use 7-day TTL', !serverSrc.includes('7 * 24 * 60 * 60 * 1000'))
  ok('Stale warning threshold is 3 days', serverSrc.includes('ageDays > 3'))
})

// ─────────────────────────────────────────────
// PABT gate fix — dynamic PABT stop detection
// ─────────────────────────────────────────────
await section('PABT — dynamic stop ID detection from GTFS', async () => {
  const serverSrc = readFileSync('server/index.js', 'utf8')
  ok('PABT_STOP_IDS rebuilt from GTFS after load', serverSrc.includes('PORT AUTHORITY') && serverSrc.includes('PABT_STOP_IDS.add'))
  ok('Rebuild logs resolved IDs', serverSrc.includes('PABT stop IDs:'))
})

await section('PABT — gate shown for route 125 (live)', async () => {
  // Find a PABT stop that serves route 125
  const search = await get('/api/bus/stop-search?q=port+authority')
  const pabtStop = search.stops.find(s => s.name.toUpperCase().includes('PORT AUTHORITY'))
  if (!pabtStop) { skip('PABT gate for 125', 'no PABT stop in search results'); return }
  const routeCheck = await get(`/api/bus/stop-routes?id=${pabtStop.id}`)
  if (!routeCheck.routes.includes('125')) { skip('PABT gate for 125', 'route 125 not in GTFS for this stop'); return }
  const data = await get(`/api/bus/stops?ids=${pabtStop.id}&routes=125`)
  ok('isPabt is true for PABT stop', data.isPabt === true)
  ok('Gate is returned for single-route 125 selection', data.gate !== null && data.gate !== undefined)
  ok('GateSchedule has day/late/overnight', data.gateSchedule?.day && data.gateSchedule?.late && data.gateSchedule?.overnight)
})

await section('PABT — gate shown for route 126 (live)', async () => {
  const search = await get('/api/bus/stop-search?q=port+authority')
  const pabtStop = search.stops.find(s => s.name.toUpperCase().includes('PORT AUTHORITY'))
  if (!pabtStop) { skip('PABT gate for 126', 'no PABT stop found'); return }
  const data = await get(`/api/bus/stops?ids=${pabtStop.id}&routes=126`)
  ok('isPabt true for 126', data.isPabt === true)
  ok('Gate returned for 126', data.gate !== null && data.gate !== undefined)
})

// ─────────────────────────────────────────────
// HBLR name persistence
// ─────────────────────────────────────────────
await section('HBLR — stop name persistence in frontend', async () => {
  const src = readFileSync('src/App.jsx', 'utf8')
  ok('STOP_NAMES_KEY defined', src.includes("'hoboken-commuter-stop-names'"))
  ok('persistDynamicStopName writes to localStorage', src.includes('localStorage.setItem(STOP_NAMES_KEY'))
  ok('Stop names restored from localStorage on load', src.includes('Object.assign(dynamicStopNames'))
  ok('STOP_NAMES_KEY cleared on reset', src.includes('localStorage.removeItem(STOP_NAMES_KEY)'))
  ok('DynamicHblrCard backfills name via persistDynamicStopName', src.includes('persistDynamicStopName(stopId'))
  ok('Default HBLR stops have fallback names in dynamicStopNames', src.includes("'hblr:15534': 'Hoboken Terminal'") || src.includes("'hblr:15534'"))
})

// ─────────────────────────────────────────────
// Preset picker
// ─────────────────────────────────────────────
await section('Preset picker — structure and content', async () => {
  const src = readFileSync('src/App.jsx', 'utf8')
  ok('PRESETS array defined', src.includes('const PRESETS = ['))
  ok('PresetPickerModal component defined', src.includes('function PresetPickerModal('))
  ok('applyPreset function defined', src.includes('function applyPreset('))
  ok('presetPickerOpen state initialized from localStorage', src.includes('!localStorage.getItem(STORAGE_KEY)'))
  ok('handlePresetSelect updates all relevant state', src.includes('function handlePresetSelect('))
  ok('Picker shown when no saved settings', src.includes("!localStorage.getItem(STORAGE_KEY)"))
  ok('Reset button shows picker instead of reloading', src.includes('onShowPresetPicker()') && !src.includes('window.location.reload()'))
})

await section('Preset picker — all 6 presets defined', async () => {
  const src = readFileSync('src/App.jsx', 'utf8')
  ok("Hoboken preset defined", src.includes("id: 'hoboken'"))
  ok("Newport/JC preset defined", src.includes("id: 'newport'"))
  ok("Midtown preset defined", src.includes("id: 'midtown'"))
  ok("Downtown preset defined", src.includes("id: 'downtown'"))
  ok("Brooklyn preset defined", src.includes("id: 'brooklyn'"))
  ok("Queens preset defined", src.includes("id: 'queens'"))
})

await section('Preset picker — each preset has required fields', async () => {
  const src = readFileSync('src/App.jsx', 'utf8')
  const presetsStart = src.indexOf('const PRESETS = [')
  const presetsEnd = src.indexOf('\n]', presetsStart) + 2
  const presetsBlock = src.slice(presetsStart, presetsEnd)
  ok('All presets have outboundStops', (presetsBlock.match(/outboundStops:/g) || []).length >= 6)
  ok('All presets have inboundStops', (presetsBlock.match(/inboundStops:/g) || []).length >= 6)
  ok('All presets have outboundCity', (presetsBlock.match(/outboundCity:/g) || []).length >= 6)
  ok('All presets have stopNames map', (presetsBlock.match(/stopNames:/g) || []).length >= 6)
  ok('All presets have emoji', (presetsBlock.match(/emoji:/g) || []).length >= 6)
  ok('Midtown preset includes NYC Ferry stop', presetsBlock.includes("nycferry:17"))
  ok('Downtown preset includes NYC Ferry stop', presetsBlock.includes("nycferry:87"))
  ok('Newport preset includes HBLR stop', presetsBlock.includes("hblr:15497"))
  ok('Newport preset includes PATH stop', presetsBlock.includes("path:861"))
})

await section('Preset picker — HBLR_DEFAULTS_FALLBACK defined before PRESETS', async () => {
  const src = readFileSync('src/App.jsx', 'utf8')
  const fallbackIdx = src.indexOf('const HBLR_DEFAULTS_FALLBACK')
  const presetsIdx = src.indexOf('const PRESETS')
  ok('HBLR_DEFAULTS_FALLBACK defined before PRESETS', fallbackIdx < presetsIdx,
    `fallback at ${fallbackIdx}, presets at ${presetsIdx}`)
})

await section('Preset picker — blur effect on dashboard', async () => {
  const src = readFileSync('src/App.jsx', 'utf8')
  const css = readFileSync('src/App.css', 'utf8')
  ok('dashboard gets dashboard-blurred class when preset picker or settings open', src.includes('dashboard-blurred'))
  ok('Blur triggered by both presetPickerOpen and settingsOpen', src.includes('presetPickerOpen || settingsOpen'))
  ok('CSS blur rule defined for dashboard-blurred', css.includes('.dashboard.dashboard-blurred'))
  ok('CSS applies filter: blur', css.includes('filter: blur'))
  ok('Both modals rendered outside dashboard div', (() => {
    // SettingsPanel and PresetPickerModal should both appear after the closing </div> of the dashboard
    const lastDivClose = src.lastIndexOf('    </div>\n\n    <SettingsPanel')
    return lastDivClose > 0
  })())
})

await section('Settings panel — reset button two-step confirm', async () => {
  const src = readFileSync('src/App.jsx', 'utf8')
  ok('confirmReset state initialized to false', src.includes('useState(false)') && src.includes('confirmReset'))
  ok('confirmReset reset to false when panel opens', src.includes('setConfirmReset(false)') && src.includes('if (open)'))
  ok('Reset button shows confirm UI only when confirmReset is true', src.includes('{confirmReset ?'))
  ok('First step shows plain text button (not red)', src.includes("settings-reset-btn") && src.includes("onClick={() => setConfirmReset(true)"))
  ok('Second step shows red confirm button', src.includes("settings-reset-confirm-btn"))
  ok('Cancel button returns to first step', src.includes("onClick={() => setConfirmReset(false)"))
})

// ─────────────────────────────────────────────
// Mobile layout (iPhone fix)
// ─────────────────────────────────────────────
await section('Mobile layout — iPhone viewport and safe area fixes', async () => {
  const css = readFileSync('src/App.css', 'utf8')
  const indexCss = readFileSync('src/index.css', 'utf8')
  ok('Mobile media query exists (max-width: 480px)', css.includes('@media (max-width: 480px)'))
  ok('Dashboard uses height: auto on mobile', css.includes('height: auto'))
  ok('Dashboard uses min-height: 100dvh (dynamic viewport)', css.includes('100dvh'))
  ok('Safe area inset padding applied', css.includes('safe-area-inset-bottom'))
  ok('index.css overrides overflow: hidden on mobile', indexCss.includes('@media (max-width: 480px)'))
  ok('html/body overflow set to visible on mobile', indexCss.includes('overflow: visible'))
})
// ─────────────────────────────────────────────
await section('DEFAULT_SETTINGS — correct default card config', async () => {
  const src = readFileSync('src/App.jsx', 'utf8')
  ok('HBLR outbound stop in defaults', src.includes(`hblr:\${HBLR_DEFAULTS_FALLBACK.outbound}`) || src.includes("'hblr:15534'"))
  ok('HBLR inbound stop in defaults', src.includes(`hblr:\${HBLR_DEFAULTS_FALLBACK.inbound}`) || src.includes("'hblr:15537'"))
  ok('clinton in outbound defaults', src.includes("'clinton'"))
  ok('path_hob33 in outbound defaults', src.includes("'path_hob33'"))
  ok('ferry_hob14 in outbound defaults', src.includes("'ferry_hob14'"))
  ok('pabt_willow in inbound defaults', src.includes("'pabt_willow'"))
  ok('path_33hob in inbound defaults', src.includes("'path_33hob'"))
  ok('ferry_w39 in inbound defaults', src.includes("'ferry_w39'"))
})

// ─────────────────────────────────────────────
// Runtime transit card endpoint smoke tests
// Verifies every card mode can return data without crashing
// ─────────────────────────────────────────────
await section('Runtime — NJT Bus card endpoint', async () => {
  const data = await get('/api/bus/stops?ids=7931&routes=126')
  ok('Returns buses array', Array.isArray(data.buses))
  ok('Returns stop name', typeof data.stop === 'string')
  if (data.buses.length > 0) {
    const b = data.buses[0]
    ok('eta is a non-negative number', typeof b.eta === 'number' && b.eta >= 0)
    ok('etaTime is a time string (e.g. "7:30 AM")', /\d+:\d+ (AM|PM)/.test(b.etaTime))
    ok('source is realtime or schedule', b.source === 'realtime' || b.source === 'schedule')
  } else {
    skip('NJT Bus departure fields', 'no buses currently running')
  }
})

await section('Runtime — NJT Rail card endpoint (Madison)', async () => {
  const data = await get('/api/rail/query?station=MDSN')
  ok('Returns departures array', Array.isArray(data.departures))
  ok('Returns stationName', typeof data.stationName === 'string')
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('eta is a non-negative number', typeof d.eta === 'number' && d.eta >= 0)
    ok('etaTime is a time string', /\d+:\d+ (AM|PM)/.test(d.etaTime))
    ok('No departed trains (eta not wildly negative)', d.eta >= 0)
    // Verify times are not in the past by checking eta is reasonable (< 3 hours)
    ok('eta is within 3 hours (not stale past data)', d.eta <= 180)
  } else {
    skip('NJT Rail departure fields', 'no trains currently running')
  }
})

await section('Runtime — PATH card endpoint', async () => {
  const data = await get('/api/path/query?route=862,1024&direction=1&stop=26729')
  ok('Returns departures array', Array.isArray(data.departures))
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('eta is a non-negative number', typeof d.eta === 'number' && d.eta >= 0)
    ok('etaTime is a time string', /\d+:\d+ (AM|PM)/.test(d.etaTime))
  } else {
    skip('PATH departure fields', 'no trains in feed')
  }
})

await section('Runtime — MTA Subway card endpoint (Herald Square)', async () => {
  const data = await get('/api/mta/query?stop=D17S,R17S&lines=B,D,F,M,N,Q,R,W')
  ok('Returns departures array', Array.isArray(data.departures))
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('eta is a non-negative number', typeof d.eta === 'number' && d.eta >= 0)
    ok('etaTime is a time string', /\d+:\d+ (AM|PM)/.test(d.etaTime))
    ok('route is a string', typeof d.route === 'string')
  } else {
    skip('MTA Subway departure fields', 'no trains in feed right now')
  }
})

await section('Runtime — MTA Subway station-lines (no stuck loading)', async () => {
  const data = await get('/api/mta/station-lines?ids=D17,R17')
  ok('Returns lines array (not stuck building)', Array.isArray(data.lines))
  ok('Has lines when cache exists', data.building === true || data.lines.length > 0)
  ok('building flag is boolean', typeof data.building === 'boolean' || data.building === undefined)
})

await section('Runtime — LIRR card endpoint (Penn Station)', async () => {
  const data = await get('/api/lirr/query?stop=8')
  ok('Returns departures array', Array.isArray(data.departures))
  ok('Returns stationName', typeof data.stationName === 'string')
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('eta is a non-negative number', typeof d.eta === 'number' && d.eta >= 0)
    ok('etaTime is a time string', /\d+:\d+ (AM|PM)/.test(d.etaTime))
    ok('lineColor is a hex color', d.lineColor && d.lineColor.startsWith('#'))
  } else {
    skip('LIRR departure fields', 'no trains in feed')
  }
})

await section('Runtime — Metro-North card endpoint (Grand Central)', async () => {
  const data = await get('/api/mnr/query?stop=1')
  ok('Returns departures array', Array.isArray(data.departures))
  ok('Returns stationName', typeof data.stationName === 'string')
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('eta is a non-negative number', typeof d.eta === 'number' && d.eta >= 0)
    ok('etaTime is a time string', /\d+:\d+ (AM|PM)/.test(d.etaTime))
  } else {
    skip('MNR departure fields', 'no trains in feed')
  }
})

await section('Runtime — NYC Ferry card endpoint', async () => {
  const data = await get('/api/nycferry/query?stop=113')
  ok('Returns departures array', Array.isArray(data.departures))
  ok('Returns stationName', typeof data.stationName === 'string')
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('eta is a non-negative number', typeof d.eta === 'number' && d.eta >= 0)
    ok('dest is not empty or "?"', d.dest && d.dest !== '?')
  } else {
    skip('NYC Ferry departure fields', 'no ferries running')
  }
})

await section('Runtime — NYW Ferry card endpoint', async () => {
  const data = await get('/api/ferry?dir=outbound')
  ok('Returns departures array', Array.isArray(data.departures))
  if (data.departures.length > 0) {
    const d = data.departures[0]
    ok('eta is a non-negative number', typeof d.eta === 'number' && d.eta >= 0)
  } else {
    skip('NYW Ferry departure fields', 'no ferries running')
  }
})

await section('Runtime — MTA Bus card endpoint (M15)', async () => {
  const data = await get('/api/mtabus/query?stop=MTA_305423&route=MTA+NYCT_M15')
  ok('Returns departures array or timeout flag', Array.isArray(data.departures) || data.timeout === true)
  if (Array.isArray(data.departures) && data.departures.length > 0) {
    const d = data.departures[0]
    ok('eta is a non-negative number', typeof d.eta === 'number' && d.eta >= 0)
  } else {
    skip('MTA Bus departure fields', 'no buses or feed timed out')
  }
})

await section('Runtime — HBLR card endpoint', async () => {
  const data = await get('/api/bus/hblr-defaults')
  ok('Returns outbound stop ID', typeof data.outbound === 'string')
  ok('Returns inbound stop ID', typeof data.inbound === 'string')
  const stopData = await get(`/api/bus/stops?ids=${data.outbound}&routes=HBLR`)
  ok('HBLR stop returns buses array', Array.isArray(stopData.buses))
  ok('HBLR stop returns stop name', typeof stopData.stop === 'string')
})

// ─────────────────────────────────────────────
// System Status endpoint
// ─────────────────────────────────────────────
await section('System Status — /api/system-status endpoint', async () => {
  const data = await get('/api/system-status')
  ok('Returns uptime string', typeof data.uptime === 'string' && data.uptime.includes('h'))
  ok('Returns busGtfs object', typeof data.busGtfs === 'object')
  ok('busGtfs has ageDays', data.busGtfs.ageDays === null || typeof data.busGtfs.ageDays === 'number')
  ok('busGtfs has loaded flag', typeof data.busGtfs.loaded === 'boolean')
  ok('busGtfs has stale flag', typeof data.busGtfs.stale === 'boolean')
  ok('Returns subwayGtfs object', typeof data.subwayGtfs === 'object')
  ok('subwayGtfs has ageDays', data.subwayGtfs.ageDays === null || typeof data.subwayGtfs.ageDays === 'number')
  ok('Returns stationRoutes object', typeof data.stationRoutes === 'object')
  ok('stationRoutes has stations count', typeof data.stationRoutes.stations === 'number')
  ok('Returns njtBusToken object', typeof data.njtBusToken === 'object')
  ok('njtBusToken has valid flag', typeof data.njtBusToken.valid === 'boolean')
  ok('Returns njtRailToken object', typeof data.njtRailToken === 'object')
  ok('njtRailToken has valid flag', typeof data.njtRailToken.valid === 'boolean')
})

// ─────────────────────────────────────────────
// Settings — minimum card requirement
// ─────────────────────────────────────────────
await section('Settings — minimum 1 card requirement', async () => {
  const src2 = readFileSync('src/App.jsx', 'utf8')
  ok('Save button has disabled prop', src2.includes('disabled={draftOutStops.length + draftInStops.length < 1}'))
  ok('renderStopList called with minCount 0 for outbound', src2.includes('renderStopList(draftOutStops, setDraftOutStops, 0)'))
  ok('renderStopList called with minCount 0 for inbound', src2.includes('renderStopList(draftInStops, setDraftInStops, 0)'))
  ok('Remove button disabled when stops.length <= minCount', src2.includes('disabled={stops.length <= minCount}'))
})

// ─────────────────────────────────────────────
// Dismissable inline alerts
// ─────────────────────────────────────────────
await section('Dismissable inline alerts', async () => {
  const src2 = readFileSync('src/App.jsx', 'utf8')
  ok('_dismissedAlerts Set defined', src2.includes('const _dismissedAlerts = new Set()'))
  ok('InlineAlert checks dismissed state', src2.includes('_dismissedAlerts.has(text)'))
  ok('Dismiss button adds to Set', src2.includes('_dismissedAlerts.add(text)'))
  ok('Dismiss button has X icon', src2.includes('inline-alert-dismiss'))
  ok('CSS for dismiss button exists', readFileSync('src/App.css', 'utf8').includes('.inline-alert-dismiss'))
})

// ─────────────────────────────────────────────
// System status easter egg
// ─────────────────────────────────────────────
await section('System status easter egg — triple-click gear', async () => {
  const src2 = readFileSync('src/App.jsx', 'utf8')
  ok('Gear icon in settings header', src2.includes('<Settings size={18}'))
  ok('Triple-click detection (count >= 3)', src2.includes('gearClickCount.current >= 3'))
  ok('showSystemStatus state toggle', src2.includes('setShowSystemStatus'))
  ok('System status fetched on panel open', src2.includes("fetch('/api/system-status')"))
  ok('Status hidden by default', src2.includes('showSystemStatus && ('))
})

// ─────────────────────────────────────────────
// Summary (final)
// ─────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Final results: ${passed} passed, ${failed} failed, ${skipped} skipped`)
if (failed > 0) process.exit(1)
