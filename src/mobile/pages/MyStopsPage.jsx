import { useState, useRef, useEffect } from 'react'
import TransitCard from '../components/TransitCard'
import InfoPills from '../components/InfoPills'

export default function MyStopsPage({ stops, stopNames, stopHiddenBadges, showWeather, showTunnels, tunnels, alerts, dismissedAlerts, tempUnit, weatherZip, onNavigateToAlerts }) {
  const [time, setTime] = useState(new Date())
  const [pullProgress, setPullProgress] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const containerRef = useRef(null)
  const pullStartY = useRef(0)
  const pulling = useRef(false)

  // Clock
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Pull-to-refresh touch handlers
  function handleTouchStart(e) {
    // Only enable pull if we're scrolled to the very top
    if (containerRef.current && containerRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY
      pulling.current = true
    } else {
      pulling.current = false
    }
  }

  function handleTouchMove(e) {
    if (!pulling.current) return
    const diff = e.touches[0].clientY - pullStartY.current
    if (diff > 0 && diff < 200) {
      const progress = Math.min(diff / 120, 1)
      setPullProgress(progress)
    }
  }

  function handleTouchEnd() {
    if (!pulling.current) return
    pulling.current = false
    if (pullProgress >= 0.8) {
      setRefreshKey(k => k + 1)
    }
    setPullProgress(0)
  }

  const timeStr = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  return (
    <div
      className="m-mystops-page"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="m-pull-indicator"
        style={{
          width: `${pullProgress * 100}%`,
          opacity: pullProgress > 0 ? Math.min(pullProgress * 1.5, 1) : 0,
        }}
      />

      <div className="ms-header">
        <div className="ms-logo">MY<span className="m-accent">STOP</span>NOW</div>
        <div className="ms-time">{timeStr}</div>
      </div>

      <div className="ms-cards">
        <InfoPills
          key={`info-${refreshKey}`}
          showWeather={showWeather}
          showTunnels={showTunnels}
          tunnelFilter={tunnels}
          activeAlerts={alerts}
          tempUnit={tempUnit}
          weatherZip={weatherZip}
        />

        {stops.length === 0 ? (
          <div className="ms-empty-state">
            <span className="ms-empty-icon">🚏</span>
            <p>No stops added yet.</p>
            <p className="ms-empty-hint">Open Settings to add transit stops.</p>
          </div>
        ) : (
          stops.map(stopId => (
            <TransitCard
              key={`${stopId}-${refreshKey}`}
              stopId={stopId}
              displayName={stopNames[stopId]}
              hiddenBadges={stopHiddenBadges?.[stopId]}
              alerts={alerts}
              dismissedAlerts={dismissedAlerts}
              onAlertTap={onNavigateToAlerts}
            />
          ))
        )}
      </div>
    </div>
  )
}
