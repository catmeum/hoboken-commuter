# Hoboken Commuter Dashboard — TODO

## Bug Fixes

- [ ] **HBLR light rail icon** — replace the generic train icon with a light rail icon featuring a catenary/overhead wire element to distinguish it from heavy rail
- [ ] **LIRR icon** — use a different heavy rail train icon to distinguish LIRR from other train services
- [ ] **Rename NY Waterway to "NYW Ferry"** — add distinction between NY Waterway Ferry and NYC Ferry in card titles and settings
- [ ] **Metro-North Grand Central icon redesign** — update the clock icon to look more like the actual Grand Central Terminal clock (ornate, four-faced opal clock on a brass stand). Reference: the iconic information booth clock
- [ ] **Test new data sources** — verify LIRR, Metro-North, MTA Bus, NYC Ferry, and NJT Rail all work correctly with real data during daytime hours

- [ ] **Settings persistence** — no localStorage; settings reset on page refresh
- [ ] **Clinton St service note** — hardcoded hours; could derive from GTFS dynamically
- [ ] **PABT gate accuracy for sub-routes** — route 126 has two gates (213 for Washington, 214 for Willow) but the dynamic card only shows the primary gate. Headsign-based lookup would be more accurate but adds complexity. See DECISIONS.md for tradeoff analysis


## Testing (next session)

### NJT Rail
- [ ] Search for stations (e.g. "Hoboken", "Secaucus", "Newark Penn")
- [ ] Station shows correct lines with official colors
- [ ] Select/deselect lines works, select all/deselect all works
- [ ] Card shows real-time departures with line badges, destinations, ETAs
- [ ] Station alerts show inline on card and in ticker
- [ ] Card title shows station name and selected lines
- [ ] Rate limiting: verify polling at 60s intervals doesn't exceed 40K/day

### HBLR Light Rail
- [ ] Search for HBLR stops (e.g. "Hoboken Terminal", "Exchange Place", "Liberty")
- [ ] Only HBLR-served stops appear in search results
- [ ] Card shows schedule/realtime departures with HBLR badge
- [ ] Card title shows shortened stop name

### Regression Tests

#### Alert filtering
- [ ] Turning off all alert toggles → ticker shows "No active alerts" only
- [ ] Removing all ferry cards → ferry alerts suppressed from ticker
- [ ] Adding a bus:STOP:126 card → bus_126 alert source appears in settings
- [ ] Removing last PATH card → PATH alerts disappear from ticker
- [ ] Adding rail:HB:GS card → njt_rail alert source appears
- [ ] Adding hblr:15536 card → hblr alert source appears
- [ ] `deriveActiveAlertSources` returns correct set for all card types

#### Bus picker & dynamic cards
- [ ] Bus picker: search stop → select lines → confirm creates `bus:STOP_ID:ROUTES`
- [ ] PABT gate shows for single-route, hidden for multi-route
- [ ] PABT detection works for all known stop IDs
- [ ] Stop names deduplicated in search and route stops
- [ ] `shortenStopName` correctly shortens NJT stop names

#### Settings panel
- [ ] Display settings appear above Transit Cards
- [ ] Ticker speed slider snaps to 3 positions
- [ ] Preconfigured stops show friendly names
- [ ] Select all / Deselect all works on bus and rail route selectors

#### Card rendering
- [ ] All card ID prefixes route to correct components (bus:, rail:, hblr:, path:, ferry:, mta:)
- [ ] `LINES_BY_MODE` entries without `stops` array don't crash `ALL_STOPS` builder
- [ ] Ferry card shows displayName when no departures (not "Loading…")
- [ ] PATH card shows station name in title
- [ ] MTA globe icon has green glow in dark mode only

## Before Deployment

- [ ] **Rate limiting** — add rate limiting to the Express server to prevent abuse and control upstream API usage costs

## Future Data Sources

(All data sources now implemented!)

## Implemented ✅

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

### Data Sources (all implemented)
- [x] Tunnels (7 PANYNJ crossings), NJ Transit Bus (16,820 stops), NJ Transit Rail (173 stations)
- [x] HBLR, PATH (13 stations), NY Waterway (14 terminals), NYC Ferry (50 stops)
- [x] MTA Subway (496 stations), LIRR (127 stations), Metro-North (~100 stations), MTA Bus (286+ routes)
- [x] Weather (any US zip), all alerts live, bidirectional support

### UI
- [x] Custom icons: MTA globe, Grand Central clock, provider-specific colors
- [x] PABT gate info, line badges with official colors
- [x] Responsive scaling, dark/light mode, ticker speed control
