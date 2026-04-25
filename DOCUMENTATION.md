# Hoboken Commuter Dashboard — Technical Documentation

**Version 1.7.0**

## Overview

A real-time commuter dashboard for the NY/NJ metro area. Displays tunnel crossing times, NJ Transit bus and rail arrivals, HBLR light rail, NY Waterway and NYC Ferry departures, PATH trains, MTA subway/LIRR/Metro-North/bus, weather for any US zip code, and transit alerts from all sources. Supports bidirectional commuting with a single toggle, and includes a comprehensive settings panel for customizing transit cards, alerts, and display preferences.

**Stack:** React (Vite) frontend + Express backend for API proxying, protobuf parsing, NJT Rail JSON API, and MTA Bus SIRI API.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                    │
│  Polls /api/* endpoints every 15–120 seconds            │
│  Direction toggle swaps all data sources instantly       │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  Vite Dev Server (port 5173)                            │
│  Proxies /api/* to backend or external APIs             │
└────────────────┬────────────────────────────────────────┘
                 │
     ┌───────────┼───────────────┐
     │           │               │
     ▼           ▼               ▼
┌─────────┐ ┌─────────┐ ┌──────────────┐
│ Express │ │  PANYNJ │ │   NWS API    │
│ Backend │ │  (direct│ │   (direct    │
│ :3001   │ │  proxy) │ │    proxy)    │
└────┬────┘ └─────────┘ └──────────────┘
     │
     ├── NJT GTFS-RT (bus + HBLR times, capacity, alerts)
     ├── NJT Rail JSON API (rail departures, alerts, capacity)
     ├── PATH GTFS-RT (train times)
     ├── PATH Alerts (PANYNJ)
     ├── Ferry ETA (Connexionz)
     └── MTA GTFS-RT (subway times + alerts)
```

---

## Running the App

```bash
cd hoboken-commuter
npm install
cp .env.example .env
# Edit .env with your NJT developer credentials

# Start backend (port 3001)
npm run server

# Start frontend (port 5173)
npm run dev
```

Both must be running. The Vite dev server proxies `/api/bus`, `/api/path`, and `/api/ferry` to the Express backend on port 3001.

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `VITE_NJT_USERNAME` | NJ Transit developer portal username | Yes |
| `VITE_NJT_PASSWORD` | NJ Transit developer portal password | Yes |
| `MTA_BUS_API_KEY` | MTA Bus Time API key (bt.mta.info) | Yes (for MTA Bus) |
| `BUS_API_PORT` | Express server port (default: 3001) | No |

Register at https://developer.njtransit.com/registration/

---

## Proxy Configuration (vite.config.js)

| Path | Target | Purpose |
|---|---|---|
| `/api/panynj/*` | `https://www.panynj.gov/bin/portauthority/*` | Tunnel crossing times + alerts |
| `/api/nws/*` | `https://api.weather.gov/*` | NWS weather forecasts |
| `/api/bus` | `http://localhost:3001` | NJT bus (via Express backend) |
| `/api/path` | `http://localhost:3001` | PATH trains (via Express backend) |
| `/api/ferry` | `http://localhost:3001` | NY Waterway ferry (via Express backend) |
| `/api/mta` | `http://localhost:3001` | MTA subway (via Express backend) |
| `/api/rail` | `http://localhost:3001` | NJT Rail (via Express backend) |

All backend endpoints accept `?dir=outbound` (default) or `?dir=inbound` to switch direction.

---

## Direction Support

The dashboard supports two directions, toggled via the header title:

### Outbound (Hoboken → NYC)
- **Tunnel:** Lincoln Tunnel NY-bound (`travelDirection: "ToNY"`)
- **Bus stops:** Clinton St & 11th, Willow Ave & 15th, Washington St & 11th
- **Ferry:** Hoboken 14th St → W 39th (Connexionz stop 9)
- **PATH:** HOB → 33rd St (route 862, direction 1)

### Inbound (NYC → Hoboken)
- **Tunnel:** Lincoln Tunnel NJ-bound (`travelDirection: "ToNJ"`)
- **Bus stops:** PABT Gate 213 (126 Washington), Gate 214 (126 Willow), Gate 210 (119)
- **Ferry:** W 39th → Hoboken 14th (Connexionz stop 14)
- **PATH:** 33rd → Hoboken (route 862, dir 0) + 33rd → Newport (route 861, dir 0)

---

## Data Sources

### 1. Lincoln Tunnel (Crossing Time + Alerts)

**Service:** `src/services/lincolnTunnel.js`
**Polling:** Every 2 minutes

#### Crossing Times
- **Endpoint:** `GET /api/panynj/crossingtimesapi.json`
- **Auth:** None
- **Filter:** `facilityId === 5`, `travelDirection` based on direction
- **Key fields:** `routeTravelTime` (minutes), `routeSpeed` (mph), `overviewUIBackgroundColor` (severity)

#### Severity Mapping
| PANYNJ Color | Hex | Dashboard Severity |
|---|---|---|
| Green | `#2FB357` | light |
| Yellow | `#FFDD15` | moderate |
| Orange | `#FFAE00` | heavy |
| Red | `#FF0000` | severe |

#### Tunnel Alerts
- **Endpoint:** `GET /api/panynj/crossingtimesalertapi.json?start_date=MM/DD/YYYY`
- **Important:** Always pass `start_date=today` or you get 50k+ historical records
- **Filter:** "Lincoln" in `SentMessage` or `TemplateName`

#### Adding Other Tunnels/Bridges
Filter by `facilityId`: 1=Bayonne, 2=GWB, 3=Goethals, 4=Holland, 5=Lincoln, 6=Outerbridge

---

### 2. Bus Arrivals (NJ Transit GTFS-RT G2)

**Service:** `src/services/bus.js` (frontend) + `server/index.js` (backend)
**Polling:** Every 30 seconds

#### Authentication
```
POST https://pcsdata.njtransit.com/api/GTFSG2/authenticateUser
Fields: username, password → Returns UserToken (24h TTL)
```

#### Trip Updates (real-time ETAs)
```
POST https://pcsdata.njtransit.com/api/GTFSG2/getTripUpdates
Returns: ~2.8MB protobuf. route_id is EMPTY — join trip_id to static GTFS.
```

#### Vehicle Positions (capacity/occupancy)
```
POST https://pcsdata.njtransit.com/api/GTFSG2/getVehiclePositions
occupancy_status: 0=EMPTY, 1=MANY_SEATS, 2=FEW_SEATS, 3=STANDING, 5=FULL
```

#### Bus Alerts
```
POST https://pcsdata.njtransit.com/api/GTFSG2/getAlerts
Filtered to routes: 126, 119, 89, 22, 23, 128, 165, 166
```

#### Static GTFS (schedule fallback + route mapping)
```
POST https://pcsdata.njtransit.com/api/GTFSG2/getGTFS
~31MB ZIP, cached 24h in .cache/gtfs.zip
```

#### Outbound Stop Configuration
| Stop Name | GTFS stop_id | MyBus Code | Routes |
|---|---|---|---|
| Clinton St & 11th | 7917 | 20495 | 126 |
| Washington St & 11th | 7931 | 20513 | 126, 22, 89 |
| Willow Ave & 15th | 7940, 16135 | 20523, 32084 | 126, 119, 89 |

**Clinton St service hours:** Weekdays only, AM 5:40–9:45, PM 4:09–8:29

#### Inbound Stop Configuration (PABT)
| Card Name | GTFS stop_ids | Headsign Filter | Gate (day) |
|---|---|---|---|
| 126 Willow / Hamilton Pk | 16977, 16809 | WILLOW, HAMILTON PK VIA WILLOW | 214 |
| 126 Washington | 16977, 16808 | PATH, HAMILTON PK VIA HOBOKEN (excl. WILLOW) | 213 |
| 119 | 16977, 16803, 16856 | (all 119) | 210 |

#### PABT Gate Schedule (from portauthoritygate.com)
| Route | 6 AM – 10 PM | 10 PM – 1 AM | 1 AM – 6 AM |
|---|---|---|---|
| 126 (non-L/Washington) | Gate 213 | Gate 323 | Gate 79 |
| 126 (L/Willow) | Gate 214 | Gate 323 | Gate 79 |
| 119 | Gate 210 | Gate 322 | Gate 80 |

Gate info is shown in the card header and clickable for the full schedule popup.

#### Adding New Bus Stops

Bus stops are now added through the settings panel search-based picker:
1. Settings → New Transit Card → NJ Transit Bus
2. Search for a stop by name (e.g. "Washington", "Port Authority")
3. Select which routes you want at that stop
4. Card ID format: `bus:STOP_ID:ROUTE1,ROUTE2`

For preconfigured stops, the legacy format still works (see `DIRECTIONS` config in `server/index.js`).

#### Dynamic Bus Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/bus/stop-search?q=TEXT` | Search stops by name (deduplicated, max 30) |
| `GET /api/bus/stop-routes?id=STOP_ID` | All routes serving a stop |
| `GET /api/bus/stops?ids=ID&routes=126,22` | Departures with optional route filter |
| `GET /api/bus/routes` | All 273 NJT bus route numbers |
| `GET /api/bus/routes/:route/stops` | All stops for a route (deduplicated) |

#### PABT Gate Lookup

For Port Authority Bus Terminal stops (detected by GTFS stop ID), the server returns gate info when a single route is selected. Gate assignments are from `PABT_GATES_BY_ROUTE` covering ~50 routes. Known PABT stop IDs: 16977, 16012, 16049, 16808, 16809, 16803, 16856.

---

### 3. Weather (NWS API)

**Service:** `src/services/weather.js`
**Polling:** Every 10 minutes

- **Hoboken:** `/api/nws/gridpoints/OKX/32,43/forecast/hourly`
- **NYC Midtown:** `/api/nws/gridpoints/OKX/34,44/forecast/hourly`
- **Auth:** None (requires `User-Agent` header, set in Vite proxy)
- **Toggle:** Click location badge in weather card header to switch

#### Adding New Locations
1. `GET https://api.weather.gov/points/{lat},{lon}` → get `gridId`, `gridX`, `gridY`
2. Add to `LOCATIONS` in `src/services/weather.js`

---

### 4. NY Waterway Ferry (Connexionz ETA API)

**Service:** `src/services/ferry.js` (frontend) + `server/index.js` (backend)
**Polling:** Every 30 seconds

#### ETA Endpoint
```
GET https://api-eta.connexionz.net/api/cnxlegacy/stet/nywaterway.connexionz.net/{stopTag}
Headers: apikey: EFD912BD775313FED5D8791D11365
         origin: https://etacloud.connexionz.net
```

#### Direction Config
| Direction | Stop Tag | Route | Destination Match |
|---|---|---|---|
| Outbound | 9 (Hoboken 14th) | 18 | "Midtown" |
| Inbound | 14 (Midtown/W39th) | 18 | "Hoboken" |

#### Response Key Fields
- `eta` — real-time minutes (null = schedule only)
- `scheduledMin` — minutes since midnight (fallback)
- `alerts` — platform-level alerts

#### Known Ferry Stops
| Tag | Name |
|---|---|
| 9 | Hoboken 14th Street |
| 10 | Hoboken/NJ Transit Terminal |
| 14 | Midtown / W. 39th St. |

---

### 5. PATH Train (Community GTFS-RT Feed)

**Service:** `src/services/path.js` (frontend) + `server/index.js` (backend)
**Polling:** Every 15 seconds

#### GTFS-RT Feed
```
GET https://path.transitdata.nyc/gtfsrt
Free, no auth. Updated every 5 seconds.
```

#### PATH Alerts
```
GET https://www.panynj.gov/bin/portauthority/alerts?agency=PATH
Filters out elevator/escalator advisories.
```

#### Direction Config
| Direction | Stop | Route | Dir | Destination |
|---|---|---|---|---|
| Outbound | 26729 (Hoboken) | 862 (HOB-33) | 1 | HOB → 33rd St |
| Inbound | 26734 (33rd St) | 862 (HOB-33) | 0 | 33rd → Hoboken |
| Inbound | 26732 (33rd St) | 861 (JSQ-33) | 0 | 33rd → Newport |

#### PATH Routes
| Route ID | Line |
|---|---|
| 859 | Newark–World Trade Center |
| 860 | Hoboken–World Trade Center |
| 861 | Journal Square–33rd St |
| 862 | Hoboken–33rd St |

---

### 6. Transit Alerts

Alerts use a two-layer filtering system:
1. **Active sources** — derived from transit cards on the dashboard. No ferry card = no ferry alerts.
2. **User toggles** — per-source on/off in Settings → Alerts. Auto-generated from active cards.

All alerts are live and aggregated into the scrolling ticker:

| Source | Endpoint | Filter |
|---|---|---|
| Lincoln Tunnel | PANYNJ `crossingtimesalertapi.json` | "Lincoln" in message |
| Holland Tunnel | PANYNJ `crossingtimesalertapi.json` | "Holland" in message |
| NJT Bus | NJT GTFS-RT `getAlerts` | Routes matching dashboard cards |
| Ferry | Connexionz API `alerts` field | Platform-level |
| PATH | PANYNJ `/alerts?agency=PATH` | Excludes elevator/escalator |

Alerts also show inline in their respective cards (tunnel card, ferry card, PATH card).

When no live alerts exist, the ticker shows "No active alerts".

---

## UI Features

### Light/Dark Mode
- Auto-switches at 7:30 AM (light) and 6:00 PM (dark)
- Manual toggle via moon/sun button in header
- Manual override disables auto-switching

### Direction Toggle
- Click the "Hoboken → NYC" / "NYC → Hoboken" title to switch
- All data sources refresh immediately (stale data clears, fresh data loads)

### Tunnel Card
- Shows Lincoln and Holland tunnels side by side
- Each with crossing time (color-coded severity), speed, and most recent alert
- Flips direction with the main toggle

### Weather
- 3 time periods: adapts labels by time of day (Now/Midday/Evening → Now/Evening/Tonight → Now/+3hr/+6hr)
- Night periods show moon phase emoji (calculated from synodic month) instead of sun icons
- Uses NWS `isDaytime` flag per forecast period
- Hoboken/NYC toggle in card header

### Bus Capacity Badges
- **Seats** (green) — EMPTY or MANY_SEATS_AVAILABLE
- **Standing** (yellow) — FEW_SEATS_AVAILABLE
- **Full** (red) — STANDING_ROOM_ONLY or FULL

### LIVE / SCHED Indicators
- **LIVE** (green badge) — real-time GPS-based prediction
- **SCHED** (yellow badge) — static schedule fallback
- **~** on individual rows indicates scheduled (not tracked) time

### PABT Gate Info
- Gate number shown in card header for preconfigured and dynamic PABT bus cards
- Only shown when a single route is selected (different routes use different gates)
- Clickable for floating popup showing all time-of-day gate changes (day/late/overnight)
- Gate data covers ~50 NJT routes from portauthoritygate.com
- Updates automatically as time of day changes

### Settings Panel
- Gear icon in header opens centered floating modal
- **Display settings** (top of panel) — inline alert duration (Ticker only / 15m / 30m / 60m / Always) and ticker speed slider (Slow / Regular / Fast)
- **Direction labels** — "Outbound from" / "Inbound from" with city dropdowns (Hoboken, Jersey City, NYC, Home, Work). Same city can't be selected for both. Updates dashboard header title.
- **Transit Cards** — side-by-side outbound/inbound columns, up to 6 each, min 3. Reorder with ↑/↓, remove with −.
- **New Transit Card** — mode-specific picker:
  - **NJ Transit Bus**: search stops → select routes → confirm
  - **NJ Transit Rail**: search 173 stations → select lines → confirm
  - **PATH Train**: search 13 stations → select direction → confirm
  - **NY Waterway Ferry**: search 14 terminals → select destination → confirm
  - **NYC Ferry**: search 50 stops → confirm
  - **HBLR Light Rail**: search stops → confirm
  - **MTA Subway**: search stations → select lines + direction → confirm
  - **LIRR**: search 127 stations → confirm
  - **Metro-North**: search ~100 stations → confirm
  - **MTA Bus**: search 286+ routes → select stop → confirm
- **Alerts** — auto-generated toggles from active dashboard cards. Only shows sources relevant to your selected transit lines.
- **Tunnels & Bridges** — select up to 2 (Coming Soon — UI only)
- **Save Changes** commits all draft changes; closing without saving reverts

### Connectivity Banner
- Red banner appears when any data source fails to fetch
- Disappears automatically when connections recover

### Responsive Scaling
- All text and elements scale via `clamp()` from 5" Pi screen to large desktop
- Bus cards dynamically show 2–6 rows based on available height
- Phone breakpoint stacks to single column with scroll

---

## Caching Strategy

| Data | Cache TTL | Location |
|---|---|---|
| NJT auth token | 20 hours | Server memory |
| GTFS static ZIP | 24 hours | `.cache/gtfs.zip` on disk |
| Trip updates (bus) | 30 seconds | Server memory |
| Vehicle positions | 30 seconds | Server memory |
| Bus alerts | 2 minutes | Server memory |
| PATH GTFS-RT | 15 seconds | Server memory |
| PATH alerts | 2 minutes | Server memory |
| Ferry ETA | 30 seconds (per stop) | Server memory |
| MTA GTFS-RT | 30 seconds (per feed) | Server memory |
| MTA Subway alerts | 2 minutes | Server memory |
| NJT Rail token | 20 hours | Server memory |
| NJT Rail station list | Until restart | Server memory |
| NJT Rail station lines | 1 hour | Server memory |

---

## Frontend Polling Intervals

| Data | Interval | Rationale |
|---|---|---|
| Lincoln Tunnel | 2 min | PANYNJ updates every 2-3 min |
| Weather | 10 min | NWS updates hourly |
| Bus arrivals | 30 sec | Real-time GPS tracking |
| Ferry | 30 sec | Real-time vessel tracking |
| PATH | 15 sec | Feed updates every 5 sec |
| MTA Subway | 30 sec | Feed updates every 30 sec |
| MTA Alerts | 2 min | Alert feed cached 2 min |
| NJT Rail | 60 sec | Rate limit: 40K calls/day |
| HBLR | 30 sec | Uses bus GTFS-RT feed |

---

## Production Deployment (Raspberry Pi)

1. `npm run build` → static files in `dist/`
2. Add to `server/index.js`: `app.use(express.static(path.join(__dirname, '..', 'dist')))`
3. Add direct fetch calls for PANYNJ and NWS (replace Vite proxy)
4. `npm run server` — serves SPA + all APIs on port 3001
5. Auto-start with systemd or pm2

---

## Future Expansion Ideas

- **Settings persistence** — localStorage or backend storage
- **Rate limiting** — needed before public deployment
- **NJT Rail capacity display** — API returns car-level passenger counts
- **Custom transit icons** — HBLR catenary icon, LIRR heavy rail icon, Metro-North Grand Central redesign
- **Phone app** — wrap with Capacitor or serve as PWA
- **Historical data** — store crossing times for trend analysis
