import { useState, useEffect, useCallback } from 'react'
import { fetchWeather } from '../../services/weather'
import { fetchTunnels } from '../../services/tunnels'

// ── Polling hook ──
function usePolling(fetchFn, intervalMs) {
  const [data, setData] = useState(null)
  const poll = useCallback(async () => {
    try {
      const result = await fetchFn()
      setData(result)
    } catch (e) {
      console.error('Poll error:', e.message)
    }
  }, [fetchFn])

  useEffect(() => {
    poll() // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(poll, intervalMs)
    return () => clearInterval(id)
  }, [poll, intervalMs])

  return { data, refetch: poll }
}

// Severity → dot color
function severityColor(severity) {
  if (severity === 'low' || severity === 'free') return '#34d399'
  if (severity === 'heavy' || severity === 'severe') return '#f87171'
  return '#fbbf24' // moderate / default
}

// ── Info Pills Row (weather + tunnels) ──
export default function InfoPills({ showWeather, showTunnels, tunnelFilter, activeAlerts }) {
  const [weatherExpanded, setWeatherExpanded] = useState(false)
  const [weatherLocation, setWeatherLocation] = useState('hoboken')

  // Try to get user's location for weather on mount
  useEffect(() => {
    if (!showWeather) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        // NWS grid lookup — use the points endpoint to get the grid
        // For simplicity, if user is near Hoboken/NYC area, use the closest known grid
        // Hoboken: 40.744, -74.032 → OKX 32,43
        // NYC Midtown: 40.758, -73.978 → OKX 34,44
        const distToHoboken = Math.abs(latitude - 40.744) + Math.abs(longitude + 74.032)
        const distToNyc = Math.abs(latitude - 40.758) + Math.abs(longitude + 73.978)
        if (distToNyc < distToHoboken) {
          setWeatherLocation('nyc')
        }
        // Otherwise keep hoboken default
      },
      () => { /* denied or error — keep default */ },
      { timeout: 5000 }
    )
  }, [showWeather])

  const weatherFetcher = useCallback(() => fetchWeather(weatherLocation), [weatherLocation])
  const tunnelFetcher = useCallback(() => fetchTunnels(), [])

  const { data: weatherData } = usePolling(weatherFetcher, 300_000) // 5 min
  const { data: tunnelData } = usePolling(tunnelFetcher, 60_000) // 1 min

  const filteredTunnels = tunnelData?.tunnels?.filter(t =>
    tunnelFilter.includes(t.name.toLowerCase())
  ) || []

  const weatherNow = weatherData?.periods?.[0]

  return (
    <>
      <div className="ms-info-row">
        {showWeather && weatherNow && (
          <div
            className="ms-info-pill ms-weather-pill"
            onClick={() => setWeatherExpanded(v => !v)}
          >
            {weatherNow.icon} {weatherNow.temp}° {weatherNow.desc}
          </div>
        )}
        {showWeather && !weatherNow && (
          <div className="ms-info-pill ms-weather-pill">⏳ Loading…</div>
        )}
        {showTunnels && filteredTunnels.map(t => {
          // Glow only if there's an undismissed alert for this tunnel in the alerts panel
          const tunnelName = t.name.toLowerCase()
          const hasActiveAlert = (activeAlerts || []).some(a =>
            a.id?.includes(`tunnel-${tunnelName}`) || a.text?.toLowerCase().includes(tunnelName)
          )
          return (
            <TunnelPill key={t.name} tunnel={t} hasAlert={hasActiveAlert} />
          )
        })}
      </div>

      {/* Weather expanded card — full width below the pill row */}
      {showWeather && weatherExpanded && weatherData && (
        <div className="ms-weather-expand open">
          <div className="ms-wx-header">
            <span className="ms-wx-temp">{weatherNow.temp}°F</span>
            <span className="ms-wx-desc">{weatherNow.desc} · {weatherData.label}</span>
            <button className="ms-wx-close" onClick={() => setWeatherExpanded(false)}>✕</button>
          </div>
          <div className="ms-wx-grid">
            <div className="ms-wx-stat">
              <span className="ms-wx-stat-val">{weatherNow.precip}</span>
              <span className="ms-wx-stat-label">Precip</span>
            </div>
            <div className="ms-wx-stat">
              <span className="ms-wx-stat-val">{weatherNow.humidity}</span>
              <span className="ms-wx-stat-label">Humidity</span>
            </div>
            <div className="ms-wx-stat">
              <span className="ms-wx-stat-val">{weatherNow.wind}</span>
              <span className="ms-wx-stat-label">Wind</span>
            </div>
          </div>
          <div className="ms-wx-hours">
            {weatherData.periods.map((p, i) => (
              <div key={i} className="ms-wx-hour">
                <span className="ms-wx-h-time">{p.label}</span>
                <span className="ms-wx-h-icon">{p.icon}</span>
                <span className="ms-wx-h-temp">{p.temp}°</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── Tunnel Pill ──
function TunnelPill({ tunnel, hasAlert }) {
  const [expanded, setExpanded] = useState(false)

  const dotColor = severityColor(tunnel.severity)

  return (
    <div
      className={`ms-info-pill ms-tunnel-pill ${hasAlert ? 'ms-tunnel-alert' : ''} ${expanded ? 'expanded' : ''}`}
      onClick={() => {
        setExpanded(v => !v)
        if (!expanded) {
          // Auto-collapse after 3s
          setTimeout(() => setExpanded(false), 3000)
        }
      }}
    >
      <span className="ms-info-dot" style={{ background: dotColor }} />
      {tunnel.name} {tunnel.crossingMinutes}m
      <span className="ms-tunnel-speed">· {tunnel.speed || '—'} mph</span>
    </div>
  )
}
