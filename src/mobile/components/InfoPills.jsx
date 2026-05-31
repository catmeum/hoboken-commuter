import React, { useState, useEffect, useCallback } from 'react'
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

// F → C conversion
function toC(f) {
  return Math.round((f - 32) * 5 / 9)
}

function displayTemp(temp, unit) {
  if (unit === 'C') return `${toC(temp)}°`
  return `${temp}°`
}

// ── Info Pills Row (weather + tunnels) ──
export default function InfoPills({ showWeather, showTunnels, tunnelFilter, activeAlerts, tempUnit }) {
  const [weatherExpanded, setWeatherExpanded] = useState(false)
  const [weatherLocation, setWeatherLocation] = useState('hoboken')

  // Try to get user's location for weather on mount
  useEffect(() => {
    if (!showWeather) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const distToHoboken = Math.abs(latitude - 40.744) + Math.abs(longitude + 74.032)
        const distToNyc = Math.abs(latitude - 40.758) + Math.abs(longitude + 73.978)
        if (distToNyc < distToHoboken) {
          setWeatherLocation('nyc')
        }
      },
      () => { /* denied or error — keep default */ },
      { timeout: 5000 }
    )
  }, [showWeather])

  const weatherFetcher = useCallback(() => fetchWeather(weatherLocation), [weatherLocation])
  const tunnelFetcher = useCallback(() => fetchTunnels('outbound', tunnelFilter), [tunnelFilter])

  const { data: weatherData } = usePolling(weatherFetcher, 300_000)
  const { data: tunnelData } = usePolling(tunnelFetcher, 60_000)

  const filteredTunnels = tunnelData?.tunnels || []

  const weatherNow = weatherData?.periods?.[0]
  const unit = tempUnit || 'F'

  return (
    <>
      <div className="ms-info-row">
        {showWeather && weatherNow && (
          <div
            className="ms-info-pill ms-weather-pill"
            onClick={() => setWeatherExpanded(v => !v)}
          >
            {weatherNow.icon} {displayTemp(weatherNow.temp, unit)} {weatherNow.desc}
          </div>
        )}
        {showWeather && !weatherNow && (
          <div className="ms-info-pill ms-weather-pill">⏳ Loading…</div>
        )}
        {showTunnels && filteredTunnels.map(t => {
          const tunnelName = t.name.toLowerCase()
          const hasActiveAlert = (activeAlerts || []).some(a =>
            a.id?.includes(`tunnel-${tunnelName}`) || a.text?.toLowerCase().includes(tunnelName)
          )
          return (
            <TunnelPill key={t.name} tunnel={t} hasAlert={hasActiveAlert} />
          )
        })}
      </div>

      {/* Weather expanded card — Apple Weather style hourly scroll */}
      {showWeather && weatherExpanded && weatherData && (
        <div className="ms-weather-expand open">
          <div className="ms-wx-header">
            <span className="ms-wx-temp">{displayTemp(weatherNow.temp, unit)}</span>
            <span className="ms-wx-desc">{weatherNow.desc} · {weatherData.label}</span>
            <button className="ms-wx-close" onClick={() => setWeatherExpanded(false)}>✕</button>
          </div>
          <div className="ms-wx-stats">
            <span className="ms-wx-stat-item">💧 {weatherNow.precip}</span>
            <span className="ms-wx-stat-item">💨 {weatherNow.wind}</span>
            <span className="ms-wx-stat-item">🌡 {weatherNow.humidity}</span>
          </div>
          <div className="ms-wx-hourly">
            {(weatherData.hourly || weatherData.periods).map((p, i) => (
              <React.Fragment key={i}>
                {p.hour === 0 && i > 0 && <div className="ms-wx-day-divider" />}
                <div className="ms-wx-hour-card">
                  <span className="ms-wx-h-time">{p.label}</span>
                  <span className="ms-wx-h-icon">{p.icon}</span>
                  <span className="ms-wx-h-temp">{displayTemp(p.temp, unit)}</span>
                </div>
              </React.Fragment>
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
