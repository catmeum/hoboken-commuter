

export default function TabBar({ activePage, onNavigate, alertCount, alertBadge }) {
  const isAlerts = activePage === 'alerts'

  return (
    <div className="m-tabbar">
      <div className={`m-tabbar-main ${isAlerts ? 'tab-alerts' : ''}`}>
        <button
          className={`m-tabbar-btn ${activePage === 'stops' ? 'active' : ''}`}
          onClick={() => onNavigate('stops')}
        >
          <span className="m-tabbar-icon">⌂</span>
          <span className="m-tabbar-label">My Stops</span>
        </button>
        <button
          className={`m-tabbar-btn ${activePage === 'alerts' ? 'active' : ''}`}
          onClick={() => onNavigate('alerts')}
        >
          <span className="m-tabbar-icon">△</span>
          <span className="m-tabbar-label">Alerts</span>
          {alertBadge !== 'off' && alertCount > 0 && (
            <span className={`m-tab-badge ${alertBadge === 'dot' ? 'dot-only' : ''}`}>
              {alertBadge === 'count' ? alertCount : ''}
            </span>
          )}
        </button>
      </div>
      <button className="m-tabbar-settings" onClick={() => onNavigate('settings')}>
        ⚙
      </button>
    </div>
  )
}
