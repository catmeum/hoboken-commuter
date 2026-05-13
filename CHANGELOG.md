# Hoboken Commuter Dashboard — Version History

## v2.0.0 (2026-05-13)

### Neighborhood Preset Picker
- First-load onboarding modal: new users pick their neighborhood before seeing the dashboard
- 6 presets: Hoboken, Newport/JC, Midtown Manhattan, Downtown Manhattan, Brooklyn, Queens
- Each preset populates both outbound and inbound card lists with relevant transit stops
- Midtown and Downtown presets include NYC Ferry stops (E34th St and Wall St/Pier 11)
- Newport preset includes Bus 119, PATH (Newport + Grove St), HBLR Newport, NYW Ferry Paulus Hook
- Dashboard blurs and dims behind the picker (`filter: blur(4px) brightness(0.7)`) to reduce distraction
- Reset button in settings now shows the preset picker instead of doing a hard page reload
- Stop names for all preset stops written to `dynamicStopNames` immediately — settings panel shows friendly labels without waiting for API responses

### GTFS Stop ID Auto-Resolution
- Hardcoded GTFS stop IDs replaced with name-pattern-based resolution
- After each GTFS load, `findStopIdsByName()` searches `stops.txt` by name patterns (e.g. `['CLINTON', '11TH']`) and updates `DIRECTIONS` stop IDs automatically
- HBLR default stops resolved the same way via `/api/bus/hblr-defaults` endpoint
- Frontend fetches HBLR defaults on load and migrates stale IDs in localStorage
- Fallback IDs used only if name resolution fails (logged as `⚠️` warning)
- Fixes bus routes showing wrong numbers after NJT GTFS update (stop IDs had changed)

### PABT Gate Fix for Dynamic Routes
- `PABT_STOP_IDS` set rebuilt from GTFS after each load — any stop named "PORT AUTHORITY" is included
- Previously, dynamically-added PABT routes (e.g. 125) showed no gate because new GTFS assigned different platform IDs not in the hardcoded set
- Gate info now works correctly for all PABT routes added via the picker

### HBLR Stop Name Persistence
- Dynamic stop names (HBLR, bus, PATH, etc.) now persisted to `localStorage` under `hoboken-commuter-stop-names`
- Settings panel shows friendly names after page reload (was showing raw IDs like `hblr:15534`)
- `persistDynamicStopName()` helper writes to both in-memory cache and localStorage
- `DynamicHblrCard` backfills name from API response on first load
- Reset clears both `hoboken-commuter-settings` and `hoboken-commuter-stop-names`

### Mobile Layout Fixes (iPhone)
- `100dvh` (dynamic viewport height) replaces `100vh` — fixes content cut off by iOS Safari browser chrome
- `env(safe-area-inset-bottom)` padding added — fixes content hidden behind iPhone home indicator
- `html/body/#root` overflow overridden to `visible` on mobile — was blocking scroll
- Dashboard height set to `auto` on mobile with `min-height: 100dvh`

### GTFS Cache TTL Reduced to 3 Days
- Changed from 7 days to 3 days to comply with NJT license (download within 3 business days of update)
- Stale warning threshold updated to match

### Google Analytics
- GA4 tag added to `index.html`
- Custom `settings_saved` event fires on every Save Changes with full card config payload

### Pull-to-Refresh
- Pull-down gesture on mobile triggers a full data refresh across all cards
- Blue progress bar indicator shown during refresh

### Integration Test Suite Expanded
- New test sections: GTFS auto-resolution, HBLR defaults endpoint, PABT gate detection, preset picker structure, HBLR name persistence, mobile layout CSS
- Live runtime tests: verifies outbound stops return only expected routes, HBLR stop IDs serve HBLR route, PABT gate returned for routes 125 and 126
- Static analysis tests: verifies HBLR_DEFAULTS_FALLBACK defined before PRESETS (prevents blank-page ReferenceError), blur CSS present, PresetPickerModal outside dashboard div

---

## v1.9.0 (2026-04-26)

### Production Deployment (AWS Lightsail)
- App is now live on AWS Lightsail VPS with auto-deploy via GitHub Actions
- GitHub Actions workflow: push to `master` → SSH → pull → `npm ci` → `npm run build` → pm2 restart
- `paths-ignore` added to workflow so doc-only pushes don't trigger deploys
- Production server mode: Express serves built React SPA from `dist/` and proxies PANYNJ + NWS directly

### Rate Limiting & Security
- `express-rate-limit` added: global 300 req/min per IP, strict 30 req/min on NJT Rail / MTA Bus / weather zip
- Localhost (`127.0.0.1`, `::1`) exempt from all rate limits (dev/test never blocked)
- CORS restricted to `ALLOWED_ORIGIN` env var (defaults to `*` in dev)
- Input sanitization on bus stop search and weather zip endpoints

### Bug Fixes
- **Express 5 wildcard routes** — unnamed `/*` throws in Express 5 (`path-to-regexp` v8); renamed to `/*path` on all three routes (`/api/panynj/*path`, `/api/nws/*path`, `*path` catch-all)
- **`/api/bus/gtfs-status` returning HTML** — endpoint was registered after `app.listen()`, after the production `*path` catch-all; moved before the production block so it responds correctly
- **Regression test suite expanded** — 238 tests, 0 failures; covers alert filtering logic, settings panel structure, card routing, dark mode CSS, and all deployment-related code paths

---

## v1.8.0 (2026-04-25)

### Custom Transit Icons
- **HBLR** — Hoboken Lackawanna Terminal clocktower SVG replaces generic train icon; clock face glows teal in dark mode
- **LIRR** — M7/M9 commuter train profile (blue nose, silver body, yellow safety stripe); headlight appears in dark mode
- **Metro-North** — Grand Central information booth clock redesigned with flat pedestal base; opal face glows gold in dark mode; pedestal stays flat
- **MTA Subway** — settings picker now uses the MtaGlobeIcon to match the card (was generic TrainFront)
- **MTA Globe** — dark mode now shows warm yellow tint on white half + trapezoid light beam fanning downward
- All icon glows are element-scoped (not whole-SVG filter) for precision

### NY Waterway renamed to "NYW Ferry"
- Card titles, settings picker, alert source names, and picker dialog updated
- Distinguishes clearly from NYC Ferry

### HBLR destination display
- Headsign (e.g. "Hoboken Terminal", "Bayonne") now shown on each departure row
- Was missing from realtime response — fixed in both server and card

### PATH fixes
- Feed only reports each train's next stop, not full itinerary — fixed by matching route+direction only (not stop ID)
- Weekend/holiday service: route ID `1024` (JSQ-33 via Hoboken) added to all route maps, station configs, and direction labels
- Both `862` (HOB-33) and `1024` (JSQ-33 wknd) now show correctly on weekends

### NYC Ferry destination fix
- Realtime feed has empty `routeId` — fixed by building `tripId → routeId + headsign` map from static GTFS `trips.txt`
- Fixed broken GTFS URL (was pointing at a 403 S3 bucket; now uses official Connexionz endpoint)
- Departures now show route name + headsign (e.g. "Astoria → Wall St./Pier 11")

### MTA Subway station lines fix
- `.cache/mta_station_routes.json` was missing after fresh clone — added `server/build_station_routes.mjs`
- Server auto-builds the file on startup if absent
- Station line picker now correctly shows all lines for any station

### Settings persistence
- All settings saved to `localStorage` under key `hoboken-commuter-settings`
- Loads persisted settings on startup; falls back to defaults for new users
- Default configuration updated to match current setup (HBLR added to both directions)
- Reset button at bottom of settings panel with inline confirmation step

### Transit card drag-to-reorder
- Replaced ↑/↓ arrow buttons with HTML5 drag-and-drop
- Grab the GripVertical handle and drag a card to its new position

### NJT GTFS refresh interval
- Changed from 24 hours to 7 days — NJT publishes updates sporadically, not daily
- Added `/api/bus/gtfs-status` endpoint showing cache age, size, and stale flag
- Server startup now logs GTFS cache age with ⚠️ warning if over 7 days

### MTA Bus timeout handling
- SIRI API requests now have an 8-second timeout via `AbortSignal.timeout`
- On timeout: card shows "Feed timed out — try again shortly" in orange instead of silent empty state
- Server logs timeout warnings; returns `{ timeout: true }` flag in response

### Integration test suite
- `npm test` runs 134 tests across all server endpoints
- Covers NJT Bus/Rail, HBLR, PATH (including weekend route 1024), NYW Ferry, NYC Ferry, MTA Subway/Bus, LIRR, Metro-North, Weather, settings persistence, station routes cache, and all 10 card ID prefixes

---

## v1.7.0 (2026-04-24)

### LIRR Integration
- 127 stations, 13 branches with official colors from GTFS static data
- Real-time departures via MTA GTFS-RT feed
- Search-based station picker, creates `lirr:STOP_ID` cards

### Metro-North Integration
- ~100 public stations, 6 lines (Hudson, Harlem, New Haven, New Canaan, Danbury, Waterbury)
- Real-time departures via MTA GTFS-RT feed
- Custom Grand Central Terminal clock icon (golden, shows 4:20, dark mode radium glow)
- Search-based station picker, creates `mnr:STOP_ID` cards

### MTA Bus Integration
- 286+ routes across MTA NYCT and MTABC agencies
- Real-time arrivals via Bus Time SIRI API with distance info
- Inline service alerts from SIRI SituationExchange
- Route search → stop selection picker, creates `mtabus:STOP_ID:ROUTE` cards

### NYC Ferry Integration
- 50 stops, 8 routes (Astoria, East River, Rockaway, South Brooklyn, St. George, etc.)
- GTFS static for station names and route colors, GTFS-RT for real-time departures
- Search-based stop picker, creates `nycferry:STOP_ID` cards

### Transit Card Icon Colors
- Each transit provider now has a distinct icon color for visual differentiation
- NJ Transit Bus: theme-aware (white/black), NJT Rail: green, PATH: blue
- NY Waterway: red, NYC Ferry: teal, HBLR: purple, MTA Subway: blue (globe)
- LIRR: MTA blue, MTA Bus: MTA blue, Metro-North: golden clock icon

### Tunnel Selector
- Tunnel selector in settings now fully functional (was "Coming Soon")
- Select up to 2 from 7 PANYNJ crossings: Lincoln, Holland, GWB Upper/Lower, Goethals, Bayonne, Outerbridge
- Tunnel card header shows "NJ → NY" / "NY → NJ" instead of city names

### Weather Improvements
- Weather location now tied to city settings (zip code based)
- Any US zip code resolves to city name + NWS forecast grid
- Weather auto-switches with direction toggle
- Location badge is now static (not clickable)

### Display Settings
- Show/hide toggles for tunnel card and weather card
- Inline alert duration "Ticker only" fix — now properly suppresses inline alerts on ALL card types
- Separate weather settings removed (unified with city zip code)

### Other
- All transit modes enabled in settings picker (no more "Coming Soon")
- `inlineAlertDuration` uses nullish coalescing (`??`) instead of `||` to properly handle 0

---

## v1.6.0 (2026-04-23)

### NJ Transit Rail Integration
- All 173 NJT Rail stations searchable in the picker
- 11 rail lines with official NJT brand colors: NEC, NJCL, M&E, Gladstone, Main, Bergen County, Montclair-Boonton, Pascack Valley, Raritan Valley, Atlantic City, Princeton Branch
- Real-time departures via `raildata.njtransit.com` TrainData JSON API (same credentials as bus)
- Line selection with select all/deselect all, creates `rail:STATION:LINES` card ID
- Station alerts shown inline on cards and in scrolling ticker
- Train capacity data available in API (not yet displayed)
- Polls every 60 seconds (rate-limit aware — 40K calls/day)
- Server endpoints: `/api/rail/stations`, `/api/rail/station-lines`, `/api/rail/query`

### HBLR Light Rail Integration
- Uses existing NJT bus GTFS-RT infrastructure (route `HBLR`)
- Search-based stop picker filters to HBLR-served stops only
- `DynamicHblrCard` component with purple HBLR badge
- Creates `hblr:STOP_ID` card ID

### MTA Subway Alerts
- Integrated MTA GTFS-RT subway alerts feed (`camsys/subway-alerts`)
- Alerts filtered by selected lines, shown inline on subway cards
- Up to 3 MTA alerts in scrolling ticker with blue "MTA" badge
- Cached for 2 minutes

### Ferry Picker Redesign
- Search-based terminal picker replacing static route groups
- All 14 NY Waterway terminals with live route/destination data from Connexionz API
- Server endpoints: `/api/ferry/terminals`, `/api/ferry/terminal-routes`
- Ferry card shows displayName when no departures (not "Loading…")

### PATH Picker Redesign
- Search-based station picker replacing static line/stop lists
- All 13 PATH stations with correct route assignments from official PANYNJ service map
- Deduplicated direction options (e.g. Christopher St shows "To 33rd St" once, not twice)
- Terminal stations only show outbound directions
- PATH card title now shows station name, line, and direction
- Server endpoints: `/api/path/stations`, `/api/path/station-routes`
- Multi-route query support (comma-separated route IDs)

### Other
- NJT Rail and HBLR wired into alert system (`njt_rail`, `hblr` sources)
- Transit card icon colors differentiated: bus (theme-aware), PATH (blue), ferry (red)
- NJ Transit Rail added to settings picker (between Bus and PATH)
- HBLR enabled in settings picker (was "Coming Soon")

---

## v1.5.0 (2026-04-22)

### Bus Picker Redesign (MTA-style)
- New search-based bus stop picker: type to search 16,820 stops by name, then select which routes you want
- Mirrors the MTA subway flow: Search Stop → Select Lines → Confirm
- New `bus:STOP_ID:ROUTES` card ID format with server-side route filtering
- `/api/bus/stops` now accepts `?routes=126,22` to filter departures to selected lines only
- `/api/bus/stop-search` endpoint for searching stops by name across all routes
- `/api/bus/stop-routes` endpoint returns all routes serving a given stop
- Stop names deduplicated in search results and route stop lists
- Select all / Deselect all toggle on route selector (useful for PABT with 60+ routes)

### PABT Gate Info for Dynamic Cards
- Dynamic bus cards at Port Authority Bus Terminal now show gate number in card header
- Gate data from `PABT_GATES_BY_ROUTE` lookup table covering ~50 NJT routes
- Gate only shown for single-route selections (different routes use different gates)
- `isPabtStop()` recognizes all known PABT GTFS stop IDs (16977, 16012, 16049, 16808, 16809, 16803, 16856)
- Clickable gate header shows full day/late/overnight schedule popup

### Bus Card Titles
- Preconfigured PABT cards now show "PABT · 126 Washington" (was "126 Washington")
- Dynamic PABT cards show "PABT · 125" (short, matching preconfigured style)
- Non-PABT dynamic cards show shortened names: "Washington / 11th (126)"
- `shortenStopName()` helper strips street suffixes (ST, AVE, BLVD), converts AT→/, title-cases
- Line suffix format: (all) for all routes, (126/119) for 1-2, (126+) for 3+

### Alert Filtering Overhaul
- Two-layer alert system: `deriveActiveAlertSources()` from dashboard cards + per-source user toggles
- Alerts only show for transit lines currently on the dashboard
- Alert toggles in settings auto-generate from active cards (no more static list)
- Removing a ferry card automatically suppresses ferry alerts
- `alertSettings` starts empty — sources default to on unless explicitly toggled off

### Display Settings
- Display section moved to top of settings panel (above Transit Cards)
- Ticker speed: snap-to slider replacing dropdown (Slow / Regular / Fast)
- Inline alert duration: dropdown (Ticker only / 15m / 30m / 60m / Always)

### Dark Mode
- MTA subway entrance globe icon gets a green glow/halo effect via CSS `drop-shadow`

### Settings Panel
- Preconfigured stops show friendly names (e.g. "Clinton / 11th (126)" not "clinton")
- Dynamic bus cards show formatted names in stop list

---

## v1.4.0 (2026-04-21)

### MTA Subway Integration
- All subway lines live (1-7, A-G, J/Z, L, N/Q/R/W, SIR) from 8 GTFS-RT feeds — no API key needed
- Search-based station picker: type to search 496 stations, consolidated by name (no duplicates)
- Line selection: after picking a station, see all lines that serve it with official MTA colored circle badges
- Direction selection: Downtown/Brooklyn, Uptown/Bronx/Queens, or Both
- `DynamicMtaCard` component with MTA subway entrance globe icon
- Static station-to-route mapping from GTFS data (works even when trains aren't running)
- Server endpoints: `/api/mta/stations`, `/api/mta/station-lines`, `/api/mta/query`
- Filters by selected lines — only shows trains for the lines you chose

### MTA Brand Colors
- All 26 subway lines have correct MTA brand colors as circle badges
- Yellow lines (N/Q/R/W) use black text for contrast

### MTA Subway Entrance Icon
- Custom SVG: green/white split globe on a green pole with cast-iron base
- Replaces generic train icon on subway cards

### Display Settings
- Inline alert duration: Ticker only, 15 min, 30 min, 60 min, Always on
- Ticker speed: Slow (30px/s), Regular (60px/s), Fast (100px/s)
- Both configurable in Settings → Display section

### Other Fixes
- Ferry card subtitle now matches bus card style (inline with header)
- Ticker scroll speed is now constant regardless of content length (px/sec based)
- "No active alerts" replaces static fallback when no alerts exist
- Alert settings filter both ticker and inline card alerts
- LIRR and Metro-North disabled pending debugging (feeds tested and working)

---

## v1.3.0 (2026-04-21)

### PATH — All Lines & Stations
- All 4 PATH lines now available in settings picker: HOB-33, JSQ-33, HOB-WTC, NWK-WTC
- All 13 stations with both directions (26 stop options total)
- Dynamic `/api/path/query` endpoint accepts any route/direction/stop combo
- Station name lookup map for all PATH stops
- `DynamicPathCard` component self-polls every 15 seconds

### Ferry — All Routes & Stops
- 5 ferry route groups now available: Hoboken 14th ↔ Midtown, Hoboken NJT ↔ Midtown, Hoboken NJT ↔ Downtown, Hoboken 14th ↔ Downtown, Port Imperial ↔ Midtown
- Dynamic `/api/ferry/query` endpoint accepts any stop tag, route, and destination filter
- `DynamicFerryCard` component self-polls every 30 seconds
- Ferry and PATH now enabled (not "Coming Soon") in the transit card picker

### Other
- PATH and ferry cards render inline with bus cards in settings order (not forced to bottom)
- Dynamic stop name caching for settings panel display

---

## v1.2.0 (2026-04-20)

### Settings Panel — Fully Functional
- Transit card picker: Mode → Line → Stop (3-step flow) with dropdown for stop selection
- Dynamic bus route search: "Other routes…" button searches all 273 NJT bus routes
- Dynamic stop data: any GTFS stop ID gets live real-time ETAs + schedule fallback automatically
- Direction labels: outbound/inbound city dropdowns (Hoboken, Jersey City, NYC, Home, Work) update dashboard title
- Alert toggles: on/off per source, filters both scrolling ticker AND inline card alerts
- Save button commits all draft changes; cancel reverts to previous state
- Stop names cached from GTFS data for display in settings panel

### Dynamic Bus Stops
- Server loads ALL 16,820 NJT bus stops at startup (full stop_times.txt index)
- New `/api/bus/stops?ids=` endpoint accepts any GTFS stop ID
- New `/api/bus/routes` endpoint returns all 265 bus route numbers
- New `/api/bus/routes/:route/stops` endpoint returns all stops for any route
- `DynamicBusCard` component self-polls every 30 seconds for any stop

### Tunnel Card
- Shows Lincoln and Holland tunnels side by side
- Inline alerts expire after 1 hour (still show in ticker until upstream stops sending)
- `allAlerts` field added for ticker, `alerts` field filtered to recent only

### Weather
- Night icons: uses NWS `isDaytime` flag + moon phase calculation (synodic month)
- Time labels: Now/Midday/Evening → Now/Evening/Tonight → Now/+3hr(10p)/+6hr(1a)
- Fixed duplicate "Next Hr" bug

### Alerts
- Static fallback replaced with "No active alerts"
- Alert settings filter both ticker and inline card alerts
- Tunnel alerts: only most recent per tunnel in ticker
- PATH alerts: filtered to 33rd St / Hoboken routes only (excludes NWK-WTC, elevator/escalator)
- Bus alerts: filtered to configured routes

### Other
- All transit cards render in settings order (ferry/PATH no longer forced to bottom)
- PABT cards show service notes when no buses available
- HBLR added as "Coming Soon" transit mode
- Connectivity banner and ticker have fixed max-height to prevent layout jumps

---

## v1.1.0 (2026-04-20)

### Settings Panel — Mockup
- Centered floating modal with gear icon in header
- City settings, transit card selection (outbound/inbound columns), alert toggles, tunnel selector
- "New transit card" button with mode/line/stop picker
- Save Changes button (not yet wired to dashboard)
- Coming Soon badges on unimplemented sections

### Holland Tunnel
- Added to tunnel card alongside Lincoln (facilityId 4)
- Both tunnels shown side by side with crossing time, speed, severity
- Direction-aware (flips with outbound/inbound toggle)

### Bidirectional Support
- Direction toggle in header swaps all data sources
- Inbound: PABT gate cards (126 Washington/Willow, 119) with gate schedule popup
- Inbound: PATH 33rd→Hoboken + 33rd→Newport
- Inbound: Ferry W 39th→Hoboken 14th
- Inbound: Lincoln/Holland tunnel NJ-bound
- Data clears immediately on direction switch, fresh data loads

---

## v1.0.0 (2026-04-20)

### Initial Release
- Lincoln Tunnel: real-time crossing time, speed, severity, alerts (PANYNJ API)
- NJ Transit Bus: real-time ETAs + capacity from GTFS-RT, schedule fallback from static GTFS
- Bus stops: Clinton St & 11th, Willow Ave & 15th, Washington St & 11th
- NY Waterway Ferry: real-time ETAs from Connexionz API (Hoboken 14th → W 39th)
- PATH Train: real-time departures from community GTFS-RT feed (HOB → 33rd St)
- PATH Alerts: from PANYNJ alerts API (filtered to service disruptions)
- Weather: NWS hourly forecast with Hoboken/NYC toggle
- Light/dark mode: auto by time of day (7:30 AM / 6 PM) + manual override
- Bus capacity badges: Seats/Standing/Full from vehicle positions feed
- LIVE/SCHED indicators on all transit data
- Clinton St service note for peak-hours-only stop
- Scrolling alert ticker aggregating all live alert sources
- Connectivity banner on API failures
- Responsive scaling from 5" Raspberry Pi to ultrawide desktop
- Express backend for NJT auth, protobuf parsing, GTFS data caching
- Vite dev proxy for CORS
