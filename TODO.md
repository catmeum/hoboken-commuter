# My Stop Now (formerly Hoboken Commuter Dashboard) — TODO

## Active — Next Session

- [x] **Convert mobile mockup to React** — take the approved `v3-mobile.html` design and implement as real React components on the `v3-rebrand` branch. Route via `/mobile`. Reuse v1's existing service layer (`src/services/*`), custom SVG icons, and localStorage persistence. Pages: Welcome, My Stops, Alerts, Settings + Add Stop flow.

## v3 Mobile App — Implementation Tasks

- [x] **React shell** — tab routing, page transitions (slide-up settings), floating tab bar component
- [x] **Welcome page** — zip code onboarding with `/api/nearby-stops`, "Pick stops manually" → Add Stop flow
- [x] **My Stops page** — scrollable card list, weather/tunnel pills (tap-to-expand), pull-to-refresh, geolocation sorting
- [x] **Transit cards** — reuse v1 data fetching, render with custom SVG icons, route-colored badges, ETA hierarchy
- [x] **Alerts page** — swipe-to-dismiss, dismissed alerts section with restore, empty state, badge count
- [x] **Settings page** — slide-up panel, display settings (appearance, alert badge style, weather °F/°C, tunnels), stop management (drag-reorder, remove, expand/collapse >6), tunnel config (pick up to 2), presets with confirmation, widgets coming soon, danger zone reset
- [x] **Add Stop flow** — stepped picker (mode → search → select lines/direction → add), slides up over settings
- [ ] **Pinned cards** — allow pinning up to 6 transit cards to the top of My Stops for quick-glance priority
- [ ] **Triple-tap logo easter egg** — triple-tap MSN logo to pick 6 random stops (one per transit mode)
- [ ] **Geolocation sorting** — sort My Stops cards by proximity to current location (closest first)
- [ ] **Pull-to-refresh** — connect pull gesture to actual data refetch across all cards
- [ ] **Custom SVG icons** — replace emoji placeholders with existing transit icons (NJT Bus XD60, PATH Oculus, MTA Globe, etc.)
- [ ] **Tunnel pill glow** — orange glow when tunnel has active alert, remove glow when alert dismissed/resolved
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
- [ ] **PABT gate accuracy for sub-routes** — route 126 has two gates (213 for Washington, 214 for Willow) but the dynamic card only shows the primary gate. Headsign-based lookup would be more accurate but adds complexity. See DECISIONS.md for tradeoff analysis
- [ ] **Clothing recommendation card** — square card that sits between the tunnel and weather cards. Shows a single icon for what to bring outside based on current conditions: umbrella (rain), winter coat (cold), sunscreen (hot/sunny), light jacket (mild), etc. Derived from the weather data already fetched — no new API needed.

## Completed

- [x] **Welcome page — zip code auto-setup** — zip code input resolves to lat/lon, calls `/api/nearby-stops` to auto-select up to 6 relevant transit stops.
- [x] **Welcome page — "Random 6 stops" easter egg** — triple-click title picks one random stop from each transit mode.
- [x] **Nearby-stop auto-lookup** — `/api/nearby-stops?lat=X&lon=Y` endpoint searches GTFS stop coordinates across all transit types (MTA subway, NJT bus, PATH, ferry, NJT Rail, HBLR). Consolidates nearby MTA stations into complexes.
- [x] **Zip code picker validation** — out-of-area zips show clear error message instead of silently selecting a wrong preset.
- [x] **MTA station name disambiguation** — stations with the same name but different physical locations (e.g. "72 St") show line letters in search results. Uses coordinate-based clustering to distinguish complexes from separate stations.
- [x] **Desktop rebrand header** — replaced "Hoboken → NYC" with MYSTOPNOW logo, added Home/Alerts icons to header.
- [x] **Mobile mockup (v3-mobile.html)** — complete static HTML mockup of all 4 pages (Welcome, My Stops, Alerts, Settings) with floating tab bar, swipe-to-dismiss, pull-to-refresh, add stop flow, tunnel/weather pills, and settings panel.
