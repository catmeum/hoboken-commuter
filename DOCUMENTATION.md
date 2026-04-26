# Hoboken Commuter Dashboard — Technical Documentation

**Version 1.8.0**

## Overview

A real-time commuter dashboard for the NY/NJ metro area. Displays tunnel crossing times, NJ Transit bus and rail arrivals, HBLR light rail, NY Waterway and NYC Ferry departures, PATH trains, MTA subway/LIRR/Metro-North/bus, weather for any US zip code, and transit alerts from all sources. Supports bidirectional commuting with a single toggle, and includes a comprehensive settings panel for customizing transit cards, alerts, and display preferences. Settings persist across sessions via localStorage.

**Stack:** React (Vite) frontend + Express backend for API proxying, protobuf parsing, NJT Rail JSON API, and MTA Bus SIRI API.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                    │
│  Polls /api/* endpoints every 15–120 seconds            │
│  Direction toggle swaps all data sources instantly       │
│  Settings persisted in localStorage                      │
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
     ├── NY Waterway Connexionz API (ferry ETAs)
     ├── NYC Ferry GTFS-RT (ferry times)
     ├── MTA GTFS-RT (subway, LIRR, Metro-North times + alerts)
     └── MTA Bus SIRI API (bus arrivals + alerts)
```

---

## Running the App

```bash
npm install
cp .env.example .env
# Edit .env with your credentials

# Terminal 1 — backend (port 3001)
npm run server

# Terminal 2 — frontend (port 5173)
npm run dev

# Run integration tests (server must be running)
npm test
```

Both server and frontend must be running. The Vite dev server proxies all `/api/*` calls to the Express backend or external APIs.

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
| `/api/lirr` | `http://localhost:3001` | LIRR (via Express backend) |
| `/api/mnr` | `http://localhost:3001` | Metro-North (via Express backend) |
| `/api/mtabus` | `http://localhost:3001` | MTA Bus (via Express backend) |
| `/api/nycferry` | `http://localhost:3001` | NYC Ferry (via Express backend) |
| `/api/weather` | `http://localhost:3001` | Weather zip resolution (via Express backend) |

All backend endpoints accept `?dir=outbound` (default) or `?dir=inbound` to switch direction.

---

## Direction Support

The dashboard supports two directions, toggled via the header title:

### Outbound (Hoboken → NYC)
- **Tunnel:** Lincoln Tunnel NY-bound (`travelDirection: "ToNY"`)
- **Bus stops:** Clinton St & 11th, Willow Ave & 15th, Washington St & 11th
- **HBLR:** Hoboken Terminal area stop (15534)
- **Ferry:** Hoboken 14th St → W 39th (Connexionz stop 9)
- **PATH:** HOB → 33rd St (route 862 + weekend route 1024, direction 1)

### Inbound (NYC → Hoboken)
- **Tunnel:** Lincoln Tunnel NJ-bound (`travelDirection: "ToNJ"`)
- **Bus stops:** PABT Gate 213 (126 Washington), Gate 214 (126 Willow), Gate 210 (119)
- **HBLR:** 9th Street stop (15537)
- **Ferry:** W 39th → Hoboken 14th (Connexionz stop 14)
- **PATH:** 33rd → Hoboken (route 862 + 1024, dir 0) + 33rd → Newport (route 861, dir 0)

---

## Data Sources

### 1. Tunnels (PANYNJ)

**Polling:** Every 2 minutes (via Vite proxy, not Express backend)

#### Crossing Times
- **Endpoint:** `GET /api/panynj/crossingtimesapi.json`
- **Filter:** `facilityId`, `travelDirection` based on direction and selected tunnels
- **Key fields:** `routeTravelTime` (minutes), `routeSpeed` (mph), `overviewUIBackgroundColor` (severity)

#### Severity Mapping
| PANYNJ Color | Hex | Dashboard Severity |
|---|---|---|
| Green | `#2FB357` | light |
| Yellow | `#FFDD15` | moderate |
| Orange | `#FFAE00` | heavy |
| Red | `#FF0000` | severe |

#### Facility IDs
1=Bayonne, 2=GWB Upper, 3=Goethals, 4=Holland, 5=Lincoln, 6=Outerbridge, 7=GWB Lower

#### Tunnel Alerts
- **Endpoint:** `GET /api/panynj/crossingtimesalertapi.json?start_date=MM/DD/YYYY`
- Always pass `start_date=today` or you get 50k+ historical records

---

### 2. NJT Bus (GTFS-RT G2)

**Polling:** Every 30 seconds

#### Authentication
```
POST https://pcsdata.njtransit.com/api/GTFSG2/authenticateUser
Fields: username, password → Returns UserToken (24h TTL, cached 20h)
```

#### Static GTFS (schedule fallback + route/headsign mapping)
```
POST https://pcsdata.njtransit.com/api/GTFSG2/getGTFS
~31MB ZIP, cached 7 days in .cache/gtfs.zip
Refreshes automatically on server start if stale
```

Check cache status: `GET /api/bus/gtfs-status`

#### Dynamic Bus Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/bus/stop-search?q=TEXT` | Search stops by name (max 30) |
| `GET /api/bus/stop-routes?id=STOP_ID` | All routes serving a stop |
| `GET /api/bus/stops?ids=ID&routes=126,22` | Departures with optional route filter |
| `GET /api/bus/routes` | All NJT bus route numbers |
| `GET /api/bus/routes/:route/stops` | All stops for a route |
| `GET /api/bus/gtfs-status` | Cache age, size, stale flag |

#### Outbound Stop Configuration
| Stop Name | GTFS stop_id | Routes |
|---|---|---|
| Clinton St & 11th | 7917 | 126 |
| Washington St & 11th | 7931 | 126, 22, 89 |
| Willow Ave & 15th | 7940, 16135 | 126, 119, 89 |

#### Inbound Stop Configuration (PABT)
| Card Name | GTFS stop_ids | Gate (day) |
|---|---|---|
| 126 Willow / Hamilton Pk | 16977, 16809 | 214 |
| 126 Washington | 16977, 16808 | 213 |
| 119 | 16977, 16803, 16856 | 210 |

---

### 3. NJT Rail (TrainData JSON API)

**Polling:** Every 60 seconds (rate limit: 40K calls/day)

| Endpoint | Purpose |
|---|---|
| `GET /api/rail/stations?q=` | Search 173 stations |
| `GET /api/rail/station-lines?code=` | Lines at a station |
| `GET /api/rail/query?station=&lines=` | Departures filtered by line |

---

### 4. HBLR Light Rail

Uses NJT bus GTFS-RT infrastructure (route `HBLR`). Stops appear in bus stop search. Card shows headsign (destination) on each departure row.

---

### 5. PATH Train (Community GTFS-RT)

**Polling:** Every 15 seconds

```
GET https://path.transitdata.nyc/gtfsrt
Free, no auth. Updated every 5 seconds.
```

**Important:** Feed only reports each train's next stop. Server matches by route+direction only (not stop ID).

#### PATH Routes
| Route ID | Line | Notes |
|---|---|---|
| 859 | NWK-WTC | Weekdays |
| 860 | HOB-WTC | Weekdays |
| 861 | JSQ-33 | Weekdays |
| 862 | HOB-33 | All days |
| 1024 | JSQ-33 via HOB | Weekends/holidays |

| Endpoint | Purpose |
|---|---|
| `GET /api/path/gtfsrt?dir=` | Preconfigured departures |
| `GET /api/path/query?route=&direction=&stop=` | Dynamic query (multi-route) |
| `GET /api/path/stations?q=` | Search 13 stations |
| `GET /api/path/station-routes?id=` | Direction options at a station |

---

### 6. NY Waterway Ferry (Connexionz)

**Polling:** Every 30 seconds

```
GET http://nywaterway.connexionz.net/{stopTag}
Headers: apikey: EFD912BD775313FED5D8791D11365
```

| Endpoint | Purpose |
|---|---|
| `GET /api/ferry?dir=` | Preconfigured departures |
| `GET /api/ferry/query?stop=&route=&dest=` | Dynamic query |
| `GET /api/ferry/terminals?q=` | Search 14 terminals |
| `GET /api/ferry/terminal-routes?tag=` | Routes at a terminal |

---

### 7. NYC Ferry (GTFS-RT)

**Polling:** Every 30 seconds

```
GET https://nycferry.connexionz.net/rtt/public/utility/gtfsrealtime.aspx/tripupdate
Static GTFS: http://nycferry.connexionz.net/rtt/public/utility/gtfs.aspx
```

**Note:** Realtime feed has empty `routeId` — resolved via `tripId → routeId` map built from static GTFS `trips.txt`.

| Endpoint | Purpose |
|---|---|
| `GET /api/nycferry/stops?q=` | Search 50 stops |
| `GET /api/nycferry/query?stop=` | Real-time departures with route + headsign |

---

### 8. MTA Subway (GTFS-RT)

**Polling:** Every 30 seconds (8 feeds by line group)

Station-to-route mapping stored in `.cache/mta_station_routes.json`. Auto-built by `server/build_station_routes.mjs` on server start if missing.

| Endpoint | Purpose |
|---|---|
| `GET /api/mta/stations?q=` | Search 496 stations |
| `GET /api/mta/station-lines?ids=` | Lines at a station (from cache file) |
| `GET /api/mta/query?stop=&lines=` | Departures + alerts |
| `GET /api/mta/alerts?lines=` | Alerts filtered by line |

---

### 9. LIRR & Metro-North (MTA GTFS-RT)

**Polling:** Every 30 seconds

| Endpoint | Purpose |
|---|---|
| `GET /api/lirr/stations?q=` | Search 127 LIRR stations |
| `GET /api/lirr/query?stop=` | LIRR departures |
| `GET /api/mnr/stations?q=` | Search ~100 MNR stations |
| `GET /api/mnr/query?stop=` | Metro-North departures |

---

### 10. MTA Bus (SIRI API)

**Polling:** Every 30 seconds. **8-second timeout** — SIRI can be slow; card shows "Feed timed out" on timeout instead of hanging.

| Endpoint | Purpose |
|---|---|
| `GET /api/mtabus/routes?q=` | Search 286+ routes |
| `GET /api/mtabus/route-stops?route=` | Stops for a route (by direction) |
| `GET /api/mtabus/query?stop=&route=` | Real-time arrivals + alerts |

---

### 11. Weather (NWS)

**Polling:** Every 10 minutes (via Vite proxy)

- Tied to city zip codes set in Settings
- Auto-switches with direction toggle
- Zip resolves via `GET /api/weather/resolve-zip?zip=XXXXX`

---

## Settings Persistence

Settings are stored in `localStorage` under key `hoboken-commuter-settings`. Includes:
- Outbound/inbound card lists and city names
- Weather locations (zip-resolved)
- Alert toggles, inline alert duration, ticker speed
- Show/hide tunnel and weather cards
- Selected tunnels

**Reset:** Settings panel footer has a "Reset to defaults" button with inline confirmation. Clears localStorage and reloads.

---

## Card ID Format Conventions

| Prefix | Component | Example |
|---|---|---|
| `clinton`, `willow`, etc. | Preconfigured BusStopCard | `clinton` |
| `pabt_*` | Preconfigured BusStopCard (inbound) | `pabt_washington` |
| `bus:*` | DynamicBusCard | `bus:16012:125` |
| `rail:*` | DynamicRailCard | `rail:HB:GS,ML` |
| `hblr:*` | DynamicHblrCard | `hblr:15534` |
| `ferry_*` | Preconfigured FerryCard | `ferry_hob14` |
| `ferry:*` | DynamicFerryCard | `ferry:10:19:Midtown` |
| `path_*` | Preconfigured PathCard | `path_hob33` |
| `path:*` | DynamicPathCard | `path:861,862:1:26727` |
| `mta:*` | DynamicMtaCard | `mta:D17,R17:S:B,D,F,N,Q,R,W` |
| `lirr:*` | DynamicLirrCard | `lirr:8` |
| `mnr:*` | DynamicMnrCard | `mnr:1` |
| `mtabus:*` | DynamicMtaBusCard | `mtabus:308209:MTA+NYCT_M1` |
| `nycferry:*` | DynamicNycFerryCard | `nycferry:113` |

---

## Caching Strategy

| Data | Cache TTL | Location |
|---|---|---|
| NJT auth token | 20 hours | Server memory |
| GTFS static ZIP | 7 days | `.cache/gtfs.zip` on disk |
| MTA station routes | Until restart | `.cache/mta_station_routes.json` on disk |
| Trip updates (bus) | 30 seconds | Server memory |
| Vehicle positions | 30 seconds | Server memory |
| Bus alerts | 2 minutes | Server memory |
| PATH GTFS-RT | 15 seconds | Server memory |
| PATH alerts | 2 minutes | Server memory |
| Ferry ETA (NYW) | 30 seconds (per stop) | Server memory |
| NYC Ferry GTFS-RT | 30 seconds | Server memory |
| MTA GTFS-RT | 30 seconds (per feed) | Server memory |
| MTA Subway alerts | 2 minutes | Server memory |
| NJT Rail token | 20 hours | Server memory |
| NJT Rail station lines | 1 hour | Server memory |
| Weather zip grid | 24 hours | Server memory |

---

## Frontend Polling Intervals

| Data | Interval | Rationale |
|---|---|---|
| Lincoln/Holland Tunnel | 2 min | PANYNJ updates every 2-3 min |
| Weather | 10 min | NWS updates hourly |
| NJT Bus | 30 sec | Real-time GPS tracking |
| NYW Ferry | 30 sec | Real-time vessel tracking |
| NYC Ferry | 30 sec | GTFS-RT feed |
| PATH | 15 sec | Feed updates every 5 sec |
| MTA Subway | 30 sec | Feed updates every 30 sec |
| MTA Alerts | 2 min | Alert feed cached 2 min |
| NJT Rail | 60 sec | Rate limit: 40K calls/day |
| HBLR | 30 sec | Uses bus GTFS-RT feed |
| LIRR | 30 sec | MTA GTFS-RT feed |
| Metro-North | 30 sec | MTA GTFS-RT feed |
| MTA Bus | 30 sec | SIRI API (8s timeout) |

---

## Custom Icons

| Transit Mode | Icon | Dark Mode Effect |
|---|---|---|
| MTA Subway | `MtaGlobeIcon` — green/white globe on pole | White half → warm yellow + trapezoid beam |
| HBLR | `LightRailIcon` — Hoboken Lackawanna clocktower | Clock face glows teal |
| LIRR | `HeavyRailIcon` — M7/M9 train profile | Headlight appears |
| Metro-North | `GrandCentralClock` — GCT info booth clock on pedestal | Clock face glows gold |

---

## Testing

```bash
npm test
```

Runs 134 integration tests against the live server covering all endpoints. Server must be running on port 3001.

---

## Production Deployment (Raspberry Pi)

1. `npm run build` → static files in `dist/`
2. Add to `server/index.js`: `app.use(express.static(path.join(__dirname, '..', 'dist')))`
3. Add direct fetch calls for PANYNJ and NWS (replace Vite proxy)
4. `npm run server` — serves SPA + all APIs on port 3001
5. Auto-start with systemd or pm2
