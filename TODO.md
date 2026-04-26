# Hoboken Commuter Dashboard — TODO

## Active

## Backlog

- [ ] **Clinton St service note** — hardcoded hours; could derive from GTFS dynamically
- [ ] **PABT gate accuracy for sub-routes** — route 126 has two gates (213 for Washington, 214 for Willow) but the dynamic card only shows the primary gate. Headsign-based lookup would be more accurate but adds complexity. See DECISIONS.md for tradeoff analysis

## Before Deployment

- [ ] **Rate limiting** — add rate limiting to the Express server to prevent abuse and control upstream API usage costs

## Regression Tests

#### Alert filtering
- [ ] Turning off all alert toggles → ticker shows "No active alerts" only
- [ ] Removing all ferry cards → ferry alerts suppressed from ticker
- [ ] Adding a bus:STOP:126 card → bus_126 alert source appears in settings
- [ ] Removing last PATH card → PATH alerts disappear from ticker
- [ ] Adding rail:HB:GS card → njt_rail alert source appears
- [ ] Adding hblr:15536 card → hblr alert source appears

#### Settings panel
- [ ] Display settings appear above Transit Cards
- [ ] Ticker speed slider snaps to 3 positions
- [ ] Preconfigured stops show friendly names
- [ ] Select all / Deselect all works on bus and rail route selectors
- [ ] Drag-and-drop reorder works on both outbound and inbound lists

#### Card rendering
- [ ] All card ID prefixes route to correct components (bus:, rail:, hblr:, path:, ferry:, mta:, lirr:, mnr:, mtabus:, nycferry:)
- [ ] Ferry card shows displayName when no departures (not "Loading…")
- [ ] PATH card shows station name in title
- [ ] MTA globe icon has beam glow in dark mode only

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
