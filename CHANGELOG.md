# Hoboken Commuter Dashboard — Version History

## 2026-06-02 — NJT Bus Icon Fix, NYC Ferry Schedule Fallback, Mobile Tap-to-Expand & Alert Toggles

### Bug Fixes
- **NJT Bus custom SVG icon restored in settings** — legacy stop IDs (`clinton`, `willow`, `washington`, `pabt_*`) were falling through to the generic Lucide Bus icon in the desktop and mobile settings stop list. Fixed matching to cover all legacy bus stop ID formats.
- **Alert toggle filtering fixed** — tunnel alert IDs had a case mismatch ("Lincoln" vs "tunnel_lincoln") causing toggles to not work. Also fixed: alerts for routes not in user's config (128, 165, etc.) now correctly hidden instead of leaking through. PATH alert filtering also fixed for users with only one PATH line configured.

### New Features
- **NYC Ferry schedule supplement** — the RT feed only tracks actively running ferries, leaving gaps for routes like Rockaway and Soundview. The server now always supplements RT data with static GTFS schedule departures (`stop_times.txt`), filtered by today's service day (weekday/weekend from `calendar.txt`). Scheduled departures within ±3 min of an RT departure are deduplicated. Shows "LIVE" for tracked ferries and "SCHED" for schedule-only times.
- **Tap-to-expand departure rows on mobile** — on smaller screens where long bus route/destination text is truncated, tapping a departure row expands it to show the full text. Auto-collapses after 10 seconds. A second tap immediately collapses it.
- **Alert source on/off toggles on mobile** — new consolidated "Alerts" section in mobile Settings. Two-level expandable UI: categories (NJT Bus, MTA Subway, PATH, Tunnels, etc.) with master toggle, tap to expand and see individual per-line/route toggles (e.g., bus 126 on, bus 119 off; subway B on, D off). Badge style and staleness settings moved into this section for discoverability. Persisted in localStorage.
- **Multi-variant NJT Bus selection** — the variant picker at PABT (and similar terminals) now supports multi-select. Users can pick multiple headsigns (e.g., "126 via Willow" + "126 via Washington") to display them interleaved in a single transit card with "Select all" / "Deselect all" toggle. Server headsign filtering supports semicolons for multi-group keywords.

---

## 2026-06-02 — Lint Cleanup, Ferry Multi-Route Picker, Tunnel Alert Dedup

### Code Quality
- **Zero ESLint errors** — fixed 106 errors across all files: added Node.js globals for server/tests, removed dead per-card alert code, fixed duplicate object keys, added empty-block comments, suppressed intentional patterns
- **Mobile presets updated** — all 6 neighborhood presets now include stops for both outbound and inbound directions
- **NYW Ferry route coverage verified** — Route 12 (downtown) confirmed in API alongside Route 18 (Midtown)
- **NYC Ferry feed gaps investigated** — GTFS-RT only reports real-time tracked trips, no static fallback

### New Features
- **NYW Ferry multi-route picker** — ferry terminal picker now supports selecting multiple routes/destinations in a single card (checkbox-style, mirrors NJT Rail picker pattern). New stop ID format: `ferry:TAG:all` or `ferry:TAG:R1:D1,R2:D2`
- **Ferry destination badges** — each departure row shows a colored badge indicating its destination. Distinct colors per destination (Midtown=blue, Pier 11=amber, Brookfield=green, etc.)
- **Ferry destination colors** — shared `ferryDestColor()` utility in `transitColors.js` with known color assignments and hash-based fallback

### Bug Fixes
- **Holland Tunnel duplicate alerts** — tunnel alerts now only show the most recent status update per tunnel instead of all historical alerts for the day. Fixes the "8 alerts that are all the same" issue
- **NYW Ferry Hoboken 14th route test** — added integration test verifying both Route 12 (downtown) and Route 18 (Midtown) remain in the API feed

---

## 2026-06-02 — Bus Alert Route Filtering Fix

### Bug Fix
- **NJT bus alerts route-level matching** — bus alert icons on cards now correctly match by specific route number. Previously, all NJT bus alerts would appear on every bus card regardless of route (e.g., route 126 cards showed alerts for routes 165, 22, 128). Fixed in `getAlertState()` (TransitCard), `alertMatchesSource()` (AlertsPage), and `fetchAlerts()` (alerts service now passes route array for downstream filtering).

---

## 2026-06-02 — Desktop Refresh, Skeleton Loading, Settings Badges & Naming Consistency

### Desktop Header
- **Refresh button** — replaced Home (scroll-to-top) icon with RotateCw; clicking force-refreshes all polling data across all cards

### Skeleton Loading States
- **Shimmer skeletons** — all transit cards (Bus, MTA Subway, NJT Rail, HBLR, LIRR, MNR, MTA Bus, NYC Ferry, PATH, Ferry) now show pulsing grey skeleton rows while data loads, instead of "No upcoming buses/trains/ferries" text
- **Tunnel & Weather cards** — show skeleton placeholders during initial fetch instead of "--" and "Loading…" text

### Stop Cards in Settings — Transit Icons & Route Badges
- **Transit mode SVG icons** — settings stop list now shows the actual transit mode icon (MTA globe, NJT bus, PATH oculus, etc.) instead of generic colored text badges
- **Route/line badges** — MTA subway stops show colored line circles, NJT bus shows route pills, NJT rail shows line pills, MTA bus shows route pill; truncated to 2 with "+N" overflow
- **Consistent between desktop and mobile** — both platforms use the same icon + badge pattern in settings

### Naming Consistency (Desktop & Mobile)
- **Direction only in parentheses** — MTA Subway shows `(Uptown)` / `(Downtown)` / `(Both)` only; line info is shown via badges
- **No route/line text in stop names** — NJT Bus, NJT Rail, LIRR, MNR, MTA Bus no longer embed route or line info in the display name; all communicated via badges
- **Ferry unchanged** — keeps `→ destination` format (which is the direction equivalent)

### Bug Fix — Show Line Badges Toggle
- **Settings card badges respect toggle** — "Show Line Badges" toggle in the mobile edit panel now correctly hides/shows badges in both the Settings stop list AND the transit cards on My Stops page. Previously the settings list badges were always visible regardless of the toggle.

---

## 2026-06-02 — Desktop Alerts Panel & Test Coverage

### Desktop Alerts Panel
- **Alerts sidebar** — new slide-in panel from the right, triggered by bell icon in header
- **Bidirectional toggle** — independent direction filter within the alerts panel (separate from main dashboard direction)
- **Dismiss/restore** — individual dismiss, dismiss all, and restore from dismissed section
- **Badge count** — bell icon shows red badge with undismissed alert count; respects auto-dismiss settings
- **Auto-dismiss setting** — renamed "Inline alert duration" to "Auto-dismiss alerts" with new options: Ticker only, After 30 min, After 1 hour, After 3 hours, After 12 hours, Never
- **Removed inline alerts from cards** — alerts no longer appear on individual transit cards (TunnelCard, MTA Subway, NJT Rail, MTA Bus, Ferry, PATH). All alerts centralized in the panel.

### Alert Timestamps
- **API-provided timestamps** — GTFS-RT `active_period.start` extracted for NJT Bus and MTA Subway alerts; PATH alerts use `SendDate` from PANYNJ JSON; Tunnel alerts computed from `ageMinutes`
- **No false timestamps** — alerts without an API-provided time show no timestamp (rather than showing incorrect "first seen" time)
- **Relative time display** — timestamps shown as "2h ago", "45 min ago", "just now" in both desktop panel and mobile alerts page

### Missing Endpoints Fixed
- **`/api/bus/alerts`** — new endpoint returning NJT bus alerts (mobile was silently 404ing)
- **`/api/path/alerts`** — new endpoint returning PATH alerts with `startedAt` timestamp
- **`/api/ferry/alerts`** — new endpoint returning NY Waterway ferry alerts

### Test Coverage
- **32 new AddStopPanel tests** — covering all 7 previously untested transit modes: NY Waterway Ferry, HBLR, Newark Light Rail, LIRR, Metro-North, MTA Bus, NYC Ferry
- Total AddStopPanel test count: 53 (was 21)

---

## 2026-06-02 — Bug Fixes & Alert UX

### Fixes
- **BusVariants tests** — fixed 3 test failures by adding missing `/api/bus/stop-directions` mock for multi-platform stops (PABT)
- **Alert triangle button** — fixed non-functional alert icon on all 10 transit card types (`onAlertTap` wasn't forwarded to `CardShell`)

### Enhancements
- **Alert highlight on tap** — tapping a card's alert triangle navigates to Alerts page, auto-scrolls to the first matching alert, and highlights matching alerts with an inset orange glow that fades after 2.5s
- **Source-based matching** — highlight logic identifies alerts by transit source (mta, bus, path, ferry, etc.) matching the originating card

### Tests
- Added 3 new AlertsPage tests: highlight matching, no-highlight default, source filtering

---

## v3.0.0-alpha (2026-05-30) — Mobile App

### Mobile App (`/mobile`)
- **Full React mobile app** at `/mobile` route with 4 pages: Welcome, My Stops, Alerts, Settings
- **Welcome flow** — zip code onboarding with nearby-stop auto-detection, neighborhood preset picker (Hoboken, Newport/JC, Midtown, Downtown, Brooklyn, Queens), or start from scratch
- **My Stops page** — scrollable transit cards with real-time data, weather/tunnel info pills (tap-to-expand), pull-to-refresh
- **Transit cards** — MTA Subway, NJT Bus, PATH, Ferry, NJT Rail, HBLR all wired to v1 service layer with custom SVG icons
- **Alerts page** — live alert aggregation from all transit APIs, swipe-to-dismiss, dismissed section with restore
- **Settings page** — slide-up panel with theme cycling, weather/tunnel toggles, tunnel picker (up to 2), stop management (remove, expand/collapse), danger zone reset
- **Add Stop flow** — mode picker → search → add, slides up over settings
- **Floating tab bar** — glassmorphism design with lucide-react icons (Home, Bell, Settings), sliding pill indicator, alert badge
- **Theme support** — dark/light/auto with `t` key dev shortcut for toggling
- **localStorage persistence** — all user preferences and stop selections persist across sessions
- **Tunnel pill glow** — tied to undismissed alerts in notification panel (not stale API data)
- **GPS-aware** — weather defaults to GPS location; hides weather/tunnels if GPS denied on manual setup

### Technical
- Added `react-router-dom` for `/mobile` route alongside existing desktop at `/`
- Extracted shared SVG icon components to `src/components/icons.jsx`
- Added Vitest + React Testing Library test suite (43 tests across 5 files)
- Inter font loaded for mobile typography

## v2.4.0 (2026-05-27)

### Nearby-Stop Auto-Lookup
- **New endpoint: `/api/nearby-stops?lat=X&lon=Y`** — searches GTFS stop coordinates across all transit types (MTA subway, NJT bus, PATH, ferry, NJT Rail, HBLR)
- Zip code input now auto-detects the 3–6 closest transit stops and builds a custom dashboard
- Consolidates nearby MTA stations into complexes (e.g. Lexington Av/63 St merges two station IDs to show F, M, N, Q, R, W)
- NJT Rail stations included with verified 2-char codes from live API
- Falls back to nearest preset if fewer than 3 stops found within 3 miles

### Zip Code Validation
- Out-of-area zips (outside NY/NJ metro) now show a clear error message instead of silently selecting a wrong preset
- Bounding box check: lat 40.4–41.3, lon -74.5 to -73.5

### Random Stops Easter Egg (Updated)
- Triple-click easter egg now picks one random stop from each transit mode (MTA subway, PATH, ferry, NJT Rail, NJT bus, HBLR) instead of selecting a random preset

### Bug Fixes
- **PATH station names** — nearby-stops now uses station IDs instead of name slugs, fixing "grove_st" displaying instead of "Grove St"

## v2.3.0 (2026-05-25)

### Custom Transit Icons
- **NJT Bus** — XD60 Xcelsior with blue/magenta/orange arch livery (matches current fleet)
- **NJT Rail** — Comet V / Multilevel car, blue nose, red bottom stripe, headlight glows in dark mode
- **PATH** — WTC Oculus (white ribs with gray outline in light, pure white in dark) + One World Trade Center (triangular glass facets, blinking red spire in dark mode)
- **NYW Ferry** — White hull with red waterline stripe, pilot house, running lights in dark mode
- **NYC Ferry** — Teal-stripe vessel with Statue of Liberty (chest-up, crown spikes, torch with orange glow in dark mode)
- **MTA Bus** — New Flyer XD40 with MTA blue top/bottom bands, orange destination sign glow in dark mode
- Replaces generic Lucide Bus/Ship/TrainFront icons on both dashboard cards and settings picker
- Existing custom icons (MTA Globe, HBLR clocktower, LIRR M7, Metro-North clock) unchanged

### Preset Picker — Zip Code Input
- Zip code input field added to the preset picker modal (between subtitle and neighborhood cards)
- Resolves zip via NWS API → finds nearest preset by lat/lon distance
- Triple-click the title "Where do you commute from?" to load a random preset (easter egg)
- TODO: distance threshold validation, nearby-stop GTFS lookup, 500 premade presets

### Dismissable Inline Alerts
- Every inline alert on transit cards now has an X button to dismiss
- Dismissed alerts are session-only (in-memory Set, not persisted to localStorage)
- Alert still shows in the scrolling ticker — only the card display is hidden
- Full page refresh resets all dismissed alerts

### System Status Easter Egg
- Triple-click the gear icon in the settings panel header to reveal diagnostics
- Shows: server uptime, NJT Bus GTFS age, MTA Subway GTFS age, station routes count, NJT Bus/Rail token status
- Hover any item for verbose tooltip
- Hidden by default — no UI clutter for normal users

### Settings & UX
- **Minimum card requirement reduced to 1** (was 3) — users can now run with a single transit card
- Remove buttons no longer disabled at 3 cards — can delete down to 0
- Save Changes button disabled + grayed out when total cards < 1
- Weather period cards now flex to fill available card height (no more collapsed sub-cards)

### Bug Fixes
- **MTA Subway station lines stuck on "Loading lines" (again)** — four root causes fixed (cache path, ID mismatch, stuck loading state, undefined React key)
- **Vite proxy missing for `/api/system-status`** — added proxy rule so the endpoint works in dev mode

---

## v2.2.0 (2026-05-25)

### Bug Fixes
- **MTA Subway station lines stuck on "Loading lines" (again)** — four separate root causes identified and fixed:
  1. **Wrong cache write path** — `build_station_routes.mjs` was writing `mta_station_routes.json` to `server/.cache/` but the server reads from `<root>/.cache/`. On a fresh deploy where the file is missing, the server triggers a rebuild, but the rebuilt file landed in the wrong directory and was never found. Fixed `CACHE_DIR` to use `path.join(__dirname, '..', '.cache')`.
  2. **Station ID mismatch between station list and routes cache** — `loadMtaStations()` downloaded a fresh MTA GTFS zip on every server restart, while the routes cache was built from a separate download. If the GTFS data changed between the two downloads, station IDs could differ and lookups would return empty. Fixed by sharing a single cached zip (`gtfs_subway.zip`, refreshed every 7 days) between both `loadMtaStations` and `build_station_routes.mjs`.
  3. **Frontend stuck on "Loading lines…" forever** — when the server returned `{ lines: [], building: false }` (cache ready but no routes found for the station's IDs), the frontend set `stationLines` to `[]` with `stationLinesError` still `false`. The UI showed the loading spinner with no way out. Fixed by treating the empty-but-not-building case as an error, which surfaces the "Retry" button.
  4. **`key={s.id}` on search results used `undefined`** — consolidated station objects from `/api/mta/stations` have `{ name, ids: [] }` with no `id` field. React list used `key={s.id}` (always `undefined`). Fixed to use `key={s.name}`.
- **`stationRoutesBuilding` flag not tracked** — server always returned `building: true` when the cache was empty, even after a build failed or completed. Added a `stationRoutesBuilding` module-level flag that is set `true` when a build starts and `false` when it finishes (success or failure), so the frontend gets accurate status and stops retrying unnecessarily.

---

## v2.1.0 (2026-05-17)

### Bug Fixes
- **MTA Subway station lines stuck on "Loading lines"** — root cause was the API server being unreachable (502 from Vite proxy) while the frontend silently swallowed the error and stayed on "Loading lines…" forever. Fixed with: explicit `!res.ok` check throwing on non-200 responses, 3 auto-retries at 2s intervals, and a visible error state with a Retry button if all retries fail. Also fixed a logic bug where an empty `data.lines` array (truthy in JS) would short-circuit the building-state retry path.
- **NJT Rail showing stale past times** — API returns all scheduled trains including already-departed ones. Old code clamped `eta` to `Math.max(0, ...)` making departed trains show as `0 min` with their past scheduled time. Now filters out trains with `eta < -1` before slicing results.
- **Tunnel inline alerts ignoring "Ticker only" setting** — `TunnelCard` was missing the `inlineAlertDuration !== 0` guard that all other card types use. Added explicit check so "Ticker only" correctly suppresses inline alerts on the tunnel card.

### Weather Card Redesign
- Stripped down to label + icon + temp + humidity per sub-card (removed wind and description)
- Temp and humidity displayed on the same row with a `|` separator: `84° | 💧40%`
- Humidity sourced from NWS `relativeHumidity.value` field (was unused before)
- Card sizes to its own content (`flex: none` on card-body) — no longer fights for vertical space

### GTFS Age in Settings
- Settings panel footer now shows NJT Bus data age: e.g. `NJT Bus data: 4.6d old`
- Turns orange with ⚠️ warning if data is over 3 days old (NJT license threshold)
- Fetched fresh each time the settings panel opens

### Mobile Layout
- Transit cards use `height: auto` and `min-height: 80px` on mobile — no longer collapse to zero
- Card body uses `overflow: visible` on mobile so content is never clipped
- Bus/transit lists set to `overflow: visible` — all rows show regardless of card height

### Runtime Test Suite
- Added 11 new runtime test sections covering every card mode end-to-end
- Each verifies the endpoint returns a valid response, non-negative ETAs, and properly formatted time strings (`/\d+:\d+ (AM|PM)/`)
- Covers: NJT Bus, NJT Rail, PATH, MTA Subway, LIRR, Metro-North, NYC Ferry, NYW Ferry, MTA Bus, HBLR
- Total: 362 tests, 0 failures

---

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
