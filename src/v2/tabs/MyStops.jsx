import { useState, useEffect } from 'react'
import TransitCard from '../components/TransitCard.jsx'

export default function MyStops({ stops, stopNames, showWeather, showTunnels, onAlertsUpdate, onAddStop }) {
  const [weather, setWeather] = useState(null)
  const [tunnels, setTunnels] = useState(null)
  const [zipInput, setZipInput] = useState('')
  const [zipLoading, setZipLoading] = useState(false)
  const [zipError, setZipError] = useState('')

  // Fetch weather
  useEffect(() => {
    if (!showWeather) return
    async function fetchWeather() {
      try {
        const res = await fetch('/api/nws/gridpoints/OKX/34,44/forecast/hourly')
        if (!res.ok) return
        const data = await res.json()
        const periods = data?.properties?.periods?.slice(0, 4) || []
        if (periods.length > 0) {
          setWeather({ temp: periods[0].temperature, desc: periods[0].shortForecast, periods })
        }
      } catch { /* ignore */ }
    }
    fetchWeather()
    const id = setInterval(fetchWeather, 600000)
    return () => clearInterval(id)
  }, [showWeather])

  // Fetch tunnels
  useEffect(() => {
    if (!showTunnels) return
    async function fetchTunnels() {
      try {
        const res = await fetch('/api/panynj/crossingtimesapi.json')
        if (!res.ok) return
        const data = await res.json()
        const routes = data?.crossingTimes?.routes || []
        const lincoln = routes.find(r => r.facilityId === 5 && r.travelDirection === 'ToNY')
        const holland = routes.find(r => r.facilityId === 4 && r.travelDirection === 'ToNY')
        setTunnels({
          lincoln: lincoln ? { time: lincoln.routeTravelTime, color: severityColor(lincoln.overviewUIBackgroundColor) } : null,
          holland: holland ? { time: holland.routeTravelTime, color: severityColor(holland.overviewUIBackgroundColor) } : null,
        })
      } catch { /* ignore */ }
    }
    fetchTunnels()
    const id = setInterval(fetchTunnels, 120000)
    return () => clearInterval(id)
  }, [showTunnels])

  // Collect alerts from MTA lines on dashboard
  useEffect(() => {
    const mtaLines = stops
      .filter(id => id.startsWith('mta:'))
      .flatMap(id => { const lines = id.split(':')[3]; return lines ? lines.split(',') : [] })
    if (mtaLines.length === 0) { onAlertsUpdate([]); return }

    async function fetchAlerts() {
      try {
        const res = await fetch(`/api/mta/alerts?lines=${[...new Set(mtaLines)].join(',')}`)
        if (!res.ok) return
        const data = await res.json()
        onAlertsUpdate(data.alerts || [])
      } catch { /* ignore */ }
    }
    fetchAlerts()
    const id = setInterval(fetchAlerts, 120000)
    return () => clearInterval(id)
  }, [stops, onAlertsUpdate])

  // Zip code setup
  async function handleZipSubmit(e) {
    e.preventDefault()
    const zip = zipInput.replace(/\D/g, '').slice(0, 5)
    if (zip.length !== 5) { setZipError('Enter a 5-digit zip code'); return }
    setZipLoading(true)
    setZipError('')
    try {
      const res = await fetch(`/api/weather/resolve-zip?zip=${zip}`)
      if (!res.ok) { setZipError('Zip code not found'); setZipLoading(false); return }
      const data = await res.json()
      const lat = parseFloat(data.lat)
      const lon = parseFloat(data.lon)
      const nearbyRes = await fetch(`/api/nearby-stops?lat=${lat}&lon=${lon}&max=6`)
      if (nearbyRes.ok) {
        const nearbyData = await nearbyRes.json()
        if (nearbyData.stops && nearbyData.stops.length >= 3) {
          for (const s of nearbyData.stops) {
            const name = s.name + (s.routes.length ? ` (${s.routes.slice(0, 3).join(', ')})` : '')
            onAddStop(s.stopKey, name)
          }
          setZipLoading(false)
          return
        }
      }
      // Fallback — check if in NY/NJ area
      const inNYNJ = lat >= 40.4 && lat <= 41.3 && lon >= -74.5 && lon <= -73.5
      if (!inNYNJ) {
        setZipError('Transit service information is not available at this zip code. Try a zip code closer to NYC.')
      } else {
        setZipError('No nearby stops found. Try the Explore tab to search manually.')
      }
    } catch {
      setZipError('Could not resolve zip code')
    }
    setZipLoading(false)
  }

  if (stops.length === 0) {
    return (
      <div className="v2-empty-state">
        <div className="v2-empty-icon">🚇</div>
        <h2>Welcome to My Stop Now</h2>
        <p>Enter your zip code to find nearby transit stops.</p>
        <form className="v2-zip-form" onSubmit={handleZipSubmit}>
          <input
            type="text"
            className="v2-zip-input"
            placeholder="Enter zip code…"
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            maxLength={5}
            inputMode="numeric"
          />
          <button type="submit" className="v2-zip-btn" disabled={zipLoading}>
            {zipLoading ? '…' : 'Go'}
          </button>
        </form>
        {zipError && <p className="v2-zip-error">{zipError}</p>}
        <p className="v2-empty-hint">Or use the Explore tab to search for specific stops.</p>
      </div>
    )
  }

  return (
    <div className="v2-mystops">
      {/* Info strip */}
      <div className="v2-info-strip">
        {showWeather && weather && (
          <div className="v2-pill">☀️ {weather.temp}° {weather.desc}</div>
        )}
        {showTunnels && tunnels?.lincoln && (
          <div className="v2-pill"><span className="v2-dot" style={{ background: tunnels.lincoln.color }}></span>Lincoln {tunnels.lincoln.time}m</div>
        )}
        {showTunnels && tunnels?.holland && (
          <div className="v2-pill"><span className="v2-dot" style={{ background: tunnels.holland.color }}></span>Holland {tunnels.holland.time}m</div>
        )}
      </div>

      {/* Transit cards */}
      <div className="v2-cards">
        {stops.map(stopKey => (
          <TransitCard key={stopKey} stopKey={stopKey} displayName={stopNames[stopKey]} />
        ))}
      </div>
    </div>
  )
}

function severityColor(hex) {
  if (!hex) return '#34d399'
  const h = hex.toLowerCase()
  if (h.includes('2fb357') || h.includes('green')) return '#34d399'
  if (h.includes('ffdd15') || h.includes('yellow')) return '#fbbf24'
  if (h.includes('ffae00') || h.includes('orange')) return '#fb923c'
  if (h.includes('ff0000') || h.includes('red')) return '#f87171'
  return '#34d399'
}
