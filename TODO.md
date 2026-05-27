# Hoboken Commuter Dashboard — TODO

## Active

- [ ] **MTA station name disambiguation** — when searching for stations manually (settings panel), stations with the same name (e.g. "72 St" appears 4 times across NYC) should show their line letters to disambiguate: "72 St (N, Q, R)" vs "72 St (1, 2, 3)" vs "72 St (B, C)".


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
