# Hoboken Commuter Dashboard — TODO

## Active

- [ ] **Dismissable inline alerts** — add an "X" button to inline alerts on transit cards. Clicking it hides that specific alert from the card for the rest of the session (in-memory state, not persisted). The alert should still appear in the scrolling ticker. A full page refresh resets dismissed alerts.
- [ ] **Bus time timezone bug** — dashboard shows wrong times (e.g. "5 min, 11:35am" when it's 7:30am). Server is likely running in UTC on Lightsail and formatting departure times without converting to Eastern Time. Fix: ensure `formatTime()` in `server/index.js` uses Eastern timezone, or pass a timezone offset. Affects all NJT bus schedule fallback times.
- [ ] **Fix weather card height** — card still doesn't size consistently across viewport heights. Needs a reliable compact layout that doesn't clip or over-expand regardless of screen size.
- [ ] **Remove minimum 3 stops requirement** — dashboard currently enforces a minimum of 3 transit cards. Remove this constraint so users can run with as few cards as they want (even just 1).

## Feature Backlog

- [ ] **Rename app to "My Stop Now"** — rebrand from "Hoboken Commuter Dashboard" to My Stop Now (domain: mystopnow.com). Update app title, header, page title, README, all docs, and any hardcoded references. 
- [ ] **iPhone app (Flighty-style UI)** — wrap as PWA first (`manifest.json`, service worker, iOS meta tags for home screen install). Then review UI design inspiration on Mobbin for a Flighty-like aesthetic before any visual redesign. Longer term: Capacitor wrapper for a native App Store build.
- [ ] **Welcome page — zip code auto-setup** — on the preset picker, add a zip code input field. When submitted, use the NWS zip→grid resolution (already built) plus a nearby-stops lookup to auto-select up to 6 relevant transit stops around that location and pre-populate the dashboard. No new API needed if using GTFS stop coordinates.
- [ ] **Welcome page — "Random 6 stops" easter egg** — hidden trigger on the preset picker (e.g. long-press the logo, or a specific tap sequence) that picks 6 random transit stops and loads them as a demo. Good for showing off the app without committing to a real location. Integration approach TBD — could be a hidden button that appears after 5 seconds of inactivity on the picker, or a konami-code style input.
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
