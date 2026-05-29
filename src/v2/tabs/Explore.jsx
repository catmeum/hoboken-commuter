import { useState, useEffect, useRef } from 'react'

export default function Explore({ onAddStop, existingStops }) {
  const [search, setSearch] = useState('')
  const [nearbyStops, setNearbyStops] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) { setLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setUserLocation(loc)
        fetchNearby(loc.lat, loc.lon)
      },
      () => {
        // Fallback to Hoboken
        const fallback = { lat: 40.744, lon: -74.032 }
        setUserLocation(fallback)
        fetchNearby(fallback.lat, fallback.lon)
      },
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }, [])

  async function fetchNearby(lat, lon) {
    setLoading(true)
    try {
      const res = await fetch(`/api/nearby-stops?lat=${lat}&lon=${lon}&max=10&maxDistance=2`)
      if (res.ok) {
        const data = await res.json()
        setNearbyStops(data.stops || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  // Search — multi-source (MTA stations + NJT bus stops)
  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const results = []
        // Search MTA stations
        const mtaRes = await fetch(`/api/mta/stations?q=${encodeURIComponent(search)}`)
        if (mtaRes.ok) {
          const mtaData = await mtaRes.json()
          for (const s of (mtaData.stations || [])) {
            results.push({
              type: 'MTA Subway',
              name: s.name + (s.linesLabel ? ` (${s.linesLabel})` : ''),
              stopKey: `mta:${s.ids.join(',')}:S:${s.lines.join(',')}`,
              lines: s.lines,
            })
          }
        }
        // Search NJT bus stops
        const busRes = await fetch(`/api/bus/stop-search?q=${encodeURIComponent(search)}`)
        if (busRes.ok) {
          const busData = await busRes.json()
          for (const s of (busData.stops || []).slice(0, 5)) {
            results.push({
              type: 'NJT Bus',
              name: s.name,
              stopKey: `bus:${s.id}`,
            })
          }
        }
        // Search PATH stations
        const pathRes = await fetch(`/api/path/stations?q=${encodeURIComponent(search)}`)
        if (pathRes.ok) {
          const pathData = await pathRes.json()
          for (const s of (pathData.stations || [])) {
            results.push({
              type: 'PATH',
              name: s.name,
              stopKey: `path:${s.ids ? s.ids.join(',') : s.id}:1:${s.ids?.[0] || s.id}`,
            })
          }
        }
        setSearchResults(results.slice(0, 15))
      } catch { setSearchResults([]) }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !userLocation) return
    if (mapInstance.current) return // already initialized

    // Dynamically load MapLibre
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'
    script.onload = () => {
      const maplibregl = window.maplibregl
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      const style = isDark
        ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

      const map = new maplibregl.Map({
        container: mapRef.current,
        style,
        center: [userLocation.lon, userLocation.lat],
        zoom: 14,
      })

      // User location marker
      const el = document.createElement('div')
      el.className = 'v2-map-user-dot'
      new maplibregl.Marker({ element: el }).setLngLat([userLocation.lon, userLocation.lat]).addTo(map)

      // Add nearby stop markers
      for (const stop of nearbyStops) {
        // We don't have individual stop coords in the response yet,
        // so markers will be added when we enhance the API
      }

      mapInstance.current = map
    }
    document.head.appendChild(script)

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [userLocation, nearbyStops])

  const isAdded = (stopKey) => existingStops.includes(stopKey)
  const displayStops = search.length >= 2 ? searchResults : nearbyStops

  return (
    <div className="v2-explore">
      {/* Map */}
      <div className="v2-map-container" ref={mapRef}></div>

      {/* Search overlay */}
      <div className="v2-explore-search">
        <input
          type="text"
          className="v2-search-input"
          placeholder="Search by station name (e.g. 72 St, Penn Station, Summit)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Bottom sheet — scrollable */}
      <div className="v2-sheet">
        <div className="v2-sheet-handle"></div>
        <h3 className="v2-sheet-title">{search.length >= 2 ? 'Search Results' : 'Nearby Stops'}</h3>

        <div className="v2-sheet-list">
          {loading && <div className="v2-sheet-loading">Finding stops near you…</div>}

          {!loading && displayStops.map((stop, i) => {
            const key = stop.stopKey
            const added = isAdded(key)
            return (
              <div key={key || i} className="v2-sheet-card">
                <div className="v2-sheet-card-info">
                  <div className="v2-sheet-name">{stop.name}</div>
                  <div className="v2-sheet-sub">
                    {stop.distance != null && `${stop.distance} mi · `}
                    {stop.type || 'transit'}
                  </div>
                </div>
                <button
                  className={`v2-sheet-add ${added ? 'added' : ''}`}
                  onClick={() => !added && onAddStop(key, stop.name)}
                  disabled={added}
                >
                  {added ? '✓' : '+ Add'}
                </button>
              </div>
            )
          })}

          {!loading && displayStops.length === 0 && search.length >= 2 && (
            <div className="v2-sheet-empty">No results found</div>
          )}
        </div>
      </div>
    </div>
  )
}
