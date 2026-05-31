# My Stop Now (formerly Hoboken Commuter Dashboard) — TODO

## Active — Next Session

- [x] **Pull-to-refresh only at top** — fixed: only triggers when scrollTop=0, page container has proper overflow for scroll detection.
- [x] **NJT bus header truncation** — headsigns cleaned: strip route prefix, VIA→arrow, 28ch max.
- [x] **NJT bus route colors** — consistent colors per route in cards and picker.
- [x] **PATH multi-step picker** — search → multi-select direction picker → add. Smart display name truncation.
- [x] **NJT Rail multi-step picker** — search → line picker with colors and select/deselect all → add. Handles empty stations gracefully.
- [x] **Expandable badge rows** — MTA Subway and NJT Rail badges truncate with tappable "+N" to expand/collapse.
- [ ] **Alert cards with transit badges** — show the associated transit line badges (subway circles, bus route pills) in each alert card.
- [ ] **Alert icon → notification center sync** — transit cards show ⚠️ from their own API data, but the notification center polls separately and may not have the same alerts. Need to either: feed card-level alerts into the notification center, or only show ⚠️ when the alert exists in the notification center.
- [ ] **NY Waterway route coverage** — Hoboken 14th St only shows Midtown/W39th route from Connexionz API. Verify if downtown (Brookfield Place) service still operates from this terminal or only from NJT Terminal. May need to combine terminal tags or check if Connexionz data is incomplete.
- [ ] **NYC Ferry empty departures** — some stops (e.g. Astoria) return empty departures even during operating hours. Investigate if the GTFS-RT feed has timing gaps or if stop IDs don't match the feed's stop references.
- [ ] **Dismiss all alerts** - Add the ability to dismiss all alerts at once in notificaiton center.
- [ ] **Tap alert icon → navigate to alerts** — tapping the ⚠️ on a transit card navigates to the Alerts page and highlights the relevant alert. Ask user about updating ⚠️ icon / button so it changes color when the alert is active vs. dismissed. Potentially create custom icon. 
- [ ] **Tunnel alert timestamps** — show when the alert was first posted. If no timestamp available from PANYNJ API, display "time unknown".
- [ ] **Update presets with inbound + outbound** — mobile presets should include both directions (matching desktop), not just outbound.
- [ ] **Weather zip code in Settings** — add a zip code input for weather location in Settings (only visible when weather pill is enabled). Allows manual override of GPS-based location.
- [ ] **All transit types supported in Add Stop** — ~~verify search endpoints work for every mode~~ DONE: all 11 modes implemented with proper multi-step pickers.
- [ ] **Fix duplicate alerts in Alerts panel** — deduplicate by alert ID before adding to state.
- [ ] **Buy Me a Coffee link** — swap Venmo link with https://buymeacoffee.com/mystopnow. Consider placement (Settings about section, welcome page footer).
- [x] **LIRR/MNR per-station route filter** — built from static GTFS stop_times.txt + trips.txt at load time.
- [ ] **Transit card icons per type** — add ferry SVG icon (currently emoji ⛴️).
- [ ] **Unit tests + E2E verification** — add tests for TransitCard routing, InfoPills, MobileApp alert aggregation. Full manual E2E walkthrough.

## v3 Mobile App — Implementation Tasks

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
- [ ] **Pinned cards** — allow pinning up to 6 transit cards to the top of My Stops for quick-glance priority
- [ ] **Triple-tap logo easter egg** — triple-tap MSN logo to pick 6 random stops (one per transit mode)
- [ ] **Geolocation sorting** — sort My Stops cards by proximity to current location (closest first)
- [ ] **Add Stop — step 3 (line/direction picker)** — after selecting a station, let user pick specific lines and direction (N/S) before adding
- [ ] **Edit stop (swipe-to-edit)** — swipe left on a stop in Settings to reveal "Edit" button.  Opens the line/direction picker pre-populated with current config. Depends on step 3 picker being built first. Swipe right when edit button is revealed, to cover edit button. UI shell is in place (disabled).
- [ ] **Tunnel direction picker + up to 4** — let user pick direction (NJ→NY or NY→NJ) per tunnel and allow up to 4 selections (e.g. Lincoln outbound + Lincoln inbound + Holland outbound + GWB inbound)
- [ ] **Drag-reorder stops** — touch-based drag reorder in Settings stop list (grip handles rendered, logic TBD)
- [ ] **Skeleton loading states** — replace all fallback/placeholder text with pulsing grey skeleton loaders (Facebook/iOS style). Transit cards, weather pill, tunnel pills should all show a shimmer skeleton while data loads instead of "Loading…" or empty states.
- [ ] **Up to 25 cards** — increase max card limit from desktop's 6 to 25 for mobile
- [ ] **PWA setup** — manifest.json, service worker, iOS meta tags for home screen install

## Feature Backlog

- [ ] **Rename app to "My Stop Now"** — rebrand from "Hoboken Commuter Dashboard" to My Stop Now (domain: mystopnow.com). Update app title, page title, README, all docs, and any hardcoded references. commute.stroszeck.com should still work as redirect/alias.
- [ ] **Dashboard theme refresh (desktop)** — apply v3 visual language (rounded cards, accent purple, liquid glass elements) to the desktop dashboard. Keep existing functionality, just restyle.
- [ ] **Explore page with map** — MapLibre GL map showing nearby transit stops as colored markers. Bottom sheet with list. Medium effort — add after list-based Add Stop flow is solid.
- [ ] **iPhone app (Capacitor)** — wrap PWA as native iOS app for App Store. Longer term after PWA is stable.

## UX / Loading State (Future)

- [ ] **GTFS loading status API** — update `/api/bus/gtfs-status` to return `{ status: "building" | "ready", progress?: string }` so the frontend can poll it during startup
- [ ] **App-level loading screen** — on initial load, poll `/api/bus/gtfs-status` every 3s; while `status === "building"` show a full-screen overlay with spinner and "Loading transit data, please wait…"
- [ ] **Panel-level graceful degradation** — instead of panels hanging, show skeleton loader or "Data loading…" placeholder while GTFS builds, then auto-refresh when ready
- [ ] **Auto-refresh on ready** — when poll detects `status === "ready"`, dismiss loading screen and trigger a data fetch across all panels automatically

## Backlog

- [ ] **Clinton St service note** — hardcoded hours; could derive from GTFS dynamically
- [ ] **NJT Bus intermittent empty state** — bus cards occasionally show "No upcoming buses" for ~30 seconds then repopulate. Likely a GTFS-RT protobuf parsing race condition or index-out-of-range error when route filter is applied. Server returns `{ error: "index out of range" }` intermittently.
- [ ] **PABT gate accuracy for sub-routes** — route 126 has two gates (213 for Washington, 214 for Willow) but the dynamic card only shows the primary gate. Headsign-based lookup would be more accurate but adds complexity. See DECISIONS.md for tradeoff analysis
- [ ] **Clothing recommendation card** — square card that sits between the tunnel and weather cards. Shows a single icon for what to bring outside based on current conditions: umbrella (rain), winter coat (cold), sunscreen (hot/sunny), light jacket (mild), etc. Derived from the weather data already fetched — no new API needed.

## Completed

- [x] **PABT full support** — multi-platform stop consolidation (80+ IDs), direction_id filtering (outbound only), headsign variant picker for route 126 (Willow vs Washington gates), gate info display on cards, stop ID resilience across GTFS updates.
- [x] **Add Stop multi-step flow** — MTA Subway (search → lines + direction picker), NJT Bus (search → route picker → variant picker for PABT). All 10 transit modes wired to correct server endpoints.
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
