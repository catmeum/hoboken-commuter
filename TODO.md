# Hoboken Commuter Dashboard — TODO

## Active

## Deployment

- [ ] **Document deployment issues** — write up the Express 5 wildcard bug (`/*` → `/*path`), pm2 NODE_ENV setup, and any other gotchas encountered during initial Lightsail deploy into DEPLOYMENT.md
- [ ] **Upgrade Ubuntu 22.04 → 24.04** — 24.04 is the current LTS (supported to 2029); no reason to stay on 22. Rebuild the Lightsail instance with Ubuntu 24.04 when convenient (or snapshot + rebuild)

## UX / Loading State (Future)

- [ ] **GTFS loading status API** — update `/api/bus/gtfs-status` to return `{ status: "building" | "ready", progress?: string }` so the frontend can poll it during startup
- [ ] **App-level loading screen** — on initial load, poll `/api/bus/gtfs-status` every 3s; while `status === "building"` show a full-screen overlay with spinner and "Loading transit data, please wait…"
- [ ] **Panel-level graceful degradation** — instead of panels hanging, show skeleton loader or "Data loading…" placeholder while GTFS builds, then auto-refresh when ready
- [ ] **Auto-refresh on ready** — when poll detects `status === "ready"`, dismiss loading screen and trigger a data fetch across all panels automatically

## Backlog

- [ ] **Clinton St service note** — hardcoded hours; could derive from GTFS dynamically
- [ ] **PABT gate accuracy for sub-routes** — route 126 has two gates (213 for Washington, 214 for Willow) but the dynamic card only shows the primary gate. Headsign-based lookup would be more accurate but adds complexity. See DECISIONS.md for tradeoff analysis

## Before Deployment

- [x] **Rate limiting** — `express-rate-limit`: global 300 req/min per IP; strict 30 req/min on NJT Rail, MTA Bus SIRI, and weather zip endpoints; CORS restricted to `ALLOWED_ORIGIN` env var (defaults to `*` in dev)

## Regression Tests

All regression tests are now automated in `npm test`. 238 tests, 0 failures.

#### Alert filtering ✅
- [x] `deriveActiveAlertSources` adds correct sources for all card types
- [x] bus:STOP:126 card → bus_126 source added
- [x] ferry source only added when ferry card present
- [x] PATH alerts gated on path_hob33/path_jsq33 sources
- [x] njt_rail source added for rail: prefix cards
- [x] hblr source added for hblr: prefix cards

#### Settings panel ✅
- [x] Display settings appear above Transit Cards in source order
- [x] Ticker speed has 3 positions (Slow=30, Regular=60, Fast=100)
- [x] Preconfigured stops have friendly names (clinton, willow, path_hob33, etc.)
- [x] Select all / Deselect all present for bus and rail route selectors
- [x] Drag-and-drop reorder: draggable, onDragStart/Over/End, dragRef, splice

#### Card rendering ✅
- [x] All 12 card ID prefixes route to correct components
- [x] LINES_BY_MODE entries without stops use `(line.stops || [])` guard
- [x] FerryCard shows displayName or "No service" when no departures (not "Loading")
- [x] PathCard uses displayName prop; DynamicPathCard shows stationName
- [x] HBLR card shows `b.headsign || b.variant` on each row
- [x] MTA globe beam hidden by default, shown in dark mode only
- [x] HBLR/MNR clock face and LIRR headlight dark-mode-only CSS verified
- [x] MTA Bus timeout: `timedOut` flag, "Feed timed out" message, orange color

---

## Implemented ✅

### Post-v1.7.0 fixes (2026-04-25)
- [x] **HBLR icon** — Hoboken Lackawanna clocktower SVG; clock face glows teal in dark mode
- [x] **LIRR icon** — M7/M9 train profile (blue nose, silver body, yellow stripe); headlight in dark mode
- [x] **Metro-North icon** — Grand Central clock with flat pedestal; opal face glows gold in dark mode
- [x] **MTA Subway picker icon** — settings picker now uses MtaGlobeIcon to match the card
- [x] **Rename NY Waterway → "NYW Ferry"** — card titles, settings picker, alert names, picker dialog
- [x] **HBLR missing destination** — headsign missing from realtime response; fixed in server + card
- [x] **PATH trains not showing** — feed reports next stop only; fixed by matching route+direction only
- [x] **PATH weekend service (route 1024)** — weekend JSQ-33 via Hoboken; added to all route maps
- [x] **NYC Ferry missing line/destination** — realtime feed has empty routeId; fixed via tripId→route map from static GTFS trips.txt; also fixed broken GTFS URL
- [x] **Transit card drag-to-reorder** — replaced ↑/↓ buttons with HTML5 drag-and-drop on GripVertical handle
- [x] **MTA Subway station lines blank** — `.cache/mta_station_routes.json` was missing; added `server/build_station_routes.mjs` and auto-build on server start
- [x] **Settings persistence** — localStorage with `hoboken-commuter-settings` key; loads on startup, saves on "Save Changes", reset button with confirmation in settings footer
- [x] **Integration test suite** — `npm test` runs 134 tests across all endpoints; 0 failures
- [x] **NJT GTFS update check** — auto-refreshes every 24h; added `/api/bus/gtfs-status` endpoint and startup log showing cache age/size with stale warning if >7 days
- [x] **MTA Bus SIRI timeout** — added 8s `AbortSignal.timeout`; returns empty departures gracefully instead of hanging; logs timeout warnings to server console

### v1.7.0 (2026-04-24)
- [x] LIRR — 127 stations, 13 branches, real-time via MTA GTFS-RT
- [x] Metro-North — ~100 stations, 6 lines, real-time via MTA GTFS-RT, Grand Central clock icon
- [x] MTA Bus — 286+ routes via Bus Time SIRI API with alerts
- [x] NYC Ferry — 50 stops, 8 routes via GTFS-RT
- [x] Tunnel selector fully functional — 7 PANYNJ crossings, max 2 selection
- [x] Tunnel card header shows "NJ → NY" / "NY → NJ"
- [x] Show/hide toggles for tunnel and weather cards
- [x] Inline alert "Ticker only" fix for all card types
- [x] Weather tied to city zip codes, auto-switches with direction
- [x] Transit card icon color differentiation per provider
- [x] Metro-North Grand Central clock icon with dark mode radium glow

### v1.6.0 (2026-04-23)
- [x] NJ Transit Rail — 173 stations, 11 lines via TrainData JSON API
- [x] HBLR Light Rail — via bus GTFS-RT
- [x] MTA subway alerts — GTFS-RT alerts feed
- [x] Ferry picker redesign — search-based with all 14 terminals
- [x] PATH picker redesign — search-based, deduplicated directions
- [x] NJT Rail and HBLR alert integration

### v1.5.0 (2026-04-22)
- [x] Alert filtering overhaul, PABT gate info, bus picker redesign
- [x] Display settings, ticker speed slider, MTA globe glow

### v1.4.0 and earlier
- [x] MTA Subway, PATH, NYW Ferry, NJT Bus, tunnels, weather, all alerts, bidirectional support
- [x] Responsive scaling, dark/light mode, settings panel
