# Hoboken Commuter Dashboard — TODO

## Active

*(No active items — pick from Feature Backlog or Backlog)*


## Feature Backlog

- [ ] **Rename app to "My Stop Now"** — rebrand from "Hoboken Commuter Dashboard" to My Stop Now (domain: mystopnow.com). Update app title, header, page title, README, all docs, and any hardcoded references. 
- [ ] **iPhone app (Flighty-style UI)** — wrap as PWA first (`manifest.json`, service worker, iOS meta tags for home screen install). Then review UI design inspiration on Mobbin for a Flighty-like aesthetic before any visual redesign. Longer term: Capacitor wrapper for a native App Store build.
- [ ] **Dashboard theme refresh** — current theme feels generic/AI-generated. Redesign with a more distinct visual identity — consider a transit-inspired aesthetic (think MTA signage, NJT colors, or a clean commuter board look). Review Mobbin for inspiration alongside the iPhone app work.

## UX / Loading State (Future)

- [ ] **GTFS loading status API** — update `/api/bus/gtfs-status` to return `{ status: "building" | "ready", progress?: string }` so the frontend can poll it during startup
- [ ] **App-level loading screen** — on initial load, poll `/api/bus/gtfs-status` every 3s; while `status === "building"` show a full-screen overlay with spinner and "Loading transit data, please wait…"
- [ ] **Panel-level graceful degradation** — instead of panels hanging, show skeleton loader or "Data loading…" placeholder while GTFS builds, then auto-refresh when ready
- [ ] **Auto-refresh on ready** — when poll detects `status === "ready"`, dismiss loading screen and trigger a data fetch across all panels automatically

## Backlog

- [ ] **Clinton St service note** — hardcoded hours; could derive from GTFS dynamically
- [ ] **PABT gate accuracy for sub-routes** — route 126 has two gates (213 for Washington, 214 for Willow) but the dynamic card only shows the primary gate. Headsign-based lookup would be more accurate but adds complexity. See DECISIONS.md for tradeoff analysis
- [ ] **Clothing recommendation card** — square card that sits between the tunnel and weather cards. Shows a single icon for what to bring outside based on current conditions: umbrella (rain), winter coat (cold), sunscreen (hot/sunny), light jacket (mild), etc. Derived from the weather data already fetched — no new API needed.
- [ ] **Phone / iPad app** — see "iPhone app (Flighty-style UI)" in Feature Backlog above.

## Completed

- [x] **Welcome page — zip code auto-setup** — zip code input resolves to lat/lon, calls `/api/nearby-stops` to auto-select up to 6 relevant transit stops.
- [x] **Welcome page — "Random 6 stops" easter egg** — triple-click title picks one random stop from each transit mode.
- [x] **Nearby-stop auto-lookup** — `/api/nearby-stops?lat=X&lon=Y` endpoint searches GTFS stop coordinates across all transit types (MTA subway, NJT bus, PATH, ferry, NJT Rail, HBLR). Consolidates nearby MTA stations into complexes.
- [x] **Zip code picker validation** — out-of-area zips show clear error message instead of silently selecting a wrong preset.
- [x] **MTA station name disambiguation** — stations with the same name but different physical locations (e.g. "72 St") show line letters in search results. Uses coordinate-based clustering to distinguish complexes from separate stations.
