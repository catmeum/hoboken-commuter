import { useState, useRef } from 'react'

function AlertCard({ alert, onDismiss }) {
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
    <div className={`m-alert-card ${dismissing ? 'dismissing' : ''}`}>
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
              <span key={i} className="ms-badge" style={{ background: b.color, color: b.textColor || '#fff', minWidth: 18, height: 18, fontSize: 9 }}>
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

export default function AlertsPage({ alerts, dismissedAlerts, onDismiss, onDismissAll, onRestore }) {
  const [showDismissed, setShowDismissed] = useState(false)

  return (
    <div className="m-alerts-page">
      <div className="ms-header">
        <div className="ms-logo">MY<span className="m-accent">STOP</span>NOW</div>
        <div className="m-alerts-title">Alerts</div>
      </div>

      <div className="m-alerts-list">
        {alerts.length > 0 ? (
          <>
            {alerts.map((alert, i) => (
              <AlertCard key={`${alert.text}-${i}`} alert={alert} onDismiss={onDismiss} />
            ))}
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
