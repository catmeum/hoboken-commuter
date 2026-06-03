# My Stop Now — Data Sources (v1.7.0)

All data sources are live. No mock data.

## Status

| Source | Status | Stations/Stops | Auth | Format |
|---|---|---|---|---|
| Lincoln + Holland Tunnel | ✅ | 7 crossings | None | JSON |
| NJ Transit Bus | ✅ | 16,820 stops | Token | Protobuf |
| NJ Transit Rail | ✅ | 173 stations, 11 lines | Token | JSON |
| HBLR Light Rail | ✅ | Via bus GTFS-RT | Token | Protobuf |
| PATH Train | ✅ | 13 stations, 4 lines | None | Protobuf |
| NY Waterway Ferry | ✅ | 14 terminals | API key | JSON |
| NYC Ferry | ✅ | 50 stops, 8 routes | None | Protobuf |
| MTA Subway | ✅ | 496 stations, all lines | None | Protobuf |
| MTA Subway Alerts | ✅ | All lines | None | Protobuf |
| LIRR | ✅ | 127 stations, 13 branches | None | Protobuf |
| Metro-North | ✅ | ~100 stations, 6 lines | None | Protobuf |
| MTA Bus | ✅ | 286+ routes | API key | JSON (SIRI) |
| Weather (NWS) | ✅ | Any US zip code | None | JSON |

## Server Endpoints (port 3001)

### NJ Transit Bus
| Endpoint | Purpose |
|---|---|
| `GET /api/bus?dir=` | Preconfigured bus stops by direction |
| `GET /api/bus/stops?ids=&routes=` | Dynamic bus stop query with route filter |
| `GET /api/bus/stop-search?q=` | Search stops by name |
| `GET /api/bus/stop-routes?id=` | All routes at a stop |
| `GET /api/bus/routes` | All 273 NJT bus route numbers |
| `GET /api/bus/routes/:route/stops` | All stops for a route |

### NJ Transit Rail
| Endpoint | Purpose |
|---|---|
| `GET /api/rail/stations?q=` | Search 173 rail stations |
| `GET /api/rail/station-lines?code=` | Lines at a station |
| `GET /api/rail/query?station=&lines=` | Departures filtered by line |

### PATH Train
| Endpoint | Purpose |
|---|---|
| `GET /api/path/gtfsrt?dir=` | Preconfigured PATH departures |
| `GET /api/path/query?route=&direction=&stop=` | Dynamic PATH query (multi-route) |
| `GET /api/path/stations?q=` | Search PATH stations |
| `GET /api/path/station-routes?id=` | Lines + directions at a station |

### NY Waterway Ferry
| Endpoint | Purpose |
|---|---|
| `GET /api/ferry?dir=` | Preconfigured ferry departures |
| `GET /api/ferry/query?stop=&route=&dest=` | Dynamic ferry query |
| `GET /api/ferry/terminals?q=` | Search 14 terminals |
| `GET /api/ferry/terminal-routes?tag=` | Routes at a terminal |

### NYC Ferry
| Endpoint | Purpose |
|---|---|
| `GET /api/nycferry/stops?q=` | Search 50 NYC Ferry stops |
| `GET /api/nycferry/query?stop=` | Real-time departures |

### MTA Subway
| Endpoint | Purpose |
|---|---|
| `GET /api/mta/stations?q=` | Search 496 subway stations |
| `GET /api/mta/station-lines?ids=` | Lines at a station |
| `GET /api/mta/query?stop=&lines=` | Departures + alerts |
| `GET /api/mta/alerts?lines=` | Alerts filtered by line |

### LIRR & Metro-North
| Endpoint | Purpose |
|---|---|
| `GET /api/lirr/stations?q=` | Search 127 LIRR stations |
| `GET /api/lirr/query?stop=` | LIRR departures |
| `GET /api/mnr/stations?q=` | Search ~100 MNR stations |
| `GET /api/mnr/query?stop=` | Metro-North departures |

### MTA Bus
| Endpoint | Purpose |
|---|---|
| `GET /api/mtabus/routes?q=` | Search 286+ bus routes |
| `GET /api/mtabus/route-stops?route=` | Stops for a route |
| `GET /api/mtabus/query?stop=&route=` | Real-time arrivals (SIRI) |

### Other
| Endpoint | Purpose |
|---|---|
| `GET /api/weather/resolve-zip?zip=` | Zip code → NWS grid resolution |
| `GET /api/nearby-stops?lat=&lon=&max=&maxDistance=` | Geo-lookup: closest transit stops across all modes |

## External APIs

| Source | Base URL | Auth | Format | Polling |
|---|---|---|---|---|
| PANYNJ tunnels | panynj.gov | None | JSON | 2 min |
| NJT Bus GTFS-RT | pcsdata.njtransit.com | Token (24h) | Protobuf | 30 sec |
| NJT Rail | raildata.njtransit.com | Token (24h) | JSON | 60 sec |
| NWS Weather | api.weather.gov | None | JSON | 10 min |
| NY Waterway | etacloud.connexionz.net | API key | JSON | 30 sec |
| NYC Ferry | nycferry.connexionz.net | None | GTFS-RT | 30 sec |
| PATH GTFS-RT | path.transitdata.nyc | None | Protobuf | 15 sec |
| MTA Subway (8 feeds) | api-endpoint.mta.info | None | Protobuf | 30 sec |
| MTA Alerts | api-endpoint.mta.info | None | Protobuf | 2 min |
| LIRR GTFS-RT | api-endpoint.mta.info | None | Protobuf | 30 sec |
| Metro-North GTFS-RT | api-endpoint.mta.info | None | Protobuf | 30 sec |
| MTA Bus Time | bustime.mta.info | API key | JSON (SIRI) | 30 sec |
| Zippopotam.us | api.zippopotam.us | None | JSON | On demand |

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `VITE_NJT_USERNAME` | NJ Transit developer credentials | Yes |
| `VITE_NJT_PASSWORD` | NJ Transit developer credentials | Yes |
| `MTA_BUS_API_KEY` | MTA Bus Time API key | Yes (for MTA Bus) |
| `BUS_API_PORT` | Express server port (default: 3001) | No |

## NJT Rail Lines

| Code | Line | Color |
|---|---|---|
| NE | Northeast Corridor | #F7505E |
| NC | North Jersey Coast | #009CDB |
| ME | Morris & Essex | #00953B |
| GS | Gladstone Branch | #A1D5AE |
| ML | Main Line | #F2B826 |
| BC | Bergen County | #98A8BF |
| MC | Montclair-Boonton | #C36366 |
| PV | Pascack Valley | #A34F8B |
| RV | Raritan Valley | #FF993E |
| AC | Atlantic City | #2E55A5 |
| PR | Princeton Branch | #FF6319 |

## NYC Ferry Routes

| Code | Route | Color |
|---|---|---|
| AS | Astoria | #FF6B00 |
| ER | East River | #00839C |
| RW | Rockaway | #B218AA |
| RS | Rockaway-Soundview | #4E008E |
| SB | South Brooklyn | #FFD100 |
| SG | St. George | #D0006F |
