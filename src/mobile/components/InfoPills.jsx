import React, { useState, useEffect, useCallback } from 'react'
import { Droplets, Wind, Thermometer } from 'lucide-react'
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
export default function InfoPills({ showWeather, showTunnels, tunnelFilter, activeAlerts, tempUnit, weatherZip }) {
  const [weatherExpanded, setWeatherExpanded] = useState(false)
  const [weatherLocation, setWeatherLocation] = useState(null)
  const [resolvedZipLocation, setResolvedZipLocation] = useState(null)

  // Resolve zip code to NWS grid or fall back to geolocation
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!showWeather) return

    if (weatherZip && /^\d{5}$/.test(weatherZip)) {
      // Resolve zip to grid
      fetch(`/api/weather/resolve-zip?zip=${weatherZip}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && d.url) {
            setResolvedZipLocation({ label: d.label || weatherZip, url: d.url })
            setWeatherLocation('zip')
          } else {
            setWeatherLocation('hoboken')
          }
        })
        .catch(() => setWeatherLocation('hoboken'))
      return
    }

    // No zip — use geolocation
    setResolvedZipLocation(null)
    if (!navigator.geolocation) {
      setWeatherLocation('hoboken')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const distToHoboken = Math.abs(latitude - 40.744) + Math.abs(longitude + 74.032)
        const distToNyc = Math.abs(latitude - 40.758) + Math.abs(longitude + 73.978)
        setWeatherLocation(distToNyc < distToHoboken ? 'nyc' : 'hoboken')
      },
      () => setWeatherLocation('hoboken'),
      { timeout: 5000 }
    )
  }, [showWeather, weatherZip])
  /* eslint-enable react-hooks/set-state-in-effect */

  const weatherFetcher = useCallback(() => {
    if (weatherLocation === 'zip' && resolvedZipLocation) {
      return fetchWeather(resolvedZipLocation)
    }
    return fetchWeather(weatherLocation || 'hoboken')
  }, [weatherLocation, resolvedZipLocation])
  const tunnelFetcher = useCallback(async () => {
    // Always fetch both directions
    const [out, inb] = await Promise.all([
      fetchTunnels('outbound', tunnelFilter),
      fetchTunnels('inbound', tunnelFilter),
    ])
    // Merge: show each tunnel with both directions
    const merged = (out.tunnels || []).map((t, i) => {
      const inTunnel = (inb.tunnels || [])[i]
      return {
        ...t,
        outbound: { crossingMinutes: t.crossingMinutes, speed: t.speed, severity: t.severity },
        inbound: inTunnel ? { crossingMinutes: inTunnel.crossingMinutes, speed: inTunnel.speed, severity: inTunnel.severity } : null,
        bidirectional: true,
      }
    })
    return { tunnels: merged }
  }, [tunnelFilter])

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
        {showTunnels && !tunnelData && tunnelFilter.length === 1 && (
          <div className="ms-info-pill ms-tunnel-pill ms-tunnel-loading">
            <span className="ms-tunnel-skeleton-dot" />
            <span className="ms-tunnel-skeleton-dot" />
            <span className="ms-tunnel-skeleton-text" />
          </div>
        )}
        {showTunnels && filteredTunnels.length === 1 && filteredTunnels.map(t => {
          const tunnelName = t.name.toLowerCase()
          const hasActiveAlert = (activeAlerts || []).some(a =>
            a.id?.includes(`tunnel-${tunnelName}`) || a.text?.toLowerCase().includes(tunnelName)
          )
          return (
            <TunnelPill key={t.name} tunnel={t} hasAlert={hasActiveAlert} />
          )
        })}
      </div>

      {/* Tunnel pills on separate row when >1 */}
      {showTunnels && !tunnelData && tunnelFilter.length > 1 && (
        <div className="ms-info-row">
          {tunnelFilter.map(id => (
            <div key={id} className="ms-info-pill ms-tunnel-pill ms-tunnel-loading">
              <span className="ms-tunnel-skeleton-dot" />
              <span className="ms-tunnel-skeleton-dot" />
              <span className="ms-tunnel-skeleton-text" />
            </div>
          ))}
        </div>
      )}
      {showTunnels && filteredTunnels.length > 1 && (
        <div className="ms-info-row">
          {filteredTunnels.map(t => {
            const tunnelName = t.name.toLowerCase()
            const hasActiveAlert = (activeAlerts || []).some(a =>
              a.id?.includes(`tunnel-${tunnelName}`) || a.text?.toLowerCase().includes(tunnelName)
            )
            return (
              <TunnelPill key={t.name} tunnel={t} hasAlert={hasActiveAlert} />
            )
          })}
        </div>
      )}

      {/* Weather expanded card — Apple Weather style hourly scroll */}
      {showWeather && weatherExpanded && weatherData && (
        <div className="ms-weather-expand open">
          <div className="ms-wx-header">
            <span className="ms-wx-temp">{displayTemp(weatherNow.temp, unit)}</span>
            <span className="ms-wx-desc">{weatherNow.desc} · {weatherData.label}</span>
            <button className="ms-wx-close" onClick={() => setWeatherExpanded(false)}>✕</button>
          </div>
          <div className="ms-wx-stats">
            <span className="ms-wx-stat-item"><Thermometer size={13} className="ms-wx-stat-icon" /> Feels like {displayTemp(weatherNow.feelsLike, unit)}</span>
            <span className="ms-wx-stat-item"><Droplets size={13} className="ms-wx-stat-icon" /> {weatherNow.humidity}</span>
            <span className="ms-wx-stat-item"><Wind size={13} className="ms-wx-stat-icon" /> {weatherNow.wind}</span>
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

  // Bidirectional display
  if (tunnel.bidirectional && tunnel.inbound) {
    const outDotColor = severityColor(tunnel.outbound?.severity || tunnel.severity)
    const inDotColor = severityColor(tunnel.inbound.severity)
    const outMin = tunnel.outbound?.crossingMinutes || tunnel.crossingMinutes
    const inMin = tunnel.inbound.crossingMinutes
    const outSpeed = tunnel.outbound?.speed || tunnel.speed
    const inSpeed = tunnel.inbound.speed

    return (
      <div
        className={`ms-info-pill ms-tunnel-pill ${hasAlert ? 'ms-tunnel-alert' : ''} ${expanded ? 'expanded' : ''}`}
        onClick={() => {
          setExpanded(v => !v)
          if (!expanded) setTimeout(() => setExpanded(false), 6000)
        }}
      >
        {!expanded ? (
          <>
            <span className="ms-info-dot" style={{ background: outDotColor }} />
            <span className="ms-info-dot" style={{ background: inDotColor }} />
            {tunnel.name} {outMin}/{inMin}m
          </>
        ) : (
          <span className="ms-tunnel-expanded">
            <span className="ms-tunnel-expanded-name">{tunnel.name}</span>
            <span className="ms-tunnel-dir-row">
              <span className="ms-info-dot" style={{ background: outDotColor }} />
              <span className="ms-tunnel-dir-label">NJ→NY</span>
              <span className="ms-tunnel-dir-time">{outMin}m</span>
              <span className="ms-tunnel-dir-speed">{outSpeed || '—'} mph</span>
            </span>
            <span className="ms-tunnel-dir-row">
              <span className="ms-info-dot" style={{ background: inDotColor }} />
              <span className="ms-tunnel-dir-label">NY→NJ</span>
              <span className="ms-tunnel-dir-time">{inMin}m</span>
              <span className="ms-tunnel-dir-speed">{inSpeed || '—'} mph</span>
            </span>
          </span>
        )}
      </div>
    )
  }

  // Fallback: single-direction
  const dotColor = severityColor(tunnel.severity)

  return (
    <div
      className={`ms-info-pill ms-tunnel-pill ${hasAlert ? 'ms-tunnel-alert' : ''} ${expanded ? 'expanded' : ''}`}
      onClick={() => {
        setExpanded(v => !v)
        if (!expanded) setTimeout(() => setExpanded(false), 3000)
      }}
    >
      <span className="ms-info-dot" style={{ background: dotColor }} />
      {tunnel.name} {tunnel.crossingMinutes}m
      {expanded && <span className="ms-tunnel-speed">· {tunnel.speed || '—'} mph</span>}
    </div>
  )
}
