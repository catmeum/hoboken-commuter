import { useState, useRef, useEffect } from 'react'

// ── Source matching helper (mirrors getAlertState in TransitCard) ──
function getSourceMatchers(stopId) {
  if (!stopId) return []
  if (stopId.startsWith('mta:')) return ['mta']
  if (stopId.startsWith('bus:') || /^\d/.test(stopId)) return ['bus']
  if (stopId.startsWith('path:')) return ['path']
  if (stopId.startsWith('ferry:')) return ['ferry']
  if (stopId.startsWith('rail:')) return ['rail', 'njt']
  if (stopId.startsWith('hblr:')) return ['hblr']
  if (stopId.startsWith('lirr:')) return ['lirr']
  if (stopId.startsWith('mnr:')) return ['mnr']
  if (stopId.startsWith('nycferry:')) return ['nycferry']
  if (stopId.startsWith('mtabus:')) return ['mtabus', 'mta']
  return []
}

// Extract bus routes from stop ID (e.g., bus:7917:126 → ['126'])
function getBusRoutes(stopId) {
  if (!stopId || !stopId.startsWith('bus:')) return []
  const parts = stopId.split(':')
  if (parts.length >= 3) return parts[2].split(',')
  return []
}

function alertMatchesSource(alert, sourceMatchers, stopId) {
  if (!sourceMatchers.length) return false
  const sourceMatch = sourceMatchers.some(s => alert.id?.includes(s) || alert.source?.toLowerCase().includes(s))
  if (!sourceMatch) return false
  // For bus alerts, additionally verify route overlap
  const busRoutes = getBusRoutes(stopId)
  if (busRoutes.length > 0 && alert.routes) {
    return alert.routes.some(r => busRoutes.includes(r))
  }
  return true
}

function AlertCard({ alert, onDismiss, highlighted, highlightRef }) {
  const startX = useRef(0)
  const [offset, setOffset] = useState(0)
  const [dismissing, setDismissing] = useState(false)

  function handleTouchStart(e) {
    startX.current = e.touches[0].clientX
  }

  function handleTouchMove(e) {
    const diff = e.touches[0].clientX - startX.current
    if (diff < -5) {
      setOffset(Math.max(diff, -100))
    }
  }

  function handleTouchEnd() {
    if (offset < -60) {
      setDismissing(true)
      setTimeout(() => onDismiss(alert), 300)
    } else {
      setOffset(0)
    }
  }

  return (
    <div ref={highlightRef} className={`m-alert-card ${dismissing ? 'dismissing' : ''} ${highlighted ? 'm-alert-highlight' : ''}`}>
      <div className="m-alert-dismiss-bg">Dismiss</div>
      <div
        className="m-alert-card-inner"
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.25s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="m-alert-head">
          <div className="m-alert-badges">
            {alert.badges ? alert.badges.map((b, i) => (
              <span key={i} className={`ms-badge ${b.color === 'transparent' ? 'm-alert-source-badge' : ''}`} style={{ background: b.color !== 'transparent' ? b.color : 'var(--m-card-border)', color: b.textColor || '#fff', minWidth: 18, height: 18, fontSize: 9, borderRadius: b.label?.length > 2 ? 5 : '50%', padding: b.label?.length > 2 ? '0 5px' : 0 }}>
                {b.label}
              </span>
            )) : (
              <span className="m-alert-source">{alert.source}</span>
            )}
          </div>
          <span className="m-alert-timestamp">{alert.timestamp || ''}</span>
        </div>
        <div className="m-alert-body">{alert.text}</div>
      </div>
    </div>
  )
}

export default function AlertsPage({ alerts, dismissedAlerts, onDismiss, onDismissAll, onRestore, highlightSource }) {
  const [showDismissed, setShowDismissed] = useState(false)
  const [highlightActive, setHighlightActive] = useState(!!highlightSource)

  // Clear highlight after 2.5 seconds
  useEffect(() => {
    if (!highlightSource) {
      setHighlightActive(false)
      return
    }
    setHighlightActive(true)
    const timer = setTimeout(() => {
      setHighlightActive(false)
    }, 2500)
    return () => clearTimeout(timer)
  }, [highlightSource])

  const sourceMatchers = getSourceMatchers(highlightSource)
  const firstHighlightRef = useRef(null)

  // Scroll to first highlighted alert
  useEffect(() => {
    if (highlightActive && firstHighlightRef.current) {
      setTimeout(() => {
        firstHighlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [highlightActive])

  return (
    <div className="m-alerts-page">
      <div className="ms-header">
        <div className="ms-logo">MY<span className="m-accent">STOP</span>NOW</div>
        <div className="m-alerts-title">Alerts</div>
      </div>

      <div className="m-alerts-list">
        {alerts.length > 0 ? (
          <>
            {alerts.map((alert, i) => {
              const isHighlighted = highlightActive && sourceMatchers.length > 0 && alertMatchesSource(alert, sourceMatchers, highlightSource)
              const isFirstHighlight = isHighlighted && !alerts.slice(0, i).some(a => alertMatchesSource(a, sourceMatchers, highlightSource))
              return (
                <AlertCard
                  key={`${alert.text}-${i}`}
                  alert={alert}
                  onDismiss={onDismiss}
                  highlighted={isHighlighted}
                  highlightRef={isFirstHighlight ? firstHighlightRef : null}
                />
              )
            })}
            {alerts.length > 1 && (
              <button className="m-dismiss-all-btn" onClick={onDismissAll}>
                Dismiss all
              </button>
            )}
          </>
        ) : (
          <div className="m-alerts-empty">
            <span className="m-alerts-empty-icon">✓</span>
            <p className="m-alerts-empty-text">No active alerts at the moment</p>
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <p className="m-alerts-hint">Swipe left to dismiss</p>
      )}

      {dismissedAlerts.length > 0 && (
        <div className="m-dismissed-section">
          <button className="m-dismissed-toggle" onClick={() => setShowDismissed(v => !v)}>
            <span className={`m-dismissed-arrow ${showDismissed ? 'open' : ''}`}>▸</span>
            Dismissed alerts <span className="m-dismissed-count">{dismissedAlerts.length}</span>
          </button>
          {showDismissed && (
            <div className="m-dismissed-list">
              {dismissedAlerts.map((alert, i) => (
                <div key={i} className="m-dismissed-card">
                  <div className="m-alert-head">
                    <div className="m-alert-badges">
                      {alert.badges ? alert.badges.map((b, j) => (
                        <span key={j} className="ms-badge" style={{ background: b.color, color: b.textColor || '#fff', minWidth: 18, height: 18, fontSize: 9 }}>
                          {b.label}
                        </span>
                      )) : (
                        <span className="m-alert-source">{alert.source}</span>
                      )}
                    </div>
                    <span className="m-alert-timestamp">{alert.timestamp || ''}</span>
                  </div>
                  <div className="m-alert-body">{alert.text}</div>
                  <div className="m-dismissed-actions">
                    <button className="m-dismissed-restore" onClick={() => onRestore(alert)}>Restore</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
