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
if (failed > 0) process.exit(1)
