# Hoboken Commuter Dashboard

A real-time commuter dashboard for the NY/NJ metro area. Built for Hoboken-based commuters, it aggregates live transit data from a dozen sources into a single, clean interface — tunnels, buses, trains, ferries, subway, and weather, all in one place. Visit the live version of this dashboard at: [https://commute.stroszeck.com](https://commute.stroszeck.com)

![Version](https://img.shields.io/badge/version-2.4.0-blue) ![Stack](https://img.shields.io/badge/stack-React%20%2B%20Vite%20%2B%20Express-lightgrey)

---

## What It Does

- **Zip code auto-setup** — enter your zip code and the dashboard auto-detects the 3–6 closest transit stops across all modes (subway, bus, rail, PATH, ferry, light rail). No manual configuration needed.
- **Bidirectional** — toggle between Hoboken → NYC and NYC → Hoboken with a single click. All data sources flip instantly.
- **Fully customizable** — settings panel lets you add/remove/drag-reorder transit cards, configure alerts, and set your home/work cities. Settings persist across sessions.
- **Live data everywhere** — real-time ETAs, not just schedules. Falls back to static GTFS when live data isn't available.
- **Alert aggregation** — scrolling ticker pulls alerts from all active transit sources. Inline alerts on individual cards too.
- **Light/dark mode** — auto-switches at 7:30 AM / 6 PM, with manual override. Custom icons glow in dark mode.

---

## Transit Coverage

| Mode | Coverage | Auth |
|---|---|---|
| Lincoln & Holland Tunnels | Crossing time, speed, severity, alerts | None |
| NJ Transit Bus | 16,820 stops, 273 routes, real-time ETAs + capacity | NJT token |
| NJ Transit Rail | 173 stations, 11 lines, real-time departures | NJT token |
| HBLR Light Rail | All stops via NJT GTFS-RT | NJT token |
| PATH Train | 13 stations, 4 lines + weekend route, real-time | None |
| NYW Ferry | 14 terminals, real-time ETAs | API key (hardcoded) |
| NYC Ferry | 50 stops, 8 routes, real-time | None |
| MTA Subway | 496 stations, all lines, real-time | None |
| LIRR | 127 stations, 13 branches, real-time | None |
| Metro-North | ~100 stations, 6 lines, real-time | None |
| MTA Bus | 286+ routes, real-time via SIRI | MTA Bus API key |
| Weather | Any US zip code via NWS | None |

---

## Stack

- **Frontend:** React 19 + Vite 8, no UI framework
- **Backend:** Express 5 — handles NJT auth, protobuf parsing, GTFS caching, MTA SIRI calls
- **Data formats:** GTFS-RT (protobuf), JSON, SIRI
- **Styling:** Plain CSS with CSS variables for theming

---

## Getting Started

### Prerequisites

- Node.js 18+
- NJ Transit developer account — [register here](https://developer.njtransit.com/registration/)
- MTA Bus Time API key — [register here](https://bt.mta.info/wiki/Developers/Index) *(only needed for MTA Bus cards)*

### Setup

```bash
# Install dependencies
npm install

# Copy and fill in your credentials
cp .env.example .env
```

Edit `.env`:

```env
VITE_NJT_USERNAME=your_njt_username
VITE_NJT_PASSWORD=your_njt_password
MTA_BUS_API_KEY=your_mta_bus_key
```

### Running

You need two terminals:

```bash
# Terminal 1 — backend (port 3001)
npm run server

# Terminal 2 — frontend (port 5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

On first run, the backend downloads ~31MB of NJT GTFS static data and caches it to `.cache/gtfs.zip`. This refreshes every 7 days. It also auto-builds the MTA station routes cache (`.cache/mta_station_routes.json`) if missing.

### Testing

```bash
npm test
```

Runs 134 integration tests against the live server. Server must be running.

---

## Architecture

```
Browser (React SPA)  ←→  localStorage (settings)
  └── Vite dev server :5173
        ├── /api/panynj  →  panynj.gov          (tunnel data)
        ├── /api/nws     →  api.weather.gov      (weather)
        └── /api/*       →  Express backend :3001
                              ├── NJT GTFS-RT (bus, HBLR)
                              ├── NJT Rail JSON API
                              ├── PATH GTFS-RT
                              ├── NY Waterway Connexionz API
                              ├── NYC Ferry GTFS-RT
                              ├── MTA GTFS-RT (subway, LIRR, MNR)
                              └── MTA Bus SIRI API
```

---

## Key Features

### Zip Code Auto-Setup
Enter your zip code on the welcome screen and the dashboard automatically finds the closest transit stops — MTA subway, NJT bus, NJT Rail, PATH, ferry, and HBLR. Works for any zip in the NY/NJ metro area. Out-of-area zips get a clear error message.

### Settings Panel
Add any transit card from the full picker — search by stop name, station, or route. Drag cards to reorder using the grip handle. Separate outbound and inbound columns, up to 6 cards each. All settings persist in localStorage. Reset to defaults via the button at the bottom of the panel.

### Custom Icons
Each transit mode has a distinct icon. HBLR shows the Hoboken Lackawanna clocktower, LIRR shows an M7/M9 train profile, Metro-North shows the Grand Central information booth clock, and MTA Subway shows the iconic entrance globe. All glow in dark mode.

### PABT Gate Info
Bus cards at Port Authority Bus Terminal automatically show the current gate number (day/late/overnight schedule) based on route and time of day.

### Smart Alert Filtering
Alerts only appear for transit lines you actually have on your dashboard. Remove a card, its alerts disappear from the ticker automatically.

### Schedule Fallback
When real-time GPS data isn't available, NJT Bus falls back to static GTFS schedule data. Every departure is labeled **LIVE** or **SCHED**.

### PATH Weekend Service
On weekends and holidays, PATH runs JSQ-33 via Hoboken as route `1024`. The dashboard correctly shows both `HOB-33` and `JSQ via HOB → 33rd St` trains.

---

## Version History

See [CHANGELOG.md](CHANGELOG.md) for full version history. Current version: **v2.4.0** (May 2026).

---

## Deployment (Raspberry Pi)

```bash
npm run build
# Add static file serving + direct API calls to server/index.js (replace Vite proxy)
npm run server  # serves SPA + all APIs on port 3001
```

Use `pm2` or `systemd` for auto-start on boot.
