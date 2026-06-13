# My Stop Now — TODO

## Active — Next Session

- [ ] **Mobile: NY Waterway ferry card showing single route instead of all destinations** — A ferry stop (e.g. Hoboken/NJ Transit Terminal) serves multiple routes (Brookfield Place, W 39th St, Paulus Hook), but the mobile transit card only displays one. Should show all destination routes for the selected terminal, matching the desktop multi-route display behavior. Additionally, existing preset cards now show no upcoming ferries.
- [ ] **Mobile: Replace static presets with dynamic ones** — Some presets may still be hardcoded, leading to inaccurate stop times (e.g. Willow / 15 preset shows no buses, but the dynamically-added version does).
- [ ] **Add Service Time Notice** — Some routes (e.g. 126 NYC via Clinton St) only run during commute windows (Weekdays 5:40am–9:45am, 4:09pm–8:29pm). Dynamically detect routes with limited service hours from GTFS and display a notice on the card. Apply the same logic to NYW and NYC Ferries, which also don't run 24/7.
- [ ] **Mobile: Tunnel Pills Disappear** - Occasionally on refresh, the tunnel pills disappear, leaving only the weather pill. Investigate cause and fix.

## UX & Visual Polish

- [ ] **Add animation when transit cards update** — Animate individual transit cards (fade, highlight, or slide) when their departure data refreshes, so users can see at a glance which cards just received new information.
- [ ] **Mobile: Fix "My Stops" toggle text alignment** — The text inside the direction toggle on the My Stops page is not vertically centered. Fix the toggle styling so the label text is properly centered within the button.
- [x] **Add high-contrast mode toggle to settings** — Added accessibility option in both desktop and mobile Settings for a high-contrast color scheme. Persists independently of light/dark theme via `data-high-contrast` attribute.
- [ ] **Create new logo for MyStopNow** — Design a logo suitable for favicon and home screen install icon.
- [ ] **Mobile: Fix weather panel** - Replace emojis with better icons and text. Add a Feels Like temperature.

## Feature Backlog

- [ ] **Feedback submission mechanism** — Add a way for users to submit feedback or report issues. Options: embedded Google Form, link to a GitHub Issues template, or a simple form that sends an email.
- [x] **Improve zip code stop selection algorithm** — Rewrote nearby-stops selection: 2-per-type cap, location-aware priority zones (NJ waterfront, Manhattan, outer boroughs, NJ suburban), cross-state exclusions (no subway in NJ, no HBLR in NYC), default max bumped to 10. Added NYC Ferry GTFS stops to candidate search (fixed `\r` parsing bug in stop_lon).
- [ ] **Add MTA Bus to nearby-stops search** — The nearby-stops endpoint doesn't include MTA Bus stops as candidates. Requires downloading MTA Bus GTFS data or building a stop coordinate cache from the SIRI `routes-for-agency` + `stops-for-route` API calls. Currently only subway, PATH, NJT Bus, ferries, and rail are searchable.
- [ ] **PWA setup** — manifest.json, service worker, iOS meta tags for home screen install.
- [ ] **Explore page with map** — MapLibre GL map showing nearby transit stops as colored markers. Bottom sheet with list. Medium effort — add after list-based Add Stop flow is solid.
- [ ] **iPhone app (Capacitor)** — Wrap PWA as native iOS app for App Store. Longer term after PWA is stable.
- [ ] **Unit tests + E2E verification** — Add tests for TransitCard routing, InfoPills, MobileApp alert aggregation. Full manual E2E walkthrough.
- [ ] **Triple-tap logo easter egg** — Triple-tap MSN logo to pick 6 random stops (one per transit mode).
- [ ] **My Stops sorting** — Sort My Stops cards by proximity to current location (closest first), order added, or by soonest arrival.
- [ ] **Buy Me a Coffee link** — Swap Venmo with buymeacoffee.com/mystopnow.
- [ ] **Desktop: Per-line alert toggles (match mobile)** — Update desktop `deriveActiveAlertSources()` to emit per-subway-line IDs (`mta_B`, `mta_D`, etc.) instead of a single `mta_subway`. Add grouped/expandable UI in the desktop settings alert section to match the mobile two-level toggle pattern.
- [ ] **Clothing recommendation card** — Square card between tunnel and weather cards. Shows a single icon for what to bring outside (umbrella, winter coat, sunscreen, light jacket) derived from existing weather data.
- [ ] **Share list of stops** - Create a mechanism to share one or multiple stops with a friend using a shared URL.

## Informational / About

- [x] **About page in settings** — Added About section to both desktop and mobile settings with app description, non-affiliation notice, and link to stroszeck.com.
- [x] **Add NJT disclaimer to About section** — Included full NJT data disclaimer and MyBusNow personal-use notice in collapsible/expandable section on both platforms.
- [x] **Update version number on desktop and mobile** — Bumped to v2.5.0 in package.json. Desktop already read from package.json; mobile now imports it instead of hardcoding.

## UX / Loading State (Future)

- [ ] **GTFS loading status API** — Update `/api/bus/gtfs-status` to return `{ status: "building" | "ready", progress?: string }` so the frontend can poll during startup.
- [ ] **App-level loading screen** — On initial load, poll `/api/bus/gtfs-status` every 3s; while `status === "building"` show a full-screen overlay with spinner and "Loading transit data, please wait…"
- [ ] **Auto-refresh on ready** — When poll detects `status === "ready"`, dismiss loading screen and trigger a data fetch across all panels.

## Known Bugs

- [ ] **NJT Bus intermittent empty state** — Bus cards occasionally show "No upcoming buses" for ~30s then repopulate. Likely a GTFS-RT protobuf parsing race condition or index-out-of-range error when route filter is applied.
- [ ] **PABT gate accuracy for sub-routes** — Route 126 has two gates (213 for Washington, 214 for Willow) but the dynamic card only shows the primary gate. Headsign-based lookup would be more accurate.

## Recently Completed

- [x] **NJT bus real-time data fix** — Upgraded gtfs-realtime-bindings to 2.0.0, fixed route resolution via VP feed, added terminal-stop headsigns, mobile capacity badges, graceful RT fallback
- [x] **App rebrand & deployment** — Renamed to "My Stop Now", split builds, Caddy config, beta stage, GitHub Actions pipeline
- [x] **Mobile base path fix** — Added `base: '/mobile/'` to vite.config.mobile.js so assets load correctly
- [x] **Express /mobile route** — Added explicit `app.get('/mobile', ...)` route for the bare path (Express 5 wildcard only matches subpaths)

## Completed

- [x] **Rename app to "My Stop Now"** — Rebrand complete (domain: mystopnow.com). App title, page title, README, all docs, and hardcoded references updated. commute.stroszeck.com configured as redirect. Independent deploy strategy with beta/production stages documented.
- [x] **NJT Bus Custom svg gone** — fixed legacy stop IDs (`clinton`, `willow`, `washington`, `pabt_*`) falling through to generic Lucide Bus icon in desktop and mobile settings. Matching now covers all legacy formats.
- [x] **NYC Ferry empty departures** — implemented static GTFS schedule supplement in `/api/nycferry/query`. Parses `stop_times.txt` and `calendar.txt` at startup; RT departures are always supplemented with schedule data for gaps (filtered by service day, deduped within ±3 min of RT). Shows LIVE/SCHED badges.
- [x] **Tap to expand individual line info on mobile** — departure rows are now tappable. Tap expands to show full truncated text (flex-wrap), auto-collapses after 10s. Second tap immediately collapses.
- [x] **Enable on/off toggle for active alerts on mobile** — new "Alerts" section in mobile Settings consolidates badge style, staleness, and per-line source toggles. Two-level UI: tap a category (NJT Bus, MTA Subway, etc.) to expand individual line/route toggles. Master switch turns all children on/off. Derived from user's stops, persisted in localStorage. Granular filtering (e.g., see bus 126 alerts but not 119).
- [x] **Mobile: Multi-variant NJT Bus Selection** — variant picker at PABT (and similar terminals) now uses multi-select toggle buttons instead of single-tap. Users can pick multiple headsigns (e.g., 126 via Willow + 126 via Washington) and they're displayed interleaved in a single card. Server handles semicolon-separated keyword groups for combined headsign filtering.
- [x] **Fix all lint errors** — 104 ESLint errors across server/index.js, App.jsx, and test files (unused vars, no-undef for Buffer/global/process, duplicate keys, empty blocks, set-state-in-effect, impure render calls). Clean pass should be the goal.
- [x] **Update mobile presets with inbound + outbound** — include both directions.
- [x] **NY Waterway route coverage** — verify Hoboken 14th downtown service. **Verified:** Route 12 (Hoboken 14th → Pier 11/Wall St → Brookfield Place) exists in the Connexionz API feed alongside Route 18 (Midtown). It's accessible via the dynamic ferry terminal picker on both desktop and mobile.
- [x] **Bus alert route-level filtering** — fixed NJT bus alerts showing on wrong cards. `getAlertState()` and `alertMatchesSource()` now match alerts by specific route number (parsed from stopId `bus:{id}:{route}`) instead of just source prefix. Route 126 cards no longer show alerts for routes 165/22/128.
- [x] **Desktop home button → Refresh icon** — replaced Home icon (scroll-to-top) with RotateCw that force-refreshes all polling data via refreshKey increment.
- [x] **Skeleton loading states** — shimmer skeletons for all card types (tunnel, weather, bus, subway, rail, HBLR, LIRR, MNR, MTA Bus, NYC Ferry, PATH, Ferry) during initial data fetch.
- [x] **Stop cards in settings with transit mode icons** — settings stop list uses actual transit SVG icons + colored route/line badges with +N overflow (desktop and mobile).
- [x] **Direction/mode naming consistency** — stop names no longer embed route/line info in parens; badges communicate that info. Subway shows direction only. Applied to both desktop and mobile add-stop flows.
- [x] **Show Line Badges toggle fix** — settings card badges now respect the toggle (stopHiddenBadges passed to SettingsPage).
- [x] **AddStopPanel tests for all 11 transit modes** — 32 new tests covering Ferry, HBLR, Newark LR, LIRR, Metro-North, MTA Bus, NYC Ferry. Total AddStopPanel tests: 53.
- [x] **Desktop alerts panel** — slide-in sidebar from bell icon with full alert list, dismiss/restore, dismiss all, independent bidirectional toggle, badge count on bell icon.
- [x] **Removed inline alerts from transit cards** — alerts now centralized in the alerts panel only. Cards are cleaner.
- [x] **Alert auto-dismiss setting** — renamed "Inline alert duration" to "Auto-dismiss alerts" with options: Ticker only, 30 min, 1 hour, 3 hours, 12 hours, Never.
- [x] **Alert timestamps from API** — GTFS-RT `active_period.start` (bus, MTA subway), PATH `SendDate`, tunnel `ageMinutes`. No timestamp shown when source doesn't provide one.
- [x] **Added missing alert endpoints** — `/api/bus/alerts`, `/api/path/alerts`, `/api/ferry/alerts` (mobile was silently 404ing).
- [x] **Edit stop (swipe-to-edit)** — swipe left reveals "Edit" button in Settings, opens AddStopPanel in edit mode (rename + reconfigure). Swipe right cancels.
- [x] **Show Line Badges toggle** — per-stop toggle in edit panel to hide/show transit line badges on cards. Works for all transit types.
- [x] **Alert staleness setting** — cycle through Off/30m/1hr/3hr/12hr in Settings. Alerts older than threshold filtered from badge count and display.
- [x] **Tunnel direction — always both** — tunnel pills always fetch + show both NJ→NY and NY→NJ with individual severity dots. Tap to expand shows stacked rows with speed.
- [x] **Drag-reorder stops** — touch-based drag reorder in Settings stop list via grip handles.
- [x] **Weather zip code** — controlled input with ✓ confirm button, resolves zip to NWS grid via server endpoint. "Use auto-location" resets to geolocation.
- [x] **React shell** — tab routing, page transitions (slide-up settings), floating tab bar component
- [x] **Welcome page** — zip code onboarding with `/api/nearby-stops`, preset picker flow, "Start from scratch" option
- [x] **My Stops page** — scrollable card list, weather/tunnel pills (tap-to-expand), pull-to-refresh, custom SVG icons, proper severity dot colors
- [x] **Transit cards** — reuse v1 data fetching, render with custom SVG icons (MtaGlobe, NjtBus, PATH Oculus, NjtRail, HBLR Clocktower), route-colored badges, ETA hierarchy
- [x] **Alerts page** — swipe-to-dismiss, dismissed alerts section with restore, empty state, badge count, live alert aggregation from transit APIs
- [x] **Settings page** — slide-up panel, display settings (appearance, alert badge style, weather °F/°C, tunnels), stop management (remove, expand/collapse >6), tunnel config (pick up to 2), widgets coming soon, danger zone reset
- [x] **Add Stop flow** — stepped picker (mode → search → add), slides up over settings
- [x] **Custom SVG icons** — replaced emoji with existing transit icons (NJT Bus XD60, PATH Oculus, MTA Globe, NJT Rail, HBLR Clocktower)
- [x] **Tunnel pill glow** — orange glow tied to undismissed alerts in notification panel, removed when alert dismissed
- [x] **Pull-to-refresh** — pull gesture triggers full re-mount of all data-fetching components (cards + info pills)
- [x] **Tab bar icons** — lucide-react Home, Bell, Settings icons matching desktop dashboard style
- [x] **Alert cards with transit badges** — MTA alerts show proper colored subway line circles, bus alerts show route pills, PATH/tunnel show source badges.
- [x] **Alert icon → notification center sync** — cards derive icon state from central alerts/dismissedAlerts.
- [x] **Dismiss all alerts** — button appears when 2+ active alerts.
- [x] **Tap alert icon → navigate to alerts** — tapping the alert triangle navigates to Alerts page.
- [x] **Three-state alert icon** — amber triangle (active), greyed (dismissed), hidden. Uses lucide AlertTriangle SVG.
- [x] **Alert timestamps** — tunnel alerts show "X min ago", others show "time unknown" when no timestamp available.
- [x] **NJT Bus direction picker** — direction picker after route selection for multi-ID stops.
- [x] **All transit types supported in Add Stop** — all 11 modes with proper multi-step pickers.
- [x] **Fix duplicate alerts** — polling replaces entire array with deduped live feed.
- [x] **LIRR/MNR per-station route filter** — built from static GTFS.
- [x] **Pull-to-refresh only at top** — fixed: only triggers when scrollTop=0, page container has proper overflow for scroll detection.
- [x] **NJT bus header truncation** — headsigns cleaned: strip route prefix, VIA→arrow, 28ch max.
- [x] **NJT bus route colors** — consistent colors per route in cards and picker.
- [x] **PATH multi-step picker** — search → multi-select direction picker → add. Smart display name truncation.
- [x] **NJT Rail multi-step picker** — search → line picker with colors and select/deselect all → add. Handles empty stations gracefully.
- [x] **Expandable badge rows** — MTA Subway and NJT Rail badges truncate with tappable "+N" to expand/collapse.
- [x] **PABT full support** — multi-platform stop consolidation (80+ IDs), direction_id filtering (outbound only), headsign variant picker for route 126 (Willow vs Washington gates), gate info display on cards, stop ID resilience across GTFS updates.
- [x] **Add Stop multi-step flow** — MTA Subway (search → lines + direction picker), NJT Bus (search → route picker → variant picker for PABT). All 10 transit modes wired to correct server endpoints.
- [x] **(Fix) BusVariants.test.jsx — 3 failures** — added missing `/api/bus/stop-directions` mock for multi-platform stops. Tests now pass.
- [x] **(Fix) Add Stop — step 3 (line/direction picker)** — already implemented: direction picker exists for subway, bus direction, PATH, and bus variant flows.
- [x] **(Fix) Alert triangle button non-functional** — `onAlertTap` wasn't forwarded from card components to `CardShell`. Fixed all 10 card types. Also added highlight glow: tapping the alert icon navigates to Alerts page and scrolls to + highlights matching alerts with an inset orange glow that fades after 2.5s.
- [x] **v3 Mobile app scaffold** — full React mobile app at `/mobile` with Welcome, My Stops, Alerts, Settings pages. React Router, localStorage persistence, custom SVG icons, Vitest test suite.
- [x] **Welcome page — preset picker** — "Pick stops manually" leads to neighborhood preset cards (Hoboken, Newport, Midtown, Downtown, Brooklyn, Queens) or "Start from scratch".
- [x] **Transit card wiring** — all modes (MTA Subway, NJT Bus, PATH, Ferry, NJT Rail, HBLR) properly connected to server APIs with correct stop ID formats.
- [x] **Alerts aggregation** — live polling from tunnel, bus, PATH, MTA, ferry APIs; alerts feed into Alerts page and drive tunnel pill glow.
- [x] **Welcome page — zip code auto-setup** — zip code input resolves to lat/lon, calls `/api/nearby-stops` to auto-select up to 6 relevant transit stops.
- [x] **Welcome page — "Random 6 stops" easter egg** — triple-click title picks one random stop from each transit mode.
- [x] **Nearby-stop auto-lookup** — `/api/nearby-stops?lat=X&lon=Y` endpoint searches GTFS stop coordinates across all transit types (MTA subway, NJT bus, PATH, ferry, NJT Rail, HBLR). Consolidates nearby MTA stations into complexes.
- [x] **Zip code picker validation** — out-of-area zips show clear error message instead of silently selecting a wrong preset.
- [x] **MTA station name disambiguation** — stations with the same name but different physical locations (e.g. "72 St") show line letters in search results. Uses coordinate-based clustering to distinguish complexes from separate stations.
- [x] **Desktop rebrand header** — replaced "Hoboken → NYC" with MYSTOPNOW logo, added Home/Alerts icons to header.
- [x] **Mobile mockup (v3-mobile.html)** — complete static HTML mockup of all 4 pages (Welcome, My Stops, Alerts, Settings) with floating tab bar, swipe-to-dismiss, pull-to-refresh, add stop flow, tunnel/weather pills, and settings panel.
