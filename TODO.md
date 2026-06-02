# My Stop Now (formerly Hoboken Commuter Dashboard) — TODO

## Active — Next Session

- [x] **Fix all lint errors** — 104 ESLint errors across server/index.js, App.jsx, and test files (unused vars, no-undef for Buffer/global/process, duplicate keys, empty blocks, set-state-in-effect, impure render calls). Clean pass should be the goal.
- [x] **Update mobile presets with inbound + outbound** — include both directions.
- [x] **NY Waterway route coverage** — verify Hoboken 14th downtown service. **Verified:** Route 12 (Hoboken 14th → Pier 11/Wall St → Brookfield Place) exists in the Connexionz API feed alongside Route 18 (Midtown). It's accessible via the dynamic ferry terminal picker on both desktop and mobile.
- [ ] **NYC Ferry empty departures** — investigate GTFS-RT feed gaps. **Finding:** The NYC Ferry GTFS-RT feed (`tripupdate`) only reports actively tracked real-time trips — there is no static schedule fallback. Most stops show 0 departures outside peak hours or when ferries aren't actively running on their route. High-frequency stops (E 34th, Wall St/Pier 11) consistently have data; low-frequency routes (Rockaway, Soundview) may be empty for hours. This is a feed limitation, not a parsing bug. A potential improvement would be to fall back to static GTFS schedule data when the RT feed is empty. Update: Backup schedules **do** exist: https://www.ferry.nyc/routes-and-schedules/
- [ ] **Tap to expand individual line information for a stop** - On smaller screens, some of the long bus lines (and potentially on other transit modes) are cut off. Find ways to reduce the length of text and allow for tapping on an individual line (i.e. 126 * Hoboken via willow Ave | 1min | 6:17 |sched) to be temporarily expanded (automatically shrinks back after 10 seconds if not tapped again first) so all of the text can show for a given ride / individual line information.
- [ ] **Enable on/off toggle for active alerts on mobile** - On desktop, a user can choose (of the active lines being displayed) which transit line alerts they do or do not want to see by toggling them on/off in settings. Bring this functionality to Mobile. 
- [ ] **Rename app to "My Stop Now"** — FIRST: Evaluate options for a better git strategy to deploy the mobile and desktop versions independently. THEN, rebrand from "Hoboken Commuter Dashboard" to My Stop Now (domain: mystopnow.com). Update app title, page title, README, all docs, and any hardcoded references. commute.stroszeck.com should still work as redirect/alias. Host on same lightsail instance. Give information of how to host app on mystopnow.com and setup redirect from commute.stroszeck.com


## v3 Mobile App — Implementation Tasks

- [ ] **PWA setup** — manifest.json, service worker, iOS meta tags for home screen install

## Feature Backlog

- [ ] **Explore page with map** — MapLibre GL map showing nearby transit stops as colored markers. Bottom sheet with list. Medium effort — add after list-based Add Stop flow is solid.
- [ ] **iPhone app (Capacitor)** — wrap PWA as native iOS app for App Store. Longer term after PWA is stable.
- [ ] **Unit tests + E2E verification** — add tests for TransitCard routing, InfoPills, MobileApp alert aggregation. Full manual E2E walkthrough.
- [ ] **Triple-tap logo easter egg** — triple-tap MSN logo to pick 6 random stops (one per transit mode)
- [ ] **My Stops sorting** — sort My Stops cards by proximity to current location (closest first), Order added, or by Soonest Arrival (which stop has an arrival first)
- [ ] **Buy Me a Coffee link** — swap Venmo with buymeacoffee.com/mystopnow.


## UX / Loading State (Future)

- [ ] **GTFS loading status API** — update `/api/bus/gtfs-status` to return `{ status: "building" | "ready", progress?: string }` so the frontend can poll it during startup
- [ ] **App-level loading screen** — on initial load, poll `/api/bus/gtfs-status` every 3s; while `status === "building"` show a full-screen overlay with spinner and "Loading transit data, please wait…"
- [ ] **Auto-refresh on ready** — when poll detects `status === "ready"`, dismiss loading screen and trigger a data fetch across all panels automatically

## Backlog

- [ ] **Clinton St service note** — hardcoded hours; could derive from GTFS dynamically
- [ ] **NJT Bus intermittent empty state** — bus cards occasionally show "No upcoming buses" for ~30 seconds then repopulate. Likely a GTFS-RT protobuf parsing race condition or index-out-of-range error when route filter is applied. Server returns `{ error: "index out of range" }` intermittently.
- [ ] **PABT gate accuracy for sub-routes** — route 126 has two gates (213 for Washington, 214 for Willow) but the dynamic card only shows the primary gate. Headsign-based lookup would be more accurate but adds complexity. See DECISIONS.md for tradeoff analysis
- [ ] **Clothing recommendation card** — square card that sits between the tunnel and weather cards. Shows a single icon for what to bring outside based on current conditions: umbrella (rain), winter coat (cold), sunscreen (hot/sunny), light jacket (mild), etc. Derived from the weather data already fetched — no new API needed.

## Completed

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
