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

// ── Weather Pill + Expanded Card ──
function WeatherPill({ data, expanded, onToggle }) {
  if (!data) return <div className="ms-info-pill ms-weather-pill">⏳ Loading…</div>
  const now = data.periods?.[0]
  if (!now) return null

  return (
    <>
      <div className="ms-info-pill ms-weather-pill" onClick={onToggle}>
        {now.icon} {now.temp}° {now.desc}
      </div>
      {expanded && (
        <div className="ms-weather-expand open">
          <div className="ms-wx-header">
            <span className="ms-wx-temp">{now.temp}°F</span>
            <span className="ms-wx-desc">{now.desc} · {data.label}</span>
            <button className="ms-wx-close" onClick={onToggle}>✕</button>
          </div>
          <div className="ms-wx-grid">
            <div className="ms-wx-stat"><span className="ms-wx-stat-val">{now.precip}</span><span className="ms-wx-stat-label">Precip</span></div>
            <div className="ms-wx-stat"><span className="ms-wx-stat-val">{now.humidity}</span><span className="ms-wx-stat-label">Humidity</span></div>
            <div className="ms-wx-stat"><span className="ms-wx-stat-val">{now.wind}</span><span className="ms-wx-stat-label">Wind</span></div>
            <div className="ms-wx-stat"><span className="ms-wx-stat-val">{now.temp}°</span><span className="ms-wx-stat-label">Feels like</span></div>
          </div>
          {data.periods.length > 1 && (
            <div className="ms-wx-hours">
              {data.periods.map((p, i) => (
                <div key={i} className="ms-wx-hour">
                  <span className="ms-wx-h-time">{p.label}</span>
                  <span className="ms-wx-h-icon">{p.icon}</span>
                  <span className="ms-wx-h-temp">{p.temp}°</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── Tunnel Pill ──
function TunnelPill({ tunnel }) {
  const [expanded, setExpanded] = useState(false)
  if (!tunnel) return null

  const severity = tunnel.severity || 'moderate'
  const dotColor = severity === 'low' ? '#34d399' : severity === 'moderate' ? '#fbbf24' : '#f87171'
  const hasAlert = tunnel.alerts?.length > 0 || tunnel.allAlerts?.length > 0

  return (
    <div
      className={`ms-info-pill ms-tunnel-pill ${hasAlert ? 'ms-tunnel-alert' : ''} ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded(v => !v)}
    >
      <span className="ms-info-dot" style={{ background: dotColor }} />
      {tunnel.name} {tunnel.crossingMinutes}m
      <span className="ms-tunnel-speed">· {tunnel.speed || '—'} mph</span>
    </div>
  )
}

// ── Info Pills Row (weather + tunnels) ──
export default function InfoPills({ showWeather, showTunnels, tunnelFilter }) {
  const [weatherExpanded, setWeatherExpanded] = useState(false)

  const weatherFetcher = useCallback(() => fetchWeather('hoboken'), [])
  const tunnelFetcher = useCallback(() => fetchTunnels(), [])

  const { data: weatherData } = usePolling(weatherFetcher, 300_000) // 5 min
  const { data: tunnelData } = usePolling(tunnelFetcher, 60_000) // 1 min

  const filteredTunnels = tunnelData?.tunnels?.filter(t =>
    tunnelFilter.includes(t.name.toLowerCase())
  ) || []

  return (
    <>
      <div className="ms-info-row">
        {showWeather && (
          <WeatherPill
            data={weatherData}
            expanded={weatherExpanded}
            onToggle={() => setWeatherExpanded(v => !v)}
          />
        )}
        {showTunnels && filteredTunnels.map(t => (
          <TunnelPill key={t.name} tunnel={t} />
        ))}
      </div>
      {/* Weather expanded card renders outside the row for full width */}
      {showWeather && weatherExpanded && weatherData && (
        <div className="ms-weather-expand open">
          <div className="ms-wx-header">
            <span className="ms-wx-temp">{weatherData.periods[0]?.temp}°F</span>
            <span className="ms-wx-desc">{weatherData.periods[0]?.desc} · {weatherData.label}</span>
            <button className="ms-wx-close" onClick={() => setWeatherExpanded(false)}>✕</button>
          </div>
          <div className="ms-wx-grid">
            <div className="ms-wx-stat"><span className="ms-wx-stat-val">{weatherData.periods[0]?.precip}</span><span className="ms-wx-stat-label">Precip</span></div>
            <div className="ms-wx-stat"><span className="ms-wx-stat-val">{weatherData.periods[0]?.humidity}</span><span className="ms-wx-stat-label">Humidity</span></div>
            <div className="ms-wx-stat"><span className="ms-wx-stat-val">{weatherData.periods[0]?.wind}</span><span className="ms-wx-stat-label">Wind</span></div>
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
