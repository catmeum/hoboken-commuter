# My Stop Now — TODO

## Active — Next Session

- [ ] **Mobile: NY Waterway ferry card showing single route instead of all destinations** — A ferry stop (e.g. Hoboken/NJ Transit Terminal) serves multiple routes (Brookfield Place, W 39th St, Paulus Hook), but the mobile transit card only displays one. Should show all destination routes for the selected terminal, matching the desktop multi-route display behavior. Additionally, existing preset cards now show no upcoming ferries.
- [ ] **Mobile: Replace static presets with dynamic ones** — Some presets may still be hardcoded, leading to inaccurate stop times (e.g. Willow / 15 preset shows no buses, but the dynamically-added version does).
- [ ] **Add Service Time Notice** — Some routes (e.g. 126 NYC via Clinton St) only run during commute windows (Weekdays 5:40am–9:45am, 4:09pm–8:29pm). Dynamically detect routes with limited service hours from GTFS and display a notice on the card. Apply the same logic to NYW and NYC Ferries, which also don't run 24/7.
- [ ] **Mobile: NJT Data fidelity issue** - The Clinton / 11th St NJT bus stop shows scheduled buses on the weekend, when there are none. Identify why this is happening and then fix it. Implement the "Add Service Time Notice" too, potentially, as part of this fix.
- [ ] **Mobile: Display name handling for bus stops** — If a stop has no saved display name (e.g. from presets/nearby-stops), show a fallback indicator rather than the raw stop ID. On the card itself, the API response name works; the issue is in Settings where the raw ID appears. The stop editor (reconfigure flow) should let the user pick the correct name. Also investigate why the PABT short name truncation ("PABT · 126 Willow") doesn't always apply consistently.
- [ ] **Mobile: Display name handling for bus stops** — If a stop has no saved display name (e.g. from presets/nearby-stops), show a fallback indicator rather than the raw stop ID. On the card itself, the API response name works; the issue is in Settings where the raw ID appears. The stop editor (reconfigure flow) should let the user pick the correct name. Also investigate why the PABT short name truncation ("PABT · 126 Willow") doesn't always apply consistently.
## UX & Visual Polish

- [ ] **Add animation when transit cards update** — Animate individual transit cards (fade, highlight, or slide) when their departure data refreshes, so users can see at a glance which cards just received new information.
- [ ] **Create new logo for MyStopNow** — Design a logo suitable for favicon and home screen install icon.

## Feature Backlog

- [ ] **Feedback submission mechanism** — Add a way for users to submit feedback or report issues. Options: embedded Google Form, link to a GitHub Issues template, or a simple form that sends an email.
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
- [ ] **Share list of stops** — Create a mechanism to share one or multiple stops with a friend using a shared URL.

## UX / Loading State (Future)

- [ ] **GTFS loading status API** — Update `/api/bus/gtfs-status` to return `{ status: "building" | "ready", progress?: string }` so the frontend can poll during startup.
- [ ] **App-level loading screen** — On initial load, poll `/api/bus/gtfs-status` every 3s; while `status === "building"` show a full-screen overlay with spinner and "Loading transit data, please wait…"
- [ ] **Auto-refresh on ready** — When poll detects `status === "ready"`, dismiss loading screen and trigger a data fetch across all panels.
- [ ] **Desktop ticker: Consider suppressing long-lived advisories** — Service advisories (detours, construction) can last months and feel noisy in the ticker. Consider filtering them out of the ticker while still showing them in the Alerts panel, or auto-dismissing advisories older than X days from the ticker. Travel alerts (real-time disruptions) should always show.
- [ ] **NJT service/station advisories: Monitor for cause/effect enrichment** — NJT's GTFS-RT `getAlerts` endpoint doesn't populate cause/effect enums. If NJT begins using them in the future, re-enable the classification infrastructure (cause/effect badges, richer categorization). Currently using RSS feed which only distinguishes advisory vs. travel alert.

## Known Bugs

- [ ] **NJT Bus intermittent empty state** — Bus cards occasionally show "No upcoming buses" for ~30s then repopulate. Likely a GTFS-RT protobuf parsing race condition or index-out-of-range error when route filter is applied.
- [ ] **PABT gate accuracy for sub-routes** — Route 126 has two gates (213 for Washington, 214 for Willow) but the dynamic card only shows the primary gate. Headsign-based lookup would be more accurate.
