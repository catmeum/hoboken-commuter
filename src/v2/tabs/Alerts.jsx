export default function Alerts({ alerts }) {
  if (alerts.length === 0) {
    return (
      <div className="v2-empty-state">
        <div className="v2-empty-icon">✓</div>
        <h2>All clear</h2>
        <p>No active alerts for your stops.</p>
      </div>
    )
  }

  return (
    <div className="v2-alerts">
      <h2 className="v2-section-title">Active Alerts</h2>
      {alerts.map((alert, i) => (
        <div key={i} className="v2-alert-card">
          <div className="v2-alert-head">
            {alert.routes && alert.routes.length > 0 && (
              <div className="v2-alert-badges">
                {alert.routes.slice(0, 4).map(r => (
                  <span key={r} className="v2-alert-badge">{r}</span>
                ))}
              </div>
            )}
            <span className="v2-alert-time">Active</span>
          </div>
          <div className="v2-alert-body">{alert.text || alert}</div>
        </div>
      ))}
      <p className="v2-alerts-hint">Only showing alerts for stops on your dashboard.</p>
    </div>
  )
}
