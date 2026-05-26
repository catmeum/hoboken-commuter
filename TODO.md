# Hoboken Commuter Dashboard — TODO

## Active

- [ ] **Nearby-stop auto-lookup** — enhance the zip code flow to find the 3-6 closest transit stops using GTFS stop coordinates (MTA subway, NJT bus, PATH, ferry). Requires a new `/api/nearby-stops?lat=X&lon=Y` endpoint that searches stop coordinates. Falls back to premade presets if no nearby stops found.
- [ ] **500 premade presets spreadsheet** — import a user-provided spreadsheet of ~500 zip→preset mappings as a fallback layer between the automatic GTFS lookup and the "pick manually" message.
- [ ] **Zip code picker validation** — currently accepts any US zip code (including California) and matches to the nearest preset even if it's hundreds of miles away. Add a distance threshold (~0.05° / ~3 miles) — if the nearest preset is too far, show "No nearby transit coverage — pick a neighborhood manually" instead of silently selecting a wrong preset. Also add test cases for out-of-range zips.

## Feature Backlog

- [ ] **Rename app to "My Stop Now"** — rebrand from "Hoboken Commuter Dashboard" to My Stop Now (domain: mystopnow.com). Update app title, header, page title, README, all docs, and any hardcoded references. 
- [ ] **iPhone app (Flighty-style UI)** — wrap as PWA first (`manifest.json`, service worker, iOS meta tags for home screen install). Then review UI design inspiration on Mobbin for a Flighty-like aesthetic before any visual redesign. Longer term: Capacitor wrapper for a native App Store build.
- [x] **Welcome page — zip code auto-setup** — on the preset picker, add a zip code input field. When submitted, use the NWS zip→grid resolution (already built) plus a nearby-stops lookup to auto-select up to 6 relevant transit stops around that location and pre-populate the dashboard. No new API needed if using GTFS stop coordinates.
- [x] **Welcome page — "Random 6 stops" easter egg** — hidden trigger on the preset picker (e.g. long-press the logo, or a specific tap sequence) that picks 6 random transit stops and loads them as a demo. Good for showing off the app without committing to a real location. Integration approach TBD — could be a hidden button that appears after 5 seconds of inactivity on the picker, or a konami-code style input.
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
