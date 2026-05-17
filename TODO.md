# Hoboken Commuter Dashboard — TODO

## Active

- [ ] **Bus time timezone bug** — dashboard shows wrong times (e.g. "5 min, 11:35am" when it's 7:30am). Server is likely running in UTC on Lightsail and formatting departure times without converting to Eastern Time. Fix: ensure `formatTime()` in `server/index.js` uses Eastern timezone, or pass a timezone offset. Affects all NJT bus schedule fallback times.

## Feature Backlog

- [ ] **Phone / iPad app** — wrap as a PWA (Progressive Web App) first: add `manifest.json`, service worker, and iOS meta tags so it can be installed to home screen. Longer term: Capacitor wrapper for a native App Store build.
- [ ] **Dashboard theme refresh** — current theme feels generic/AI-generated. Redesign with a more distinct visual identity — consider a transit-inspired aesthetic (think MTA signage, NJT colors, or a clean commuter board look).

## UX / Loading State (Future)

- [ ] **GTFS loading status API** — update `/api/bus/gtfs-status` to return `{ status: "building" | "ready", progress?: string }` so the frontend can poll it during startup
- [ ] **App-level loading screen** — on initial load, poll `/api/bus/gtfs-status` every 3s; while `status === "building"` show a full-screen overlay with spinner and "Loading transit data, please wait…"
- [ ] **Panel-level graceful degradation** — instead of panels hanging, show skeleton loader or "Data loading…" placeholder while GTFS builds, then auto-refresh when ready
- [ ] **Auto-refresh on ready** — when poll detects `status === "ready"`, dismiss loading screen and trigger a data fetch across all panels automatically

## Backlog

- [ ] **Clinton St service note** — hardcoded hours; could derive from GTFS dynamically
- [ ] **PABT gate accuracy for sub-routes** — route 126 has two gates (213 for Washington, 214 for Willow) but the dynamic card only shows the primary gate. Headsign-based lookup would be more accurate but adds complexity. See DECISIONS.md for tradeoff analysis
- [ ] **Clothing recommendation card** — square card that sits between the tunnel and weather cards. Shows a single icon for what to bring outside based on current conditions: umbrella (rain), winter coat (cold), sunscreen (hot/sunny), light jacket (mild), etc. Derived from the weather data already fetched — no new API needed.
